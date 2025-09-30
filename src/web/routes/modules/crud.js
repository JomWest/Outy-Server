const express = require('express');
const { sql, getPool } = require('../../../db/pool');
const { LRUCache } = require('lru-cache');
const { z } = require('zod');

const cache = new LRUCache({ max: 500, ttl: (parseInt(process.env.CACHE_TTL_SECONDS || '60', 10)) * 1000 });

function createCrudRouter({ table, idColumn, idColumns, idType = 'int', idTypes, schema, requireAuthWrite = true }) {
  const router = express.Router();

  // Normalize id columns and types (support single or composite keys)
  const ids = Array.isArray(idColumns) ? idColumns : (idColumn ? [idColumn] : ['id']);
  const typesRaw = Array.isArray(idTypes) ? idTypes : (idTypes ? [idTypes] : [idType]);
  const types = ids.map((_, i) => typesRaw[i] || typesRaw[0] || 'int');
  const paramKeys = ids.length === 1 ? ['id'] : ids.map((_, i) => `id${i + 1}`);
  const idRoutePath = ids.length === 1 ? '/:id' : '/' + paramKeys.map(k => `:${k}`).join('/');

  const parseIdValue = (raw, type) => (type === 'int' ? parseInt(raw, 10) : String(raw).trim());
  const getIdValues = (req) => paramKeys.map((k, i) => parseIdValue(req.params[k], types[i]));
  const whereClause = ids.map((c, i) => `${c} = @${paramKeys[i]}`).join(' AND ');

  const fields = Object.keys(schema.shape);
  const safeOrderBy = (sortBy) => (fields.includes(sortBy) ? sortBy : ids[0]);
  const clearTableCache = () => {
    for (const key of cache.keys()) if (key.startsWith(`${table}:`)) cache.delete(key);
  };

  /**
   * @openapi
   * /api/{table}:
   *   get:
   *     summary: Listar registros con paginación
   *     tags: [CRUD]
   */
  router.get('/', async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
      const sortBy = safeOrderBy((req.query.sortBy || idColumn));
      const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const cacheKey = `${table}:list:${page}:${pageSize}:${sortBy}:${sortOrder}`;
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const pool = await getPool();
      const offset = (page - 1) * pageSize;
      const query = `SELECT * FROM ${table} ORDER BY ${sortBy} ${sortOrder} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;`;
      const data = await pool.request().query(query);
      const count = await pool.request().query(`SELECT COUNT(1) as total FROM ${table}`);
      const payload = { page, pageSize, total: count.recordset[0].total, items: data.recordset };
      cache.set(cacheKey, payload);
      res.json(payload);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /api/{table}/{id}:
   *   get:
   *     summary: Obtener un registro por id
   */
  router.get(idRoutePath, async (req, res, next) => {
    try {
      const idVals = getIdValues(req);
      const cacheKey = `${table}:get:${idVals.join(':')}`;
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
      const pool = await getPool();
      const r = pool.request();
      idVals.forEach((val, i) => r.input(paramKeys[i], val));
      const data = await r.query(`SELECT * FROM ${table} WHERE ${whereClause}`);
      const row = data.recordset[0];
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      cache.set(cacheKey, row);
      res.json(row);
    } catch (err) { next(err); }
  });

  // Validation helper
  const validateBody = (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (e) {
      e.status = 400;
      e.details = e.errors || e.message;
      next(e);
    }
  };

  const requireAuth = (req, res, next) => requireAuthWrite ? require('../../../security/auth').authMiddleware(req, res, next) : next();

  /** CREATE */
  router.post('/', requireAuth, validateBody, async (req, res, next) => {
    try {
      const payload = req.body;
      const cols = Object.keys(payload);
      const valuesPlaceholders = cols.map(c => `@${c}`).join(',');
      const query = `INSERT INTO ${table} (${cols.join(',')}) OUTPUT INSERTED.* VALUES (${valuesPlaceholders})`;
      const pool = await getPool();
      const r = pool.request();
      cols.forEach(c => r.input(c, payload[c]));
      const result = await r.query(query);
      clearTableCache();
      res.status(201).json(result.recordset[0]);
    } catch (err) { next(err); }
  });

  /** UPDATE */
  router.put(idRoutePath, requireAuth, validateBody, async (req, res, next) => {
    try {
      const idVals = getIdValues(req);
      const payload = req.body;
      const cols = Object.keys(payload);
      const setClause = cols.map(c => `${c} = @${c}`).join(', ');
      const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}; SELECT * FROM ${table} WHERE ${whereClause};`;
      const pool = await getPool();
      const r = pool.request();
      idVals.forEach((val, i) => r.input(paramKeys[i], val));
      cols.forEach(c => r.input(c, payload[c]));
      const result = await r.query(query);
      clearTableCache();
      
      // Safely access recordsets with proper validation
      const row = (result.recordsets && result.recordsets[1] && result.recordsets[1][0]) || 
                  (result.recordset && result.recordset[0]) || null;
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      res.json(row);
    } catch (err) { next(err); }
  });

  router.patch(idRoutePath, requireAuth, async (req, res, next) => {
    try {
      // Partial validation: pick only known fields
      const payload = Object.fromEntries(Object.entries(req.body).filter(([k]) => fields.includes(k)));
      const idVals = getIdValues(req);
      if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Sin cambios válidos' });
      const cols = Object.keys(payload);
      const setClause = cols.map(c => `${c} = @${c}`).join(', ');
      const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} ; SELECT * FROM ${table} WHERE ${whereClause};`;
      const pool = await getPool();
      const r = pool.request();
      idVals.forEach((val, i) => r.input(paramKeys[i], val));
      cols.forEach(c => r.input(c, payload[c]));
      const result = await r.query(query);
      clearTableCache();
      
      // Safely access recordsets with proper validation
      const row = (result.recordsets && result.recordsets[1] && result.recordsets[1][0]) || 
                  (result.recordset && result.recordset[0]) || null;
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      res.json(row);
    } catch (err) { next(err); }
  });

  /** DELETE */
  router.delete(idRoutePath, requireAuth, async (req, res, next) => {
    try {
      const idVals = getIdValues(req);
      const pool = await getPool();
      const r = pool.request();
      idVals.forEach((val, i) => r.input(paramKeys[i], val));
      const result = await r.query(`DELETE FROM ${table} WHERE ${whereClause}`);
      clearTableCache();
      if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'No encontrado' });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = createCrudRouter;