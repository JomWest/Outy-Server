const express = require('express');
const { getPool, sql } = require('../../../db/pool');
const { authMiddleware } = require('../../../security/auth');

const router = express.Router();

async function ensureModerationTables(pool) {
  // Create user_reports table if it doesn't exist
  await pool.request().query(`
    IF OBJECT_ID('user_reports', 'U') IS NULL
    BEGIN
      CREATE TABLE user_reports (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        reporter_id UNIQUEIDENTIFIER NOT NULL,
        reported_user_id UNIQUEIDENTIFIER NOT NULL,
        reason NVARCHAR(400) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        status NVARCHAR(50) NOT NULL DEFAULT 'open'
      );
    END
  `);

  // Create user_blocks table if it doesn't exist
  await pool.request().query(`
    IF OBJECT_ID('user_blocks', 'U') IS NULL
    BEGIN
      CREATE TABLE user_blocks (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        blocker_id UNIQUEIDENTIFIER NOT NULL,
        blocked_user_id UNIQUEIDENTIFIER NOT NULL,
        reason NVARCHAR(400) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL DEFAULT 1
      );
    END
  `);
}

function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Solo admin/super_admin puede realizar esta acción' });
  }
  next();
}

/**
 * POST /api/moderation/report
 * Report a user. Body: { reported_user_id, reason }
 */
router.post('/report', authMiddleware, async (req, res, next) => {
  try {
    const { reported_user_id, reason } = req.body || {};
    if (!reported_user_id) {
      return res.status(400).json({ error: 'reported_user_id es requerido' });
    }
    const pool = await getPool();
    await ensureModerationTables(pool);

    const r = await pool.request()
      .input('reporter_id', sql.UniqueIdentifier, req.user.id)
      .input('reported_user_id', sql.UniqueIdentifier, reported_user_id)
      .input('reason', sql.NVarChar(400), reason || null)
      .query(`
        INSERT INTO user_reports (reporter_id, reported_user_id, reason)
        OUTPUT INSERTED.*
        VALUES (@reporter_id, @reported_user_id, @reason)
      `);
    res.status(201).json(r.recordset[0]);
  } catch (err) { next(err); }
});

/**
 * POST /api/moderation/block/:userId
 * Block a user (super_admin only). Body: { reason }
 */
router.post('/block/:userId', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body || {};
    const pool = await getPool();
    await ensureModerationTables(pool);

    const r = await pool.request()
      .input('blocker_id', sql.UniqueIdentifier, req.user.id)
      .input('blocked_user_id', sql.UniqueIdentifier, userId)
      .input('reason', sql.NVarChar(400), reason || null)
      .query(`
        INSERT INTO user_blocks (blocker_id, blocked_user_id, reason)
        OUTPUT INSERTED.*
        VALUES (@blocker_id, @blocked_user_id, @reason)
      `);
    res.status(201).json(r.recordset[0]);
  } catch (err) { next(err); }
});

/**
 * GET /api/moderation/reports/daily?date=YYYY-MM-DD
 * List reports for a given day (default today). super_admin only.
 */
router.get('/reports/daily', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { date } = req.query;
    const pool = await getPool();
    await ensureModerationTables(pool);

    // Calculate range for given date in UTC
    const baseDate = date ? new Date(date + 'T00:00:00Z') : new Date();
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59));

    const r = await pool.request()
      .input('start', sql.DateTime2, start)
      .input('end', sql.DateTime2, end)
      .query(`
        SELECT TOP 500 *
        FROM user_reports
        WHERE created_at BETWEEN @start AND @end
        ORDER BY created_at DESC
      `);
    res.json({ date: start.toISOString().slice(0,10), count: r.recordset.length, items: r.recordset });
  } catch (err) { next(err); }
});

/**
 * GET /api/moderation/reports
 * List latest reports (super_admin)
 */
router.get('/reports', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const pool = await getPool();
    await ensureModerationTables(pool);
    const r = await pool.request().query(`
      SELECT TOP 1000 * FROM user_reports ORDER BY created_at DESC
    `);
    res.json(r.recordset);
  } catch (err) { next(err); }
});

/**
 * GET /api/moderation/blocks
 * List current blocks (super_admin)
 */
router.get('/blocks', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const pool = await getPool();
    await ensureModerationTables(pool);
    const r = await pool.request().query(`
      SELECT TOP 1000 * FROM user_blocks ORDER BY created_at DESC
    `);
    res.json(r.recordset);
  } catch (err) { next(err); }
});

// ===== Reportes de anuncios =====
async function ensureAdReportsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('ad_reports', 'U') IS NULL
    BEGIN
      CREATE TABLE ad_reports (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        reporter_id UNIQUEIDENTIFIER NOT NULL,
        ad_id UNIQUEIDENTIFIER NOT NULL,
        ad_type NVARCHAR(50) NOT NULL,
        reason NVARCHAR(400) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        status NVARCHAR(50) NOT NULL DEFAULT 'open'
      );
    END
  `);
}

/**
 * POST /api/moderation/report-ad
 * Reportar un anuncio. Body: { ad_id, ad_type, reason }
 */
router.post('/report-ad', authMiddleware, async (req, res, next) => {
  try {
    const { ad_id, ad_type, reason } = req.body || {};
    if (!ad_id || !ad_type) {
      return res.status(400).json({ error: 'ad_id y ad_type son requeridos' });
    }
    const pool = await getPool();
    await ensureAdReportsTable(pool);

    const r = await pool.request()
      .input('reporter_id', sql.UniqueIdentifier, req.user.id)
      .input('ad_id', sql.UniqueIdentifier, ad_id)
      .input('ad_type', sql.NVarChar(50), ad_type)
      .input('reason', sql.NVarChar(400), reason || null)
      .query(`
        INSERT INTO ad_reports (reporter_id, ad_id, ad_type, reason)
        OUTPUT INSERTED.*
        VALUES (@reporter_id, @ad_id, @ad_type, @reason)
      `);
    res.status(201).json(r.recordset[0]);
  } catch (err) { next(err); }
});

/**
 * GET /api/moderation/ad-reports/daily?date=YYYY-MM-DD
 * Listar reportes de anuncios por día (admin/super_admin)
 */
router.get('/ad-reports/daily', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { date } = req.query;
    const pool = await getPool();
    await ensureAdReportsTable(pool);

    const baseDate = date ? new Date(date + 'T00:00:00Z') : new Date();
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59));

    const r = await pool.request()
      .input('start', sql.DateTime2, start)
      .input('end', sql.DateTime2, end)
      .query(`
        SELECT TOP 500 *
        FROM ad_reports
        WHERE created_at BETWEEN @start AND @end
        ORDER BY created_at DESC
      `);
    res.json({ date: start.toISOString().slice(0,10), count: r.recordset.length, items: r.recordset });
  } catch (err) { next(err); }
});

/**
 * GET /api/moderation/ad-reports
 * Listar últimos reportes de anuncios (admin/super_admin)
 */
router.get('/ad-reports', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const pool = await getPool();
    await ensureAdReportsTable(pool);
    const r = await pool.request().query(`
      SELECT TOP 1000 * FROM ad_reports ORDER BY created_at DESC
    `);
    res.json(r.recordset);
  } catch (err) { next(err); }
});

module.exports = router;