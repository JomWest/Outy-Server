require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../src/db/pool');

(async () => {
  try {
    const pool = await getPool();

    const email = process.env.ADMIN_EMAIL || process.argv[2];
    const password = process.env.ADMIN_PASSWORD || process.argv[3];
    const phone = process.env.ADMIN_PHONE || process.argv[4] || '+50570000003';

    if (!email || !password) {
      console.error('Faltan parámetros: use ADMIN_EMAIL y ADMIN_PASSWORD o pase email y password como argumentos');
      process.exitCode = 1;
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    // ¿Existe ya el usuario con ese email?
    const existing = await pool.request()
      .input('email', sql.NVarChar(320), email)
      .query(`SELECT TOP 1 id, email, role FROM users WHERE email = @email`);

    if (existing.recordset && existing.recordset.length > 0) {
      // Actualizar a admin y cambiar contraseña
      const r = await pool.request()
        .input('email', sql.NVarChar(320), email)
        .input('password_hash', sql.NVarChar(500), hash)
        .input('role', sql.NVarChar(50), 'admin')
        .query(`
          UPDATE users
          SET password_hash = @password_hash, role = @role
          WHERE email = @email;
        `);
      console.log('Usuario existente actualizado a admin:', email);
    } else {
      // Insertar nuevo admin
      const r = await pool.request()
        .input('email', sql.NVarChar(320), email)
        .input('password_hash', sql.NVarChar(500), hash)
        .input('role', sql.NVarChar(50), 'admin')
        .input('phone_number', sql.NVarChar(50), phone)
        .query(`
          INSERT INTO users (email, password_hash, role, phone_number)
          OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
          VALUES (@email, @password_hash, @role, @phone_number)
        `);
      console.log('Admin creado:', r.recordset[0]);
    }
  } catch (err) {
    console.error('Error creando/actualizando admin:', err?.message || err);
    process.exitCode = 1;
  }
})();