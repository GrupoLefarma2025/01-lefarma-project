-- ============================================================
-- 013 - Crear workflow_estados y actualizar esquema relacionado
-- ============================================================

-- 1. Crear tabla config.workflow_estados
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_estados]'))
BEGIN
    CREATE TABLE config.workflow_estados
    (
        id_estado INT IDENTITY(1,1) PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        color_hex VARCHAR(7) NULL,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT 'Tabla [config].[workflow_estados] creada';
END
GO

-- 2. Poblar estados base requeridos por el sistema
SET IDENTITY_INSERT config.workflow_estados ON;

MERGE config.workflow_estados AS target
USING (VALUES
    (1, 'CREADA',     'Creada',       '#6B7280'),
    (2, 'REVISION',   'En Revisión',  '#F59E0B'),
    (3, 'TESORERIA',  'En Tesorería', '#3B82F6'),
    (4, 'PAGADA',     'Pagada',       '#10B981'),
    (5, 'CERRADA',    'Cerrada',      '#059669'),
    (6, 'CANCELADA',  'Cancelada',    '#EF4444')
) AS source (id_estado, codigo, nombre, color_hex)
ON target.id_estado = source.id_estado
WHEN MATCHED THEN
    UPDATE SET codigo = source.codigo, nombre = source.nombre, color_hex = source.color_hex
WHEN NOT MATCHED THEN
    INSERT (id_estado, codigo, nombre, color_hex, activo)
    VALUES (source.id_estado, source.codigo, source.nombre, source.color_hex, 1);

SET IDENTITY_INSERT config.workflow_estados OFF;
GO

-- 3. Actualizar workflow_pasos: reemplazar codigo_estado por id_estado (FK)
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('[config].[workflow_pasos]') 
           AND name = 'codigo_estado')
BEGIN
    -- Agregar columna id_estado si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns 
                   WHERE object_id = OBJECT_ID('[config].[workflow_pasos]') 
                   AND name = 'id_estado')
    BEGIN
        ALTER TABLE config.workflow_pasos
        ADD id_estado INT NULL;
    END

    -- Migrar datos: mapear codigo_estado -> id_estado
    UPDATE p
    SET p.id_estado = e.id_estado
    FROM config.workflow_pasos p
    LEFT JOIN config.workflow_estados e ON p.codigo_estado = e.codigo
    WHERE p.codigo_estado IS NOT NULL;

    -- Eliminar constraint UNIQUE si existe
    IF EXISTS (SELECT * FROM sys.indexes 
               WHERE object_id = OBJECT_ID('[config].[workflow_pasos]') 
               AND name = 'UQ__workflow__3D232E0689C2D2B1')
    BEGIN
        ALTER TABLE config.workflow_pasos
        DROP CONSTRAINT UQ__workflow__3D232E0689C2D2B1;
    END

    -- Eliminar columna codigo_estado
    ALTER TABLE config.workflow_pasos
    DROP COLUMN codigo_estado;

    PRINT 'Columna codigo_estado migrada a id_estado en [config].[workflow_pasos]';
END
GO

-- 4. Agregar FK de workflow_pasos -> workflow_estados
IF NOT EXISTS (SELECT * FROM sys.foreign_keys 
               WHERE parent_object_id = OBJECT_ID('[config].[workflow_pasos]')
               AND name = 'FK_workflow_pasos_estado')
BEGIN
    ALTER TABLE config.workflow_pasos
    ADD CONSTRAINT FK_workflow_pasos_estado
        FOREIGN KEY (id_estado) REFERENCES config.workflow_estados(id_estado)
        ON DELETE SET NULL;
    PRINT 'FK_workflow_pasos_estado creada';
END
GO

-- 5. Actualizar ordenes_compra: renombrar estado -> id_estado y agregar id_workflow
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') 
           AND name = 'estado')
BEGIN
    -- Primero eliminar el DEFAULT constraint si existe
    DECLARE @defaultConstraintName NVARCHAR(128);
    SELECT @defaultConstraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND c.name = 'estado';

    IF @defaultConstraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE operaciones.ordenes_compra DROP CONSTRAINT ' + @defaultConstraintName);
    END

    -- Renombrar columna
    EXEC sp_rename 'operaciones.ordenes_compra.estado', 'id_estado', 'COLUMN';
    PRINT 'Columna estado renombrada a id_estado en [operaciones].[ordenes_compra]';
END
GO

-- 6. Agregar id_workflow a ordenes_compra si no existe
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') 
               AND name = 'id_workflow')
BEGIN
    ALTER TABLE operaciones.ordenes_compra
    ADD id_workflow INT NULL;
    PRINT 'Columna id_workflow agregada a [operaciones].[ordenes_compra]';
END
GO

-- 7. Actualizar índice en ordenes_compra si existe
IF EXISTS (SELECT * FROM sys.indexes 
           WHERE name = 'IX_ordenes_compra_estado' 
           AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
BEGIN
    DROP INDEX IX_ordenes_compra_estado ON operaciones.ordenes_compra;
    CREATE INDEX IX_ordenes_compra_id_estado ON operaciones.ordenes_compra (id_estado);
    PRINT 'Índice actualizado a IX_ordenes_compra_id_estado';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes 
                   WHERE name = 'IX_ordenes_compra_id_estado' 
                   AND object_id = OBJECT_ID('[operaciones].[ordenes_compra]'))
    BEGIN
        CREATE INDEX IX_ordenes_compra_id_estado ON operaciones.ordenes_compra (id_estado);
        PRINT 'Índice IX_ordenes_compra_id_estado creado';
    END
END
GO

-- 8. Agregar FK de ordenes_compra -> workflow_estados (opcional, para integridad)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys 
               WHERE parent_object_id = OBJECT_ID('[operaciones].[ordenes_compra]')
               AND name = 'FK_ordenes_compra_estado')
BEGIN
    ALTER TABLE operaciones.ordenes_compra
    ADD CONSTRAINT FK_ordenes_compra_estado
        FOREIGN KEY (id_estado) REFERENCES config.workflow_estados(id_estado);
    PRINT 'FK_ordenes_compra_estado creada';
END
GO

PRINT 'Migración 013 completada exitosamente.';
GO
