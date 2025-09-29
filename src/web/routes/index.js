const express = require('express');
const { login } = require('../../security/auth');
const createCrudRouter = require('./modules/crud');
const schemas = require('../validation/schemas');
const { getPool } = require('../../db/pool');

const router = express.Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión y obtener JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token JWT
 */
router.post('/auth/login', login);

// Health check (DB y API)
router.get('/health', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS ok');
    res.json({ api: 'ok', db: result.recordset[0].ok === 1 ? 'ok' : 'unknown' });
  } catch (err) { next(err); }
});

// CRUD routers
router.use('/users', createCrudRouter({ table: 'users', idColumn: 'id', idType: 'uuid', schema: schemas.users, requireAuthWrite: true }));
router.use('/skills', createCrudRouter({ table: 'skills', idColumn: 'id', idType: 'int', schema: schemas.skills, requireAuthWrite: true }));
router.use('/job_categories', createCrudRouter({ table: 'job_categories', idColumn: 'id', idType: 'int', schema: schemas.job_categories, requireAuthWrite: true }));
router.use('/jobs', createCrudRouter({ table: 'jobs', idColumn: 'id', idType: 'uuid', schema: schemas.jobs, requireAuthWrite: true }));
router.use('/locations_nicaragua', createCrudRouter({ table: 'locations_nicaragua', idColumn: 'id', idType: 'int', schema: schemas.locations_nicaragua, requireAuthWrite: true }));
router.use('/company_profiles', createCrudRouter({ table: 'company_profiles', idColumn: 'user_id', idType: 'uuid', schema: schemas.company_profiles, requireAuthWrite: true }));
router.use('/candidate_profiles', createCrudRouter({ table: 'candidate_profiles', idColumn: 'user_id', idType: 'uuid', schema: schemas.candidate_profiles, requireAuthWrite: true }));
router.use('/education', createCrudRouter({ table: 'education', idColumn: 'id', idType: 'uuid', schema: schemas.education, requireAuthWrite: true }));
router.use('/work_experience', createCrudRouter({ table: 'work_experience', idColumn: 'id', idType: 'uuid', schema: schemas.work_experience, requireAuthWrite: true }));
router.use('/candidate_skills', createCrudRouter({ table: 'candidate_skills', idColumns: ['candidate_id','skill_id'], idTypes: ['uuid','int'], schema: schemas.candidate_skills, requireAuthWrite: true }));
router.use('/job_applications', createCrudRouter({ table: 'job_applications', idColumn: 'id', idType: 'uuid', schema: schemas.job_applications, requireAuthWrite: true }));
router.use('/conversations', createCrudRouter({ table: 'conversations', idColumn: 'id', idType: 'uuid', schema: schemas.conversations, requireAuthWrite: true }));
router.use('/conversation_participants', createCrudRouter({ table: 'conversation_participants', idColumns: ['user_id','conversation_id'], idTypes: ['uuid','uuid'], schema: schemas.conversation_participants, requireAuthWrite: true }));
router.use('/messages', createCrudRouter({ table: 'messages', idColumn: 'id', idType: 'uuid', schema: schemas.messages, requireAuthWrite: true }));
router.use('/reviews', createCrudRouter({ table: 'reviews', idColumn: 'id', idType: 'uuid', schema: schemas.reviews, requireAuthWrite: true }));

module.exports = router;