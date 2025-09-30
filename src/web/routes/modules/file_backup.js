const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authMiddleware } = require('../../../security/auth');
const { getPool } = require('../../../db/pool');

const router = express.Router();

// Backup directory configuration
const backupDir = path.join(__dirname, '../../../../backups');
const profileBackupDir = path.join(backupDir, 'profiles');
const resumeBackupDir = path.join(backupDir, 'resumes');

// Ensure backup directories exist
const ensureBackupDirectories = async () => {
  try {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.mkdir(profileBackupDir, { recursive: true });
    await fs.mkdir(resumeBackupDir, { recursive: true });
    console.log('Backup directories ensured');
  } catch (error) {
    console.error('Error creating backup directories:', error);
  }
};

// Initialize backup directories on module load
ensureBackupDirectories();

/**
 * Create backup of user files
 * @param {number} userId - User ID
 * @param {string} type - File type ('profile_image' or 'resume')
 * @param {Buffer} fileData - File data buffer
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type
 */
const createFileBackup = async (userId, type, fileData, filename, contentType) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${userId}_${timestamp}_${filename}`;
    
    let backupPath;
    if (type === 'profile_image') {
      backupPath = path.join(profileBackupDir, backupFilename);
    } else if (type === 'resume') {
      backupPath = path.join(resumeBackupDir, backupFilename);
    } else {
      throw new Error('Invalid file type for backup');
    }

    // Write file to backup directory
    await fs.writeFile(backupPath, fileData);
    
    // Create metadata file
    const metadataPath = backupPath + '.meta.json';
    const metadata = {
      userId,
      type,
      originalFilename: filename,
      contentType,
      backupDate: new Date().toISOString(),
      fileSize: fileData.length,
      backupPath: backupPath
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Backup created: ${backupPath}`);
    return backupPath;
    
  } catch (error) {
    console.error('Error creating file backup:', error);
    throw error;
  }
};

/**
 * Clean old backups (keep only last 5 versions per user per type)
 * @param {number} userId - User ID
 * @param {string} type - File type
 */
const cleanOldBackups = async (userId, type) => {
  try {
    const targetDir = type === 'profile_image' ? profileBackupDir : resumeBackupDir;
    const files = await fs.readdir(targetDir);
    
    // Filter files for this user and type
    const userFiles = files
      .filter(file => file.startsWith(`${userId}_`) && !file.endsWith('.meta.json'))
      .sort()
      .reverse(); // Most recent first
    
    // Keep only the 5 most recent files
    const filesToDelete = userFiles.slice(5);
    
    for (const file of filesToDelete) {
      const filePath = path.join(targetDir, file);
      const metaPath = filePath + '.meta.json';
      
      try {
        await fs.unlink(filePath);
        await fs.unlink(metaPath);
        console.log(`Deleted old backup: ${file}`);
      } catch (deleteError) {
        console.error(`Error deleting backup file ${file}:`, deleteError);
      }
    }
    
  } catch (error) {
    console.error('Error cleaning old backups:', error);
  }
};

/**
 * GET /api/file-backup/list/:userId
 * List all backups for a user
 */
router.get('/list/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own backups or admin access
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado para acceder a estos respaldos' });
    }
    
    const backups = {
      profile_images: [],
      resumes: []
    };
    
    // Get profile image backups
    try {
      const profileFiles = await fs.readdir(profileBackupDir);
      const userProfileFiles = profileFiles
        .filter(file => file.startsWith(`${userId}_`) && file.endsWith('.meta.json'))
        .sort()
        .reverse();
      
      for (const metaFile of userProfileFiles) {
        const metaPath = path.join(profileBackupDir, metaFile);
        const metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        backups.profile_images.push(metadata);
      }
    } catch (error) {
      console.error('Error reading profile backups:', error);
    }
    
    // Get resume backups
    try {
      const resumeFiles = await fs.readdir(resumeBackupDir);
      const userResumeFiles = resumeFiles
        .filter(file => file.startsWith(`${userId}_`) && file.endsWith('.meta.json'))
        .sort()
        .reverse();
      
      for (const metaFile of userResumeFiles) {
        const metaPath = path.join(resumeBackupDir, metaFile);
        const metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        backups.resumes.push(metadata);
      }
    } catch (error) {
      console.error('Error reading resume backups:', error);
    }
    
    res.json({
      success: true,
      backups,
      total: backups.profile_images.length + backups.resumes.length
    });
    
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al listar respaldos',
      details: error.message 
    });
  }
});

/**
 * POST /api/file-backup/restore
 * Restore a file from backup
 */
router.post('/restore', authMiddleware, async (req, res) => {
  try {
    const { backupPath, type } = req.body;
    const userId = req.user.id;
    
    if (!backupPath || !type) {
      return res.status(400).json({ error: 'Ruta de respaldo y tipo son requeridos' });
    }
    
    // Security check: ensure the backup belongs to the user
    if (!backupPath.includes(`${userId}_`)) {
      return res.status(403).json({ error: 'No autorizado para restaurar este respaldo' });
    }
    
    // Read backup file
    const fileData = await fs.readFile(backupPath);
    const metadataPath = backupPath + '.meta.json';
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    // Restore to database
    const pool = await getPool();
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();
      
      if (type === 'profile_image') {
        await transaction.request()
          .input('userId', userId)
          .input('fileData', fileData)
          .input('filename', metadata.originalFilename)
          .input('contentType', metadata.contentType)
          .input('restoreDate', new Date())
          .query(`
            UPDATE candidate_profiles 
            SET profile_picture_data = @fileData,
                profile_picture_filename = @filename,
                profile_picture_content_type = @contentType,
                updated_at = @restoreDate
            WHERE user_id = @userId;
          `);
      } else if (type === 'resume') {
        await transaction.request()
          .input('userId', userId)
          .input('fileData', fileData)
          .input('filename', metadata.originalFilename)
          .input('contentType', metadata.contentType)
          .input('restoreDate', new Date())
          .query(`
            UPDATE candidate_profiles 
            SET resume_data = @fileData,
                resume_filename = @filename,
                resume_content_type = @contentType,
                updated_at = @restoreDate
            WHERE user_id = @userId;
          `);
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        message: 'Archivo restaurado exitosamente desde el respaldo',
        restored: {
          filename: metadata.originalFilename,
          type: type,
          backupDate: metadata.backupDate
        }
      });
      
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
    
  } catch (error) {
    console.error('Error restoring from backup:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al restaurar desde respaldo',
      details: error.message 
    });
  }
});

module.exports = {
  router,
  createFileBackup,
  cleanOldBackups
};