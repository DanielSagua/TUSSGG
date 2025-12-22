# Trabajos Urgentes SSGG

App web interna para registrar y hacer seguimiento de **trabajos urgentes** realizados por Servicios Generales (SSGG).  
Frontend híbrido: **Nunjucks (SSR)** + **fetch a /api** para listados y acciones rápidas.

## Stack
- Node.js + Express
- SQL Server (mssql)
- Sesiones: express-session
- Templates: Nunjucks (layouts + partials)
- Uploads: multer (en memoria) + guardado en `/uploads/yyyy-mm/`
- Bootstrap 5.3 + JavaScript

## Requisitos
- Node.js 18+ (recomendado 20+)
- SQL Server (local o remoto)

## 1) Base de datos
Ejecuta el script:

- `sql/schema.sql`

> Puedes ejecutarlo en SSMS.  
> Crea tablas normalizadas y precarga catálogos (Estados, Tipos, Ubicaciones).

## 2) Variables de entorno
Copia `.env.example` a `.env` y completa valores:

```bash
cp .env.example .env
```

### Login (una sola clave)
Recomendado: usar hash bcrypt (guardar en `APP_PASSWORD_HASH`):

```bash
node -e "console.log(require('bcryptjs').hashSync('TU_CLAVE', 12))"
```

## 3) Instalar y correr
```bash
npm install
npm run dev
# o
npm start
```

Abrir: `http://localhost:3000`

## Estructura
```
/views              # Nunjucks (layouts + partials + páginas)
/public             # CSS/JS estáticos
/uploads            # Archivos subidos (se crea automáticamente)
/db                 # conexión SQL Server + helpers
/routes             # rutas páginas + api
/controllers        # lógica
/middlewares        # auth, errores, rate-limit login
/sql                # schema + seeds
app.js
```

## Notas de seguridad / producción
- `SESSION_COOKIE_SECURE=true` si estás detrás de HTTPS.
- Para producción, usa un **session store** externo (ej: Redis o SQL) en vez del MemoryStore.
- `/uploads` se sirve **protegido** (requiere sesión).

## Migraciones (features extra)
Ejecuta `sql/migrations/001_add_features.sql` después de `sql/schema.sql`.

### Extras v1.1
- Prioridad + Fecha objetivo (SLA)
- Responsable
- Comentarios
- Bitácora (auditoría)

Recuerda ejecutar `sql/migrations/001_add_features.sql`.

## Reportes
- Página: `GET /reportes`
- API: `GET /api/reportes/resumen` (usa filtros: search, estado, tipo, ubicacion, prioridad, from, to)

## Exportaciones
- `GET /api/trabajos/export.csv`
- `GET /api/trabajos/export.xlsx`

> Nota: las exportaciones se limitan a 20.000 registros por seguridad.

## Hotfix v1.2.1
- Fix JOIN Prioridades duplicado (alias p)
- Fix campo responsable_correo
- Manejo de errores en endpoints (no cae el servidor)

## Uploads persistentes (recomendado)
Para no perder imágenes al actualizar el proyecto, define en `.env` una carpeta externa:
- `UPLOADS_DIR=C:\\Daniel\\SSGG_Uploads` (Windows)
- Mantén `PROTECT_UPLOADS=1` para exigir sesión.
