const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const nunjucks = require('nunjucks');
const dotenv = require('dotenv');

dotenv.config();

const { ensureDbConnection } = require('./db/sql');
const { requireAuth } = require('./middlewares/requireAuth');
const { sessionActivityGuard } = require('./middlewares/sessionActivityGuard');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const pagesRouter = require('./routes/pagesRoutes');
const authRouter = require('./routes/authRoutes');
const apiTrabajosRouter = require('./routes/apiTrabajosRoutes');
const apiAdjuntosRouter = require('./routes/apiAdjuntosRoutes');
const apiReportesRouter = require('./routes/apiReportesRoutes');

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_IDLE_MINUTES = parseInt(process.env.SESSION_IDLE_MINUTES || '30', 10);
const SESSION_COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || 'false') === 'true';

app.set('trust proxy', 1); // útil si estás tras proxy/https (Render, Railway, etc.)

// Nunjucks
app.set('view engine', 'njk');
nunjucks.configure('views', {
  autoescape: true,
  express: app,
  noCache: NODE_ENV !== 'production'
});

// Seguridad básica
app.use(helmet({
  contentSecurityPolicy: false // simplifica por ahora (Bootstrap CDN). Endurecer en producción.
}));

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Sesiones
app.use(session({
  name: 'ssgg.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    maxAge: SESSION_IDLE_MINUTES * 60 * 1000
  }
}));

// Guard de inactividad (además del cookie maxAge)
app.use(sessionActivityGuard(SESSION_IDLE_MINUTES));

// Static
app.use(express.static(path.join(__dirname, 'public')));

// Uploads (puede ser carpeta externa para no perder archivos al actualizar el proyecto)
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');

const PROTECT_UPLOADS = (process.env.PROTECT_UPLOADS || '1') !== '0'; // por defecto protegido
if (PROTECT_UPLOADS) {
  app.use('/uploads', requireAuth, express.static(UPLOADS_DIR));
} else {
  app.use('/uploads', express.static(UPLOADS_DIR));
}


// Variables para vistas
app.use((req, res, next) => {
  res.locals.NODE_ENV = NODE_ENV;
  res.locals.isAuthenticated = !!(req.session && req.session.authenticated);
  res.locals.currentYear = new Date().getFullYear();

  // Defaults (prefill / auditoría)
  res.locals.DEFAULT_CREADO_POR_NOMBRE = process.env.DEFAULT_CREADO_POR_NOMBRE || '';
  res.locals.DEFAULT_CREADO_POR_CORREO = process.env.DEFAULT_CREADO_POR_CORREO || '';

  next();
});
// Rutas públicas
app.use('/', pagesRouter);
app.use('/auth', authRouter);

// Rutas protegidas (API)
app.use('/api', requireAuth, apiTrabajosRouter);
app.use('/api', requireAuth, apiAdjuntosRouter);
app.use('/api', requireAuth, apiReportesRouter);

// 404 + error handler
app.use(notFoundHandler);
app.use(errorHandler);

// DB (warm-up)
ensureDbConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a la base de datos:', err);
    process.exit(1);
  });
