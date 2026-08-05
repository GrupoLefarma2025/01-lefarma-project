-- =============================================================================
-- 021. AGREGAR FECHAS DE CICLO DE VIDA A ORDENES DE COMPRA
-- =============================================================================

-- FechaSolicitud se vuelve nullable (se setea cuando el creador envia al flujo)
ALTER TABLE operaciones.ordenes_compra ALTER COLUMN fecha_solicitud DATETIME NULL;

-- Nuevas columnas de fechas
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'fecha_autorizacion')
    ALTER TABLE operaciones.ordenes_compra ADD fecha_autorizacion DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'fecha_pago')
    ALTER TABLE operaciones.ordenes_compra ADD fecha_pago DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'fecha_cierre')
    ALTER TABLE operaciones.ordenes_compra ADD fecha_cierre DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'fecha_rechazo')
    ALTER TABLE operaciones.ordenes_compra ADD fecha_rechazo DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[operaciones].[ordenes_compra]') AND name = 'fecha_cancelacion')
    ALTER TABLE operaciones.ordenes_compra ADD fecha_cancelacion DATETIME NULL;

-- Insertar codigo AUTORIZADA si no existe
IF NOT EXISTS (SELECT 1 FROM config.workflow_estados WHERE codigo = 'AUTORIZADA')
BEGIN
    INSERT INTO config.workflow_estados (codigo, nombre, activo) VALUES ('AUTORIZADA', 'Autorizada', 1);
    PRINT 'Estado AUTORIZADA insertado';
END

PRINT 'Script 021 ejecutado correctamente.';
