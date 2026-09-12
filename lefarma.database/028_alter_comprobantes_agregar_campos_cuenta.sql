-- ─────────────────────────────────────────────────────────────────────────────
-- 028: Agregar a operaciones.comprobantes los campos de cuenta bancaria y soft delete
--
-- Requeridos por la entidad Comprobante (commit 34d9d4b): la entidad y su
-- configuracion EF mapean id_banco, numero_cuenta, clabe, id_forma_pago y activo,
-- pero ningun script anterior habia creado esas columnas en la tabla
-- (020 crea la tabla sin ellas; 026 solo agrego activo a comprobantes_partidas).
-- Sin estas columnas, cualquier INSERT/SELECT de comprobantes falla con
-- 'Invalid column name' -> HTTP 500 con cuerpo vacio.
-- ─────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH('operaciones.comprobantes', 'id_banco') IS NULL
BEGIN
    ALTER TABLE operaciones.comprobantes
        ADD id_banco        INT NULL,
            numero_cuenta   NVARCHAR(50) NULL,
            clabe           NVARCHAR(50) NULL,
            id_forma_pago   INT NULL;
END

IF COL_LENGTH('operaciones.comprobantes', 'activo') IS NULL
BEGIN
    ALTER TABLE operaciones.comprobantes
        ADD activo BIT NOT NULL DEFAULT 1;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_comprobantes_banco')
BEGIN
    ALTER TABLE operaciones.comprobantes
        ADD CONSTRAINT FK_comprobantes_banco
        FOREIGN KEY (id_banco) REFERENCES catalogos.bancos (id_banco);
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_comprobantes_forma_pago')
BEGIN
    ALTER TABLE operaciones.comprobantes
        ADD CONSTRAINT FK_comprobantes_forma_pago
        FOREIGN KEY (id_forma_pago) REFERENCES catalogos.formas_pago (id_forma_pago);
END