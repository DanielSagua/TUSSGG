function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }
  return res.status(404).render('errors/404.njk');
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (req.originalUrl.startsWith('/api')) {
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: 'Error interno' });
  }

  return res.status(500).render('errors/500.njk', { message: 'Error interno' });
}

module.exports = { notFoundHandler, errorHandler };
