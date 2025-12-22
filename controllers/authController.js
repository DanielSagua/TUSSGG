const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { recordFailure, reset } = require('../middlewares/loginLock');

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

async function login(req, res) {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
  const lockMinutes = parseInt(process.env.LOGIN_LOCK_MINUTES || '15', 10);

  const clave = String(req.body?.clave || '');

  if (!clave || clave.trim().length < 1) {
    return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'Debes ingresar la clave.' });
  }

  let ok = false;

  const hash = process.env.APP_PASSWORD_HASH || '';
  const plain = process.env.APP_PASSWORD || '';

  if (hash && hash.trim().length > 0) {
    ok = await bcrypt.compare(clave, hash);
  } else if (plain && plain.trim().length > 0) {
    ok = timingSafeEqualStr(clave, plain);
  } else {
    return res.status(500).json({
      ok: false,
      error: 'CONFIG',
      message: 'No hay clave configurada. Define APP_PASSWORD_HASH (recomendado) o APP_PASSWORD en .env.'
    });
  }

  if (!ok) {
    recordFailure(req, maxAttempts, lockMinutes);
    return res.status(401).json({ ok: false, error: 'INVALID', message: 'Clave incorrecta.' });
  }

  reset(req);
  req.session.authenticated = true;
  req.session.lastActivity = Date.now();

  return res.json({ ok: true });
}

function logout(req, res) {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.json({ ok: true });
  });
}

module.exports = { login, logout };
