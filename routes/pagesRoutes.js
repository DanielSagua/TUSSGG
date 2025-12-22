const express = require('express');
const { requireAuth } = require('../middlewares/requireAuth');
const { getCatalogsForViews } = require('../db/catalogs');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/trabajos');
  return res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/trabajos');
  res.render('login.njk', { publicLayout: true, expired: req.query.expired === '1' });
});

// Páginas protegidas
router.get('/trabajos', requireAuth, async (req, res, next) => {
  try {
    const catalogs = await getCatalogsForViews();
    res.render('trabajos/index.njk', { ...catalogs });
  } catch (err) { next(err); }
});

router.get('/trabajos/nuevo', requireAuth, async (req, res, next) => {
  try {
    const catalogs = await getCatalogsForViews();
    res.render('trabajos/nuevo.njk', { ...catalogs });
  } catch (err) { next(err); }
});

router.get('/trabajos/:id', requireAuth, async (req, res, next) => {
  try {
    const catalogs = await getCatalogsForViews();
    res.render('trabajos/detalle.njk', { ...catalogs, trabajoId: req.params.id });
  } catch (err) { next(err); }
});

router.get('/reportes', requireAuth, async (req, res, next) => {
  try {
    const catalogs = await getCatalogsForViews();
    res.render('reportes/index.njk', { ...catalogs, title: 'Reportes' });
  } catch (err) { next(err); }
});

module.exports = router;
