const { sql, getPool } = require('../db/sql');
const { ZONE, dayStartSql, dayEndSql } = require('../utils/time');
const { toNullableTrimmed, toIntOrNull } = require('../utils/validators');
const { DateTime } = require('luxon');

function normalizeDateOrNull(v) {
  const s = toNullableTrimmed(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function defaultRange() {
  const now = DateTime.now().setZone(ZONE);
  const from = now.minus({ days: 30 }).toISODate();
  const to = now.toISODate();
  return { from, to };
}

function maybeMigrationError(err) {
  const msg = String(err?.message || '').toLowerCase();
  // Cuando falta ejecutar la migración (tablas nuevas)
  if (msg.includes('invalid object name') && (
    msg.includes('prioridades') || msg.includes('trabajoslog') || msg.includes('comentarios')
  )) return true;
  return false;
}

function buildBaseFilter(req, pool) {
  const search = toNullableTrimmed(req.query.search);
  const estado = toIntOrNull(req.query.estado);
  const tipo = toIntOrNull(req.query.tipo);
  const ubicacion = toIntOrNull(req.query.ubicacion);
  const prioridad = toIntOrNull(req.query.prioridad);

  let from = normalizeDateOrNull(req.query.from);
  let to = normalizeDateOrNull(req.query.to);

  if (!from && !to) {
    const def = defaultRange();
    from = def.from;
    to = def.to;
  }

  const where = [];
  const r = pool.request();

  if (search) {
    where.push(`(
      t.descripcion LIKE '%' + @search + '%'
      OR ISNULL(t.proveedor,'') LIKE '%' + @search + '%'
      OR ISNULL(t.orden_compra,'') LIKE '%' + @search + '%'
      OR ISNULL(t.solicitado_por,'') LIKE '%' + @search + '%'
      OR ISNULL(t.creado_por_nombre,'') LIKE '%' + @search + '%'
      OR ISNULL(t.creado_por_correo,'') LIKE '%' + @search + '%'
      OR ISNULL(t.observaciones,'') LIKE '%' + @search + '%'
    )`);
    r.input('search', sql.NVarChar(200), search);
  }

  if (estado) { where.push('t.estado_id = @estado'); r.input('estado', sql.Int, estado); }
  if (tipo) { where.push('t.tipo_id = @tipo'); r.input('tipo', sql.Int, tipo); }
  if (ubicacion) { where.push('t.ubicacion_id = @ubicacion'); r.input('ubicacion', sql.Int, ubicacion); }
  if (prioridad) { where.push('t.prioridad_id = @prioridad'); r.input('prioridad', sql.Int, prioridad); }

  if (from) {
    where.push('t.fecha_creacion >= CONVERT(datetime, @fromDt, 120)');
    r.input('fromDt', sql.VarChar(19), dayStartSql(from));
  }
  if (to) {
    where.push('t.fecha_creacion <= CONVERT(datetime, @toDt, 120)');
    r.input('toDt', sql.VarChar(19), dayEndSql(to));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, r, range: { from, to } };
}

async function resumen(req, res) {
  const pool = await getPool();
  const { whereSql, r, range } = buildBaseFilter(req, pool);

  function cloneRequest() {
    const rr = pool.request();
    for (const p of r.parameters ? Object.values(r.parameters) : []) {
      rr.input(p.name, p.type, p.value);
    }
    return rr;
  }

  const today = DateTime.now().setZone(ZONE).toISODate();

  try {
    const kpiReq = cloneRequest();
    kpiReq.input('today', sql.Date, new Date(today));

    const kpisQ = await kpiReq.query(`
      WITH F AS (
        SELECT
          t.id,
          t.fecha_creacion,
          t.fecha_cierre,
          t.fecha_objetivo,
          e.nombre AS estado
        FROM dbo.TrabajosUrgentes t
        INNER JOIN dbo.Estados e ON e.id = t.estado_id
        ${whereSql}
      )
      SELECT
        COUNT(1) AS total,
        SUM(CASE WHEN LOWER(estado) <> 'cerrado' THEN 1 ELSE 0 END) AS abiertos,
        SUM(CASE WHEN LOWER(estado) = 'cerrado' THEN 1 ELSE 0 END) AS cerrados_rango,
        SUM(CASE WHEN LOWER(estado) <> 'cerrado' AND fecha_objetivo IS NOT NULL AND fecha_objetivo < @today THEN 1 ELSE 0 END) AS atrasados_sla
      FROM F;
    `);

    const cierreReq = cloneRequest();
    const cierreQ = await cierreReq.query(`
      WITH F AS (
        SELECT
          t.fecha_creacion,
          t.fecha_cierre
        FROM dbo.TrabajosUrgentes t
        INNER JOIN dbo.Estados e ON e.id = t.estado_id
        ${whereSql}
      )
      SELECT TOP 1
        AVG(CAST(DATEDIFF(day, fecha_creacion, fecha_cierre) AS float)) OVER() AS avg_dias_cierre,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY DATEDIFF(day, fecha_creacion, fecha_cierre)) OVER () AS median_dias_cierre
      FROM F
      WHERE fecha_cierre IS NOT NULL;
    `);

    const porEstadoQ = await cloneRequest().query(`
      SELECT e.nombre AS estado, COUNT(1) AS total
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.Estados e ON e.id = t.estado_id
      ${whereSql}
      GROUP BY e.nombre
      ORDER BY total DESC, e.nombre ASC;
    `);

    const porTipoQ = await cloneRequest().query(`
      SELECT ti.nombre AS tipo, COUNT(1) AS total
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.TiposSolicitud ti ON ti.id = t.tipo_id
      ${whereSql}
      GROUP BY ti.nombre
      ORDER BY total DESC, ti.nombre ASC;
    `);

    const porUbicacionQ = await cloneRequest().query(`
      SELECT u.nombre AS ubicacion, COUNT(1) AS total
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.Ubicaciones u ON u.id = t.ubicacion_id
      ${whereSql}
      GROUP BY u.nombre
      ORDER BY total DESC, u.nombre ASC;
    `);

    const porPrioridadQ = await cloneRequest().query(`
      SELECT ISNULL(p.nombre, 'Sin prioridad') AS prioridad, COUNT(1) AS total
      FROM dbo.TrabajosUrgentes t
      LEFT JOIN dbo.Prioridades p ON p.id = t.prioridad_id
      ${whereSql}
      GROUP BY ISNULL(p.nombre, 'Sin prioridad')
      ORDER BY total DESC;
    `);

    const topProvQ = await cloneRequest().query(`
      SELECT TOP 10
        ISNULL(NULLIF(LTRIM(RTRIM(t.proveedor)), ''), '—') AS proveedor,
        COUNT(1) AS total,
        SUM(ISNULL(t.valor_neto, 0)) AS monto_total
      FROM dbo.TrabajosUrgentes t
      ${whereSql}
      GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(t.proveedor)), ''), '—')
      ORDER BY monto_total DESC, total DESC;
    `);

    const k = kpisQ.recordset[0] || {};
    const c = cierreQ.recordset[0] || {};

    return res.json({
      ok: true,
      data: {
        range,
        kpis: {
          total: Number(k.total || 0),
          abiertos: Number(k.abiertos || 0),
          cerrados_rango: Number(k.cerrados_rango || 0),
          atrasados_sla: Number(k.atrasados_sla || 0),
          avg_dias_cierre: (c.avg_dias_cierre === null || c.avg_dias_cierre === undefined) ? null : Number(c.avg_dias_cierre),
          median_dias_cierre: (c.median_dias_cierre === null || c.median_dias_cierre === undefined) ? null : Number(c.median_dias_cierre)
        },
        porEstado: porEstadoQ.recordset || [],
        porTipo: porTipoQ.recordset || [],
        porUbicacion: porUbicacionQ.recordset || [],
        porPrioridad: porPrioridadQ.recordset || [],
        topProveedores: topProvQ.recordset || []
      }
    });
  } catch (err) {
  console.error('Error reportes resumen:', err);
  if (maybeMigrationError(err)) {
    return res.status(400).json({
      ok: false,
      error: 'MIGRATION_REQUIRED',
      message: 'Falta ejecutar la migración de features. Ejecuta sql/migrations/001_add_features.sql y reinicia el servidor.'
    });
  }
  return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
}
}

module.exports = { resumen };
