const express = require('express');
const { getPool, sql } = require('../../../db/pool');
const { authMiddleware } = require('../../../security/auth');

const router = express.Router();

async function ensureNotificationsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('notifications', 'U') IS NULL
    BEGIN
      CREATE TABLE notifications (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        type NVARCHAR(50) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        body NVARCHAR(1000) NULL,
        data NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        read_at DATETIME2 NULL,
        CONSTRAINT PK_notifications PRIMARY KEY CLUSTERED (id ASC)
      );
      CREATE INDEX IX_notifications_user_created ON notifications(user_id, created_at DESC);
    END
  `);
}

async function createNotification(pool, { userId, type, title, body, data }) {
  await ensureNotificationsTable(pool);
  const r = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .input('type', sql.NVarChar(50), type)
    .input('title', sql.NVarChar(200), title)
    .input('body', sql.NVarChar(1000), body || null)
    .input('data', sql.NVarChar(sql.MAX), data ? JSON.stringify(data) : null)
    .query(`
      INSERT INTO notifications (user_id, type, title, body, data)
      OUTPUT INSERTED.*
      VALUES (@userId, @type, @title, @body, @data)
    `);
  return r.recordset[0];
}

/**
 * GET /api/notifications/my
 * Lista las últimas notificaciones del usuario autenticado
 */
router.get('/my', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    await ensureNotificationsTable(pool);
    const r = await pool.request()
      .input('userId', sql.UniqueIdentifier, req.user.id)
      .query(`
        SELECT TOP 200 id, type, title, body, data, created_at, read_at
        FROM notifications
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);
    const items = r.recordset.map(row => ({
      ...row,
      is_read: row.read_at != null,
      data: (() => { try { return row.data ? JSON.parse(row.data) : null; } catch { return null; } })()
    }));
    res.json({ items });
  } catch (err) { next(err); }
});

/**
 * PUT /api/notifications/:id/read
 * Marca como leída una notificación del usuario actual
 */
router.put('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    await ensureNotificationsTable(pool);
    // Solo permitir si la notificación pertenece al usuario
    const owned = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('userId', sql.UniqueIdentifier, req.user.id)
      .query(`
        SELECT COUNT(1) AS count FROM notifications WHERE id = @id AND user_id = @userId
      `);
    if (owned.recordset[0].count === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`UPDATE notifications SET read_at = SYSUTCDATETIME() WHERE id = @id`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.ensureNotificationsTable = ensureNotificationsTable;
module.exports.createNotification = createNotification;