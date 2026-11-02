/* ============================================================
   045 — Empresas internas de CxP, sucursal y area base
   BD destino: Lefarma / LefarmaDev

   POR QUE EXISTE
   --------------
   El catalogo interno no tenia Reumedika, V-young, Pickneys ni
   Argosol. Farmalic existia sin sucursal ni area. Sin sucursal y
   area, el selector de empresa no puede crear una orden.

   ALCANCE
   -------
   - Inserta empresas faltantes con datos de Asokam.genEmpresasCat.
   - Corrige los datos fiscales base de Farmalic.
   - Crea una sucursal "Unica" por empresa sin sucursal.
   - Crea un area "CxP" por empresa sin area.
   - Idempotente: reejecutar no duplica registros.

   NO APLICA PERMISOS. El permiso va en 046.
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- Empresas que deben existir en el catalogo interno.
IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'REUMEDIKA')
BEGIN
    INSERT INTO catalogos.empresas
        (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave,
         razon_social, rfc, telefono, email, activo, fecha_creacion,
         puede_seleccionar_empresas)
    VALUES
        ('Reumedika', 'REUMEDIKA', 'Reumedika', 'REUMEDIKA', 'REU',
         'Reumedika', 'REU170407IP3', '5620216917', 'licitaciones@reumedika.com.mx',
         1, GETDATE(), 0);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'V-YOUNG')
BEGIN
    INSERT INTO catalogos.empresas
        (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave,
         razon_social, rfc, activo, fecha_creacion, puede_seleccionar_empresas)
    VALUES
        ('V-young', 'V-YOUNG', 'V-young', 'V-YOUNG', 'VYO',
         'V-young', 'VCA210223416', 1, GETDATE(), 0);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'PICKNEYS')
BEGIN
    INSERT INTO catalogos.empresas
        (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave,
         razon_social, rfc, telefono, email, activo, fecha_creacion,
         puede_seleccionar_empresas)
    VALUES
        ('Pickneys', 'PICKNEYS', 'Pickneys', 'PICKNEYS', 'PIC',
         'Pickneys', 'PIC240206MW2', '5559805552', 'licitaciones@pickneys.com.mx',
         1, GETDATE(), 0);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'ARGOSOL')
BEGIN
    INSERT INTO catalogos.empresas
        (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave,
         razon_social, rfc, telefono, email, activo, fecha_creacion,
         puede_seleccionar_empresas)
    VALUES
        ('Argosol', 'ARGOSOL', 'Argosol', 'ARGOSOL', 'ARG',
         'Argosol', 'ARG160222ECA', '5541726008', 'licitaciones@argosol.com.mx',
         1, GETDATE(), 0);
END;

-- Farmalic puede existir con datos de prueba o faltar en desarrollo.
IF NOT EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'FARMALIC')
BEGIN
    INSERT INTO catalogos.empresas
        (nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave,
         razon_social, rfc, telefono, email, activo, fecha_creacion,
         puede_seleccionar_empresas)
    VALUES
        ('Farmalic', 'FARMALIC', 'Farmalic', 'FARMALIC', 'FAR',
         'Farmalic', 'FAR120528783', '5585908586', 'licitaciones@farmalic.com.mx',
         1, GETDATE(), 0);
END;

IF EXISTS (SELECT 1 FROM catalogos.empresas WHERE nombre_normalizado = 'FARMALIC')
BEGIN
    UPDATE catalogos.empresas
    SET nombre = 'Farmalic',
        nombre_normalizado = 'FARMALIC',
        clave = 'FAR',
        razon_social = 'Farmalic',
        rfc = 'FAR120528783',
        telefono = '5585908586',
        email = 'licitaciones@farmalic.com.mx',
        activo = 1,
        fecha_modificacion = GETDATE()
    WHERE nombre_normalizado = 'FARMALIC';
END;

-- Sucursal y area base solo para las empresas de este cambio.
DECLARE @empresas TABLE
(
    nombre NVARCHAR(255) NOT NULL PRIMARY KEY,
    codigo NVARCHAR(10) NOT NULL
);

INSERT INTO @empresas (nombre, codigo)
VALUES
    ('Reumedika', 'REU'),
    ('V-young',   'VYO'),
    ('Pickneys',  'PIC'),
    ('Argosol',   'ARG'),
    ('Farmalic',  'FAR');

INSERT INTO catalogos.sucursales
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, clave_contable, activo, fecha_creacion)
SELECT e.id_empresa,
       'Unica',
       'UNICA',
       'Sucursal interna de CxP',
       'SUCURSAL INTERNA DE CXP',
       x.codigo + '-001',
       x.codigo + '-001',
       1,
       GETDATE()
FROM catalogos.empresas e
INNER JOIN @empresas x ON x.nombre COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogos.sucursales s
    WHERE s.id_empresa = e.id_empresa
);

INSERT INTO catalogos.areas
    (id_empresa, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     clave, id_supervisor_responsable, numero_empleados, activo, fecha_creacion)
SELECT e.id_empresa,
       'CxP',
       'CXP',
       'Area interna de CxP',
       'AREA INTERNA DE CXP',
       x.codigo + '-CXP',
       NULL,
       0,
       1,
       GETDATE()
FROM catalogos.empresas e
INNER JOIN @empresas x ON x.nombre COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogos.areas a
    WHERE a.id_empresa = e.id_empresa
);

COMMIT TRANSACTION;

-- Verificacion: cinco empresas, cinco sucursales y cinco areas.
SELECT e.id_empresa, e.nombre, e.rfc, e.clave,
       s.id_sucursal, s.nombre AS sucursal, s.clave AS clave_sucursal,
       a.id_area, a.nombre AS area, a.clave AS clave_area
FROM catalogos.empresas e
LEFT JOIN catalogos.sucursales s ON s.id_empresa = e.id_empresa
LEFT JOIN catalogos.areas a ON a.id_empresa = e.id_empresa
WHERE e.nombre_normalizado IN ('REUMEDIKA', 'V-YOUNG', 'PICKNEYS', 'ARGOSOL', 'FARMALIC')
ORDER BY e.nombre;
