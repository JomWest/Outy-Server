const express = require('express');
const { getPool } = require('../../../db/pool');
const { authMiddleware } = require('../../../security/auth');

const router = express.Router();

/**
 * @openapi
 * /api/candidate_profiles/validate/name:
 *   post:
 *     summary: Validar si un nombre completo ya existe
 *     tags: [Candidate Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 description: Nombre completo a validar
 *               exclude_user_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID del usuario a excluir de la búsqueda (para actualizaciones)
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: Si el nombre ya existe
 *                 message:
 *                   type: string
 *                   description: Mensaje descriptivo
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Sugerencias de nombres alternativos
 */
router.post('/validate/name', authMiddleware, async (req, res, next) => {
  try {
    const { full_name, exclude_user_id } = req.body;
    
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ 
        error: 'El nombre completo es requerido' 
      });
    }

    const trimmedName = full_name.trim();
    const pool = await getPool();
    
    // Buscar nombres exactos y similares
    let query = `
      SELECT user_id, full_name 
      FROM candidate_profiles 
      WHERE LOWER(TRIM(full_name)) = LOWER(@fullName)
    `;
    
    const request = pool.request().input('fullName', trimmedName);
    
    // Excluir el usuario actual si se proporciona (para actualizaciones)
    if (exclude_user_id) {
      query += ` AND user_id != @excludeUserId`;
      request.input('excludeUserId', exclude_user_id);
    }
    
    const exactMatches = await request.query(query);
    
    // Buscar nombres similares para sugerencias
    const similarQuery = `
      SELECT TOP 3 full_name 
      FROM candidate_profiles 
      WHERE LOWER(full_name) LIKE LOWER(@similarPattern)
        AND LOWER(TRIM(full_name)) != LOWER(@fullName)
        ${exclude_user_id ? 'AND user_id != @excludeUserId' : ''}
      ORDER BY LEN(full_name)
    `;
    
    const similarRequest = pool.request()
      .input('fullName', trimmedName)
      .input('similarPattern', `%${trimmedName.split(' ')[0]}%`);
    
    if (exclude_user_id) {
      similarRequest.input('excludeUserId', exclude_user_id);
    }
    
    const similarMatches = await similarRequest.query(similarQuery);
    
    const exists = exactMatches.recordset.length > 0;
    let message = '';
    let suggestions = [];
    
    if (exists) {
      message = `Ya existe un candidato con el nombre "${trimmedName}". Te recomendamos usar un nombre más específico.`;
      
      // Generar sugerencias basadas en el nombre original
      const nameParts = trimmedName.split(' ');
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        suggestions = [
          `${firstName} ${lastName} (Segundo nombre)`,
          `${trimmedName} Jr.`,
          `${trimmedName} (Ciudad/Apellido materno)`
        ];
      }
      
      // Agregar nombres similares como referencia
      if (similarMatches.recordset.length > 0) {
        suggestions.push('--- Nombres similares existentes ---');
        similarMatches.recordset.forEach(row => {
          suggestions.push(`⚠️ ${row.full_name}`);
        });
      }
    } else {
      message = `El nombre "${trimmedName}" está disponible.`;
      
      // Mostrar nombres similares como advertencia preventiva
      if (similarMatches.recordset.length > 0) {
        message += ' Sin embargo, existen nombres similares.';
        suggestions = ['--- Nombres similares existentes ---'];
        similarMatches.recordset.forEach(row => {
          suggestions.push(`ℹ️ ${row.full_name}`);
        });
      }
    }
    
    res.json({
      exists,
      message,
      suggestions,
      checked_name: trimmedName
    });
    
  } catch (error) {
    console.error('Error validating name:', error);
    next(error);
  }
});

module.exports = router;