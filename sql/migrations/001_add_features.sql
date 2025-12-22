/*
  Migración 001 - SLA + Bitácora + Comentarios + Responsable/Prioridad
  Ejecutar DESPUÉS de sql/schema.sql
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.Prioridades', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Prioridades (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    nombre NVARCHAR(30) NOT NULL UNIQUE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Prioridades)
BEGIN
  INSERT INTO dbo.Prioridades (nombre) VALUES (N'Alta'),(N'Media'),(N'Baja');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Estados WHERE LOWER(nombre) = 'en espera')
BEGIN
  INSERT INTO dbo.Estados (nombre) VALUES (N'En espera');
END
GO

IF COL_LENGTH('dbo.TrabajosUrgentes', 'prioridad_id') IS NULL
BEGIN
  ALTER TABLE dbo.TrabajosUrgentes ADD prioridad_id INT NULL;
END
GO
IF COL_LENGTH('dbo.TrabajosUrgentes', 'fecha_objetivo') IS NULL
BEGIN
  ALTER TABLE dbo.TrabajosUrgentes ADD fecha_objetivo DATE NULL;
END
GO
IF COL_LENGTH('dbo.TrabajosUrgentes', 'responsable_nombre') IS NULL
BEGIN
  ALTER TABLE dbo.TrabajosUrgentes ADD responsable_nombre NVARCHAR(100) NULL;
END
GO
IF COL_LENGTH('dbo.TrabajosUrgentes', 'responsable_correo') IS NULL
BEGIN
  ALTER TABLE dbo.TrabajosUrgentes ADD responsable_correo NVARCHAR(150) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TrabajosUrgentes_Prioridades')
BEGIN
  ALTER TABLE dbo.TrabajosUrgentes WITH CHECK
  ADD CONSTRAINT FK_TrabajosUrgentes_Prioridades FOREIGN KEY (prioridad_id) REFERENCES dbo.Prioridades(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TrabajosUrgentes_prioridad_id' AND object_id = OBJECT_ID('dbo.TrabajosUrgentes'))
BEGIN
  CREATE INDEX IX_TrabajosUrgentes_prioridad_id ON dbo.TrabajosUrgentes (prioridad_id);
END
GO

IF OBJECT_ID('dbo.Comentarios', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Comentarios (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    trabajo_id INT NOT NULL,
    comentario NVARCHAR(MAX) NOT NULL,
    autor_nombre NVARCHAR(100) NULL,
    autor_correo NVARCHAR(150) NULL,
    fecha_creacion DATETIME NOT NULL CONSTRAINT DF_Comentarios_fecha_creacion DEFAULT (GETDATE()),
    CONSTRAINT FK_Comentarios_TrabajosUrgentes FOREIGN KEY (trabajo_id) REFERENCES dbo.TrabajosUrgentes(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_Comentarios_trabajo_id ON dbo.Comentarios (trabajo_id);
END
GO

IF OBJECT_ID('dbo.TrabajosLog', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TrabajosLog (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    trabajo_id INT NOT NULL,
    accion NVARCHAR(50) NOT NULL,
    detalle NVARCHAR(MAX) NULL,
    actor_nombre NVARCHAR(100) NULL,
    actor_correo NVARCHAR(150) NULL,
    ip NVARCHAR(45) NULL,
    user_agent NVARCHAR(255) NULL,
    fecha DATETIME NOT NULL CONSTRAINT DF_TrabajosLog_fecha DEFAULT (GETDATE()),
    CONSTRAINT FK_TrabajosLog_TrabajosUrgentes FOREIGN KEY (trabajo_id) REFERENCES dbo.TrabajosUrgentes(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_TrabajosLog_trabajo_id ON dbo.TrabajosLog (trabajo_id);
  CREATE INDEX IX_TrabajosLog_fecha ON dbo.TrabajosLog (fecha DESC);
END
GO
