const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'OUTY REST API',
      version: '1.0.0',
      description: 'API RESTful para OUTY con SQL Server, CRUD, autenticación y documentación.',
    },
    servers: [
      { url: 'http://localhost:' + (process.env.PORT || 4000) }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['src/web/routes/*.js', 'src/web/routes/**/*.js'],
};

module.exports = swaggerJsdoc(options);