const express = require('express');
const { uploadFields } = require('../middlewares/uploadMiddleware');
const trabajos = require('../controllers/trabajosController');
const comentarios = require('../controllers/comentariosController');
const logs = require('../controllers/logsController');

const router = express.Router();

// =========================
// Trabajos
// =========================

// GET /api/trabajos (listado con filtros + paginación)
router.get('/trabajos', trabajos.list);

// Exportaciones (respeta filtros del listado)
router.get('/trabajos/export.csv', trabajos.exportCsv);
router.get('/trabajos/export.xlsx', trabajos.exportXlsx);

// POST /api/trabajos (multipart)
router.post('/trabajos', uploadFields, trabajos.create);

// GET /api/trabajos/:id
router.get('/trabajos/:id', trabajos.getById);

// PUT /api/trabajos/:id
router.put('/trabajos/:id', trabajos.update);

// PATCH /api/trabajos/:id/estado
router.patch('/trabajos/:id/estado', trabajos.patchEstado);

// POST /api/trabajos/:id/adjuntos (multipart)
router.post('/trabajos/:id/adjuntos', uploadFields, trabajos.addAdjuntos);

// =========================
// Comentarios
// =========================
router.get('/trabajos/:id/comentarios', comentarios.listComentarios);
router.post('/trabajos/:id/comentarios', comentarios.addComentario);

// =========================
// Bitácora
// =========================
router.get('/trabajos/:id/logs', logs.listLogs);

module.exports = router;
