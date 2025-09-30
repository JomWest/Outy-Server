require('dotenv').config();
const { getPool } = require('./src/db/pool');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const pool = await getPool();
    
    // Verificar si el usuario ya existe
    const existingUser = await pool.request()
      .input('email', 'JomWest@outy.com')
      .query('SELECT id FROM users WHERE email = @email');
    
    if (existingUser.recordset.length > 0) {
      console.log('El usuario JomWest ya existe en la base de datos');
      return;
    }
    
    // Crear hash de la contraseña
    const hashedPassword = await bcrypt.hash('CEO2024!', 10);
    
    // Insertar el nuevo usuario CEO (usando rol 'empleador' según la restricción de la BD)
    const result = await pool.request()
      .input('email', 'JomWest@outy.com')
      .input('password_hash', hashedPassword)
      .input('role', 'empleador')
      .input('phone_number', '+1234567890')
      .query(`
        INSERT INTO users (email, password_hash, role, phone_number) 
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.phone_number, INSERTED.created_at
        VALUES (@email, @password_hash, @role, @phone_number)
      `);
    
    console.log('Usuario CEO creado exitosamente:');
    console.log('ID:', result.recordset[0].id);
    console.log('Email:', result.recordset[0].email);
    console.log('Role:', result.recordset[0].role);
    console.log('Fecha de creación:', result.recordset[0].created_at);
    
    // Crear perfil de empresa para el CEO
    const companyResult = await pool.request()
      .input('user_id', result.recordset[0].id)
      .input('company_name', 'Outy')
      .input('description', 'Plataforma líder de empleo en Nicaragua')
      .input('industry', 'Tecnología')
      .query(`
        INSERT INTO company_profiles (user_id, company_name, description, industry)
        VALUES (@user_id, @company_name, @description, @industry)
      `);
    
    console.log('Perfil de empresa creado para el CEO');
    
  } catch (err) {
    console.error('Error al crear usuario CEO:', err.message);
  }
})();