const express = require('express');
const { getPool } = require('../../../db/pool');
const { sendPushToUser } = require('./push');
const { authMiddleware } = require('../../../security/auth');

// Función para generar UUID simple
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const router = express.Router();

/**
 * GET /api/conversations/user/:userId
 * Get all conversations for a specific user
 */
router.get('/user/:userId', authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT DISTINCT
          c.id as conversation_id,
          c.last_message_at,
          c.created_at,
          u.id as other_user_id,
          u.email as other_user_email,
          u.role as other_user_role,
          m.message_text as last_message,
          m.sender_id as last_message_sender_id
        FROM conversations c
        INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        INNER JOIN users u ON cp2.user_id = u.id
        LEFT JOIN messages m ON c.id = m.conversation_id 
          AND m.created_at = c.last_message_at
        WHERE cp1.user_id = @userId 
          AND cp2.user_id != @userId
        ORDER BY c.last_message_at DESC, c.created_at DESC
      `);
    
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/conversations/create
 * Create or get existing conversation between two users
 */
router.post('/create', authMiddleware, async (req, res, next) => {
  try {
    const { user1Id, user2Id } = req.body;
    
    if (!user1Id || !user2Id) {
      return res.status(400).json({ error: 'Se requieren user1Id y user2Id' });
    }
    
    if (user1Id === user2Id) {
      return res.status(400).json({ error: 'No se puede crear una conversación consigo mismo' });
    }
    
    const pool = await getPool();
    
    // Check if conversation already exists
    const existingConversation = await pool.request()
      .input('user1Id', user1Id)
      .input('user2Id', user2Id)
      .query(`
        SELECT c.id as conversation_id
        FROM conversations c
        INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE (cp1.user_id = @user1Id AND cp2.user_id = @user2Id)
           OR (cp1.user_id = @user2Id AND cp2.user_id = @user1Id)
      `);
    
    if (existingConversation.recordset.length > 0) {
      return res.json({ 
        conversation_id: existingConversation.recordset[0].conversation_id,
        created: false 
      });
    }
    
    // Create new conversation
    const conversationId = generateUUID();
    const now = new Date().toISOString();
    
    // Start transaction
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Create conversation
      await transaction.request()
        .input('id', conversationId)
        .input('created_at', now)
        .query(`
          INSERT INTO conversations (id, created_at)
          VALUES (@id, @created_at)
        `);
      
      // Add participants
      await transaction.request()
        .input('user1Id', user1Id)
        .input('user2Id', user2Id)
        .input('conversationId', conversationId)
        .query(`
          INSERT INTO conversation_participants (user_id, conversation_id)
          VALUES (@user1Id, @conversationId), (@user2Id, @conversationId)
        `);
      
      await transaction.commit();
      
      res.status(201).json({ 
        conversation_id: conversationId,
        created: true 
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/conversations/:conversationId/messages
 * Get all messages for a specific conversation
 */
router.get('/:conversationId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, pageSize = 50 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const pool = await getPool();
    
    // Verify user is participant in this conversation
    const participantCheck = await pool.request()
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT COUNT(1) as count
        FROM conversation_participants
        WHERE conversation_id = @conversationId AND user_id = @userId
      `);
    
    if (participantCheck.recordset[0].count === 0) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }
    
    const result = await pool.request()
      .input('conversationId', conversationId)
      .input('offset', offset)
      .input('pageSize', parseInt(pageSize))
      .query(`
        SELECT 
          m.id,
          m.message_text,
          m.sender_id,
          m.created_at,
          m.delivered_at,
          m.read_at,
          m.status,
          u.email as sender_email,
          u.role as sender_role
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = @conversationId
        ORDER BY m.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);
    
    // Reverse to show oldest first
    const messages = result.recordset.reverse();
    
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/conversations/:conversationId/messages
 * Send a new message to a conversation
 */
  router.post('/:conversationId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { message_text } = req.body;
    
    if (!message_text || message_text.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    
    const pool = await getPool();
    
    // Verify user is participant in this conversation
    const participantCheck = await pool.request()
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT COUNT(1) as count
        FROM conversation_participants
        WHERE conversation_id = @conversationId AND user_id = @userId
      `);
    
    if (participantCheck.recordset[0].count === 0) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }
    
    const messageId = generateUUID();
    const now = new Date().toISOString();
    
    // Start transaction
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Insert message
      const messageResult = await transaction.request()
        .input('id', messageId)
        .input('conversationId', conversationId)
        .input('senderId', req.user.id)
        .input('messageText', message_text.trim())
        .input('createdAt', now)
        .input('deliveredAt', now)
        .input('status', 'delivered')
        .query(`
          INSERT INTO messages (id, conversation_id, sender_id, message_text, created_at, delivered_at, status)
          OUTPUT INSERTED.*
          VALUES (@id, @conversationId, @senderId, @messageText, @createdAt, @deliveredAt, @status)
        `);

      // If the message contains a file token [[FILE:url|name|mime]], persist attachment
      try {
        const tokenMatch = /\[\[FILE:([^\|\]]+)\|([^\|\]]+)\|([^\]]+)\]\]/.exec(message_text);
        if (tokenMatch) {
          const attUrl = tokenMatch[1];
          const attName = tokenMatch[2];
          const attMime = tokenMatch[3];
          const attSize = null; // Optional: can be added later from upload response

          await transaction.request()
            .input('id', generateUUID())
            .input('messageId', messageId)
            .input('url', attUrl)
            .input('name', attName)
            .input('mime', attMime)
            .input('size', attSize)
            .input('createdAt', now)
            .query(`
              INSERT INTO message_attachments (id, message_id, url, name, mime, size, created_at)
              VALUES (@id, @messageId, @url, @name, @mime, @size, @createdAt)
            `);
        }
      } catch (attErr) {
        console.warn('Attachment persistence failed:', attErr?.message || attErr);
        // Do not rollback the whole message on attachment failure
      }

      // Update conversation last_message_at
      await transaction.request()
        .input('conversationId', conversationId)
        .input('lastMessageAt', now)
        .query(`
          UPDATE conversations 
          SET last_message_at = @lastMessageAt
          WHERE id = @conversationId
        `);
      
      await transaction.commit();
      
      // Get sender info for response
      const senderInfo = await pool.request()
        .input('senderId', req.user.id)
        .query(`
          SELECT email, role
          FROM users
          WHERE id = @senderId
        `);
      
      const message = {
        ...messageResult.recordset[0],
        sender_email: senderInfo.recordset[0].email,
        sender_role: senderInfo.recordset[0].role
      };
      
      // Emit real-time message via Socket.IO
      const io = req.app.get('io');
      if (io) {
        // Include attachment info if present
        const tokenMatch = /\[\[FILE:([^\|\]]+)\|([^\|\]]+)\|([^\]]+)\]\]/.exec(message.message_text);
        const attachment = tokenMatch ? {
          url: tokenMatch[1],
          name: tokenMatch[2],
          mime: tokenMatch[3]
        } : null;

        io.to(`conversation_${conversationId}`).emit('message_received', {
          id: message.id,
          message_text: message.message_text,
          sender_id: message.sender_id,
          sender_email: message.sender_email,
          sender_role: message.sender_role,
          conversation_id: conversationId,
          created_at: message.created_at,
          delivered_at: message.delivered_at,
          read_at: message.read_at,
          status: message.status,
          attachments: attachment ? [attachment] : []
        });
      }

      // Send push notification to other participants
      try {
        const recipients = await pool.request()
          .input('conversationId', conversationId)
          .input('senderId', req.user.id)
          .query(`
            SELECT user_id FROM conversation_participants
            WHERE conversation_id = @conversationId AND user_id != @senderId
          `);
        for (const row of recipients.recordset) {
          await sendPushToUser(row.user_id, {
            title: 'Nuevo mensaje',
            body: message.message_text,
            data: { conversation_id: conversationId, sender_id: message.sender_id },
          });
        }
      } catch (pushErr) {
        console.warn('Push send failed', pushErr?.message || pushErr);
      }
      
      res.status(201).json(message);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/conversations/:conversationId/messages/:messageId/read
 * Mark a message as read
 */
router.put('/:conversationId/messages/:messageId/read', authMiddleware, async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const pool = await getPool();
    
    // Verify user is participant in this conversation
    const participantCheck = await pool.request()
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT COUNT(1) as count
        FROM conversation_participants
        WHERE conversation_id = @conversationId AND user_id = @userId
      `);
    
    if (participantCheck.recordset[0].count === 0) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }
    
    // Check if message exists and is not sent by current user
    const messageCheck = await pool.request()
      .input('messageId', messageId)
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT sender_id, status
        FROM messages
        WHERE id = @messageId AND conversation_id = @conversationId
      `);
    
    if (messageCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    const message = messageCheck.recordset[0];
    
    // Don't mark own messages as read
    if (message.sender_id === req.user.id) {
      return res.status(400).json({ error: 'No puedes marcar tus propios mensajes como leídos' });
    }
    
    // Only update if not already read
    if (message.status !== 'read') {
      const now = new Date().toISOString();
      
      await pool.request()
        .input('messageId', messageId)
        .input('readAt', now)
        .query(`
          UPDATE messages 
          SET read_at = @readAt, status = 'read'
          WHERE id = @messageId
        `);
      
      // Emit real-time status update
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('message_status_update', {
          messageId: messageId,
          status: 'read',
          readAt: now,
          readBy: req.user.id
        });
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/conversations/:conversationId/messages/:messageId
 * Delete a message sent by the current user
 */
router.delete('/:conversationId/messages/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const pool = await getPool();

    // Verify user is participant in this conversation
    const participantCheck = await pool.request()
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT COUNT(1) as count
        FROM conversation_participants
        WHERE conversation_id = @conversationId AND user_id = @userId
      `);

    if (participantCheck.recordset[0].count === 0) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }

    // Ensure the message exists and was sent by current user
    const messageRow = await pool.request()
      .input('conversationId', conversationId)
      .input('messageId', messageId)
      .query(`
        SELECT id, sender_id, created_at
        FROM messages
        WHERE id = @messageId AND conversation_id = @conversationId
      `);

    if (messageRow.recordset.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const message = messageRow.recordset[0];
    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios mensajes' });
    }

    // Start transaction
    const transaction = pool.transaction();
    await transaction.begin();
    try {
      // Delete attachments first
      await transaction.request()
        .input('messageId', messageId)
        .query(`DELETE FROM message_attachments WHERE message_id = @messageId`);

      // Delete the message
      const delResult = await transaction.request()
        .input('messageId', messageId)
        .query(`DELETE FROM messages WHERE id = @messageId`);

      if (delResult.rowsAffected[0] === 0) {
        throw new Error('No se pudo eliminar el mensaje');
      }

      // If the message was the latest one, update conversation last_message_at
      const latestRow = await transaction.request()
        .input('conversationId', conversationId)
        .query(`
          SELECT TOP 1 created_at
          FROM messages
          WHERE conversation_id = @conversationId
          ORDER BY created_at DESC
        `);

      const latest = latestRow.recordset[0]?.created_at || null;
      await transaction.request()
        .input('conversationId', conversationId)
        .input('lastMessageAt', latest)
        .query(`
          UPDATE conversations
          SET last_message_at = @lastMessageAt
          WHERE id = @conversationId
        `);

      await transaction.commit();

      // Emit real-time deletion
      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('message_deleted', {
          conversation_id: conversationId,
          message_id: messageId
        });
      }

      return res.status(204).end();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/conversations/:conversationId
 * Delete an entire conversation for its participants
 */
router.delete('/:conversationId', authMiddleware, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const pool = await getPool();

    // Verify user is participant in this conversation
    const participantCheck = await pool.request()
      .input('conversationId', conversationId)
      .input('userId', req.user.id)
      .query(`
        SELECT COUNT(1) as count
        FROM conversation_participants
        WHERE conversation_id = @conversationId AND user_id = @userId
      `);

    if (participantCheck.recordset[0].count === 0) {
      return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
    }

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      // Delete attachments referencing messages in this conversation
      await transaction.request()
        .input('conversationId', conversationId)
        .query(`
          DELETE ma
          FROM message_attachments ma
          INNER JOIN messages m ON ma.message_id = m.id
          WHERE m.conversation_id = @conversationId
        `);

      // Delete messages
      await transaction.request()
        .input('conversationId', conversationId)
        .query(`DELETE FROM messages WHERE conversation_id = @conversationId`);

      // Delete participants
      await transaction.request()
        .input('conversationId', conversationId)
        .query(`DELETE FROM conversation_participants WHERE conversation_id = @conversationId`);

      // Delete conversation
      const delConv = await transaction.request()
        .input('conversationId', conversationId)
        .query(`DELETE FROM conversations WHERE id = @conversationId`);

      if (delConv.rowsAffected[0] === 0) {
        throw new Error('Conversación no encontrada');
      }

      await transaction.commit();

      const io = req.app.get('io');
      if (io) {
        io.to(`conversation_${conversationId}`).emit('conversation_deleted', {
          conversation_id: conversationId
        });
      }

      return res.status(204).end();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;