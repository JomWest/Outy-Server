const express = require('express');
const { getPool, sql } = require('../../../db/pool');
const { authMiddleware } = require('../../../security/auth');
const { sendPushToUser } = require('./push');
const { ensureNotificationsTable, createNotification } = require('./notifications');

const router = express.Router();

/**
 * PATCH /api/express_jobs/:id
 * Intercepta actualizaciones de anuncios exprés para detectar cambio a 'en_revision'
 * y emitir notificación al dueño + push.
 */
router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const pool = await getPool();
    // Leer estado anterior y dueño
    const currentRow = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`SELECT id, client_id, status, title FROM express_jobs WHERE id = @id`);
    if (!currentRow.recordset || currentRow.recordset.length === 0) {
      return res.status(404).json({ error: 'Anuncio no encontrado' });
    }
    const existing = currentRow.recordset[0];

    // Solo soportamos cambios de estado (y updated_at) aquí; para otros campos usa el CRUD estándar
    const nextStatus = typeof updates.status === 'string' ? updates.status : existing.status;

    // Actualizar estado si cambia
    if (nextStatus !== existing.status) {
      await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .input('status', sql.NVarChar(50), nextStatus)
        .query(`
          UPDATE express_jobs SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id;
        `);
    }

    // Volver a leer fila actualizada
    const updatedRow = await pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`SELECT * FROM express_jobs WHERE id = @id`);
    const updated = updatedRow.recordset[0];

    // Hook: cuando se cambia a 'en_revision', crear notificación y enviar push
    if (existing.status !== 'en_revision' && nextStatus === 'en_revision') {
      try {
        await ensureNotificationsTable(pool);
        const title = 'Tu anuncio está en revisión';
        const body = `El anuncio "${(existing.title || 'exprés')}" ha sido puesto en revisión.`;
        await createNotification(pool, {
          userId: existing.client_id,
          type: 'express_review',
          title,
          body,
          data: { express_job_id: existing.id, status: nextStatus }
        });
        // Enviar push
        await sendPushToUser(existing.client_id, {
          title,
          body,
          data: { express_job_id: existing.id, status: nextStatus },
        });
      } catch (pushErr) {
        console.warn('No se pudo enviar notificación/push', pushErr?.message || pushErr);
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;