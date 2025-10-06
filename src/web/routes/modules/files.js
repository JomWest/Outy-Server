const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { authMiddleware } = require('../../../security/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../../uploads');
const profileImagesDir = path.join(uploadsDir, 'profiles');
const resumesDir = path.join(uploadsDir, 'resumes');
const figanDir = path.join(uploadsDir, 'figan');

// Create directories if they don't exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(profileImagesDir, { recursive: true });
    await fs.mkdir(resumesDir, { recursive: true });
    await fs.mkdir(figanDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directories:', error);
  }
};

ensureDirectories();

// File type validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'profile_image': ['image/jpeg', 'image/png', 'image/jpg'],
    'resume': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    // FIGAN admite imágenes, documentos y videos comunes
    'figan': [
      // documentos
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // imágenes
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
      // videos
      'video/mp4',
      'video/quicktime', // .mov
      'video/webm',
      'video/x-matroska', // .mkv
      'video/3gpp',
      'video/3gpp2',
      'video/x-msvideo' // .avi
    ]
  };

  const fileType = req.body.type || req.query.type;
  
  if (!fileType || !allowedTypes[fileType]) {
    return cb(new Error('Tipo de archivo no especificado o inválido'), false);
  }

  if (!allowedTypes[fileType].includes(file.mimetype)) {
    return cb(new Error(`Tipo de archivo no permitido para ${fileType}`), false);
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
 * POST /api/files/upload
 * Upload a file (profile image, resume, or FIGAN documents)
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const { type } = req.body;
    const userId = req.user.id;
    
    // Validate file size based on type
    const maxSizes = {
      'profile_image': 5 * 1024 * 1024, // 5MB
      'resume': 10 * 1024 * 1024, // 10MB
      'figan': 50 * 1024 * 1024 // 50MB
    };

    if (req.file.size > maxSizes[type]) {
      return res.status(400).json({ 
        error: `El archivo excede el tamaño máximo permitido para ${type}` 
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const extension = path.extname(originalName);
    
    let filePath;
    let processedBuffer = req.file.buffer;
    let filename;

    // Process files based on type
    if (type === 'profile_image') {
      // Resize and optimize profile image
      processedBuffer = await sharp(req.file.buffer)
        .resize(300, 300, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      filename = `${userId}_${timestamp}.jpg`;
      filePath = path.join(profileImagesDir, filename);
    } else if (type === 'resume') {
      filename = `${userId}_${timestamp}${extension}`;
      filePath = path.join(resumesDir, filename);
    } else if (type === 'figan') {
      filename = `${userId}_${timestamp}${extension}`;
      filePath = path.join(figanDir, filename);
    }

    // Save file to disk
    await fs.writeFile(filePath, processedBuffer);

    // Generate file URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const dirName = type === 'profile_image' ? 'profiles' : type;
    const fileUrl = `${baseUrl}/uploads/${dirName}/${filename}`;

    res.json({
      success: true,
      message: 'Archivo subido exitosamente',
      url: fileUrl,
      filename: filename,
      originalName: originalName,
      size: processedBuffer.length,
      type: type
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al subir el archivo',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/files/:filename
 * Delete a file
 */
router.delete('/:filename', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.params;
    const { type } = req.query;
    const userId = req.user.id;
    
    if (!type) {
      return res.status(400).json({ error: 'Tipo de archivo requerido' });
    }

    // Verify file belongs to user
    if (!filename.startsWith(`${userId}_`)) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este archivo' });
    }

    let filePath;
    switch (type) {
      case 'profile_image':
        filePath = path.join(profileImagesDir, filename);
        break;
      case 'resume':
        filePath = path.join(resumesDir, filename);
        break;
      case 'figan':
        filePath = path.join(figanDir, filename);
        break;
      default:
        return res.status(400).json({ error: 'Tipo de archivo no válido' });
    }

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente'
      });
    } catch (error) {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al eliminar el archivo',
      details: error.message 
    });
  }
});

/**
 * GET /api/files/user/:userId
 * Get all files for a user
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fileType } = req.query;
    
    // Only allow users to see their own files or admin users
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para ver estos archivos' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const uploadDirs = {
      'profile_image': { dir: profileImagesDir, urlPath: 'profiles' },
      'resume': { dir: resumesDir, urlPath: 'resumes' },
      'figan': { dir: figanDir, urlPath: 'figan' }
    };

    let files = [];

    if (fileType && uploadDirs[fileType]) {
      // Get files of specific type
      try {
        const dirFiles = await fs.readdir(uploadDirs[fileType].dir);
        const userFiles = dirFiles.filter(file => file.startsWith(`${userId}_`));
        
        for (const file of userFiles) {
          const filePath = path.join(uploadDirs[fileType].dir, file);
          const stats = await fs.stat(filePath);
          files.push({
            filename: file,
            type: fileType,
            size: stats.size,
            url: `${baseUrl}/uploads/${uploadDirs[fileType].urlPath}/${file}`,
            uploadedAt: stats.mtime.toISOString()
          });
        }
      } catch (error) {
        // Directory might not exist, that's ok
      }
    } else {
      // Get all files for user
      for (const [type, config] of Object.entries(uploadDirs)) {
        try {
          const dirFiles = await fs.readdir(config.dir);
          const userFiles = dirFiles.filter(file => file.startsWith(`${userId}_`));
          
          for (const file of userFiles) {
            const filePath = path.join(config.dir, file);
            const stats = await fs.stat(filePath);
            files.push({
              filename: file,
              type: type,
              size: stats.size,
              url: `${baseUrl}/uploads/${config.urlPath}/${file}`,
              uploadedAt: stats.mtime.toISOString()
            });
          }
        } catch (error) {
          // Directory might not exist, ignore
        }
      }
    }

    res.json({
      success: true,
      files: files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    });
    
  } catch (error) {
    console.error('Error getting user files:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener los archivos',
      details: error.message 
    });
  }
});

module.exports = router;