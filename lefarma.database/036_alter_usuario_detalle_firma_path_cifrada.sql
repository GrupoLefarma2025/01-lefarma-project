-- ============================================================================
-- LEFARMA - Puntero de firma cifrada del sistema RH (convivencia con CXP)
-- ============================================================================
-- Fecha: 2026-10-01
-- Descripcion: Agrega la columna que apunta a la firma vigente del sistema RH:
--
--                firma_path_cifrada NVARCHAR(500) NULL
--
--              Guarda el nombre logico (sin .enc) del archivo cifrado en la
--              carpeta privada, p.ej. "firmas/70_20260930162335.png".
--
--              Contexto (plan v3): la version CXP en produccion usa firma_path
--              como contrato (Perfil y OC leen de ahi); el sistema RH deja de
--              usar firma_path y resuelve la firma vigente SOLO por esta
--              columna. Sin migracion: los usuarios legacy se tratan como
--              nuevos y suben firma + INE para validacion en RH.
--
--              IMPORTANTE: aplicar ANTES de desplegar el backend nuevo (EF
--              selecciona la columna al leer config.usuario_detalle).
--              Ejecutar en Lefarma y en LefarmaDev (cambiar el USE).
-- ============================================================================

USE Lefarma;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[config].[usuario_detalle]')
      AND name = 'firma_path_cifrada'
)
BEGIN
    ALTER TABLE [config].[usuario_detalle]
    ADD [firma_path_cifrada] NVARCHAR(500) NULL;
    PRINT 'Columna [firma_path_cifrada] agregada a [config].[usuario_detalle]';
END
ELSE
BEGIN
    PRINT 'Columna [firma_path_cifrada] ya existe. Saltando.';
END
GO

PRINT 'Script 036 ejecutado correctamente.';
GO
