const { sql, getPool } = require('../db/sql');
const { deleteUploadByRuta } = require('../utils/uploads');
const { logTrabajo } = require('../db/logs');

async function deleteAdjunto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  const pool = await getPool();

  const q = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT id, trabajo_id, ruta_archivo FROM dbo.Adjuntos WHERE id = @id');

  const adj = q.recordset[0];
  if (!adj) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.Adjuntos WHERE id = @id');

  await deleteUploadByRuta(adj.ruta_archivo);

  await logTrabajo({ req, trabajo_id: adj.trabajo_id, accion: 'ADJUNTO_ELIMINADO', detalle: { adjunto_id: id } });
  return res.json({ ok: true });
}

module.exports = { deleteAdjunto };
