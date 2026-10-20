-- ============================================================================
-- 0011_20261020-0000_viaticos_folio-secuencia.lefarma.sql
-- Descripcion: Crea la secuencia que numera el folio del viaje para que el
--              POST /api/viaticos/solicitudes pueda insertar el folio en la
--              MISMA fila (sin el UPDATE posterior que dependia del IDENTITY).
--
-- Contexto:
--   Antes:  INSERT solicitudes (folio = NULL)
--           UPDATE solicitudes SET folio = 'VIA-{sam}-{id:D4}'   <-- id recien generado
--   Ahora:  num = NEXT VALUE FOR viaticos.seq_folio_viaje
--           INSERT solicitudes (... folio = 'VIA-{sam}-{num:D4}' ...)
--
--   El id_solicitud sigue siendo IDENTITY(1,1); la secuencia solo numera el
--   folio visible. Se siembra con el consecutivo mas alto ya usado para no
--   repetir folios existentes (UQ_solicitudes_folio es UNIQUE).
--
-- Notas:
--   - NEXT VALUE FOR no se revierte con la transaccion: si un INSERT falla,
--     el numero se pierde (igual que un IDENTITY). Es el comportamiento
--     esperado en folios.
--   - Idempotente: si la secuencia ya existe, no hace nada.
--   - No aplica ningun cambio a filas existentes.
-- ============================================================================
SET NOCOUNT ON;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.sequences
    WHERE name = N'seq_folio_viaje'
      AND schema_id = SCHEMA_ID(N'viaticos')
)
BEGIN
    DECLARE @siguiente INT = 1;

    -- Ultimo consecutivo usado: el tramo despues del ultimo '-' del folio.
    SELECT @siguiente = ISNULL(MAX(
               TRY_CAST(RIGHT(folio, CHARINDEX('-', REVERSE(folio)) - 1) AS INT)
           ), 0) + 1
    FROM viaticos.solicitudes
    WHERE folio LIKE N'VIA-%'
      AND CHARINDEX('-', REVERSE(folio)) > 1;

    IF @siguiente < 1
        SET @siguiente = 1;

    DECLARE @sql NVARCHAR(MAX) = N'
        CREATE SEQUENCE [viaticos].[seq_folio_viaje]
            AS INT
            START WITH ' + CAST(@siguiente AS NVARCHAR(10)) + N'
            INCREMENT BY 1
            MINVALUE 1
            NO CYCLE
            CACHE 50;';

    EXEC (@sql);

    PRINT 'Secuencia [viaticos].[seq_folio_viaje] creada en ' + CAST(@siguiente AS NVARCHAR(10)) + N'.';
END
ELSE
    PRINT 'Secuencia [viaticos].[seq_folio_viaje] ya existe. Skip.';
GO

-- Verificacion rapida (no consume la secuencia).
SELECT
    s.name              AS secuencia,
    sc.name             AS esquema,
    s.start_value       AS inicia_en,
    s.increment          AS incremento,
    s.current_value     AS valor_actual
FROM sys.sequences s
JOIN sys.schemas sc ON sc.schema_id = s.schema_id
WHERE s.name = N'seq_folio_viaje';
GO
