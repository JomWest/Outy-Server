const express = require('express');
const { login, authMiddleware } = require('../../security/auth');
const createCrudRouter = require('./modules/crud');
const schemas = require('../validation/schemas');

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

// CRUD routers
router.use('/users', createCrudRouter({ table: 'users', idColumn: 'id', schema: schemas.users, requireAuthWrite: true }));
router.use('/skills', createCrudRouter({ table: 'skills', idColumn: 'id', schema: schemas.skills, requireAuthWrite: true }));
router.use('/job_categories', createCrudRouter({ table: 'job_categories', idColumn: 'id', schema: schemas.job_categories, requireAuthWrite: true }));
router.use('/jobs', createCrudRouter({ table: 'jobs', idColumn: 'id', schema: schemas.jobs, requireAuthWrite: true }));
router.use('/locations_nicaragua', createCrudRouter({ table: 'locations_nicaragua', idColumn: 'id', schema: schemas.locations_nicaragua, requireAuthWrite: true }));
router.use('/company_profiles', createCrudRouter({ table: 'company_profiles', idColumn: 'user_id', schema: schemas.company_profiles, requireAuthWrite: true }));
router.use('/candidate_profiles', createCrudRouter({ table: 'candidate_profiles', idColumn: 'user_id', schema: schemas.candidate_profiles, requireAuthWrite: true }));
router.use('/education', createCrudRouter({ table: 'education', idColumn: 'id', schema: schemas.education, requireAuthWrite: true }));
router.use('/work_experience', createCrudRouter({ table: 'work_experience', idColumn: 'id', schema: schemas.work_experience, requireAuthWrite: true }));
router.use('/candidate_skills', createCrudRouter({ table: 'candidate_skills', idColumn: 'candidate_id', schema: schemas.candidate_skills, requireAuthWrite: true }));
router.use('/job_applications', createCrudRouter({ table: 'job_applications', idColumn: 'id', schema: schemas.job_applications, requireAuthWrite: true }));
router.use('/conversations', createCrudRouter({ table: 'conversations', idColumn: 'id', schema: schemas.conversations, requireAuthWrite: true }));
router.use('/conversation_participants', createCrudRouter({ table: 'conversation_participants', idColumn: 'conversation_id', schema: schemas.conversation_participants, requireAuthWrite: true }));
router.use('/messages', createCrudRouter({ table: 'messages', idColumn: 'id', schema: schemas.messages, requireAuthWrite: true }));
router.use('/reviews', createCrudRouter({ table: 'reviews', idColumn: 'id', schema: schemas.reviews, requireAuthWrite: true }));

module.exports = router;