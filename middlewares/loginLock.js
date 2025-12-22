/**
 * Bloqueo simple por IP en memoria:
 * - MAX_LOGIN_ATTEMPTS fallidos -> lock por LOGIN_LOCK_MINUTES.
 * Nota: en producción con múltiples instancias, usar Redis/DB.
 */
const attempts = new Map();

function getKey(req) {
  // tras proxy, usar x-forwarded-for (primer ip)
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function isLocked(req) {
  const key = getKey(req);
  const rec = attempts.get(key);
  if (!rec) return { locked: false };
  if (rec.lockUntil && Date.now() < rec.lockUntil) {
    const secondsLeft = Math.ceil((rec.lockUntil - Date.now()) / 1000);
    return { locked: true, secondsLeft };
  }
  return { locked: false };
}

function recordFailure(req, maxAttempts, lockMinutes) {
  const key = getKey(req);
  const rec = attempts.get(key) || { count: 0, lockUntil: 0 };
  rec.count += 1;

  if (rec.count >= maxAttempts) {
    rec.lockUntil = Date.now() + lockMinutes * 60 * 1000;
    rec.count = 0; // reiniciar contador al bloquear
  }
  attempts.set(key, rec);
}

function reset(req) {
  const key = getKey(req);
  attempts.delete(key);
}

function loginLockMiddleware(req, res, next) {
  const info = isLocked(req);
  if (info.locked) {
    return res.status(429).json({
      ok: false,
      error: 'LOCKED',
      message: `Demasiados intentos. Intenta nuevamente en ${info.secondsLeft}s.`
    });
  }
  next();
}

module.exports = {
  loginLockMiddleware,
  recordFailure,
  reset
};
