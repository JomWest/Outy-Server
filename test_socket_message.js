require('dotenv').config();
const { getPool } = require('./src/db/pool');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

(async () => {
  try {
    const pool = await getPool();
    
    // Obtener una conversación existente con JomWest
    const conversationResult = await pool.request()
      .input('jomwest_email', 'JomWest@outy.com')
      .query(`
        SELECT TOP 1 c.id as conversation_id
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        WHERE u.email = @jomwest_email
      `);
    
    if (conversationResult.recordset.length === 0) {
      console.log('No se encontró conversación con JomWest');
      return;
    }
    
    const conversationId = conversationResult.recordset[0].conversation_id;
    console.log('Conversación encontrada:', conversationId);
    
    // Obtener el ID de JomWest
    const jomwestResult = await pool.request()
      .input('email', 'JomWest@outy.com')
      .query('SELECT id FROM users WHERE email = @email');
    
    const jomwestId = jomwestResult.recordset[0].id;
    
    // Crear un mensaje de prueba
    const messageId = generateUUID();
    const now = new Date().toISOString();
    const testMessage = 'Mensaje de prueba para verificar Socket.IO - ' + new Date().toLocaleTimeString();
    
    await pool.request()
      .input('id', messageId)
      .input('conversationId', conversationId)
      .input('senderId', jomwestId)
      .input('messageText', testMessage)
      .input('createdAt', now)
      .query(`
        INSERT INTO messages (id, conversation_id, sender_id, message_text, created_at, status)
        VALUES (@id, @conversationId, @senderId, @messageText, @createdAt, 'sent')
      `);
    
    console.log('Mensaje de prueba creado exitosamente:');
    console.log('- ID:', messageId);
    console.log('- Conversación:', conversationId);
    console.log('- Texto:', testMessage);
    console.log('- Hora:', now);
    
    // Verificar que el mensaje se guardó correctamente
    const verifyResult = await pool.request()
      .input('messageId', messageId)
      .query(`
        SELECT m.*, u.email as sender_email
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.id = @messageId
      `);
    
    console.log('Verificación del mensaje:', verifyResult.recordset[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
})();