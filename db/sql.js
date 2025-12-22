const sql = require('mssql');

let poolPromise = null;

function getConfig() {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: String(process.env.DB_ENCRYPT || 'false') === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERT || 'true') === 'true'
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(getConfig());
    pool.on('error', (err) => {
      console.error('SQL Pool Error:', err);
    });
    poolPromise = pool.connect();
  }
  return poolPromise;
}

async function ensureDbConnection() {
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS ok');
  return true;
}

module.exports = {
  sql,
  getPool,
  ensureDbConnection
};
