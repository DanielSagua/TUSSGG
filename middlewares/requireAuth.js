function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();

  // Si es API, devolver JSON
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Sesión requerida' });
  }

  // Páginas
  return res.redirect('/login');
}

module.exports = { requireAuth };
