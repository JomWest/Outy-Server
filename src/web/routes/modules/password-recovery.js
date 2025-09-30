const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('../../../db/pool');

const router = express.Router();

// In-memory store for recovery codes (in production, use Redis or database)
const recoveryCodes = new Map();

// Generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * @openapi
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Solicitar código de recuperación de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               nombre:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código enviado exitosamente
 */
router.post('/request-password-reset', async (req, res, next) => {
  try {
    const { email, nombre } = req.body;
    
    if (!email || !nombre) {
      return res.status(400).json({ error: 'Email y nombre son requeridos' });
    }

    // Check if user exists
    const pool = await getPool();
    const result = await pool.request()
      .input('email', email.toLowerCase().trim())
      .query('SELECT id, email FROM users WHERE email = @email');
    
    const user = result.recordset[0];
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'Si el email existe, se ha enviado un código de recuperación' });
    }

    // Generate recovery code
    const code = generateCode();
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes

    // Store code (in production, save to database)
    recoveryCodes.set(email.toLowerCase().trim(), {
      code,
      expiresAt,
      userId: user.id,
      attempts: 0
    });

    // TODO: Send email with code (for now, log it)
    console.log(`Recovery code for ${email}: ${code}`);

    res.json({ message: 'Código de recuperación enviado' });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/verify-reset-code:
 *   post:
 *     summary: Verificar código de recuperación
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código verificado exitosamente
 */
router.post('/verify-reset-code', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son requeridos' });
    }

    const emailKey = email.toLowerCase().trim();
    const storedData = recoveryCodes.get(emailKey);

    if (!storedData) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      recoveryCodes.delete(emailKey);
      return res.status(400).json({ error: 'Código expirado' });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      recoveryCodes.delete(emailKey);
      return res.status(400).json({ error: 'Demasiados intentos fallidos' });
    }

    // Verify code
    if (storedData.code !== code) {
      storedData.attempts++;
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes

    // Store reset token
    recoveryCodes.set(`reset_${emailKey}`, {
      token: resetToken,
      expiresAt: resetExpiresAt,
      userId: storedData.userId
    });

    // Remove verification code
    recoveryCodes.delete(emailKey);

    res.json({ 
      message: 'Código verificado exitosamente',
      resetToken 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ error: 'Email, token y nueva contraseña son requeridos' });
    }

    if (newPassword.length < 10) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres' });
    }

    const emailKey = email.toLowerCase().trim();
    const storedData = recoveryCodes.get(`reset_${emailKey}`);

    if (!storedData) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      recoveryCodes.delete(`reset_${emailKey}`);
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Verify token
    if (storedData.token !== resetToken) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', storedData.userId)
      .input('password_hash', hashedPassword)
      .query('UPDATE users SET password_hash = @password_hash WHERE id = @userId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Remove reset token
    recoveryCodes.delete(`reset_${emailKey}`);

    res.json({ message: 'Contraseña restablecida exitosamente' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;