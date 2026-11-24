/*
    062_alter_proveedores_constancia_fiscal.sql

    Constancia de Situacion Fiscal (CSF) opcional por proveedor.

    1. Agrega constancia_fiscal_path a catalogos.proveedores_detalle.
       La CSF es un dato del proveedor (el RFC vive en catalogos.proveedores.rfc),
       no de una cuenta bancaria, por eso va en proveedores_detalle y no en
       proveedor_forma_pago_cuentas (donde vive la caratula).
    2. Agrega constancia_fiscal_path a staging.proveedores_detalles (espejo).
       El proveedor Aprobado/EditadoPendiente que suba la CSF pasa a
       EditadoPendiente y el archivo vive en staging hasta autorizar la edicion,
       igual que la caratula por cuenta (script 025).

*/

SET XACT_ABORT ON;

IF COL_LENGTH('catalogos.proveedores_detalle', 'constancia_fiscal_path') IS NULL
BEGIN
    ALTER TABLE catalogos.proveedores_detalle
    ADD constancia_fiscal_path NVARCHAR(500) NULL;

    PRINT 'Columna [catalogos].[proveedores_detalle].[constancia_fiscal_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedores_detalle].[constancia_fiscal_path] ya existe (sin cambios)';
END;
GO

IF COL_LENGTH('staging.proveedores_detalles', 'constancia_fiscal_path') IS NULL
BEGIN
    ALTER TABLE staging.proveedores_detalles
    ADD constancia_fiscal_path NVARCHAR(500) NULL;

    PRINT 'Columna [staging].[proveedores_detalles].[constancia_fiscal_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [staging].[proveedores_detalles].[constancia_fiscal_path] ya existe (sin cambios)';
END;
GO

PRINT '';
PRINT '============================================================';
PRINT '062_alter_proveedores_constancia_fiscal.sql COMPLETADO';
PRINT '============================================================';
GO

-- ============================================================================
-- ROLLBACK (notas - NO se ejecuta automaticamente)
-- ============================================================================
-- El cambio es reversible y sin perdida de datos:
--
-- IF COL_LENGTH('staging.proveedores_detalles','constancia_fiscal_path') IS NOT NULL
--     ALTER TABLE staging.proveedores_detalles DROP COLUMN constancia_fiscal_path;
-- IF COL_LENGTH('catalogos.proveedores_detalle','constancia_fiscal_path') IS NOT NULL
--     ALTER TABLE catalogos.proveedores_detalle DROP COLUMN constancia_fiscal_path;
--
-- Los archivos fisicos en wwwroot/media/archivos/constancias-fiscales/ quedan
-- en disco; solo la referencia en BD se elimina.
-- ============================================================================
