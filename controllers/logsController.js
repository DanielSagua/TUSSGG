const { sql, getPool } = require('../db/sql');

async function listLogs(req, res) {
  const trabajoId = Number(req.params.id);
  if (!Number.isInteger(trabajoId)) return res.status(400).json({ ok: false, error: 'VALIDATION', message: 'ID inválido' });

  const pool = await getPool();
  const q = await pool.request()
    .input('id', sql.Int, trabajoId)
    .query(`
      SELECT id, accion, detalle, actor_nombre, actor_correo, ip, user_agent,
             CONVERT(varchar(19), fecha, 120) AS fecha
      FROM dbo.TrabajosLog
      WHERE trabajo_id = @id
      ORDER BY id DESC
    `);

  const data = (q.recordset || []).map(r => {
    let parsed = null;
    if (r.detalle) {
      try { parsed = JSON.parse(r.detalle); } catch (e) {}
    }
    return { ...r, detalle_json: parsed };
  });

  return res.json({ ok: true, data });
}

module.exports = { listLogs };
