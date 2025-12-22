const { getPool } = require('./sql');

let cache = {
  loadedAt: 0,
  estados: [],
  tipos: [],
  ubicaciones: [],
  prioridades: []
};

async function loadCatalogs(force = false) {
  const now = Date.now();
  if (!force && cache.loadedAt && (now - cache.loadedAt) < 5 * 60 * 1000) {
    return cache;
  }
  const pool = await getPool();

  const [estados, tipos, ubicaciones, prioridades] = await Promise.all([
    pool.request().query('SELECT id, nombre FROM dbo.Estados ORDER BY id'),
    pool.request().query('SELECT id, nombre FROM dbo.TiposSolicitud ORDER BY id'),
    pool.request().query('SELECT id, nombre FROM dbo.Ubicaciones ORDER BY nombre'),
    pool.request().query(`IF OBJECT_ID('dbo.Prioridades','U') IS NULL
      SELECT CAST(NULL AS INT) AS id, CAST(NULL AS NVARCHAR(30)) AS nombre WHERE 1=0
    ELSE
      SELECT id, nombre FROM dbo.Prioridades ORDER BY id`)
  ]);

  cache = {
    loadedAt: now,
    estados: estados.recordset,
    tipos: tipos.recordset,
    ubicaciones: ubicaciones.recordset,
    prioridades: prioridades.recordset
  };
  return cache;
}

async function getEstadoIdByNombre(nombre) {
  const { estados } = await loadCatalogs(false);
  const found = estados.find(e => String(e.nombre).toLowerCase() === String(nombre).toLowerCase());
  return found ? found.id : null;
}

async function getCatalogsForViews() {
  const { estados, tipos, ubicaciones, prioridades } = await loadCatalogs(false);
  return { estados, tipos, ubicaciones, prioridades };
}

module.exports = {
  loadCatalogs,
  getCatalogsForViews,
  getEstadoIdByNombre
};
