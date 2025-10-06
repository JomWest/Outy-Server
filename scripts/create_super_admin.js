require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../src/db/pool');

(async () => {
  try {
    const pool = await getPool();

    // Check if an admin already exists
    const check = await pool.request().query(`
      SELECT TOP 1 id, email FROM users WHERE role = 'admin'
    `);
    if (check.recordset && check.recordset.length > 0) {
      console.log('Ya existe un admin:', check.recordset[0].email);
      return;
    }

    const email = process.env.ADMIN_EMAIL || 'admin@outy.local';
    const password = process.env.ADMIN_PASSWORD || 'Outy123!';
    const phone = process.env.ADMIN_PHONE || '+50570000002';
    const hash = await bcrypt.hash(password, 10);

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
  } catch (err) {
    console.error('Error creando admin:', err?.message || err);
    process.exitCode = 1;
  }
})();