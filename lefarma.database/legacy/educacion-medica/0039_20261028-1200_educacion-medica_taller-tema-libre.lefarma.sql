-- =============================================================================
-- 0039 - Tema libre del taller
-- =============================================================================
-- QUÉ HACE
--   Agrega talleres.tema (nvarchar(200), NULL) para capturar el tema/asunto del
--   taller como texto libre. Si viene vacío, el calendario conserva el fallback
--   a tema_taller o al producto del taller.
--
-- REQUISITOS
--   - 0016 aplicado.
--
-- IDEMPOTENTE: guard por columna y extended property.
-- NO APLICA EL SCRIPT SOLO: lo revisa y ejecuta el usuario.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF COL_LENGTH('educacion_medica.talleres', 'tema') IS NULL
BEGIN
    ALTER TABLE educacion_medica.talleres
        ADD [tema] nvarchar(200) NULL;
    PRINT 'Columna [educacion_medica].[talleres].[tema] agregada.';
END
ELSE
    PRINT 'Columna [educacion_medica].[talleres].[tema] ya existe. Skip.';

IF NOT EXISTS (
    SELECT 1
    FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('educacion_medica.[talleres]')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('educacion_medica.[talleres]'), 'tema', 'ColumnId')
      AND name = 'MS_Description'
)
    EXEC sp_addextendedproperty
        N'MS_Description',
        N'Tema/asunto libre del taller. Si está vacío, el calendario usa tema_taller o el producto (ADR-00016).',
        'SCHEMA', N'educacion_medica', 'TABLE', N'talleres', 'COLUMN', N'tema';
