const { sql, getPool } = require('./sql');
const { nowSantiagoSql } = require('../utils/time');

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function getActorFromEnv() {
  const actor_nombre = (process.env.DEFAULT_CREADO_POR_NOMBRE || '').trim() || null;
  const actor_correo = (process.env.DEFAULT_CREADO_POR_CORREO || '').trim() || null;
  return { actor_nombre, actor_correo };
}

async function logTrabajo({ req, trabajo_id, accion, detalle }) {
  const pool = await getPool();
  const { actor_nombre, actor_correo } = getActorFromEnv();
  const ip = req ? getClientIp(req) : null;
  const ua = req ? String(req.headers['user-agent'] || '').slice(0, 250) : null;

  const fecha = nowSantiagoSql();
  const detalleTxt = detalle ? JSON.stringify(detalle) : null;

  await pool.request()
    .input('trabajo_id', sql.Int, trabajo_id)
    .input('accion', sql.NVarChar(50), accion)
    .input('detalle', sql.NVarChar(sql.MAX), detalleTxt)
    .input('actor_nombre', sql.NVarChar(100), actor_nombre)
    .input('actor_correo', sql.NVarChar(150), actor_correo)
    .input('ip', sql.NVarChar(45), ip)
    .input('ua', sql.NVarChar(255), ua)
    .input('fecha', sql.VarChar(19), fecha)
    .query(`
      INSERT INTO dbo.TrabajosLog (trabajo_id, accion, detalle, actor_nombre, actor_correo, ip, user_agent, fecha)
      VALUES (@trabajo_id, @accion, @detalle, @actor_nombre, @actor_correo, @ip, @ua, CONVERT(datetime, @fecha, 120))
    `);
}

module.exports = { logTrabajo };
