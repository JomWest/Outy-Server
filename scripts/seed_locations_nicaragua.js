const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
// Load env from Outy-Server/.env so the DB connection works when run from repo root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require('../src/db/pool');

async function seed() {
  const pool = await getPool();
  const dataPath = path.join(__dirname, '..', 'data', 'locations_nicaragua.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const dataset = JSON.parse(raw);

  let inserted = 0;
  let skipped = 0;

  for (const dep of dataset.departments) {
    const department = String(dep.department || '').trim();
    if (!department) continue;
    for (const mun of dep.municipalities || []) {
      const municipality = String(mun || '').trim();
      if (!municipality) continue;

      const check = await pool
        .request()
        .input('department', department)
        .input('municipality', municipality)
        .query(
          'SELECT TOP 1 id FROM locations_nicaragua WHERE department = @department AND municipality = @municipality'
        );

      if (check.recordset && check.recordset.length > 0) {
        skipped++;
        continue;
      }

      await pool
        .request()
        .input('department', department)
        .input('municipality', municipality)
        .query(
          'INSERT INTO locations_nicaragua (department, municipality) VALUES (@department, @municipality)'
        );
      inserted++;
    }
  }

  console.log(`Seed completed: inserted=${inserted}, skipped=${skipped}`);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });