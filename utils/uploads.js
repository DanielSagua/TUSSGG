const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const { ZONE } = require('./time');

const ROOT = path.join(__dirname, '..');

// Permite guardar uploads fuera del proyecto (recomendado para no perderlos al actualizar)
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(ROOT, 'uploads');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  return map[mime] || 'bin';
}

/**
 * Guarda archivo en UPLOADS_DIR/yyyy-mm/
 * Retorna ruta para BD: /uploads/yyyy-mm/archivo.ext
 */
async function saveUpload({ trabajoId, buffer, mimeType, originalName }) {
  const ym = DateTime.now().setZone(ZONE).toFormat('yyyy-LL');
  const dirAbs = path.join(UPLOADS_DIR, ym);
  await ensureDir(dirAbs);

  const ext = extFromMime(mimeType);
  const ts = DateTime.now().setZone(ZONE).toFormat('yyyyLLdd_HHmmss');
  const rand = crypto.randomBytes(6).toString('hex');

  const fileName = `${trabajoId}_${ts}_${rand}.${ext}`;
  const absPath = path.join(dirAbs, fileName);

  await fs.writeFile(absPath, buffer);

  return `/uploads/${ym}/${fileName}`;
}

async function deleteUploadByRuta(rutaArchivo) {
  if (!rutaArchivo) return;

  let safe = String(rutaArchivo).replace(/\\/g, '/');
  if (!safe.startsWith('/uploads/')) return;

  // safe = /uploads/yyyy-mm/file.ext  -> UPLOADS_DIR/yyyy-mm/file.ext
  safe = safe.replace(/^\/uploads\//, '');
  const absPath = path.join(UPLOADS_DIR, safe);

  try {
    await fs.unlink(absPath);
  } catch (_) {
    // ignorar si no existe
  }
}

module.exports = { saveUpload, deleteUploadByRuta, UPLOADS_DIR };
