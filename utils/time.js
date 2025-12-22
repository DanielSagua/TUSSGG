const { DateTime } = require('luxon');

const ZONE = 'America/Santiago';

/**
 * Devuelve string "yyyy-MM-dd HH:mm:ss" en zona America/Santiago
 * para guardar en SQL Server como DATETIME de forma consistente.
 */
function nowSantiagoSql() {
  return DateTime.now().setZone(ZONE).toFormat('yyyy-LL-dd HH:mm:ss');
}

function dayStartSql(dateISO) {
  // dateISO: 'YYYY-MM-DD'
  return DateTime.fromISO(dateISO, { zone: ZONE }).startOf('day').toFormat('yyyy-LL-dd HH:mm:ss');
}

function dayEndSql(dateISO) {
  return DateTime.fromISO(dateISO, { zone: ZONE }).endOf('day').toFormat('yyyy-LL-dd HH:mm:ss');
}

module.exports = { ZONE, nowSantiagoSql, dayStartSql, dayEndSql };
