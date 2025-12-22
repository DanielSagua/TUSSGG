const { sql, getPool } = require('../db/sql');
const { nowSantiagoSql } = require('../utils/time');
const { toNullableTrimmed, isNonEmptyString } = require('../utils/validators');
const { logTrabajo } = require('../db/logs');

async function listComentarios(req, res) {
  const trabajoId = Number(req.params.id);
  if (!Number.isInteger(trabajoId)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  const pool = await getPool();
  const q = await pool.request()
    .input('id', sql.Int, trabajoId)
    .query(`
      SELECT id, comentario, autor_nombre, autor_correo, CONVERT(varchar(19), fecha_creacion, 120) AS fecha_creacion
      FROM dbo.Comentarios
      WHERE trabajo_id = @id
      ORDER BY id DESC
    `);

  return res.json({ ok: true, data: q.recordset });
}

async function addComentario(req, res) {
  const trabajoId = Number(req.params.id);
  if (!Number.isInteger(trabajoId)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  const comentario = toNullableTrimmed(req.body?.comentario);
  if (!isNonEmptyString(comentario)) {
    return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'El comentario es obligatorio.' });
  }

  const autor_nombre = (process.env.DEFAULT_CREADO_POR_NOMBRE || '').trim() || null;
  const autor_correo = (process.env.DEFAULT_CREADO_POR_CORREO || '').trim() || null;
  const fecha = nowSantiagoSql();

  const pool = await getPool();
  const existsQ = await pool.request().input('id', sql.Int, trabajoId).query('SELECT id FROM dbo.TrabajosUrgentes WHERE id = @id');
  if (!existsQ.recordset[0]) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  const ins = await pool.request()
    .input('trabajo_id', sql.Int, trabajoId)
    .input('comentario', sql.NVarChar(sql.MAX), comentario.trim())
    .input('autor_nombre', sql.NVarChar(100), autor_nombre)
    .input('autor_correo', sql.NVarChar(150), autor_correo)
    .input('fecha', sql.VarChar(19), fecha)
    .query(`
      INSERT INTO dbo.Comentarios (trabajo_id, comentario, autor_nombre, autor_correo, fecha_creacion)
      OUTPUT INSERTED.id
      VALUES (@trabajo_id, @comentario, @autor_nombre, @autor_correo, CONVERT(datetime, @fecha, 120))
    `);

  await logTrabajo({ req, trabajo_id: trabajoId, accion: 'COMENTARIO_AGREGADO', detalle: { comentario: comentario.slice(0, 200) } });

  return res.status(201).json({ ok: true, data: { id: ins.recordset[0]?.id } });
}

async function deleteComentario(req, res) {
  const comentarioId = Number(req.params.id);
  if (!Number.isInteger(comentarioId)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  const pool = await getPool();
  const q = await pool.request()
    .input('id', sql.Int, comentarioId)
    .query('SELECT id, trabajo_id FROM dbo.Comentarios WHERE id = @id');

  const row = q.recordset[0];
  if (!row) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  await pool.request().input('id', sql.Int, comentarioId).query('DELETE FROM dbo.Comentarios WHERE id = @id');
  await logTrabajo({ req, trabajo_id: row.trabajo_id, accion: 'COMENTARIO_ELIMINADO', detalle: { comentario_id: comentarioId } });

  return res.json({ ok: true });
}

module.exports = { listComentarios, addComentario, deleteComentario };
