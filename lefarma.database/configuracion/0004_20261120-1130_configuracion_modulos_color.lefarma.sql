-- =============================================================================
-- 0004_20261120-1130_configuracion_modulos_color.lefarma.sql
--
-- MÓDULO: Configuración (color identificador de los módulos)
-- TIPO:   schema
-- TARGET: LefarmaDev / Lefarma (familia .lefarma)
--
-- QUÉ HACE (idempotente)
--   1) Añade config.modulos.color NVARCHAR(7) NULL con formato #rrggbb.
--   2) Asigna color a los módulos existentes: 「global」toma el naranja de la
--      casa y el resto rota por la paleta de la aplicación. Las altas nuevas lo
--      reciben del backend (aleatorio si la petición no lo indica).
--   3) Agrega CK_config_modulos_color_formato para que la base rechace valores
--      que no sean #rrggbb; la validación de la API sigue siendo la primera.
--
-- POR QUÉ
--   La pantalla principal identifica cada módulo por color. Sin el campo, el
--   frontend solo podría derivarlo de la clave y el usuario no podría elegirlo.
--
-- QUÉ NO HACE
--   - No cambia claves, nombres ni variables.
--   - No crea triggers ni toca la bitácora.
--
-- ORDEN: ejecutar después de 0003. Requiere SQL Server 2016 SP1 o superior.
--
-- LOTE ÚNICO: sin GO, con SQL dinámico en las sentencias que tocan la columna
--   nueva: la columna no existe cuando el lote se compila, pero sí cuando esa
--   sentencia corre (así lo aceptan SSMS, «Explorador SQL» y DbUp).
--
-- ESTADO: pendiente de ejecutar en LefarmaDev y Lefarma. Publicar el backend
--   que lee esta columna solo después de aplicarlo.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

-- =============================================================================
-- 1. Columna de color
-- =============================================================================
IF COL_LENGTH(N'config.modulos', N'color') IS NULL
BEGIN
    ALTER TABLE config.modulos
        ADD color NVARCHAR(7) NULL;

    PRINT 'Añadida config.modulos.color.';
END
ELSE
BEGIN
    PRINT 'config.modulos.color ya existe; sin cambios.';
END

-- =============================================================================
-- 2. Formato del color (#rrggbb)
-- =============================================================================
IF NOT EXISTS
(
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_config_modulos_color_formato'
      AND parent_object_id = OBJECT_ID(N'config.modulos')
)
BEGIN
    EXEC (N'
ALTER TABLE config.modulos WITH CHECK
    ADD CONSTRAINT CK_config_modulos_color_formato
    CHECK (color IS NULL OR (LEN(color) = 7 AND color LIKE ''#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]''));
');

    PRINT 'Creada CK_config_modulos_color_formato.';
END

-- =============================================================================
-- 3. Backfill de los módulos existentes
-- =============================================================================
EXEC (N'
-- 「global」 conserva el naranja de la casa.
UPDATE config.modulos
SET color = N''#eb6c36''
WHERE clave = N''global''
  AND color IS NULL;

-- El resto rota por la paleta; el id solo elige el punto de partida.
UPDATE m
SET color = CASE (m.id_modulo % 12)
    WHEN 0 THEN N''#eb6c36''
    WHEN 1 THEN N''#0ea5e9''
    WHEN 2 THEN N''#10b981''
    WHEN 3 THEN N''#f59e0b''
    WHEN 4 THEN N''#8b5cf6''
    WHEN 5 THEN N''#ec4899''
    WHEN 6 THEN N''#14b8a6''
    WHEN 7 THEN N''#ef4444''
    WHEN 8 THEN N''#6366f1''
    WHEN 9 THEN N''#84cc16''
    WHEN 10 THEN N''#f97316''
    WHEN 11 THEN N''#06b6d4''
END
FROM config.modulos AS m
WHERE m.color IS NULL;
');

-- =============================================================================
-- 4. Comprobación final
-- =============================================================================
EXEC (N'
SELECT
    id_modulo,
    clave,
    nombre,
    color,
    activo
FROM config.modulos
ORDER BY id_modulo;
');
