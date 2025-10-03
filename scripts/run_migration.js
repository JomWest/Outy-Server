require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/db/pool');

async function runMigration(filePath) {
  const absPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Archivo de migración no encontrado: ${absPath}`);
  }

  const sql = fs.readFileSync(absPath, 'utf-8');

  // Separar por GO (líneas que solo contienen GO)
  const chunks = sql
    .split(/\r?\n\s*GO\s*\r?\n/i)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  const pool = await getPool();
  console.log(`Conectado a SQL Server. Ejecutando migración: ${filePath}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n>>> Ejecutando bloque ${i + 1}/${chunks.length}...`);
    try {
      await pool.request().query(chunk);
      console.log(`Bloque ${i + 1} OK`);
    } catch (err) {
      console.error(`Error en bloque ${i + 1}:`, err.message);
      throw err;
    }
  }

  console.log('\nMigración ejecutada correctamente.');
}

async function main() {
  try {
    const arg = process.argv[2] || 'migrations/add_social_fields_to_candidate_profiles.sql';
    await runMigration(arg);
    process.exit(0);
  } catch (err) {
    console.error('Fallo ejecutando migración:', err);
    process.exit(1);
  }
}

main();