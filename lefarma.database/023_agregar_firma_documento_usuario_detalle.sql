-- ============================================================================
-- LEFARMA - Agregar firma_documento a config.usuario_detalle
-- ============================================================================
-- Fecha: 2026-06-15
-- Descripcion: Agrega columna firma_documento (BIT) para controlar si la
--              firma del usuario debe aparecer en documentos (PDFs).
--              1 = la firma SI aparece (comportamiento por defecto).
--              0 = la firma NO aparece (permite excluir firmas del PDF).
--              Por defecto = 1 para preservar el comportamiento actual.
-- ============================================================================

USE Lefarma;
GO

-- PASO 1: Agregar columna firma_documento
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('[config].[usuario_detalle]') 
      AND name = 'firma_documento'
)
BEGIN
    ALTER TABLE [config].[usuario_detalle] 
    ADD [firma_documento] BIT NOT NULL DEFAULT 1;
    PRINT 'Columna [firma_documento] agregada a [config].[usuario_detalle] con DEFAULT 1';
END
ELSE
BEGIN
    PRINT 'Columna [firma_documento] ya existe. Saltando ALTER TABLE.';
END
GO

-- PASO 2: Asegurar que todos los registros existentes tengan valor 1
--         (preserva el comportamiento actual donde la firma aparece)
UPDATE [config].[usuario_detalle]
SET [firma_documento] = 1
WHERE [firma_documento] IS NULL;
GO

PRINT 'Script 023 ejecutado correctamente.';
GO
