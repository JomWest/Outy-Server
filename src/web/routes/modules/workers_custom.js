const express = require('express');
const { getPool, sql } = require('../../../db/pool');
const { authMiddleware } = require('../../../security/auth');

const router = express.Router();

/**
 * @openapi
 * /api/workers/search:
 *   get:
 *     summary: Buscar trabajadores con filtros avanzados
 *     tags: [Workers]
 *     parameters:
 *       - in: query
 *         name: trade_category_id
 *         schema:
 *           type: integer
 *         description: ID de la categoría de oficio
 *       - in: query
 *         name: location_id
 *         schema:
 *           type: integer
 *         description: ID de la ubicación
 *       - in: query
 *         name: min_rating
 *         schema:
 *           type: number
 *         description: Calificación mínima
 *       - in: query
 *         name: available_only
 *         schema:
 *           type: boolean
 *         description: Solo trabajadores disponibles
 *       - in: query
 *         name: verified_only
 *         schema:
 *           type: boolean
 *         description: Solo trabajadores verificados
 *       - in: query
 *         name: max_hourly_rate
 *         schema:
 *           type: number
 *         description: Tarifa máxima por hora
 *       - in: query
 *         name: search_text
 *         schema:
 *           type: string
 *         description: Texto de búsqueda en nombre o especialidad
 *     responses:
 *       200:
 *         description: Lista de trabajadores filtrados
 */
router.get('/search', async (req, res, next) => {
  try {
    const pool = await getPool();
    const {
      trade_category_id,
      location_id,
      min_rating,
      available_only,
      verified_only,
      max_hourly_rate,
      search_text
    } = req.query;

    let query = `
      SELECT 
        wp.*,
        tc.name as trade_category_name,
        tc.icon_name,
        ln.department,
        ln.municipality,
        COUNT(wr.id) as review_count
      FROM worker_profiles wp
      LEFT JOIN trade_categories tc ON wp.trade_category_id = tc.id
      LEFT JOIN locations_nicaragua ln ON wp.location_id = ln.id
      LEFT JOIN worker_reviews wr ON wp.id = wr.worker_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (trade_category_id) {
      query += ` AND wp.trade_category_id = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.Int, value: parseInt(trade_category_id) });
      paramIndex++;
    }

    if (location_id) {
      query += ` AND wp.location_id = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.Int, value: parseInt(location_id) });
      paramIndex++;
    }

    if (min_rating) {
      query += ` AND wp.average_rating >= @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.Float, value: parseFloat(min_rating) });
      paramIndex++;
    }

    if (available_only === 'true') {
      query += ` AND wp.available = 1`;
    }

    if (verified_only === 'true') {
      query += ` AND wp.verified = 1`;
    }

    if (max_hourly_rate) {
      query += ` AND (wp.hourly_rate_min IS NULL OR wp.hourly_rate_min <= @param${paramIndex})`;
      params.push({ name: `param${paramIndex}`, type: sql.Float, value: parseFloat(max_hourly_rate) });
      paramIndex++;
    }

    if (search_text) {
      query += ` AND (wp.full_name LIKE @param${paramIndex} OR wp.specialty LIKE @param${paramIndex})`;
      params.push({ name: `param${paramIndex}`, type: sql.NVarChar(255), value: `%${search_text}%` });
      paramIndex++;
    }

    query += `
      GROUP BY wp.id, wp.user_id, wp.full_name, wp.trade_category_id, wp.specialty, 
               wp.years_experience, wp.description, wp.profile_picture_url, wp.phone_number,
               wp.whatsapp_number, wp.location_id, wp.address_details, wp.available,
               wp.hourly_rate_min, wp.hourly_rate_max, wp.daily_rate_min, wp.daily_rate_max,
               wp.currency, wp.average_rating, wp.total_reviews, wp.verified, wp.verification_date,
               wp.created_at, wp.updated_at, tc.name, tc.icon_name, ln.department, ln.municipality
      ORDER BY wp.average_rating DESC, wp.total_reviews DESC
    `;

    const request = pool.request();
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/workers/{id}/services:
 *   get:
 *     summary: Obtener servicios ofrecidos por un trabajador
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del trabajador
 *     responses:
 *       200:
 *         description: Lista de servicios del trabajador
 */
router.get('/:id/services', async (req, res, next) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    const result = await pool.request()
      .input('worker_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          ws.id,
          ws.service_name,
          ws.description,
          wso.price_min,
          wso.price_max,
          tc.name as category_name
        FROM worker_service_offerings wso
        JOIN worker_services ws ON wso.service_id = ws.id
        JOIN trade_categories tc ON ws.trade_category_id = tc.id
        WHERE wso.worker_id = @worker_id
        ORDER BY ws.service_name
      `);

    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/workers/{id}/portfolio:
 *   get:
 *     summary: Obtener portafolio de trabajos de un trabajador
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del trabajador
 *     responses:
 *       200:
 *         description: Portafolio del trabajador
 */
router.get('/:id/portfolio', async (req, res, next) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    const result = await pool.request()
      .input('worker_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT *
        FROM worker_portfolio
        WHERE worker_id = @worker_id
        ORDER BY is_featured DESC, created_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/workers/{id}/reviews:
 *   get:
 *     summary: Obtener reseñas de un trabajador
 *     tags: [Workers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del trabajador
 *     responses:
 *       200:
 *         description: Reseñas del trabajador
 */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    const result = await pool.request()
      .input('worker_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          wr.*,
          u.email as client_email,
          ej.title as job_title
        FROM worker_reviews wr
        JOIN users u ON wr.client_id = u.id
        LEFT JOIN express_jobs ej ON wr.express_job_id = ej.id
        WHERE wr.worker_id = @worker_id
        ORDER BY wr.created_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/express-jobs/search:
 *   get:
 *     summary: Buscar trabajos exprés con filtros
 *     tags: [Express Jobs]
 *     parameters:
 *       - in: query
 *         name: trade_category_id
 *         schema:
 *           type: integer
 *         description: ID de la categoría de oficio
 *       - in: query
 *         name: location_id
 *         schema:
 *           type: integer
 *         description: ID de la ubicación
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *         description: Nivel de urgencia
 *       - in: query
 *         name: min_budget
 *         schema:
 *           type: number
 *         description: Presupuesto mínimo
 *       - in: query
 *         name: max_budget
 *         schema:
 *           type: number
 *         description: Presupuesto máximo
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Estado del trabajo
 *     responses:
 *       200:
 *         description: Lista de trabajos exprés filtrados
 */
router.get('/express-jobs/search', async (req, res, next) => {
  try {
    const pool = await getPool();
    const {
      trade_category_id,
      location_id,
      urgency,
      min_budget,
      max_budget,
      status,
      client_id,
    } = req.query;

    let query = `
      SELECT 
        ej.*,
        tc.name as trade_category_name,
        tc.icon_name,
        ln.department,
        ln.municipality,
        u.email as client_email,
        COUNT(eja.id) as application_count
      FROM express_jobs ej
      LEFT JOIN trade_categories tc ON ej.trade_category_id = tc.id
      LEFT JOIN locations_nicaragua ln ON ej.location_id = ln.id
      LEFT JOIN users u ON ej.client_id = u.id
      LEFT JOIN express_job_applications eja ON ej.id = eja.express_job_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND ej.status = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.NVarChar(50), value: status });
      paramIndex++;
    }

    if (client_id) {
      query += ` AND ej.client_id = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.UniqueIdentifier, value: client_id });
      paramIndex++;
    }

    if (trade_category_id) {
      query += ` AND ej.trade_category_id = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.Int, value: parseInt(trade_category_id) });
      paramIndex++;
    }

    if (location_id) {
      query += ` AND ej.location_id = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.Int, value: parseInt(location_id) });
      paramIndex++;
    }

    if (urgency) {
      query += ` AND ej.urgency = @param${paramIndex}`;
      params.push({ name: `param${paramIndex}`, type: sql.NVarChar(50), value: urgency });
      paramIndex++;
    }

    if (min_budget) {
      query += ` AND (ej.budget_max IS NULL OR ej.budget_max >= @param${paramIndex})`;
      params.push({ name: `param${paramIndex}`, type: sql.Float, value: parseFloat(min_budget) });
      paramIndex++;
    }

    if (max_budget) {
      query += ` AND (ej.budget_min IS NULL OR ej.budget_min <= @param${paramIndex})`;
      params.push({ name: `param${paramIndex}`, type: sql.Float, value: parseFloat(max_budget) });
      paramIndex++;
    }

    query += `
      GROUP BY ej.id, ej.client_id, ej.trade_category_id, ej.title, ej.description,
               ej.location_id, ej.address_details, ej.urgency, ej.preferred_date,
               ej.estimated_duration, ej.budget_min, ej.budget_max, ej.currency,
               ej.payment_method, ej.status, ej.created_at, ej.updated_at, ej.expires_at,
               tc.name, tc.icon_name, ln.department, ln.municipality, u.email
      ORDER BY 
        CASE ej.urgency 
          WHEN 'inmediato' THEN 1
          WHEN 'hoy' THEN 2
          WHEN 'esta_semana' THEN 3
          ELSE 4
        END,
        ej.created_at DESC
    `;

    const request = pool.request();
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/express-jobs/{id}/applications:
 *   get:
 *     summary: Obtener postulaciones de un trabajo exprés
 *     tags: [Express Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del trabajo exprés
 *     responses:
 *       200:
 *         description: Lista de postulaciones
 */
router.get('/express-jobs/:id/applications', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    const result = await pool.request()
      .input('job_id', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          eja.*, 
          wp.full_name, 
          wp.specialty, 
          wp.profile_picture_url, 
          wp.average_rating, 
          wp.total_reviews, 
          wp.phone_number, 
          wp.whatsapp_number,
          wp.user_id AS user_id
        FROM express_job_applications eja
        JOIN worker_profiles wp ON eja.worker_id = wp.id
        WHERE eja.express_job_id = @job_id
        ORDER BY eja.applied_at ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/stats/workers:
 *   get:
 *     summary: Obtener estadísticas de trabajadores
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Estadísticas generales
 */
router.get('/stats/workers', async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as total_workers,
        COUNT(CASE WHEN available = 1 THEN 1 END) as available_workers,
        COUNT(CASE WHEN verified = 1 THEN 1 END) as verified_workers,
        AVG(average_rating) as overall_avg_rating,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as new_workers_last_month
      FROM worker_profiles
    `);

    const categoryStats = await pool.request().query(`
      SELECT 
        tc.name as category_name,
        COUNT(wp.id) as worker_count
      FROM trade_categories tc
      LEFT JOIN worker_profiles wp ON tc.id = wp.trade_category_id
      GROUP BY tc.id, tc.name
      ORDER BY worker_count DESC
    `);

    res.json({
      general: result.recordset[0],
      by_category: categoryStats.recordset
    });
  } catch (err) {
    next(err);
  }
});

// Endpoint de mantenimiento: normalizar categorías (trade_categories) corrigiendo mojibake
router.post('/maintenance/normalize-categories', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();

    // Reutilizamos una versión local de fixMojibake para este endpoint
    const fixMojibake = (s) => {
      if (!s || typeof s !== 'string') return s;
      let t = s
        .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Á').replace(/Ã‰/g, 'É').replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó').replace(/Ãš/g, 'Ú').replace(/Ã‘/g, 'Ñ')
        .replace(/Â¿/g, '¿').replace(/Â¡/g, '¡')
        .replace(/GastronomÃ­a/g, 'Gastronomía')
        .replace(/MecÃ¡nica/g, 'Mecánica')
        .replace(/ConfecciÃ³n/g, 'Confección')
        .replace(/JardinerÃ­a/g, 'Jardinería')
        .replace(/ConstrucciÃ³n/g, 'Construcción');
      t = t.normalize('NFC').trim();
      return t;
    };

    const cats = await pool.request().query('SELECT id, name, description FROM trade_categories');
    let updated = 0;
    for (const row of cats.recordset) {
      const newName = fixMojibake(row.name);
      const newDesc = row.description != null ? fixMojibake(row.description) : row.description;
      if (newName !== row.name || newDesc !== row.description) {
        await pool.request()
          .input('id', sql.Int, row.id)
          .input('name', sql.NVarChar(150), newName)
          .input('description', sql.NVarChar(255), newDesc)
          .query('UPDATE trade_categories SET name = @name, description = @description WHERE id = @id');
        updated++;
      }
    }

    res.json({ updated_categories: updated });
  } catch (err) {
    next(err);
  }
});

// Endpoint de mantenimiento: normalizar textos con acentos y corregir mojibake
router.post('/maintenance/normalize-texts', authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();

    // Utilidades de normalización en JS (extendidas para cubrir "�" y patrones comunes en español)
    const fixMojibake = (s) => {
      if (!s || typeof s !== 'string') return s;
      let t = s
        .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
        .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Á').replace(/Ã‰/g, 'É').replace(/Ã/g, 'Í')
        .replace(/Ã“/g, 'Ó').replace(/Ãš/g, 'Ú').replace(/Ã‘/g, 'Ñ')
        .replace(/Â¿/g, '¿').replace(/Â¡/g, '¡');

      // Heurísticas para el carácter de reemplazo U+FFFD (�)
      t = t
        // ñ seguida de vocal
        .replace(/n�([aeiou])/g, (_m, v) => 'ñ' + v)
        .replace(/N�([AEIOU])/g, (_m, v) => 'Ñ' + v)
        // Sufijos muy comunes de español
        .replace(/acci�n/gi, (m) => (m === m.toUpperCase() ? 'ACCIÓN' : 'acción'))
        .replace(/aci�n/gi, (m) => (m === m.toUpperCase() ? 'ACIÓN' : 'ación'))
        .replace(/ci�n/gi, (m) => (m === m.toUpperCase() ? 'CIÓN' : 'ción'))
        .replace(/si�n/gi, (m) => (m === m.toUpperCase() ? 'SIÓN' : 'sión'))
        // Palabras frecuentes en nuestro dominio
        .replace(/tuber�a/gi, (m) => (m === m.toUpperCase() ? 'TUBERÍA' : 'tubería'))
        .replace(/energ�a/gi, (m) => (m === m.toUpperCase() ? 'ENERGÍA' : 'energía'))
        .replace(/l�nea/gi, (m) => (m === m.toUpperCase() ? 'LÍNEA' : 'línea'))
        .replace(/expr�s/gi, (m) => (m === m.toUpperCase() ? 'EXPRÉS' : 'exprés'));

      t = t.normalize('NFC').replace(/\s{2,}/g, ' ').trim();
      return t;
    };

    // Procesar express_jobs: título y descripción
    const jobs = await pool.request().query('SELECT id, title, description FROM express_jobs');
    let updatedCount = 0;
    for (const row of jobs.recordset) {
      const newTitle = fixMojibake(row.title);
      const newDesc = fixMojibake(row.description);
      if (newTitle !== row.title || newDesc !== row.description) {
        await pool.request()
          .input('id', sql.UniqueIdentifier, row.id)
          .input('title', sql.NVarChar, newTitle)
          .input('description', sql.NVarChar(sql.MAX), newDesc)
          .query('UPDATE express_jobs SET title = @title, description = @description, updated_at = GETDATE() WHERE id = @id');
        updatedCount++;
      }
    }

    // Procesar aplicaciones de express_jobs: message
    const apps = await pool.request().query('SELECT id, message FROM express_job_applications');
    let updatedApps = 0;
    for (const row of apps.recordset) {
      const newMsg = fixMojibake(row.message);
      if (newMsg !== row.message) {
        await pool.request()
          .input('id', sql.UniqueIdentifier, row.id)
          .input('message', sql.NVarChar(sql.MAX), newMsg)
          .query('UPDATE express_job_applications SET message = @message, updated_at = GETDATE() WHERE id = @id');
        updatedApps++;
      }
    }

    res.json({ updated_jobs: updatedCount, updated_applications: updatedApps });
  } catch (err) {
    next(err);
  }
});

module.exports = router;