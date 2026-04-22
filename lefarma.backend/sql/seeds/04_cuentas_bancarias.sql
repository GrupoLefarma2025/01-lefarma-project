-- ============================================================
-- Seed: Formas de Pago, Bancos y Cuentas Bancarias de Proveedor
-- Schema: catalogos
-- Compatible con SQL Server
-- Orden: DELETE + RESEED en cascada inversa → INSERT limpio
-- Ejecutar completo en una sola sesion
-- ============================================================
USE Lefarma;
GO

-- ============================================================
-- 1. LIMPIEZA (en orden inverso de dependencias FK)
--    IMPORTANTE: DBCC CHECKIDENT RESEED resetea el identity
--    para que los nuevos INSERT generen IDs desde 1
-- ============================================================

-- 1a. Limpiar cuentas bancarias de proveedores
DELETE FROM catalogos.proveedor_forma_pago_cuentas;
GO

-- 1b. Limpiar vinculo formas de pago x proveedor
DELETE FROM catalogos.proveedores_formas_pago;
GO

-- 1c. Limpiar formas de pago Y resetear identity a 0
DELETE FROM catalogos.formas_pago;
DBCC CHECKIDENT ('catalogos.formas_pago', RESEED, 0);
GO

-- 1d. Limpiar bancos Y resetear identity a 0
DELETE FROM catalogos.bancos;
DBCC CHECKIDENT ('catalogos.bancos', RESEED, 0);
GO

-- ============================================================
-- 2. INSERT: FORMAS DE PAGO
-- IDs generados: 1 a 7
-- ============================================================
INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, requiere_cuenta, activo, fecha_creacion)
VALUES
('Cheque',           'cheque',           'Pago mediante cheque nominativo',            'pago mediante cheque nominativo',            'CHEQUE',  1, 1, GETUTCDATE()),
('Transferencia',    'transferencia',    'Pago mediante transferencia electronica',   'pago mediante transferencia electronica',   'TRANSF',  1, 1, GETUTCDATE()),
('Efectivo',         'efectivo',         'Pago en efectivo',                         'pago en efectivo',                          'EFECT',   0, 1, GETUTCDATE()),
('Tarjeta Credito',  'tarjeta credito',  'Pago con tarjeta de credito',              'pago con tarjeta de credito',               'TARJCR',  1, 1, GETUTCDATE()),
('Tarjeta Debito',   'tarjeta debito',   'Pago con tarjeta de debito',               'pago con tarjeta de debito',                'TARJDR',  1, 1, GETUTCDATE()),
('Deposito',         'deposito',         'Deposito bancario',                        'deposito bancario',                         'DEPOS',   0, 1, GETUTCDATE()),
('OLT',              'olt',              'Orden de pago en linea de transferencia',  'orden de pago en linea de transferencia',   'OLT',     1, 1, GETUTCDATE());
GO

-- ============================================================
-- 3. INSERT: BANCOS
-- IDs generados: 1 a 10
-- ============================================================
INSERT INTO catalogos.bancos (nombre, nombre_normalizado, clave, codigo_swift, descripcion, descripcion_normalizada, activo, fecha_creacion)
VALUES
('Bancomer',       'bancomer',       '012', 'BCMRMXMT',  'BBVA Bancomer',             'bbva bancomer',             1, GETUTCDATE()),
('Santander',      'santander',      '014', 'BMSXMXSM',  'Banco Santander Mexico',    'banco santander mexico',    1, GETUTCDATE()),
('Banorte',        'banorte',        '036', 'BNMXMXMT',  'Banco Banorte',             'banco banorte',             1, GETUTCDATE()),
('HSBC',           'hsbc',           '021', 'HSBCMXMT',  'HSBC Mexico',               'hsbc mexico',               1, GETUTCDATE()),
('Scotiabank',     'scotiabank',     '044', 'BSWEMXMT',  'Scotiabank Inverlat',       'scotiabank inverlat',       1, GETUTCDATE()),
('Citibanamex',    'citibanamex',    '002', 'CITIUS33',  'Citibanamex',               'citibanamex',               1, GETUTCDATE()),
('Banco Azteca',   'banco azteca',   '127', 'AZTCMXMT',  'Banco Azteca',              'banco azteca',              1, GETUTCDATE()),
('BanRegio',       'banregio',       '058', 'BRHMXMT',   'Banco Banregio',            'banco banregio',            1, GETUTCDATE()),
('Klar',           'klar',           NULL,  NULL,         'Klar Fintech',              'klar fintech',              1, GETUTCDATE()),
('Neon',           'neon',           NULL,  NULL,         'Neon Fintech',              'neon fintech',              1, GETUTCDATE());
GO

-- ============================================================
-- 4. INSERT: VINCULO FORMAS DE PAGO x PROVEEDOR
-- Asigna TODAS las formas de pago activas a cada proveedor
-- ============================================================
INSERT INTO catalogos.proveedores_formas_pago (id_proveedor, id_forma_pago)
SELECT p.id_proveedor, fp.id_forma_pago
FROM catalogos.proveedores p
CROSS JOIN catalogos.formas_pago fp
WHERE fp.activo = 1
  AND NOT EXISTS (
      SELECT 1 FROM catalogos.proveedores_formas_pago pfp
      WHERE pfp.id_proveedor = p.id_proveedor
        AND pfp.id_forma_pago = fp.id_forma_pago
  );
GO

-- ============================================================
-- 5. INSERT: CUENTAS BANCARIAS DE PROVEEDORES
--
-- IDs de FORMA DE PAGO (generados por identity):
--   1=Cheque, 2=Transferencia, 3=Efectivo,
--   4=Tarjeta Credito, 5=Tarjeta Debito, 6=Deposito, 7=OLT
--
-- IDs de BANCO (generados por identity):
--   1=Bancomer, 2=Santander, 3=Banorte, 4=HSBC,
--   5=Scotiabank, 6=Citibanamex, 7=Banco Azteca,
--   8=BanRegio, 9=Klar, 10=Neon
--
-- Proveedores reales en base:
--   1=Farmacia del Norte S.A. de C.V.
--   2=Distribuidora Medica del Centro S.A. de C.V.
--   3=Laboratorios Biofarmacos S.A. de C.V.
--   4=Jose Luis Perez Vazquez
--   5=Comercializadora de Insumos Medicos S.A. de C.V.
-- ============================================================

INSERT INTO catalogos.proveedor_forma_pago_cuentas
    (id_proveedor, id_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo, fecha_creacion)
VALUES
    -- Proveedor 1 — Farmacia del Norte S.A. de C.V.
    (1, 2, 1, '0123456789', '012345678901234567', NULL, 'Farmacia del Norte S.A. de C.V.', 'pagospv1@farmaciadelnorte.com', 1, GETUTCDATE()),
    (1, 1, 1, '0123456789', NULL, NULL, 'Farmacia del Norte S.A. de C.V.', NULL, 1, GETUTCDATE()),

    -- Proveedor 2 — Distribuidora Medica del Centro S.A. de C.V.
    (2, 2, 2, '5678901234', '567890123456789012', NULL, 'Distribuidora Medica del Centro S.A. de C.V.', 'pagos@distmedicacentro.com', 1, GETUTCDATE()),
    (2, 3, NULL, NULL, NULL, NULL, 'Distribuidora Medica del Centro S.A. de C.V.', NULL, 1, GETUTCDATE()),

    -- Proveedor 3 — Laboratorios Biofarmacos S.A. de C.V.
    (3, 2, 3, '9876543210', '987654321012345678', NULL, 'Laboratorios Biofarmacos S.A. de C.V.', 'tesoreria@biofarmacos.com', 1, GETUTCDATE()),
    (3, 4, 3, NULL, NULL, '4111111111111111', 'Laboratorios Biofarmacos S.A. de C.V.', NULL, 1, GETUTCDATE()),

    -- Proveedor 4 — Jose Luis Perez Vazquez
    (4, 2, 4, '1357924680', '135792468013579246', NULL, 'Jose Luis Perez Vazquez', 'jlperez@perezvazquez.com', 1, GETUTCDATE()),
    (4, 2, 5, '2468013579', '246801357924680135', NULL, 'Jose Luis Perez Vazquez', 'jlperez2@perezvazquez.com', 1, GETUTCDATE()),

    -- Proveedor 5 — Comercializadora de Insumos Medicos S.A. de C.V.
    (5, 2, 7, '5555666677', '555566667777888899', NULL, 'Comercializadora de Insumos Medicos S.A. de C.V.', 'pagos@cimsa.com', 1, GETUTCDATE()),
    (5, 3, NULL, NULL, NULL, NULL, 'Comercializadora de Insumos Medicos S.A. de C.V.', NULL, 1, GETUTCDATE());
GO

-- ============================================================
-- RESUMEN
-- ============================================================
DECLARE @fp INT = (SELECT COUNT(*) FROM catalogos.formas_pago);
DECLARE @ban INT = (SELECT COUNT(*) FROM catalogos.bancos);
DECLARE @cuentas INT = (SELECT COUNT(*) FROM catalogos.proveedor_forma_pago_cuentas);
DECLARE @vinculos INT = (SELECT COUNT(*) FROM catalogos.proveedores_formas_pago);

PRINT '';
PRINT '============================================================';
PRINT 'SEED completado: 04_cuentas_bancarias';
PRINT '============================================================';
PRINT 'Formas de pago insertadas:         ' + CAST(@fp AS VARCHAR);
PRINT 'Bancos insertados:                 ' + CAST(@ban AS VARCHAR);
PRINT 'Cuentas bancarias insertadas:      ' + CAST(@cuentas AS VARCHAR);
PRINT 'Vinculos proveedores-formas pago:  ' + CAST(@vinculos AS VARCHAR);
PRINT '============================================================';
GO
