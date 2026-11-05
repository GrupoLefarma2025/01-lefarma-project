/* ============================================================
   047 — Sucursales: latitud/longitud nunca NULL
   BD destino: Lefarma / LefarmaDev

   POR QUE EXISTE
   --------------
   045_empresas_internas_cxp.sql inserto cinco sucursales "Unica"
   sin latitud ni longitud, y las columnas quedaron NULL.

   La entidad Sucursal mapea latitud/longitud como decimal NO
   nullable, asi que EF lanzaba:

       SqlNullValueException: Data is Null.
         at Microsoft.Data.SqlClient.SqlBuffer.get_Decimal()
         at SucursalService.GetAllAsync(...)

   y GET /api/catalogos/sucursales respondia 500, tumbando el
   catalogo en /cxp/ordenes/crear.

   ALCANCE
   -------
   - Rellena con 0 cualquier sucursal con latitud/longitud NULL.
   - Agrega DEFAULT (0) a ambas columnas para los INSERT que las
     omitan (caso del seed 045).
   - Idempotente: reejecutar no falla ni duplica constraints.

   NOTA
   ----
   En productivo los NULL se corrigieron el 2026-11-02 (change
   20261102-113341-ff303d) y los defaults se agregaron como
   20261102-113531-f82f56. Este script deja el mismo resultado en
   cualquier base donde todavia falte.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

UPDATE catalogos.sucursales
SET latitud = 0,
    longitud = 0
WHERE latitud IS NULL
   OR longitud IS NULL;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('catalogos.sucursales')
      AND name = 'df_sucursales_latitud'
)
BEGIN
    ALTER TABLE catalogos.sucursales
        ADD CONSTRAINT df_sucursales_latitud DEFAULT (0) FOR latitud;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('catalogos.sucursales')
      AND name = 'df_sucursales_longitud'
)
BEGIN
    ALTER TABLE catalogos.sucursales
        ADD CONSTRAINT df_sucursales_longitud DEFAULT (0) FOR longitud;
END;

COMMIT TRANSACTION;

-- Verificacion: con_null debe dar 0.
SELECT COUNT(*) AS total,
       SUM(CASE WHEN latitud IS NULL OR longitud IS NULL THEN 1 ELSE 0 END) AS con_null
FROM catalogos.sucursales;
