-- ============================================================================
-- LEFARMA - 06B_FIX_FK_CONSTRAINTS
-- ============================================================================
-- Fecha: 2026-04-17
-- Descripcion: Agrega los FK constraints sin fallar por datos legacy
--              Hace los FK opcionales para no romper datos existentes
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 06B_fix_fk_constraints.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- Agregar FK con WITH NOCHECK para no validar datos existentes
-- ============================================================================

-- FK para id_proveedor en ordenes_compra
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra
    WITH NOCHECK  -- No validar datos existentes
    ADD CONSTRAINT FK_ordenes_compra_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES catalogos.proveedores(id_proveedor);
    PRINT 'FK [FK_ordenes_compra_proveedor] creada (WITH NOCHECK)';
END
GO

-- FK para id_proveedor en ordenes_compra_partidas
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ordenes_compra_partidas_proveedor')
BEGIN
    ALTER TABLE operaciones.ordenes_compra_partidas
    WITH NOCHECK  -- No validar datos existentes
    ADD CONSTRAINT FK_ordenes_compra_partidas_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES catalogos.proveedores(id_proveedor);
    PRINT 'FK [FK_ordenes_compra_partidas_proveedor] creada (WITH NOCHECK)';
END
GO

-- FK para ids_cuentas_bancarias en ordenes_compra_partidas
-- (las cuentas se referencian via JSON, no via FK directo)

PRINT '';
PRINT '============================================================';
PRINT '06B_fix_fk_constraints.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
