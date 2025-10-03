const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require('../src/db/pool');

async function main() {
  const pool = await getPool();
  const total = await pool.request().query('SELECT COUNT(*) AS total FROM locations_nicaragua');
  const byDept = await pool
    .request()
    .query(
      `SELECT department, COUNT(*) AS cnt
       FROM locations_nicaragua
       GROUP BY department
       ORDER BY department`
    );
  const sample = await pool
    .request()
    .query(
      `SELECT TOP 15 department, municipality
       FROM locations_nicaragua
       ORDER BY department, municipality`
    );
  console.log('Total rows:', total.recordset?.[0]?.total ?? 0);
  console.log('Counts by department:');
  for (const row of byDept.recordset) {
    console.log(` - ${row.department}: ${row.cnt}`);
  }
  console.log('Sample rows:');
  for (const row of sample.recordset) {
    console.log(` - ${row.department} / ${row.municipality}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Check failed:', err);
    process.exit(1);
  });