const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { errorHandler, notFoundHandler } = require('./errors');
const routes = require('./routes');

const app = express();

// Security & parsing
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Socket.IO compatibility
}));
app.use(cors({ 
  origin: [
    'http://localhost:8081', 
    'http://localhost:8082', 
    'http://localhost:8083',
    'http://localhost:3000',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8082',
    'http://127.0.0.1:8083',
    'http://127.0.0.1:3000',
    'exp://127.0.0.1:8081',
    'exp://127.0.0.1:8083',
    'exp://localhost:8081',
    'exp://localhost:8083'
  ], 
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Rate limiting for brute-force protection
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Logging
app.use(morgan('dev'));

// API routes
app.use('/api', routes);

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 and error handlers (but exclude socket.io paths)
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io/')) {
    return next();
  }
  notFoundHandler(req, res, next);
});
app.use(errorHandler);

module.exports = app;