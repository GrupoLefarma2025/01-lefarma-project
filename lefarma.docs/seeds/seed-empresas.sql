-- Seed: Empresas
-- Schema: catalogos.empresas

SET IDENTITY_INSERT catalogos.empresas ON;

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre = 'Artricenter')
    INSERT INTO catalogos.empresas (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, activo)
    VALUES (1, 'Artricenter', 'artricenter', 'ATC', 'Artricenter S.A. de C.V.', 'artricenter s.a. de c.v.', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre = 'Asokam')
    INSERT INTO catalogos.empresas (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, activo)
    VALUES (7, 'Asokam', 'asokam', 'ASK', 'Asokam S.A. de C.V.', 'asokam s.a. de c.v.', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre = 'Lefarma')
    INSERT INTO catalogos.empresas (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, activo)
    VALUES (8, 'Lefarma', 'lefarma', 'LEF', 'Lefarma S.A. de C.V.', 'lefarma s.a. de c.v.', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre = 'Construmedika')
    INSERT INTO catalogos.empresas (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, activo)
    VALUES (11, 'Construmedika', 'construmedika', 'CON', 'Construmedika S.A. de C.V.', 'construmedika s.a. de c.v.', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre = 'GrupoLefarma')
    INSERT INTO catalogos.empresas (id_empresa, nombre, nombre_normalizado, clave, descripcion, descripcion_normalizada, activo)
    VALUES (12, 'GrupoLefarma', 'grupolefarma', 'GRP', 'Grupo Lefarma Corporativo', 'grupo lefarma corporativo', 1);

SET IDENTITY_INSERT catalogos.empresas OFF;
