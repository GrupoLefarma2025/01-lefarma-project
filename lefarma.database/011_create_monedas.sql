-- ============================================================
-- 011 - Catálogo de Monedas
-- Tabla: catalogos.monedas
-- ============================================================

CREATE TABLE catalogos.monedas (
    id_moneda          INT            IDENTITY(1,1)  NOT NULL,
    codigo             NVARCHAR(3)                   NOT NULL,  -- ISO 4217
    nombre             NVARCHAR(100)                 NOT NULL,
    simbolo            NVARCHAR(5)                   NOT NULL,
    locale             NVARCHAR(10)                  NOT NULL,  -- para Intl.NumberFormat
    tipo_cambio        DECIMAL(18,6)                 NOT NULL  DEFAULT 1.000000,
    es_default         BIT                           NOT NULL  DEFAULT 0,
    activo             BIT                           NOT NULL  DEFAULT 1,
    fecha_creacion     DATETIME                      NOT NULL  DEFAULT GETDATE(),
    fecha_modificacion DATETIME                          NULL,

    CONSTRAINT PK_monedas        PRIMARY KEY (id_moneda),
    CONSTRAINT UQ_monedas_codigo UNIQUE      (codigo)
);

-- Datos iniciales
INSERT INTO catalogos.monedas (codigo, nombre, simbolo, locale, tipo_cambio, es_default, activo)
VALUES
    ('MXN', 'Peso Mexicano',        '$',  'es-MX', 1.000000, 0, 1),
    ('USD', 'Dólar Americano',      '$',  'en-US', 0.050000, 0, 1),
    ('HNL', 'Lempira Hondureño',    'L',  'es-HN', 1.000000, 1, 1),  -- default
    ('EUR', 'Euro',                 '€',  'es-ES', 0.046000, 0, 1),
    ('GTQ', 'Quetzal Guatemalteco', 'Q',  'es-GT', 0.390000, 0, 1),
    ('CRC', 'Colón Costarricense',  '₡',  'es-CR', 26.50000, 0, 1);
