-- ============================================================================
-- SEED: Vincular Formas de Pago a Proveedores
-- ============================================================================
-- Fecha: 2026-04-14
-- Descripcion: Inserta la vinculacion muchos-a-muchos entre proveedores
--              y formas de pago. Por defecto asigna TODAS las formas de pago
--              activas a TODOS los proveedores existentes.
-- ============================================================================

USE Lefarma;
GO

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

PRINT '';
PRINT '============================================================';
PRINT 'SEED completado: proveedores_formas_pago';
PRINT '============================================================';
PRINT 'Formas de pago vinculadas a todos los proveedores activos';
GO

-- ============================================================================
-- SEED: Formas de Pago (7 registros)
-- ============================================================================
INSERT INTO catalogos.formas_pago (nombre, clave, requiere_cuenta, activo)
VALUES 
  ('Cheque', 'CHQ', 1, 1),
  ('Transferencia', 'TRF', 1, 1),
  ('Efectivo', 'EFE', 0, 1),
  ('Tarjeta Credito', 'TDC', 1, 1),
  ('Tarjeta Debito', 'TDD', 1, 1),
  ('Deposito', 'DEP', 1, 1),
  ('OLT', 'OLT', 1, 1);

-- ============================================================================
-- SEED: Bancos (10 registros)
-- ============================================================================
INSERT INTO catalogos.bancos (nombre, clave, codigo_swift, activo)
VALUES
  ('Bancomer', 'BMR', 'BCMRMXMT', 1),
  ('Santander', 'SAN', 'BMSXMXMT', 1),
  ('Banorte', 'BNT', 'BNMXMXMT', 1),
  ('HSBC', 'HSB', 'HSMRMXMT', 1),
  ('Scotiabank', 'SCO', 'SCOXMXMT', 1),
  ('Citibanamex', 'CBN', 'CIBMXMT', 1),
  ('Banco Azteca', 'AZT', 'AZTKMXMT', 1),
  ('BanRegio', 'BREG', 'BRXMXMT', 1),
  ('Klar', 'KLR', 'KLRXMXMT', 1),
  ('Neon', 'NEN', 'NENXMXMT', 1);

-- ============================================================================
-- SEED: Cuentas Bancarias de Proveedores (10 registros)
-- ============================================================================
-- Provider 1 (id 1): 2 accounts
INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '0123456789', '012345678901234567', '4111111111111111', 'LABORATORIOS DEL PHARMA S.A. DE C.V.', 'pagos@lefarma.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 1 AND b.nombre = 'Bancomer' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '9876543210', '987654321098765432', '4222222222222222', 'LABORATORIOS DEL PHARMA S.A. DE C.V.', 'pagos2@lefarma.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 1 AND b.nombre = 'Santander' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

-- Provider 2 (id 2): 2 accounts
INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '1111222233', '111122223333444455', '4333333333333333', 'DISTRIBUIDORA MEDICA NORTE S.A. DE C.V.', 'cuentas@distmednorte.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 2 AND b.nombre = 'Banorte' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '5555666677', '555566667777888899', '4555555555555555', 'DISTRIBUIDORA MEDICA NORTE S.A. DE C.V.', 'pagos@distmednorte.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 2 AND b.nombre = 'HSBC' AND pfp.id_forma_pago = 1
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

-- Provider 3 (id 3): 2 accounts
INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '7777888899', '777788889999000011', '4777777777777777', 'SUMINISTROS HOSPITALARIOS DEL SURESTE S.A.', 'finanzas@sumihospital.mx', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 3 AND b.nombre = 'Scotiabank' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '2222333344', '222233334444555566', '4888888888888888', 'SUMINISTROS HOSPITALARIOS DEL SURESTE S.A.', 'pagos@sumihospital.mx', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 3 AND b.nombre = 'Citibanamex' AND pfp.id_forma_pago = 4
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

-- Provider 4 (id 4): 2 accounts
INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '4444555566', '444455556666777788', '4999999999999999', 'MATERIALES Y EQUIPOS MEDICOS DEL CENTRO S.A. DE C.V.', 'cuentaspagar@materialesmedicos.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 4 AND b.nombre = 'Bancomer' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '6666777788', '666677778888999900', '5105105105105100', 'MATERIALES Y EQUIPOS MEDICOS DEL CENTRO S.A. DE C.V.', 'oficina@materialesmedicos.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 4 AND b.nombre = 'Banco Azteca' AND pfp.id_forma_pago = 5
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

-- Provider 5 (id 5): 2 accounts
INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '8888999900', '888899990000111122', '5205205205205200', 'FARMACEUTICA DEL PACIFICO S.A. DE C.V.', 'pagos@farmaceutica-pacifico.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 5 AND b.nombre = 'BanRegio' AND pfp.id_forma_pago = 2
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

INSERT INTO catalogos.proveedor_forma_pago_cuentas (id_proveedor_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta, beneficiario, correo_notificacion, activo)
SELECT pfp.id_proveedor_forma_pago, b.id_banco, '0001112233', '000111223344556677', '5305305305305300', 'FARMACEUTICA DEL PACIFICO S.A. DE C.V.', 'finanzas@farmaceutica-pacifico.com', 1
FROM catalogos.proveedores_formas_pago pfp
CROSS JOIN catalogos.bancos b
WHERE pfp.id_proveedor = 5 AND b.nombre = 'Klar' AND pfp.id_forma_pago = 6
AND NOT EXISTS (SELECT 1 FROM catalogos.proveedor_forma_pago_cuentas WHERE id_proveedor_forma_pago = pfp.id_proveedor_forma_pago AND id_banco = b.id_banco);

PRINT '';
PRINT '============================================================';
PRINT 'SEED completado: formas_pago, bancos y cuentas bancarias';
PRINT '============================================================';
PRINT '7 formas de pago, 10 bancos, 10 cuentas bancarias insertadas';
GO
