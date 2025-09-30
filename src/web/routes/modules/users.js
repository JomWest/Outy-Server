const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../../../db/pool');
const { users: userSchema } = require('../../validation/schemas');
const { authMiddleware } = require('../../../security/auth');
const { createWelcomeMessageForNewUser } = require('../../../../create_welcome_message_system');

const router = express.Router();

// Validation helper
const validateBody = (req, res, next) => {
  try {
    req.body = userSchema.parse(req.body);
    next();
  } catch (e) {
    e.status = 400;
    e.details = e.errors || e.message;
    next(e);
  }
};

/** CREATE USER - Special handling for password hashing */
router.post('/', validateBody, async (req, res, next) => {
  try {
    const { email, password_hash, role, phone_number } = req.body;
    
    // Check if user already exists
    const pool = await getPool();
    const existingUser = await pool.request()
      .input('email', email)
      .query('SELECT COUNT(1) AS count FROM users WHERE email = @email');
    
    if (existingUser.recordset[0].count > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password_hash, 10);
    
    // Insert new user
    const result = await pool.request()
      .input('email', email)
      .input('password_hash', hashedPassword)
      .input('role', role)
      .input('phone_number', phone_number)
      .query(`
        INSERT INTO users (email, password_hash, role, phone_number) 
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.phone_number, INSERTED.created_at
        VALUES (@email, @password_hash, @role, @phone_number)
      `);
    
    const newUser = result.recordset[0];
    
    // Create welcome message for new candidate users
    if (role === 'candidato') {
      try {
        await createWelcomeMessageForNewUser(newUser.id);
      } catch (welcomeErr) {
        console.error('Error creating welcome message:', welcomeErr.message);
        // Don't fail user creation if welcome message fails
      }
    }
    
    res.status(201).json(newUser);
  } catch (err) { 
    next(err); 
  }
});

/** GET ALL USERS */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, email, role, phone_number, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) { 
    next(err); 
  }
});

/** GET USERS FOR CHAT - Differentiate between employees and candidates */
router.get('/chat/list', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        id, 
        email, 
        role, 
        phone_number, 
        created_at,
        CASE 
          WHEN role = 'empleado' THEN 'Empleado'
          WHEN role = 'candidato' THEN 'Candidato'
          ELSE 'Usuario'
        END as role_display
      FROM users 
      WHERE role IN ('empleado', 'candidato')
      ORDER BY role, created_at DESC
    `);
    
    // Group users by role for better organization
    const employees = result.recordset.filter(user => user.role === 'empleado');
    const candidates = result.recordset.filter(user => user.role === 'candidato');
    
    res.json({
      employees,
      candidates,
      all: result.recordset
    });
  } catch (err) { 
    next(err); 
  }
});

/** GET USER BY ID */
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT id, email, role, phone_number, created_at 
        FROM users 
        WHERE id = @id
      `);
    
    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (err) { 
    next(err); 
  }
});

/** UPDATE USER */
router.put('/:id', authMiddleware, validateBody, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password_hash, role, phone_number } = req.body;
    
    // Hash password if provided
    const hashedPassword = password_hash ? await bcrypt.hash(password_hash, 10) : undefined;
    
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .input('email', email)
      .input('password_hash', hashedPassword || password_hash)
      .input('role', role)
      .input('phone_number', phone_number)
      .query(`
        UPDATE users 
        SET email = @email, 
            password_hash = @password_hash, 
            role = @role, 
            phone_number = @phone_number
        WHERE id = @id;
        
        SELECT id, email, role, phone_number, created_at 
        FROM users 
        WHERE id = @id;
      `);
    
    const user = result.recordsets[1][0];
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (err) { 
    next(err); 
  }
});

/** DELETE USER */
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .query('DELETE FROM users WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.status(204).end();
  } catch (err) { 
    next(err); 
  }
});

/** GET USERS FOR CHAT - Get all users except current user for chat list */
router.get('/chat/list', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('currentUserId', req.user.id)
      .query(`
        SELECT id, email, role, phone_number, created_at 
        FROM users 
        WHERE id != @currentUserId
        ORDER BY created_at DESC
      `);
    
    res.json(result.recordset);
  } catch (err) { 
    next(err); 
  }
});

module.exports = router;