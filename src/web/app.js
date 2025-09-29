const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { errorHandler, notFoundHandler } = require('./errors');
const routes = require('./routes');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for brute-force protection
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Logging
app.use(morgan('dev'));

// API routes
app.use('/api', routes);

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;