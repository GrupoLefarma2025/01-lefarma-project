-- ============================================================
-- 0010_20261019-0000_viaticos_limpieza-borradores-y-folio.lefarma.sql
-- Descripcion:
--   1) Elimina los dos borradores de prueba del usuario 71 (#1 y #6).
--      Los satelites (opciones, ajustes, eventos) se van por ON DELETE CASCADE.
--   2) Repara folios NULL con la misma regla del script 0009.
--   3) Muestra las solicitudes restantes con su folio y personas.
--
-- Target: Lefarma (la base que usa la app en Development).
-- LefarmaDev no tiene solicitudes; si se requiere ahi, cambiar el USE.
-- NO se aplica automaticamente: ejecutar manualmente.
-- ============================================================

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

-- 1) Borrar SOLO los borradores de prueba indicados (por id + dueño + estado)
BEGIN TRANSACTION;

DELETE FROM viaticos.solicitudes
WHERE id_solicitud IN (1, 6)
  AND id_usuario_creacion = 71
  AND estado = 'borrador';

PRINT CONCAT('Borradores eliminados: ', @@ROWCOUNT);

COMMIT TRANSACTION;
GO

-- 2) Reparar folios que hayan quedado NULL (idempotente)
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

    PRINT CONCAT('Folios reparados: ', @@ROWCOUNT);
END TRY
BEGIN CATCH
    PRINT 'Aviso: no se pudo reparar el folio: ' + ERROR_MESSAGE();
END CATCH;
GO

-- 3) Verificacion: lo que debe devolver la API
SELECT
    id_solicitud,
    folio,
    persona_solicitante,
    persona_viajera,
    estado,
    fecha_creacion
FROM viaticos.solicitudes
ORDER BY id_solicitud;
GO
