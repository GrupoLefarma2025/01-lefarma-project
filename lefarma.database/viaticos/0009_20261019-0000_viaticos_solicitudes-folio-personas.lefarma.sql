-- ============================================================
-- 0009_20261019-0000_viaticos_solicitudes-folio-personas.lefarma.sql
-- Descripcion: Agrega a [viaticos].[solicitudes] el folio del viaje y las
--              personas que intervienen:
--
--              1) folio               -> VIA-{SamAccountName viajero}-{id}
--              2) persona_solicitante -> nombre de quien solicita
--              3) persona_viajera     -> nombre de quien viaja
--
--              Backfill de filas existentes:
--               - Los nombres salen de Asokam.app.Usuarios (solicitante por
--                 id_usuario_creacion; viajero por datos_json.persona.empleadoId
--                 y, si no, por el solicitante).
--               - El folio usa el SamAccountName del viajero y el id.
--
-- Target: Lefarma \(USE explicito\).
-- Idempotente. NO se aplica automaticamente.
-- ============================================================

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

-- 1) Columnas nuevas
IF COL_LENGTH('viaticos.solicitudes', 'folio') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes ADD folio NVARCHAR(60) NULL;
    PRINT 'Columna [viaticos].[solicitudes].[folio] creada.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[folio] ya existe. Skip.';
GO

IF COL_LENGTH('viaticos.solicitudes', 'persona_solicitante') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes ADD persona_solicitante NVARCHAR(512) NULL;
    PRINT 'Columna [viaticos].[solicitudes].[persona_solicitante] creada.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[persona_solicitante] ya existe. Skip.';
GO

IF COL_LENGTH('viaticos.solicitudes', 'persona_viajera') IS NULL
BEGIN
    ALTER TABLE viaticos.solicitudes ADD persona_viajera NVARCHAR(512) NULL;
    PRINT 'Columna [viaticos].[solicitudes].[persona_viajera] creada.';
END
ELSE
    PRINT 'Columna [viaticos].[solicitudes].[persona_viajera] ya existe. Skip.';
GO

-- 2) Backfill de personas desde Asokam (si la base no es alcanzable, se avisa
--    y se dejan los campos como esten; el backend los llena al crear).
BEGIN TRY
    UPDATE s
    SET
        persona_solicitante = COALESCE(s.persona_solicitante, r.NombreCompleto),
        persona_viajera = COALESCE(
            s.persona_viajera,
            CASE WHEN ISJSON(s.datos_json) = 1
                 THEN NULLIF(JSON_VALUE(s.datos_json, '$.persona.nombre'), '')
            END,
            v.NombreCompleto,
            r.NombreCompleto
        )
    FROM viaticos.solicitudes AS s
    LEFT JOIN Asokam.app.Usuarios AS r
        ON r.IdUsuario = s.id_usuario_creacion
    LEFT JOIN Asokam.app.Usuarios AS v
        ON v.IdUsuario = COALESCE(
            CASE WHEN ISJSON(s.datos_json) = 1
                 THEN TRY_CAST(JSON_VALUE(s.datos_json, '$.persona.empleadoId') AS INT)
            END,
            s.id_usuario_creacion
        );
    PRINT 'Backfill de persona_solicitante / persona_viajera ejecutado.';
END TRY
BEGIN CATCH
    PRINT 'Aviso: no se pudo hacer backfill de nombres desde Asokam: ' + ERROR_MESSAGE();
END CATCH;
GO

-- 3) Backfill del folio: VIA-{sam del viajero}-{id con 4 digitos}
BEGIN TRY
    UPDATE s
    SET folio = 'VIA-'
        + LEFT(COALESCE(NULLIF(LTRIM(RTRIM(v.SamAccountName)), ''), 'SIN'), 40)
        + '-'
        + RIGHT('0000' + CAST(s.id_solicitud AS VARCHAR(10)), 4)
    FROM viaticos.solicitudes AS s
    LEFT JOIN Asokam.app.Usuarios AS v
        ON v.IdUsuario = COALESCE(
            CASE WHEN ISJSON(s.datos_json) = 1
                 THEN TRY_CAST(JSON_VALUE(s.datos_json, '$.persona.empleadoId') AS INT)
            END,
            s.id_usuario_creacion
        )
    WHERE s.folio IS NULL;
    PRINT 'Backfill de folio ejecutado.';
END TRY
BEGIN CATCH
    PRINT 'Aviso: no se pudo hacer backfill de folio: ' + ERROR_MESSAGE();
END CATCH;
GO

-- 4) Folio unico (solo filas con folio)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'viaticos.solicitudes')
      AND name = N'UQ_solicitudes_folio'
)
BEGIN
    CREATE UNIQUE INDEX UQ_solicitudes_folio
        ON viaticos.solicitudes (folio)
        WHERE folio IS NOT NULL;
    PRINT 'Indice [UQ_solicitudes_folio] creado.';
END
ELSE
    PRINT 'Indice [UQ_solicitudes_folio] ya existe. Skip.';
GO

PRINT 'FIN script 0009 viaticos Lefarma (folio + personas).';
GO

