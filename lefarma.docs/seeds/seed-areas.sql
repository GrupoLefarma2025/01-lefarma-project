-- Seed: Areas
-- Schema: catalogos.areas
-- Nota: id_empresa debe corresponder a una empresa existente.
--       Ajustar el valor segun el entorno (por defecto usa id_empresa = 1, Artricenter).

DECLARE @id_empresa INT = 1;

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Recursos Humanos')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Recursos Humanos', 'recursos humanos', 'Solicitar a RH', 'solicitar a rh', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Contabilidad')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Contabilidad', 'contabilidad', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Tesoreria')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Tesoreria', 'tesoreria', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Compras')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Compras', 'compras', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Almacen')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Almacen', 'almacen', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Produccion')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Produccion', 'produccion', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Ventas')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Ventas', 'ventas', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Marketing')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Marketing', 'marketing', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Tecnologia')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Tecnologia', 'tecnologia', 'Por definir', 'por definir', '', 1);

IF NOT EXISTS (SELECT 1 FROM catalogos.areas WHERE id_empresa = @id_empresa AND nombre = 'Calidad')
    INSERT INTO catalogos.areas (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, activo)
    VALUES (@id_empresa, 'Calidad', 'calidad', 'Por definir', 'por definir', '', 1);
