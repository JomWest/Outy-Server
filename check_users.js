require('dotenv').config();
const { getPool } = require('./src/db/pool');

(async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT email, role, created_at FROM users ORDER BY created_at DESC');
    
    console.log('=== USUARIOS REGISTRADOS ===');
    if (result.recordset.length === 0) {
      console.log('No hay usuarios registrados');
    } else {
      result.recordset.forEach((user, i) => {
        console.log(`${i+1}. ${user.email} (${user.role}) - ${user.created_at}`);
      });
    }
    
    console.log('\n=== EMAILS ÚNICOS PARA PRUEBAS ===');
    const testEmails = [
      'maria.gonzalez@test.com',
      'carlos.rodriguez@prueba.com', 
      'ana.martinez@demo.com',
      'luis.hernandez@ejemplo.com',
      'sofia.lopez@testing.com'
    ];
    
    console.log('Puedes usar estos emails para crear cuentas nuevas:');
    testEmails.forEach((email, i) => {
      console.log(`${i+1}. ${email}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();