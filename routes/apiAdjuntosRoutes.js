const express = require('express');
const { deleteAdjunto } = require('../controllers/adjuntosController');
const { deleteComentario } = require('../controllers/comentariosController');

const router = express.Router();

// DELETE /api/adjuntos/:id
router.delete('/adjuntos/:id', deleteAdjunto);

// DELETE /api/comentarios/:id
router.delete('/comentarios/:id', deleteComentario);

module.exports = router;
