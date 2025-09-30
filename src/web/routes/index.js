const express = require('express');
const { login } = require('../../security/auth');
const createCrudRouter = require('./modules/crud');
const usersRouter = require('./modules/users');
const conversationsRouter = require('./modules/conversations');
const passwordRecoveryRouter = require('./modules/password-recovery');
const files = require('./modules/files');
const filesBlob = require('./modules/files_blob');
const { router: fileBackupRoutes } = require('./modules/file_backup');
const candidateProfilesCustom = require('./modules/candidate_profiles_custom');
const workersCustom = require('./modules/workers_custom');
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

// Password recovery routes
router.use('/auth', passwordRecoveryRouter);

// Health check (DB y API)
router.get('/health', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS ok');
    res.json({ api: 'ok', db: result.recordset[0].ok === 1 ? 'ok' : 'unknown' });
  } catch (err) { next(err); }
});

// CRUD routers
router.use('/users', usersRouter);
router.use('/conversations', conversationsRouter);
router.use('/files', files);
router.use('/files-blob', filesBlob);
router.use('/file-backup', fileBackupRoutes);
router.use('/candidate_profiles', candidateProfilesCustom); // Custom routes first
router.use('/candidate_profiles', createCrudRouter({ table: 'candidate_profiles', idColumn: 'user_id', idType: 'uuid', schema: schemas.candidate_profiles, requireAuthWrite: true }));
router.use('/skills', createCrudRouter({ table: 'skills', idColumn: 'id', idType: 'int', schema: schemas.skills, requireAuthWrite: true }));
router.use('/job_categories', createCrudRouter({ table: 'job_categories', idColumn: 'id', idType: 'int', schema: schemas.job_categories, requireAuthWrite: true }));
router.use('/jobs', createCrudRouter({ table: 'jobs', idColumn: 'id', idType: 'uuid', schema: schemas.jobs, requireAuthWrite: true }));
router.use('/locations_nicaragua', createCrudRouter({ table: 'locations_nicaragua', idColumn: 'id', idType: 'int', schema: schemas.locations_nicaragua, requireAuthWrite: true }));
router.use('/company_profiles', createCrudRouter({ table: 'company_profiles', idColumn: 'user_id', idType: 'uuid', schema: schemas.company_profiles, requireAuthWrite: true }));
router.use('/education', createCrudRouter({ table: 'education', idColumn: 'id', idType: 'uuid', schema: schemas.education, requireAuthWrite: true }));
router.use('/work_experience', createCrudRouter({ table: 'work_experience', idColumn: 'id', idType: 'uuid', schema: schemas.work_experience, requireAuthWrite: true }));
router.use('/candidate_skills', createCrudRouter({ table: 'candidate_skills', idColumns: ['candidate_id','skill_id'], idTypes: ['uuid','int'], schema: schemas.candidate_skills, requireAuthWrite: true }));
router.use('/job_applications', createCrudRouter({ table: 'job_applications', idColumn: 'id', idType: 'uuid', schema: schemas.job_applications, requireAuthWrite: true }));
router.use('/conversation_participants', createCrudRouter({ table: 'conversation_participants', idColumns: ['user_id','conversation_id'], idTypes: ['uuid','uuid'], schema: schemas.conversation_participants, requireAuthWrite: true }));
router.use('/messages', createCrudRouter({ table: 'messages', idColumn: 'id', idType: 'uuid', schema: schemas.messages, requireAuthWrite: true }));
router.use('/reviews', createCrudRouter({ table: 'reviews', idColumn: 'id', idType: 'uuid', schema: schemas.reviews, requireAuthWrite: true }));

// ========= RUTAS PERSONALIZADAS PARA TRABAJADORES =========
router.use('/workers', workersCustom); // Custom routes first

// ========= RUTAS CRUD PARA TRABAJADORES Y TRABAJOS EXPRÉS =========
router.use('/trade_categories', createCrudRouter({ table: 'trade_categories', idColumn: 'id', idType: 'int', schema: schemas.trade_categories, requireAuthWrite: true }));
router.use('/worker_profiles', createCrudRouter({ table: 'worker_profiles', idColumn: 'id', idType: 'uuid', schema: schemas.worker_profiles, requireAuthWrite: true }));
router.use('/worker_services', createCrudRouter({ table: 'worker_services', idColumn: 'id', idType: 'int', schema: schemas.worker_services, requireAuthWrite: true }));
router.use('/worker_service_offerings', createCrudRouter({ table: 'worker_service_offerings', idColumns: ['worker_id','service_id'], idTypes: ['uuid','int'], schema: schemas.worker_service_offerings, requireAuthWrite: true }));
router.use('/express_jobs', createCrudRouter({ table: 'express_jobs', idColumn: 'id', idType: 'uuid', schema: schemas.express_jobs, requireAuthWrite: true }));
router.use('/express_job_applications', createCrudRouter({ table: 'express_job_applications', idColumn: 'id', idType: 'uuid', schema: schemas.express_job_applications, requireAuthWrite: true }));
router.use('/worker_reviews', createCrudRouter({ table: 'worker_reviews', idColumn: 'id', idType: 'uuid', schema: schemas.worker_reviews, requireAuthWrite: true }));
router.use('/worker_portfolio', createCrudRouter({ table: 'worker_portfolio', idColumn: 'id', idType: 'uuid', schema: schemas.worker_portfolio, requireAuthWrite: true }));

module.exports = router;