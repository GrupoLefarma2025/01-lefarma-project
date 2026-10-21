-- ============================================================
-- 0011_20261020-0000_viaticos_config_parametros.lefarma.sql
-- Descripcion: Tabla de configuracion de viaticos (clave/valor) con la
--              semilla de costos del motor y la llave de Google Places:
--
--              - costos.*        -> comida, rendimiento, casetas, taxi,
--                                   hospedaje (los valores por defecto
--                                   siguen en el motor si no hay clave)
--              - google_places.* -> habilitada, llave y radio de busqueda
--                                   de hoteles locales
--
--              Asi los costos ya NO viven en appsettings ni en el codigo:
--              se editan en la base y el motor los toma en cada calculo
--              (cache de 5 minutos).
--
-- Target: Lefarma (USE explicito).
-- Idempotente. NO se aplica automaticamente.
-- ============================================================

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

-- 1) Tabla de configuracion
IF OBJECT_ID('viaticos.config_parametros', 'U') IS NULL
BEGIN
    CREATE TABLE viaticos.config_parametros (
        clave          NVARCHAR(80)  NOT NULL,
        valor          NVARCHAR(400) NOT NULL,
        descripcion    NVARCHAR(200) NULL,
        fecha_creacion DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_config_parametros PRIMARY KEY (clave)
    );
    PRINT 'Tabla [viaticos].[config_parametros] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[config_parametros] ya existe. Skip.';
GO

-- 2) Semilla de costos y de proveedores (solo si la clave no existe)
DECLARE @semilla TABLE (clave NVARCHAR(80) NOT NULL PRIMARY KEY, valor NVARCHAR(400) NOT NULL, descripcion NVARCHAR(200) NULL);
INSERT INTO @semilla (clave, valor, descripcion) VALUES
    -- Proveedores: hoteles locales
    ('google_places.habilitado', '0', 'Habilita la busqueda de hoteles en Google Places (Places API - New)'),
    ('google_places.llave', '', 'Llave de la API de Google Maps (Places API - New)'),
    ('google_places.radio_km', '8', 'Radio de busqueda de hoteles alrededor del punto (km)'),
    -- Costos generales
    ('costos.comida_dia', '600', 'Costo de comida por dia de viaje (MXN)'),
    ('costos.rendimiento_km_l', '12', 'Rendimiento del vehiculo (km por litro)'),
    ('costos.caseta_por_km', '1.4', 'Costo estimado de caseta por km (MXN)'),
    ('costos.taxi_km_h', '25', 'Velocidad urbana promedio del taxi a la terminal (km/h)'),
    -- Hospedaje por ciudad (tarifa tabulador por noche)
    ('costos.hospedaje_noche.CDMX', '3533', 'Hospedaje por noche en Ciudad de Mexico'),
    ('costos.hospedaje_noche.GDL', '2006', 'Hospedaje por noche en Guadalajara'),
    ('costos.hospedaje_noche.MTY', '2353', 'Hospedaje por noche en Monterrey'),
    ('costos.hospedaje_noche.QRO', '1700', 'Hospedaje por noche en Queretaro'),
    ('costos.hospedaje_noche.PUE', '1500', 'Hospedaje por noche en Puebla'),
    ('costos.hospedaje_noche.CUN', '2300', 'Hospedaje por noche en Cancun'),
    ('costos.hospedaje_noche.TIJ', '2100', 'Hospedaje por noche en Tijuana'),
    ('costos.hospedaje_noche.XAL', '1700', 'Hospedaje por noche en Xalapa'),
    ('costos.hospedaje_noche.BJX', '2100', 'Hospedaje por noche en Bajio'),
    -- Taxi: tarifa base y por km
    ('costos.taxi_base.CDMX', '30', 'Taxi: tarifa base en Ciudad de Mexico'),
    ('costos.taxi_km.CDMX', '11', 'Taxi: costo por km en Ciudad de Mexico'),
    ('costos.taxi_base.GDL', '28', 'Taxi: tarifa base en Guadalajara'),
    ('costos.taxi_km.GDL', '10', 'Taxi: costo por km en Guadalajara'),
    ('costos.taxi_base.MTY', '30', 'Taxi: tarifa base en Monterrey'),
    ('costos.taxi_km.MTY', '12', 'Taxi: costo por km en Monterrey'),
    ('costos.taxi_base.QRO', '25', 'Taxi: tarifa base en Queretaro'),
    ('costos.taxi_km.QRO', '10', 'Taxi: costo por km en Queretaro'),
    ('costos.taxi_base.PUE', '27', 'Taxi: tarifa base en Puebla'),
    ('costos.taxi_km.PUE', '10', 'Taxi: costo por km en Puebla'),
    ('costos.taxi_base.CUN', '35', 'Taxi: tarifa base en Cancun'),
    ('costos.taxi_km.CUN', '13', 'Taxi: costo por km en Cancun'),
    ('costos.taxi_base.TIJ', '32', 'Taxi: tarifa base en Tijuana'),
    ('costos.taxi_km.TIJ', '12', 'Taxi: costo por km en Tijuana'),
    ('costos.taxi_base.XAL', '27', 'Taxi: tarifa base en Xalapa'),
    ('costos.taxi_km.XAL', '10', 'Taxi: costo por km en Xalapa'),
    ('costos.taxi_base.BJX', '28', 'Taxi: tarifa base en Bajio'),
    ('costos.taxi_km.BJX', '10', 'Taxi: costo por km en Bajio'),
    -- Taxi CDMX: tarifas por modalidad (SEMOVI)
    ('costos.taxi.cdmx.libre_base', '8.74', 'Taxi libre CDMX: tarifa base'),
    ('costos.taxi.cdmx.libre_km', '4.28', 'Taxi libre CDMX: costo por km'),
    ('costos.taxi.cdmx.sitio_base', '13.10', 'Taxi sitio CDMX: tarifa base'),
    ('costos.taxi.cdmx.sitio_km', '5.20', 'Taxi sitio CDMX: costo por km'),
    ('costos.taxi.cdmx.radio_base', '27.30', 'Radio taxi CDMX: tarifa base'),
    ('costos.taxi.cdmx.radio_km', '7.36', 'Radio taxi CDMX: costo por km'),
    -- Taxi Xalapa
    ('costos.taxi.xal.perimetro', '38.5', 'Taxi Xalapa dentro del perimetro (tarifa fija)'),
    ('costos.taxi.xal.fuera_base', '50', 'Taxi Xalapa fuera del perimetro: tarifa base'),
    ('costos.taxi.xal.fuera_km', '10', 'Taxi Xalapa fuera del perimetro: costo por km');

MERGE viaticos.config_parametros AS destino
USING @semilla AS origen
    ON destino.clave = origen.clave
WHEN NOT MATCHED THEN
    INSERT (clave, valor, descripcion) VALUES (origen.clave, origen.valor, origen.descripcion);

PRINT 'Semilla de configuracion de viaticos aplicada.';
GO

PRINT 'FIN script 0011 viaticos config_parametros.';
GO
