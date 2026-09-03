-- =============================================
-- SCRIPT 031 — Fix error de la app en LefarmaDev2
-- =============================================
-- Fecha:       2026-08-27
-- Destino:     LefarmaDev2 (192.168.4.2)
-- Motivo:      La app .NET lanza:
--              Microsoft.Data.SqlClient.SqlException:
--                'Invalid column name 'id_entidad'.
--                 Invalid column name 'tipo_entidad'.'
--              La entidad WorkflowBitacora (config.workflow_bitacora)
--              mapea esas columnas y LefarmaDev2 (snapshot viejo) no las tiene.
-- Origen:      LefarmaDev (esquema de verdad) —
--              ahi son nullable: varchar(30) NULL y int NULL.
-- Naturaleza:  100% ADITIVO (ALTER TABLE ... ADD).
--              NO borra nada. Regla del usuario: cero DROP/DELETE.
-- Nota:        Para el resto de diferencias de esquema aplicar primero
--              el script 030_actualizar_lefarmadev2_a_esquema_lefarmadev.sql.
-- =============================================

USE [LefarmaDev2];
GO

-- ----------------------------------------------------
-- 1. Agregar columnas faltantes (guardado, sin errores si ya existen)
-- ----------------------------------------------------
IF COL_LENGTH('config.workflow_bitacora', 'tipo_entidad') IS NULL
BEGIN
    ALTER TABLE config.workflow_bitacora ADD tipo_entidad varchar(30) NULL;
    PRINT 'COLUMNA AGREGADA: config.workflow_bitacora.tipo_entidad varchar(30) NULL';
END
ELSE
    PRINT 'OK (ya existia): config.workflow_bitacora.tipo_entidad';

IF COL_LENGTH('config.workflow_bitacora', 'id_entidad') IS NULL
BEGIN
    ALTER TABLE config.workflow_bitacora ADD id_entidad int NULL;
    PRINT 'COLUMNA AGREGADA: config.workflow_bitacora.id_entidad int NULL';
END
ELSE
    PRINT 'OK (ya existia): config.workflow_bitacora.id_entidad';
GO

-- ----------------------------------------------------
-- 2. Verificacion
-- ----------------------------------------------------
-- 2.1 Estructura final: esperar 11 columnas (9 anteriores + tipo_entidad + id_entidad)
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'config' AND TABLE_NAME = 'workflow_bitacora'
ORDER BY ORDINAL_POSITION;

-- 2.2 Filas legacy: las que queden con NULL en id_entidad son historico anterior
-- (mismo comportamiento que LefarmaDev, que tambien las tiene NULL).
SELECT COUNT(*) AS total_bitacora,
       SUM(CASE WHEN id_entidad IS NULL THEN 1 ELSE 0 END) AS filas_sin_id_entidad
FROM config.workflow_bitacora;
GO

-- =============================================
-- FIN — Si la app sigue reportando 'Invalid column name ...'
-- en OTRAS tablas, es el mismo patron (Dev2 es snapshot viejo):
-- avisar para generar el diff completo Dev2 vs LefarmaDev (solo aditivo).
-- =============================================