function sessionActivityGuard(idleMinutes) {
  const idleMs = idleMinutes * 60 * 1000;

  return (req, res, next) => {
    if (!req.session) return next();

    const isAuthed = !!req.session.authenticated;
    if (!isAuthed) return next();

    const now = Date.now();
    const last = req.session.lastActivity || now;

    if (now - last > idleMs) {
      // Inactividad: cerrar sesión
      req.session.destroy(() => {
        if (req.originalUrl.startsWith('/api')) {
          return res.status(401).json({ ok: false, error: 'SESSION_EXPIRED', message: 'Sesión expirada por inactividad' });
        }
        return res.redirect('/login?expired=1');
      });
      return;
    }

    req.session.lastActivity = now;
    next();
  };
}

module.exports = { sessionActivityGuard };
