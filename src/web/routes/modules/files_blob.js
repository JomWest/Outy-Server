const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { authMiddleware } = require('../../../security/auth');
const { getPool } = require('../../../db/pool');
const { createFileBackup, cleanOldBackups } = require('./file_backup');

const router = express.Router();

// Enhanced file type validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'profile_image': ['image/jpeg', 'image/png', 'image/jpg'],
    'resume': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  const fileType = req.body.type || req.query.type;
  
  if (!fileType || !allowedTypes[fileType]) {
    return cb(new Error('Tipo de archivo no especificado o inválido'), false);
  }

  if (!allowedTypes[fileType].includes(file.mimetype)) {
    return cb(new Error(`Tipo de archivo no permitido para ${fileType}. Tipos permitidos: ${allowedTypes[fileType].join(', ')}`), false);
  }

  // Additional filename validation
  if (!file.originalname || file.originalname.length > 255) {
    return cb(new Error('Nombre de archivo inválido o muy largo'), false);
  }

  // Check for potentially dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs'];
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  if (dangerousExtensions.includes(`.${fileExtension}`)) {
    return cb(new Error('Extensión de archivo no permitida por seguridad'), false);
  }

  cb(null, true);
};

// Storage configuration - using memory storage for processing
const storage = multer.memoryStorage();

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

/**
 * POST /api/files-blob/upload
 * Upload a file and store it as BLOB in database
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    // Get type from query parameter or body
    const typeFromQuery = req.query.type;
    const typeFromBody = req.body.type;
    const type = typeFromQuery || typeFromBody;
    const userId = req.user.id;
    
    console.log(`Upload request - typeFromQuery: ${typeFromQuery}, typeFromBody: ${typeFromBody}, final type: ${type}, userId: ${userId}, filename: ${req.file.originalname}`);
    console.log('req.query:', JSON.stringify(req.query));
    console.log('req.body:', JSON.stringify(req.body));
    
    if (!type || !['profile_image', 'resume'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de archivo no especificado o inválido' });
    }
    
    // Enhanced file size validation based on type
    const maxSizes = {
      'profile_image': 5 * 1024 * 1024, // 5MB
      'resume': 10 * 1024 * 1024, // 10MB
    };

    if (req.file.size > maxSizes[type]) {
      return res.status(400).json({ 
        error: `El archivo excede el tamaño máximo permitido para ${type} (${Math.round(maxSizes[type] / (1024 * 1024))}MB)` 
      });
    }

    // Minimum file size validation (avoid empty or corrupted files)
    const minSizes = {
      'profile_image': 1024, // 1KB minimum
      'resume': 1024 // 1KB minimum
    };

    if (req.file.size < minSizes[type]) {
      return res.status(400).json({ 
        error: `El archivo es demasiado pequeño. Tamaño mínimo: ${minSizes[type]} bytes` 
      });
    }

    const originalName = req.file.originalname;
    const contentType = req.file.mimetype;
    let processedBuffer = req.file.buffer;

    // Enhanced processing based on type
    if (type === 'profile_image') {
      try {
        // Validate image dimensions and format
        const imageMetadata = await sharp(req.file.buffer).metadata();
        
        // Check minimum dimensions
        if (imageMetadata.width < 50 || imageMetadata.height < 50) {
          return res.status(400).json({ 
            error: 'La imagen debe tener al menos 50x50 píxeles' 
          });
        }

        // Check maximum dimensions
        if (imageMetadata.width > 4000 || imageMetadata.height > 4000) {
          return res.status(400).json({ 
            error: 'La imagen no puede exceder 4000x4000 píxeles' 
          });
        }

        // Resize and optimize profile image
        processedBuffer = await sharp(req.file.buffer)
          .resize(300, 300, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ 
            quality: 85,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();

        console.log(`Image processed: original ${req.file.size} bytes, processed ${processedBuffer.length} bytes`);
        
      } catch (sharpError) {
        console.error('Error processing image:', sharpError);
        return res.status(400).json({ 
          error: 'El archivo no es una imagen válida o está corrupto' 
        });
      }
    } else if (type === 'resume') {
      // Additional validation for PDF files
      if (contentType === 'application/pdf') {
        // Basic PDF header validation
        const pdfHeader = req.file.buffer.slice(0, 4).toString();
        if (pdfHeader !== '%PDF') {
          return res.status(400).json({ 
            error: 'El archivo PDF parece estar corrupto' 
          });
        }
      }
    }

    // Store file in database with enhanced security
    const pool = await getPool();
    const request = pool.request();
    
    console.log(`Storing ${type} for user ${userId}, filename: ${originalName}, size: ${processedBuffer.length}`);
    
    // Sanitize filename for database storage
    const sanitizedFilename = originalName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 255);
    
    if (type === 'profile_image') {
      // Update or insert profile image with transaction for data integrity
      const transaction = pool.transaction();
      
      try {
        await transaction.begin();
        
        console.log('Attempting to update profile image...');
        const result = await transaction.request()
          .input('userId', userId)
          .input('fileData', processedBuffer)
          .input('filename', sanitizedFilename)
          .input('contentType', 'image/jpeg') // Always JPEG after processing
          .input('uploadDate', new Date())
          .query(`
            UPDATE candidate_profiles 
            SET profile_picture_data = @fileData,
                profile_picture_filename = @filename,
                profile_picture_content_type = @contentType,
                updated_at = @uploadDate
            WHERE user_id = @userId;
            
            SELECT @@ROWCOUNT as updated_rows;
          `);
        
        console.log(`Profile image update result: ${result.recordset[0].updated_rows} rows affected`);
        
        if (result.recordset[0].updated_rows === 0) {
          console.log('No existing profile found, creating new one...');
          const insertResult = await transaction.request()
            .input('userId', userId)
            .input('fileData', processedBuffer)
            .input('filename', sanitizedFilename)
            .input('contentType', 'image/jpeg')
            .input('uploadDate', new Date())
            .query(`
              INSERT INTO candidate_profiles (
                user_id, 
                full_name, 
                profile_picture_data, 
                profile_picture_filename, 
                profile_picture_content_type,
                created_at,
                updated_at
              )
              VALUES (
                @userId, 
                'New User', 
                @fileData, 
                @filename, 
                @contentType,
                @uploadDate,
                @uploadDate
              );
            `);
          console.log('New profile created with image, rows affected:', insertResult.rowsAffected);
        }
        
        await transaction.commit();
        
        // Create backup after successful database storage
        try {
          await createFileBackup(userId, type, processedBuffer, sanitizedFilename, 'image/jpeg');
          await cleanOldBackups(userId, type);
          console.log(`Backup created for ${type} of user ${userId}`);
        } catch (backupError) {
          console.error('Error creating backup (non-critical):', backupError);
          // Don't fail the upload if backup fails
        }
        
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
      
    } else if (type === 'resume') {
      // Update or insert resume with transaction for data integrity
      const transaction = pool.transaction();
      
      try {
        await transaction.begin();
        
        console.log('Attempting to update resume...');
        const result = await transaction.request()
          .input('userId', userId)
          .input('fileData', processedBuffer)
          .input('filename', sanitizedFilename)
          .input('contentType', contentType)
          .input('uploadDate', new Date())
          .query(`
            UPDATE candidate_profiles 
            SET resume_data = @fileData,
                resume_filename = @filename,
                resume_content_type = @contentType,
                updated_at = @uploadDate
            WHERE user_id = @userId;
            
            SELECT @@ROWCOUNT as updated_rows;
          `);
        
        console.log(`Resume update result: ${result.recordset[0].updated_rows} rows affected`);
        
        if (result.recordset[0].updated_rows === 0) {
          console.log('No existing profile found, creating new one...');
          const insertResult = await transaction.request()
            .input('userId', userId)
            .input('fileData', processedBuffer)
            .input('filename', sanitizedFilename)
            .input('contentType', contentType)
            .input('uploadDate', new Date())
            .query(`
              INSERT INTO candidate_profiles (
                user_id, 
                full_name, 
                resume_data, 
                resume_filename, 
                resume_content_type,
                created_at,
                updated_at
              )
              VALUES (
                @userId, 
                'New User', 
                @fileData, 
                @filename, 
                @contentType,
                @uploadDate,
                @uploadDate
              );
            `);
          console.log('New profile created with resume, rows affected:', insertResult.rowsAffected);
        }
        
        await transaction.commit();
        
        // Create backup after successful database storage
        try {
          await createFileBackup(userId, type, processedBuffer, sanitizedFilename, contentType);
          await cleanOldBackups(userId, type);
          console.log(`Backup created for ${type} of user ${userId}`);
        } catch (backupError) {
          console.error('Error creating backup (non-critical):', backupError);
          // Don't fail the upload if backup fails
        }
        
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }
    }

    res.json({
      success: true,
      message: 'Archivo guardado exitosamente en la base de datos',
      filename: originalName,
      size: processedBuffer.length,
      type: type,
      stored_as: 'blob'
    });

  } catch (error) {
    console.error('Error uploading file to database:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al guardar el archivo',
      details: error.message 
    });
  }
});

/**
 * GET /api/files-blob/:type/:userId
 * Retrieve a file from database
 */
router.get('/:type/:userId', async (req, res) => {
  try {
    const { type, userId } = req.params;
    const token = req.query.token;
    
    console.log(`Retrieving ${type} for user ${userId} with token: ${token ? 'provided' : 'missing'}`);
    
    // Validate token if provided
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`Token validated for user: ${decoded.sub}`);
      } catch (tokenError) {
        console.error('Token validation error:', tokenError.message);
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
    }
    
    if (!['profile_image', 'resume'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de archivo inválido' });
    }

    const pool = await getPool();
    const request = pool.request();
    
    let query, dataField, filenameField, contentTypeField;
    
    if (type === 'profile_image') {
      dataField = 'profile_picture_data';
      filenameField = 'profile_picture_filename';
      contentTypeField = 'profile_picture_content_type';
    } else {
      dataField = 'resume_data';
      filenameField = 'resume_filename';
      contentTypeField = 'resume_content_type';
    }
    
    query = `SELECT ${dataField} as file_data, ${filenameField} as filename, ${contentTypeField} as content_type FROM candidate_profiles WHERE user_id = @userId`;
    
    console.log(`Executing query: ${query} with userId: ${userId}`);
    
    const result = await request
      .input('userId', userId)
      .query(query);

    console.log(`Query result: ${result.recordset.length} records found`);
    
    if (result.recordset.length > 0) {
      console.log(`File data exists: ${!!result.recordset[0].file_data}, filename: ${result.recordset[0].filename}`);
    }

    if (!result.recordset.length || !result.recordset[0].file_data) {
      console.log('File not found in database');
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = result.recordset[0];
    
    console.log(`Sending file: ${fileData.filename}, size: ${fileData.file_data.length}`);
    
    // Set CORS headers explicitly for file responses
    res.set({
      'Content-Type': fileData.content_type,
      'Content-Disposition': `inline; filename="${fileData.filename}"`,
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    
    res.send(fileData.file_data);

  } catch (error) {
    console.error('Error retrieving file from database:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al recuperar el archivo',
      details: error.message 
    });
  }
});

module.exports = router;