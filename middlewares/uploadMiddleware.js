const multer = require('multer');

const maxMb = parseInt(process.env.UPLOAD_MAX_MB || '5', 10);
const maxBytes = maxMb * 1024 * 1024;

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileFilter(req, file, cb) {
  if (!allowed.has(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido. Usa jpg, png o webp.'));
  }
  cb(null, true);
}

// Usamos memoria para poder nombrar con {id + timestamp} tras crear el trabajo.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter
});

const fields = upload.fields([
  { name: 'antes', maxCount: 2 },
  { name: 'despues', maxCount: 2 },
  { name: 'evidencia', maxCount: 20 }
]);

module.exports = { uploadFields: fields };
