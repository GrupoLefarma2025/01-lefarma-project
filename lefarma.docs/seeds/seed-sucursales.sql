-- Seed: Sucursales
-- Schema: catalogos.sucursales
-- Depende de: seed-empresas.sql (usa id_empresa como FK)

-- Asokam (id_empresa = 7)
IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 7 AND nombre = 'Antonio Maura')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (7, 'Antonio Maura', 'antonio maura', '101', 'Sucursal Antonio Maura', 'sucursal antonio maura', 'ASK-101-CC', 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 7 AND nombre = 'Guadalajara')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (7, 'Guadalajara', 'guadalajara', '102', 'Sucursal Guadalajara', 'sucursal guadalajara', 'ASK-102-CC', 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 7 AND nombre = 'Cedis')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (7, 'Cedis', 'cedis', '103', 'Centro de distribucion', 'centro de distribucion', 'ASK-103-CC', 0, 0, 1);

-- Lefarma (id_empresa = 8)
IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 8 AND nombre = 'Planta')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (8, 'Planta', 'planta', '101', 'Planta de produccion', 'planta de produccion', 'LEF-101-CC', 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 8 AND nombre = 'Mancera')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (8, 'Mancera', 'mancera', '102', 'Sucursal Gabriel Mancera', 'sucursal gabriel mancera', 'LEF-102-CC', 0, 0, 1);

-- Artricenter (id_empresa = 1)
IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 1 AND nombre = 'Viaducto')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (1, 'Viaducto', 'viaducto', '101', 'Sucursal Viaducto', 'sucursal viaducto', 'ATC-101-CC', 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 1 AND nombre = 'La Raza')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (1, 'La Raza', 'la raza', '102', 'Sucursal La Raza', 'sucursal la raza', 'ATC-102-CC', 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 1 AND nombre = 'Atizapan')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (1, 'Atizapan', 'atizapan', '103', 'Sucursal Atizapan', 'sucursal atizapan', 'ATC-103-CC', 0, 0, 1);

-- Construmedika (id_empresa = 11)
IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 11 AND nombre = 'Unica')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (11, 'Unica', 'unica', '001', 'Unica sucursal', 'unica sucursal', 'CON-001-CC', 0, 0, 1);

-- Grupo Lefarma (id_empresa = 12)
IF NOT EXISTS (SELECT 1 FROM catalogos.sucursales WHERE id_empresa = 12 AND nombre = 'Oficinas centrales')
    INSERT INTO catalogos.sucursales (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, clave_contable, latitud, longitud, activo)
    VALUES (12, 'Oficinas centrales', 'oficinas centrales', '001', 'Oficinas corporativas', 'oficinas corporativas', 'GRP-001-CC', 0, 0, 1);
