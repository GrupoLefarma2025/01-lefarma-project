-- Seed: Formas de Pago
-- Schema: catalogos.formas_pago

IF NOT EXISTS (SELECT 1 FROM catalogos.formas_pago WHERE nombre = 'Pago a contado')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago a contado', 'pago a contado', 'Pago total al momento', 'pago total al momento', 'EFO', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.formas_pago WHERE nombre = 'Pago a credito')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago a credito', 'pago a credito', 'Pago diferido segun acuerdo con proveedor', 'pago diferido segun acuerdo con proveedor', 'CRE', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.formas_pago WHERE nombre = 'Pago parcial')
    INSERT INTO catalogos.formas_pago (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES ('Pago parcial', 'pago parcial', 'Anticipo + saldo pendiente', 'anticipo + saldo pendiente', 'PAR', 1);
