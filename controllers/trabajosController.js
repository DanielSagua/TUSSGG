const { sql, getPool } = require('../db/sql');
const { ZONE, nowSantiagoSql, dayStartSql, dayEndSql } = require('../utils/time');
const { DateTime } = require('luxon');

const { saveUpload } = require('../utils/uploads');
const { toNullableTrimmed, isNonEmptyString, isValidEmail, clampString } = require('../utils/validators');
const { getEstadoIdByNombre } = require('../db/catalogs');
const { logTrabajo } = require('../db/logs');

function validationError(fields) {
  return { ok: false, error: 'VALIDATION', fields };
}

function toIntOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function toDecimalOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (Number.isFinite(n)) return n;
  return null;
}

function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isMigrationMissing(err) {
  const msg = String(err?.message || '').toLowerCase();
  // tablas/columnas que dependen de la migración 001
  if (msg.includes("invalid object name") && (msg.includes("prioridades") || msg.includes("trabajoslog") || msg.includes("comentarios"))) return true;
  if (msg.includes("invalid column name") && (msg.includes("prioridad_id") || msg.includes("fecha_objetivo") || msg.includes("responsable_"))) return true;
  return false;
}

async function safeLog(payload) {
  try { await logTrabajo(payload); } catch (e) { /* no rompemos flujo por log */ }
}

async function list(req, res) {
  try {
    const pool = await getPool();

    const search = toNullableTrimmed(req.query.search);
    const estado = toIntOrNull(req.query.estado);
    const tipo = toIntOrNull(req.query.tipo);
    const ubicacion = toIntOrNull(req.query.ubicacion);
    const prioridad = toIntOrNull(req.query.prioridad);

    const from = toNullableTrimmed(req.query.from); // YYYY-MM-DD
    const to = toNullableTrimmed(req.query.to);     // YYYY-MM-DD

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(5, Number(req.query.pageSize) || 100));
    const offset = (page - 1) * pageSize;

    const where = [];
    if (search) where.push("(t.descripcion LIKE @search OR t.proveedor LIKE @search OR t.orden_compra LIKE @search OR t.solicitado_por LIKE @search)");
    if (estado) where.push("t.estado_id = @estado");
    if (tipo) where.push("t.tipo_id = @tipo");
    if (ubicacion) where.push("t.ubicacion_id = @ubicacion");
    if (prioridad) where.push("t.prioridad_id = @prioridad");

    if (from && isIsoDate(from)) where.push("t.fecha_creacion >= CONVERT(datetime, @from, 120)");
    if (to && isIsoDate(to)) where.push("t.fecha_creacion <= CONVERT(datetime, @to, 120)");

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // count
    const r = pool.request();
    if (search) r.input('search', sql.NVarChar(200), `%${search}%`);
    if (estado) r.input('estado', sql.Int, estado);
    if (tipo) r.input('tipo', sql.Int, tipo);
    if (ubicacion) r.input('ubicacion', sql.Int, ubicacion);
    if (prioridad) r.input('prioridad', sql.Int, prioridad);

    if (from && isIsoDate(from)) r.input('from', sql.VarChar(19), dayStartSql(from));
    if (to && isIsoDate(to)) r.input('to', sql.VarChar(19), dayEndSql(to));

    const countQ = await r.query(`
      SELECT COUNT(1) AS total
      FROM dbo.TrabajosUrgentes t
      ${whereSql}
    `);

    const total = countQ.recordset?.[0]?.total || 0;

    // data (reusar parámetros de forma segura)
    const r2 = pool.request();
    for (const p of r.parameters ? Object.values(r.parameters) : []) {
      r2.input(p.name, p.type, p.value);
    }
    r2.input('offset', sql.Int, offset);
    r2.input('limit', sql.Int, pageSize);

    const dataQ = await r2.query(`
      SELECT
        t.id,
        CONVERT(varchar(19), t.fecha_creacion, 120) AS fecha_creacion,
        t.proveedor,
        t.descripcion,
        t.orden_compra,
        t.valor_neto,
        t.fecha_reparacion,
        t.solicitado_por,
        t.fecha_cierre,
        t.prioridad_id,
        t.fecha_objetivo,
        t.responsable_nombre,
        t.responsable_correo,
        e.nombre AS estado,
        ti.nombre AS tipo,
        u.nombre AS ubicacion,
        p.nombre AS prioridad
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.Estados e ON e.id = t.estado_id
      INNER JOIN dbo.TiposSolicitud ti ON ti.id = t.tipo_id
      INNER JOIN dbo.Ubicaciones u ON u.id = t.ubicacion_id
      LEFT JOIN dbo.Prioridades p ON p.id = t.prioridad_id
      ${whereSql}
      ORDER BY t.fecha_creacion DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const now = DateTime.now().setZone(ZONE);

    const enriched = (dataQ.recordset || []).map(row => {
      const fc = row.fecha_creacion
        ? DateTime.fromFormat(row.fecha_creacion, 'yyyy-LL-dd HH:mm:ss', { zone: ZONE })
        : null;

      const dias_abierto = fc ? Math.max(0, Math.floor(now.diff(fc, 'days').days)) : null;

      let atrasado = false;
      if (row.fecha_objetivo && String(row.estado || '').toLowerCase() !== 'cerrado') {
        const fo = DateTime.fromJSDate(row.fecha_objetivo, { zone: ZONE }).endOf('day');
        atrasado = now > fo;
      }

      return { ...row, dias_abierto, atrasado };
    });

    return res.json({ ok: true, data: enriched, meta: { total, page, pageSize } });
  } catch (err) {
    console.error('Error list trabajos:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function exportCsv(req, res) {
  try {
    const pool = await getPool();

    const { whereSql, binder } = buildListFilters(req);
    const r = pool.request();
    binder(r);

    const q = await r.query(`
      SELECT
        t.id,
        CONVERT(varchar(19), t.fecha_creacion, 120) AS fecha_creacion,
        e.nombre AS estado,
        ti.nombre AS tipo,
        u.nombre AS ubicacion,
        p.nombre AS prioridad,
        t.proveedor,
        t.descripcion,
        t.orden_compra,
        t.valor_neto,
        t.solicitado_por,
        t.fecha_reparacion,
        t.fecha_objetivo,
        t.responsable_nombre,
        t.responsable_correo
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.Estados e ON e.id = t.estado_id
      INNER JOIN dbo.TiposSolicitud ti ON ti.id = t.tipo_id
      INNER JOIN dbo.Ubicaciones u ON u.id = t.ubicacion_id
      LEFT JOIN dbo.Prioridades p ON p.id = t.prioridad_id
      ${whereSql}
      ORDER BY t.fecha_creacion DESC
    `);

    const now = DateTime.now().setZone(ZONE);
    const rows = (q.recordset || []).map(row => {
      const fc = row.fecha_creacion
        ? DateTime.fromFormat(row.fecha_creacion, 'yyyy-LL-dd HH:mm:ss', { zone: ZONE })
        : null;

      const dias_abierto = fc ? Math.max(0, Math.floor(now.diff(fc, 'days').days)) : null;

      let atrasado = false;
      if (row.fecha_objetivo && String(row.estado || '').toLowerCase() !== 'cerrado') {
        const fo = DateTime.fromJSDate(row.fecha_objetivo, { zone: ZONE }).endOf('day');
        atrasado = now > fo;
      }

      return { ...row, dias_abierto, atrasado };
    });

    // CSV con separador ';' + BOM para Excel (acentos)
    const headers = [
      'id','fecha_creacion','estado','tipo','ubicacion','prioridad',
      'proveedor','descripcion','orden_compra','valor_neto','solicitado_por',
      'fecha_reparacion','fecha_objetivo','responsable_nombre','responsable_correo',
      'dias_abierto','atrasado'
    ];

    const escapeCsv = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // si contiene separador, comillas o salto, se quotea
      if (/[\";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    let out = '\ufeff' + headers.join(';') + '\n';
    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h];
        if (v instanceof Date) return escapeCsv(DateTime.fromJSDate(v, { zone: ZONE }).toISODate());
        return escapeCsv(v);
      });
      out += vals.join(';') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trabajos_urgentes_ssgg.csv"');
    return res.send(out);
  } catch (err) {
    console.error('Error exportCsv:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function exportXlsx(req, res) {
  try {
    const ExcelJS = require('exceljs');

    const pool = await getPool();

    const { whereSql, binder } = buildListFilters(req);
    const r = pool.request();
    binder(r);

    const q = await r.query(`
      SELECT
        t.id,
        CONVERT(varchar(19), t.fecha_creacion, 120) AS fecha_creacion,
        e.nombre AS estado,
        ti.nombre AS tipo,
        u.nombre AS ubicacion,
        p.nombre AS prioridad,
        t.proveedor,
        t.descripcion,
        t.orden_compra,
        t.valor_neto,
        t.solicitado_por,
        t.fecha_reparacion,
        t.fecha_objetivo,
        t.responsable_nombre,
        t.responsable_correo
      FROM dbo.TrabajosUrgentes t
      INNER JOIN dbo.Estados e ON e.id = t.estado_id
      INNER JOIN dbo.TiposSolicitud ti ON ti.id = t.tipo_id
      INNER JOIN dbo.Ubicaciones u ON u.id = t.ubicacion_id
      LEFT JOIN dbo.Prioridades p ON p.id = t.prioridad_id
      ${whereSql}
      ORDER BY t.fecha_creacion DESC
    `);

    const now = DateTime.now().setZone(ZONE);
    const rows = (q.recordset || []).map(row => {
      const fc = row.fecha_creacion
        ? DateTime.fromFormat(row.fecha_creacion, 'yyyy-LL-dd HH:mm:ss', { zone: ZONE })
        : null;
      const dias_abierto = fc ? Math.max(0, Math.floor(now.diff(fc, 'days').days)) : null;

      let atrasado = false;
      if (row.fecha_objetivo && String(row.estado || '').toLowerCase() !== 'cerrado') {
        const fo = DateTime.fromJSDate(row.fecha_objetivo, { zone: ZONE }).endOf('day');
        atrasado = now > fo;
      }

      return {
        ...row,
        fecha_reparacion: row.fecha_reparacion ? DateTime.fromJSDate(row.fecha_reparacion, { zone: ZONE }).toISODate() : '',
        fecha_objetivo: row.fecha_objetivo ? DateTime.fromJSDate(row.fecha_objetivo, { zone: ZONE }).toISODate() : '',
        dias_abierto,
        atrasado: atrasado ? 'SI' : 'NO'
      };
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Trabajos Urgentes SSGG';
    wb.created = new Date();

    const ws = wb.addWorksheet('Trabajos', { views: [{ state: 'frozen', ySplit: 1 }] });

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha creación', key: 'fecha_creacion', width: 20 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Ubicación', key: 'ubicacion', width: 20 },
      { header: 'Prioridad', key: 'prioridad', width: 12 },
      { header: 'Proveedor', key: 'proveedor', width: 18 },
      { header: 'Descripción', key: 'descripcion', width: 45 },
      { header: 'OC', key: 'orden_compra', width: 12 },
      { header: 'Valor neto', key: 'valor_neto', width: 14 },
      { header: 'Solicitado por', key: 'solicitado_por', width: 18 },
      { header: 'Fecha reparación', key: 'fecha_reparacion', width: 14 },
      { header: 'Fecha objetivo', key: 'fecha_objetivo', width: 14 },
      { header: 'Resp. nombre', key: 'responsable_nombre', width: 18 },
      { header: 'Resp. correo', key: 'responsable_correo', width: 24 },
      { header: 'Días abierto', key: 'dias_abierto', width: 12 },
      { header: 'Atrasado', key: 'atrasado', width: 10 }
    ];

    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: 'A1', to: 'Q1' };

    rows.forEach(rw => ws.addRow(rw));

    const buffer = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="trabajos_urgentes_ssgg.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error exportXlsx:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

/**
 * Construye filtros para list/export en base a querystring
 * Retorna { whereSql, binder } donde binder(request) aplica los .input correspondientes.
 */
function buildListFilters(req) {
  const search = toNullableTrimmed(req.query.search);
  const estado = toIntOrNull(req.query.estado);
  const tipo = toIntOrNull(req.query.tipo);
  const ubicacion = toIntOrNull(req.query.ubicacion);
  const prioridad = toIntOrNull(req.query.prioridad);

  const from = toNullableTrimmed(req.query.from); // YYYY-MM-DD
  const to = toNullableTrimmed(req.query.to);     // YYYY-MM-DD

  const where = [];
  const binders = [];

  if (search) {
    where.push("(t.descripcion LIKE @search OR t.proveedor LIKE @search OR t.orden_compra LIKE @search OR t.solicitado_por LIKE @search)");
    binders.push(r => r.input('search', sql.NVarChar(200), `%${search}%`));
  }
  if (estado) {
    where.push("t.estado_id = @estado");
    binders.push(r => r.input('estado', sql.Int, estado));
  }
  if (tipo) {
    where.push("t.tipo_id = @tipo");
    binders.push(r => r.input('tipo', sql.Int, tipo));
  }
  if (ubicacion) {
    where.push("t.ubicacion_id = @ubicacion");
    binders.push(r => r.input('ubicacion', sql.Int, ubicacion));
  }
  if (prioridad) {
    where.push("t.prioridad_id = @prioridad");
    binders.push(r => r.input('prioridad', sql.Int, prioridad));
  }
  if (from && isIsoDate(from)) {
    where.push("t.fecha_creacion >= CONVERT(datetime, @from, 120)");
    binders.push(r => r.input('from', sql.VarChar(19), dayStartSql(from)));
  }
  if (to && isIsoDate(to)) {
    where.push("t.fecha_creacion <= CONVERT(datetime, @to, 120)");
    binders.push(r => r.input('to', sql.VarChar(19), dayEndSql(to)));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const binder = (r) => binders.forEach(fn => fn(r));

  return { whereSql, binder };
}

async function getById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  try {
    const pool = await getPool();

    const jobQ = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          t.*,
          CONVERT(varchar(19), t.fecha_creacion, 120) AS fecha_creacion_str,
          CONVERT(varchar(19), t.fecha_cierre, 120) AS fecha_cierre_str,
          CONVERT(varchar(10), t.fecha_objetivo, 23) AS fecha_objetivo_str,
          e.nombre AS estado_nombre,
          ti.nombre AS tipo_nombre,
          u.nombre AS ubicacion_nombre,
          p.nombre AS prioridad_nombre
        FROM dbo.TrabajosUrgentes t
        INNER JOIN dbo.Estados e ON e.id = t.estado_id
        INNER JOIN dbo.TiposSolicitud ti ON ti.id = t.tipo_id
        INNER JOIN dbo.Ubicaciones u ON u.id = t.ubicacion_id
        LEFT JOIN dbo.Prioridades p ON p.id = t.prioridad_id
        WHERE t.id = @id
      `);

    const trabajo = jobQ.recordset[0];
    if (!trabajo) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    const adjQ = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        IF COL_LENGTH('dbo.Adjuntos','tipo_adjunto') IS NOT NULL
        BEGIN
          IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL
            SELECT id, ruta_archivo, tipo_adjunto AS tipo, original_name
            FROM dbo.Adjuntos
            WHERE trabajo_id = @id
            ORDER BY id DESC;
          ELSE
            SELECT id, ruta_archivo, tipo_adjunto AS tipo, CAST(NULL AS NVARCHAR(255)) AS original_name
            FROM dbo.Adjuntos
            WHERE trabajo_id = @id
            ORDER BY id DESC;
        END
        ELSE
        BEGIN
          IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL
            SELECT id, ruta_archivo, tipo AS tipo, original_name
            FROM dbo.Adjuntos
            WHERE trabajo_id = @id
            ORDER BY id DESC;
          ELSE
            SELECT id, ruta_archivo, tipo AS tipo, CAST(NULL AS NVARCHAR(255)) AS original_name
            FROM dbo.Adjuntos
            WHERE trabajo_id = @id
            ORDER BY id DESC;
        END
      `);

    trabajo.adjuntos = adjQ.recordset;

    // normalizamos fecha_objetivo para el front
    if (trabajo.fecha_objetivo_str && !trabajo.fecha_objetivo) {
      trabajo.fecha_objetivo = trabajo.fecha_objetivo_str;
    }

    return res.json({ ok: true, data: trabajo });
  } catch (err) {
    console.error('Error getById trabajo:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

function validateTrabajoPayload(body, mode = 'create') {
  const fields = {};

  const descripcion = clampString(body.descripcion || '', 4000);
  const ubicacion_id = toIntOrNull(body.ubicacion_id);
  const tipo_id = toIntOrNull(body.tipo_id);
  const estado_id = toIntOrNull(body.estado_id);

  if (!isNonEmptyString(descripcion)) fields.descripcion = 'La descripción es obligatoria.';
  if (!ubicacion_id) fields.ubicacion_id = 'Selecciona una ubicación.';
  if (!tipo_id) fields.tipo_id = 'Selecciona un tipo.';
  if (mode === 'update' && !estado_id) fields.estado_id = 'Selecciona un estado.';

  const valor_neto = toDecimalOrNull(body.valor_neto);
  if (body.valor_neto && valor_neto === null) fields.valor_neto = 'Valor neto inválido.';

  const creado_por_nombre = toNullableTrimmed(body.creado_por_nombre);
  const creado_por_correo = toNullableTrimmed(body.creado_por_correo);
  if (creado_por_correo && !isValidEmail(creado_por_correo)) fields.creado_por_correo = 'Correo inválido.';

  const fecha_reparacion = toNullableTrimmed(body.fecha_reparacion);
  if (fecha_reparacion && !isIsoDate(fecha_reparacion)) fields.fecha_reparacion = 'Fecha inválida.';

  // Extras v1.1+
  const prioridad_id = toIntOrNull(body.prioridad_id);
  const fecha_objetivo = toNullableTrimmed(body.fecha_objetivo);
  if (fecha_objetivo && !isIsoDate(fecha_objetivo)) fields.fecha_objetivo = 'Fecha objetivo inválida.';

  const responsable_nombre = toNullableTrimmed(body.responsable_nombre);
  const responsable_correo = toNullableTrimmed(body.responsable_correo);
  if (responsable_correo && !isValidEmail(responsable_correo)) fields.responsable_correo = 'Correo de responsable inválido.';

  return {
    fields,
    values: {
      creado_por_nombre,
      creado_por_correo,
      proveedor: toNullableTrimmed(body.proveedor),
      descripcion,
      ubicacion_id,
      orden_compra: toNullableTrimmed(body.orden_compra),
      valor_neto,
      tipo_id,
      estado_id,
      fecha_reparacion,
      solicitado_por: toNullableTrimmed(body.solicitado_por),
      observaciones: toNullableTrimmed(body.observaciones),

      prioridad_id,
      fecha_objetivo,
      responsable_nombre,
      responsable_correo
    }
  };
}

async function create(req, res) {
  try {
    const pool = await getPool();

    const { fields, values } = validateTrabajoPayload(req.body, 'create');
    if (Object.keys(fields).length) return res.status(400).json(validationError(fields));

    // Defaults backend si viene vacío
    const defNombre = (process.env.DEFAULT_CREADO_POR_NOMBRE || '').trim() || null;
    const defCorreo = (process.env.DEFAULT_CREADO_POR_CORREO || '').trim() || null;
    values.creado_por_nombre = values.creado_por_nombre || defNombre;
    values.creado_por_correo = values.creado_por_correo || defCorreo;

    // Estado default: Pendiente
    const estadoId = await getEstadoIdByNombre('Pendiente');

    const fecha = nowSantiagoSql();

    const ins = await pool.request()
      .input('fecha_creacion', sql.VarChar(19), fecha)
      .input('creado_por_nombre', sql.NVarChar(100), values.creado_por_nombre)
      .input('creado_por_correo', sql.NVarChar(150), values.creado_por_correo)
      .input('proveedor', sql.NVarChar(150), values.proveedor)
      .input('descripcion', sql.NVarChar(sql.MAX), values.descripcion)
      .input('ubicacion_id', sql.Int, values.ubicacion_id)
      .input('orden_compra', sql.NVarChar(50), values.orden_compra)
      .input('valor_neto', sql.Decimal(12,2), values.valor_neto)
      .input('tipo_id', sql.Int, values.tipo_id)
      .input('estado_id', sql.Int, estadoId)
      .input('fecha_reparacion', sql.Date, values.fecha_reparacion ? new Date(values.fecha_reparacion) : null)
      .input('solicitado_por', sql.NVarChar(100), values.solicitado_por)
      .input('observaciones', sql.NVarChar(sql.MAX), values.observaciones)
      .input('prioridad_id', sql.Int, values.prioridad_id)
      .input('fecha_objetivo', sql.Date, values.fecha_objetivo ? new Date(values.fecha_objetivo) : null)
      .input('responsable_nombre', sql.NVarChar(100), values.responsable_nombre)
      .input('responsable_correo', sql.NVarChar(150), values.responsable_correo)
      .query(`
        INSERT INTO dbo.TrabajosUrgentes (
          fecha_creacion, creado_por_nombre, creado_por_correo, proveedor, descripcion,
          ubicacion_id, orden_compra, valor_neto, tipo_id, estado_id, fecha_reparacion, solicitado_por, observaciones,
          prioridad_id, fecha_objetivo, responsable_nombre, responsable_correo
        )
        OUTPUT INSERTED.id
        VALUES (
          CONVERT(datetime, @fecha_creacion, 120), @creado_por_nombre, @creado_por_correo, @proveedor, @descripcion,
          @ubicacion_id, @orden_compra, @valor_neto, @tipo_id, @estado_id, @fecha_reparacion, @solicitado_por, @observaciones,
          @prioridad_id, @fecha_objetivo, @responsable_nombre, @responsable_correo
        );
      `);

    const trabajoId = ins.recordset[0]?.id;

    const saved = await handleAdjuntosUpload(pool, trabajoId, req.files);

    await safeLog({ req, trabajo_id: trabajoId, accion: 'CREADO', detalle: { tipo_id: values.tipo_id, ubicacion_id: values.ubicacion_id, prioridad_id: values.prioridad_id, fecha_objetivo: values.fecha_objetivo } });
    if (saved.length) await safeLog({ req, trabajo_id: trabajoId, accion: 'ADJUNTO_SUBIDO', detalle: { count: saved.length } });

    return res.status(201).json({ ok: true, data: { id: trabajoId, adjuntos: saved } });
  } catch (err) {
    console.error('Error create trabajo:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  try {
    const pool = await getPool();

    const { fields, values } = validateTrabajoPayload(req.body, 'update');
    if (Object.keys(fields).length) return res.status(400).json(validationError(fields));

    const upd = await pool.request()
      .input('id', sql.Int, id)
      .input('creado_por_nombre', sql.NVarChar(100), values.creado_por_nombre)
      .input('creado_por_correo', sql.NVarChar(150), values.creado_por_correo)
      .input('proveedor', sql.NVarChar(150), values.proveedor)
      .input('descripcion', sql.NVarChar(sql.MAX), values.descripcion)
      .input('ubicacion_id', sql.Int, values.ubicacion_id)
      .input('orden_compra', sql.NVarChar(50), values.orden_compra)
      .input('valor_neto', sql.Decimal(12,2), values.valor_neto)
      .input('tipo_id', sql.Int, values.tipo_id)
      .input('estado_id', sql.Int, values.estado_id)
      .input('fecha_reparacion', sql.Date, values.fecha_reparacion ? new Date(values.fecha_reparacion) : null)
      .input('solicitado_por', sql.NVarChar(100), values.solicitado_por)
      .input('observaciones', sql.NVarChar(sql.MAX), values.observaciones)
      .input('prioridad_id', sql.Int, values.prioridad_id)
      .input('fecha_objetivo', sql.Date, values.fecha_objetivo ? new Date(values.fecha_objetivo) : null)
      .input('responsable_nombre', sql.NVarChar(100), values.responsable_nombre)
      .input('responsable_correo', sql.NVarChar(150), values.responsable_correo)
      .query(`
        UPDATE dbo.TrabajosUrgentes
        SET creado_por_nombre = @creado_por_nombre,
            creado_por_correo = @creado_por_correo,
            proveedor = @proveedor,
            descripcion = @descripcion,
            ubicacion_id = @ubicacion_id,
            orden_compra = @orden_compra,
            valor_neto = @valor_neto,
            tipo_id = @tipo_id,
            estado_id = @estado_id,
            fecha_reparacion = @fecha_reparacion,
            solicitado_por = @solicitado_por,
            observaciones = @observaciones,
            prioridad_id = @prioridad_id,
            fecha_objetivo = @fecha_objetivo,
            responsable_nombre = @responsable_nombre,
            responsable_correo = @responsable_correo
        WHERE id = @id;
        SELECT @@ROWCOUNT AS affected;
      `);

    const affected = upd.recordset?.[0]?.affected || 0;
    if (!affected) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    await safeLog({ req, trabajo_id: id, accion: 'EDITADO', detalle: { descripcion: values.descripcion?.slice(0, 200) } });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error update trabajo:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function patchEstado(req, res) {
  const id = Number(req.params.id);
  const estado_id = toIntOrNull(req.body?.estado_id);

  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });
  if (!estado_id) return res.status(400).json(validationError({ estado_id: 'Estado inválido.' }));

  try {
    const pool = await getPool();
    const fecha = nowSantiagoSql();

    const prevQ = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT estado_id FROM dbo.TrabajosUrgentes WHERE id = @id');
    const estadoAnterior = prevQ.recordset[0]?.estado_id || null;

    // ¿Es Cerrado?
    const estadoQ = await pool.request()
      .input('id', sql.Int, estado_id)
      .query('SELECT nombre FROM dbo.Estados WHERE id = @id');

    const nombre = estadoQ.recordset[0]?.nombre;
    const isCerrado = (String(nombre || '').toLowerCase() === 'cerrado');

    const upd = await pool.request()
      .input('id', sql.Int, id)
      .input('estado_id', sql.Int, estado_id)
      .input('fecha_cierre', sql.VarChar(19), isCerrado ? fecha : null)
      .query(`
        UPDATE dbo.TrabajosUrgentes
        SET estado_id = @estado_id,
            fecha_cierre = CASE WHEN @fecha_cierre IS NULL THEN NULL ELSE CONVERT(datetime, @fecha_cierre, 120) END
        WHERE id = @id;
        SELECT @@ROWCOUNT AS affected;
      `);

    const affected = upd.recordset?.[0]?.affected || 0;
    if (!affected) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

    await safeLog({ req, trabajo_id: id, accion: 'ESTADO_CAMBIADO', detalle: { from: estadoAnterior, to: estado_id, cerrado: isCerrado } });

    return res.json({ ok: true, data: { estado_id, cerrado: isCerrado } });
  } catch (err) {
    console.error('Error patch estado:', err);
    if (isMigrationMissing(err)) {
      return res.status(500).json({ ok: false, error: 'MIGRATION_REQUIRED', message: 'Falta ejecutar sql/migrations/001_add_features.sql' });
    }
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function addAdjuntos(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  try {
    const pool = await getPool();
    const saved = await handleAdjuntosUpload(pool, id, req.files);

    if (saved.length) await safeLog({ req, trabajo_id: id, accion: 'ADJUNTO_SUBIDO', detalle: { count: saved.length } });

    return res.status(201).json({ ok: true, data: { adjuntos: saved } });
  } catch (err) {
    console.error('Error add adjuntos:', err);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
}

async function handleAdjuntosUpload(pool, trabajoId, files) {
  if (!files) return [];

  const saved = [];
  const groups = [
    { field: 'antes', tipo: 'antes' },
    { field: 'despues', tipo: 'despues' },
    { field: 'evidencia', tipo: 'evidencia' }
  ];

  for (const g of groups) {
    const arr = files[g.field] || [];
    for (const f of arr) {
      const ruta = await saveUpload({
        trabajoId,
        buffer: f.buffer,
        mimeType: f.mimetype,
        originalName: f.originalname
      });

      const fecha = nowSantiagoSql();

      const ins = await pool.request()
        .input('trabajo_id', sql.Int, trabajoId)
        .input('ruta_archivo', sql.NVarChar(300), ruta)
        .input('tipo', sql.NVarChar(20), g.tipo)
        .input('original_name', sql.NVarChar(255), f.originalname)
        .input('fecha', sql.VarChar(19), fecha)
        .query(`
          -- Compat: algunas BD usan columna tipo_adjunto en vez de tipo
          IF COL_LENGTH('dbo.Adjuntos','tipo_adjunto') IS NOT NULL
          BEGIN
            IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL AND COL_LENGTH('dbo.Adjuntos','fecha_subida') IS NOT NULL
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo_adjunto, original_name, fecha_subida)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo, @original_name, CONVERT(datetime, @fecha, 120));
            END
            ELSE IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo_adjunto, original_name)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo, @original_name);
            END
            ELSE
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo_adjunto)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo);
            END
          END
          ELSE
          BEGIN
            IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL AND COL_LENGTH('dbo.Adjuntos','fecha_subida') IS NOT NULL
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo, original_name, fecha_subida)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo, @original_name, CONVERT(datetime, @fecha, 120));
            END
            ELSE IF COL_LENGTH('dbo.Adjuntos','original_name') IS NOT NULL
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo, original_name)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo, @original_name);
            END
            ELSE
            BEGIN
              INSERT INTO dbo.Adjuntos (trabajo_id, ruta_archivo, tipo)
              OUTPUT INSERTED.id
              VALUES (@trabajo_id, @ruta_archivo, @tipo);
            END
          END
        `);

      saved.push({ id: ins.recordset[0]?.id, ruta_archivo: ruta, tipo: g.tipo, original_name: f.originalname });
    }
  }

  return saved;
}

module.exports = {
  list,
  exportCsv,
  exportXlsx,
  getById,
  create,
  update,
  patchEstado,
  addAdjuntos
};
