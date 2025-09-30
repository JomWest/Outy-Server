require('dotenv').config();
const { getPool } = require('./src/db/pool');

const WELCOME_MESSAGE = "Hola, bienvenido a Outy. ¿En qué puedo ayudarte?";

// Función para generar UUID simple
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createWelcomeMessageSystem() {
  try {
    const pool = await getPool();
    
    // 1. Obtener el ID del CEO (JomWest)
    const ceoResult = await pool.request()
      .input('email', 'JomWest@outy.com')
      .query('SELECT id FROM users WHERE email = @email');
    
    if (ceoResult.recordset.length === 0) {
      console.error('Error: No se encontró el usuario CEO JomWest');
      return;
    }
    
    const ceoId = ceoResult.recordset[0].id;
    console.log('CEO ID encontrado:', ceoId);
    
    // 2. Obtener todos los usuarios candidatos que no tienen conversación con el CEO
    const candidatesResult = await pool.request()
      .input('ceoId', ceoId)
      .query(`
        SELECT u.id, u.email 
        FROM users u
        WHERE u.role = 'candidato' 
          AND u.id NOT IN (
            SELECT DISTINCT cp.user_id
            FROM conversation_participants cp
            INNER JOIN conversation_participants cp2 ON cp.conversation_id = cp2.conversation_id
            WHERE cp2.user_id = @ceoId AND cp.user_id != @ceoId
          )
      `);
    
    console.log(`Encontrados ${candidatesResult.recordset.length} candidatos sin conversación con el CEO`);
    
    // 3. Para cada candidato, crear conversación y mensaje de bienvenida
    for (const candidate of candidatesResult.recordset) {
      console.log(`Procesando candidato: ${candidate.email}`);
      
      const conversationId = generateUUID();
      const messageId = generateUUID();
      const now = new Date().toISOString();
      
      // Iniciar transacción
      const transaction = pool.transaction();
      await transaction.begin();
      
      try {
        // Crear conversación
        await transaction.request()
          .input('id', conversationId)
          .input('created_at', now)
          .input('last_message_at', now)
          .query(`
            INSERT INTO conversations (id, created_at, last_message_at)
            VALUES (@id, @created_at, @last_message_at)
          `);
        
        // Agregar participantes (CEO y candidato)
        await transaction.request()
          .input('ceoId', ceoId)
          .input('candidateId', candidate.id)
          .input('conversationId', conversationId)
          .query(`
            INSERT INTO conversation_participants (user_id, conversation_id)
            VALUES (@ceoId, @conversationId), (@candidateId, @conversationId)
          `);
        
        // Crear mensaje de bienvenida del CEO
        await transaction.request()
          .input('id', messageId)
          .input('conversationId', conversationId)
          .input('senderId', ceoId)
          .input('messageText', WELCOME_MESSAGE)
          .input('createdAt', now)
          .query(`
            INSERT INTO messages (id, conversation_id, sender_id, message_text, created_at)
            VALUES (@id, @conversationId, @senderId, @messageText, @createdAt)
          `);
        
        await transaction.commit();
        console.log(`✓ Conversación y mensaje de bienvenida creados para ${candidate.email}`);
        
      } catch (err) {
        await transaction.rollback();
        console.error(`Error procesando candidato ${candidate.email}:`, err.message);
      }
    }
    
    console.log('\n=== Sistema de mensajes de bienvenida implementado exitosamente ===');
    
  } catch (err) {
    console.error('Error general:', err.message);
  }
}

// Función para crear mensaje de bienvenida para nuevos usuarios
async function createWelcomeMessageForNewUser(newUserId) {
  try {
    const pool = await getPool();
    
    // Obtener el ID del CEO
    const ceoResult = await pool.request()
      .input('email', 'JomWest@outy.com')
      .query('SELECT id FROM users WHERE email = @email');
    
    if (ceoResult.recordset.length === 0) {
      console.error('Error: No se encontró el usuario CEO');
      return;
    }
    
    const ceoId = ceoResult.recordset[0].id;
    
    // Verificar que el nuevo usuario sea candidato
    const userResult = await pool.request()
      .input('userId', newUserId)
      .query('SELECT role FROM users WHERE id = @userId');
    
    if (userResult.recordset.length === 0 || userResult.recordset[0].role !== 'candidato') {
      console.log('Usuario no es candidato, no se crea mensaje de bienvenida');
      return;
    }
    
    const conversationId = generateUUID();
    const messageId = generateUUID();
    const now = new Date().toISOString();
    
    // Iniciar transacción
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Crear conversación
      await transaction.request()
        .input('id', conversationId)
        .input('created_at', now)
        .input('last_message_at', now)
        .query(`
          INSERT INTO conversations (id, created_at, last_message_at)
          VALUES (@id, @created_at, @last_message_at)
        `);
      
      // Agregar participantes
      await transaction.request()
        .input('ceoId', ceoId)
        .input('userId', newUserId)
        .input('conversationId', conversationId)
        .query(`
          INSERT INTO conversation_participants (user_id, conversation_id)
          VALUES (@ceoId, @conversationId), (@userId, @conversationId)
        `);
      
      // Crear mensaje de bienvenida
      await transaction.request()
        .input('id', messageId)
        .input('conversationId', conversationId)
        .input('senderId', ceoId)
        .input('messageText', WELCOME_MESSAGE)
        .input('createdAt', now)
        .query(`
          INSERT INTO messages (id, conversation_id, sender_id, message_text, created_at)
          VALUES (@id, @conversationId, @senderId, @messageText, @createdAt)
        `);
      
      await transaction.commit();
      console.log('Mensaje de bienvenida creado para nuevo usuario');
      
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
    
  } catch (err) {
    console.error('Error creando mensaje de bienvenida para nuevo usuario:', err.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createWelcomeMessageSystem();
}

module.exports = { createWelcomeMessageForNewUser };