require('dotenv').config();
const app = require('./web/app');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`OUTY API running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}. Closing server...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});