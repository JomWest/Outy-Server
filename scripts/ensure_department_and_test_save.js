const path = require('path');
const dotenv = require('dotenv');
// Load env from Outy-Server/.env so the DB connection works when run from repo root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../src/db/pool');

async function ensureDepartmentColumn(pool) {
  const check = await pool.request()
    .input('table', sql.NVarChar(128), 'candidate_profiles')
    .input('column', sql.NVarChar(128), 'department')
    .query(`
      SELECT 1 AS col_exists
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @table AND COLUMN_NAME = @column
    `);
  const exists = check.recordset && check.recordset.length > 0;
  if (!exists) {
    console.log('Column department not found. Adding NVARCHAR(100) NULL...');
    await pool.request().query(`ALTER TABLE candidate_profiles ADD department NVARCHAR(100) NULL;`);
    console.log('Column department added.');
  } else {
    console.log('Column department already exists.');
  }
}

async function upsertDepartmentForAdmin(pool, departmentValue) {
  const admin = await pool.request()
    .input('email', sql.NVarChar(320), 'admin@outy.local')
    .query(`SELECT TOP 1 id FROM users WHERE email = @email`);
  if (!admin.recordset || admin.recordset.length === 0) {
    throw new Error('Admin user not found (admin@outy.local). Run seed:users first.');
  }
  const userId = admin.recordset[0].id;
  console.log('Admin user id:', userId);

  const profileCheck = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`SELECT TOP 1 user_id FROM candidate_profiles WHERE user_id = @userId`);

  if (profileCheck.recordset && profileCheck.recordset.length > 0) {
    console.log('Candidate profile exists. Updating department...');
    const r = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('department', sql.NVarChar(100), departmentValue)
      .query(`UPDATE candidate_profiles SET department = @department, updated_at = GETDATE() WHERE user_id = @userId`);
    console.log('Rows affected (update):', r.rowsAffected && r.rowsAffected[0]);
  } else {
    console.log('Candidate profile not found. Creating minimal profile with department...');
    const r = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('full_name', sql.NVarChar(200), 'Administrador Outy')
      .input('department', sql.NVarChar(100), departmentValue)
      .query(`
        INSERT INTO candidate_profiles (user_id, full_name, department, created_at, updated_at)
        VALUES (@userId, @full_name, @department, GETDATE(), GETDATE());
      `);
    console.log('Rows affected (insert):', r.rowsAffected && r.rowsAffected[0]);
  }

  const verify = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`SELECT TOP 1 user_id, full_name, department FROM candidate_profiles WHERE user_id = @userId`);
  const row = verify.recordset && verify.recordset[0];
  console.log('Verification result:', row);
  return row;
}

async function main() {
  try {
    const pool = await getPool();
    await ensureDepartmentColumn(pool);
    const departmentValue = process.argv[2] || 'Managua';
    const result = await upsertDepartmentForAdmin(pool, departmentValue);
    console.log(`\n✅ Department saved as "${result.department}" for user ${result.user_id}`);
    process.exit(0);
  } catch (err) {
    console.error('Error ensuring department and saving value:', err);
    process.exit(1);
  }
}

main();