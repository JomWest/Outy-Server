const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../src/db/pool');

async function main() {
  try {
    const pool = await getPool();
    const meta = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'job_application_id'
    `);
    console.log('Column metadata:', meta.recordset);

    const constraints = await pool.request().query(`
      SELECT fk.name AS fk_name, fk.is_disabled, fk.is_not_trusted
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id = OBJECT_ID('dbo.reviews')
    `);
    console.log('Foreign keys on reviews:', constraints.recordset);

    const sample = await pool.request().query(`
      SELECT TOP 5 id, job_application_id FROM dbo.reviews ORDER BY created_at DESC
    `);
    console.log('Latest reviews sample:', sample.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

main();