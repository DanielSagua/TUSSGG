/*
  Trabajos Urgentes SSGG - SQL Server Schema + Seeds
  Ejecutar en la BD objetivo (DB_DATABASE).
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =========================
-- Catálogos
-- =========================
IF OBJECT_ID('dbo.Estados', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Estados (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL UNIQUE
  );
END
GO

IF OBJECT_ID('dbo.TiposSolicitud', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TiposSolicitud (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL UNIQUE
  );
END
GO

IF OBJECT_ID('dbo.Ubicaciones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Ubicaciones (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL UNIQUE
  );
END
GO

-- =========================
-- Tabla principal
-- =========================
IF OBJECT_ID('dbo.TrabajosUrgentes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrabajosUrgentes (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    fecha_creacion DATETIME NOT NULL CONSTRAINT DF_TrabajosUrgentes_fecha_creacion DEFAULT (GETDATE()),

    creado_por_nombre NVARCHAR(100) NULL,
    creado_por_correo NVARCHAR(150) NULL,
    proveedor NVARCHAR(150) NULL,

    descripcion NVARCHAR(MAX) NOT NULL,

    ubicacion_id INT NOT NULL,
    orden_compra NVARCHAR(50) NULL,
    valor_neto DECIMAL(12,2) NULL,

    tipo_id INT NOT NULL,
    estado_id INT NOT NULL,

    fecha_reparacion DATE NULL,
    solicitado_por NVARCHAR(100) NULL,

    fecha_cierre DATETIME NULL,
    observaciones NVARCHAR(MAX) NULL,

    CONSTRAINT FK_TrabajosUrgentes_Ubicaciones FOREIGN KEY (ubicacion_id) REFERENCES dbo.Ubicaciones(id),
    CONSTRAINT FK_TrabajosUrgentes_TiposSolicitud FOREIGN KEY (tipo_id) REFERENCES dbo.TiposSolicitud(id),
    CONSTRAINT FK_TrabajosUrgentes_Estados FOREIGN KEY (estado_id) REFERENCES dbo.Estados(id)
  );

  CREATE INDEX IX_TrabajosUrgentes_fecha_creacion ON dbo.TrabajosUrgentes (fecha_creacion DESC);
  CREATE INDEX IX_TrabajosUrgentes_estado_id ON dbo.TrabajosUrgentes (estado_id);
  CREATE INDEX IX_TrabajosUrgentes_tipo_id ON dbo.TrabajosUrgentes (tipo_id);
  CREATE INDEX IX_TrabajosUrgentes_ubicacion_id ON dbo.TrabajosUrgentes (ubicacion_id);
END
GO

-- =========================
-- Adjuntos (fotos)
-- =========================
IF OBJECT_ID('dbo.Adjuntos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Adjuntos (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    trabajo_id INT NOT NULL,
    tipo_adjunto NVARCHAR(20) NOT NULL, -- 'antes' | 'despues' | 'evidencia'
    ruta_archivo NVARCHAR(255) NOT NULL,
    fecha_subida DATETIME NOT NULL CONSTRAINT DF_Adjuntos_fecha_subida DEFAULT (GETDATE()),

    CONSTRAINT FK_Adjuntos_TrabajosUrgentes FOREIGN KEY (trabajo_id) REFERENCES dbo.TrabajosUrgentes(id) ON DELETE CASCADE
  );

  CREATE INDEX IX_Adjuntos_trabajo_id ON dbo.Adjuntos (trabajo_id);
END
GO

-- =========================
-- Seeds (si no existen)
-- =========================
IF NOT EXISTS (SELECT 1 FROM dbo.Estados)
BEGIN
  INSERT INTO dbo.Estados (nombre) VALUES
    (N'Pendiente'),
    (N'En curso'),
    (N'Cerrado');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.TiposSolicitud)
BEGIN
  INSERT INTO dbo.TiposSolicitud (nombre) VALUES
    (N'Urgente'),
    (N'Mantención'),
    (N'Reparación'),
    (N'Compra'),
    (N'Instalación');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Ubicaciones)
BEGIN
  INSERT INTO dbo.Ubicaciones (nombre) VALUES
    (N'Administración'),
    (N'Comercial'),
    (N'RRHH'),
    (N'Casino'),
    (N'Sala de juegos'),
    (N'Of. Servicios'),
    (N'Of. Tableros'),
    (N'Taller Servicios'),
    (N'Taller Tableros'),
    (N'Almacen'),
    (N'Of. De Almacen'),
    (N'Operaciones'),
    (N'Porteria'),
    (N'Of. Pinturas'),
    (N'Bod, Pinturas'),
    (N'Patio 1'),
    (N'Patio 2'),
    (N'Estacionamiento P1'),
    (N'Estacionamiento P2');
END
GO
