function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const payload = {
    error: err.message || 'Error interno del servidor',
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.details = err.details || err.stack;
  }
  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };