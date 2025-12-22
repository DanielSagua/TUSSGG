const express = require('express');
const reportes = require('../controllers/reportesController');

const router = express.Router();

// GET /api/reportes/resumen (KPIs + breakdowns)
router.get('/reportes/resumen', reportes.resumen);

module.exports = router;
