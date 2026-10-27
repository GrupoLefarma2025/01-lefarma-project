-- ============================================================
-- 0013_20261021-0000_viaticos_config_taxi_km_h.lefarma.sql
-- Descripcion: agrega la clave costos.taxi_km_h a la tabla de
--              configuracion de viaticos.
--
--   El motor estima los minutos del taxi a la terminal (aeropuerto o
--   central de autobuses) con la distancia real a esa terminal y una
--   velocidad urbana promedio. Esa velocidad es configurable:
--
--     costos.taxi_km_h = 25   (km/h)
--
--   Si la clave no existe el motor usa 25 por defecto, asi que este
--   script es un ajuste explicito para que el valor se pueda editar
--   desde la base sin tocar codigo.
--
--   Requiere que exista viaticos.config_parametros (script 0011). Si la
--   tabla no existe el script avisa y no hace nada.
--
-- Target: Lefarma (USE explicito).
-- Idempotente. NO se aplica automaticamente.
-- ============================================================

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'viaticos.config_parametros', N'U') IS NULL
BEGIN
    PRINT N'viaticos.config_parametros no existe: aplica primero 0011_viaticos_config_parametros.';
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM viaticos.config_parametros WHERE clave = N'costos.taxi_km_h')
BEGIN
    INSERT INTO viaticos.config_parametros (clave, valor, descripcion)
    VALUES (N'costos.taxi_km_h', N'25', N'Velocidad urbana promedio del taxi a la terminal (km/h)');

    PRINT N'costos.taxi_km_h insertado con 25 km/h.';
END
ELSE
BEGIN
    PRINT N'costos.taxi_km_h ya existe: no se toca el valor actual.';
END
GO
