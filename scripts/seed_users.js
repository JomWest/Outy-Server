require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool } = require('../src/db/pool');

async function ensureAdmin(pool) {
  const email = 'admin@outy.local';
  const password = 'Outy123!';
  const role = 'empleador';
  const phone = '50570000000';

  const exists = await pool.request().input('email', email).query('SELECT COUNT(1) AS c FROM users WHERE email = @email');
  if (exists.recordset[0].c > 0) {
    console.log(`Admin ya existe: ${email}`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.request()
    .input('email', email)
    .input('password_hash', hash)
    .input('role', role)
    .input('phone_number', phone)
    .query('INSERT INTO users (email, password_hash, role, phone_number) OUTPUT INSERTED.id AS id VALUES (@email, @password_hash, @role, @phone_number)');
  console.log(`Admin creado: ${email} id=${r.recordset[0].id}`);
}

function makeUser(i) {
  const roles = ['candidato', 'empleador'];
  const role = roles[i % roles.length];
  return {
    email: `user${i}@example.com`,
    password: `User${i}#2024`,
    role,
    phone: `5057${String(1000000 + i).slice(-7)}`,
  };
}

async function insertUsers(pool, count = 20) {
  for (let i = 1; i <= count; i++) {
    const u = makeUser(i);
    const already = await pool.request().input('email', u.email).query('SELECT COUNT(1) AS c FROM users WHERE email = @email');
    if (already.recordset[0].c > 0) {
      console.log(`Existe, omitido: ${u.email}`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const r = await pool.request()
      .input('email', u.email)
      .input('password_hash', hash)
      .input('role', u.role)
      .input('phone_number', u.phone)
      .query('INSERT INTO users (email, password_hash, role, phone_number) OUTPUT INSERTED.id AS id VALUES (@email, @password_hash, @role, @phone_number)');
    console.log(`Usuario creado: ${u.email} role=${u.role} id=${r.recordset[0].id}`);
  }
}

async function main() {
  try {
    const pool = await getPool();
    console.log('Conexión a SQL OK');
    await ensureAdmin(pool);
    await insertUsers(pool, 20);
    const total = await pool.request().query('SELECT COUNT(1) AS total FROM users');
    console.log(`Total usuarios en DB: ${total.recordset[0].total}`);
    process.exit(0);
  } catch (err) {
    console.error('Error en seed:', err);
    process.exit(1);
  }
}

main();