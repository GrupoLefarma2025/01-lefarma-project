-- =============================================================================
-- MIGRACIÓN: Configuración de descuentos para incidencias de checado
-- DESCRIPCIÓN: Crea la tabla rh.incidencias_checado_config y
--              semilla las reglas iniciales de descuento por acumulación.
--
-- REGLAS INICIALES:
--   1. 3 retardos de entrada menores a 20 min en el mes -> descuento.
--   2. 1 retardo de entrada mayor o igual a 20 min en el mes -> descuento.
--   3. 1 omisión de entrada en la quincena -> descuento.
--   4. 1 omisión de salida en la quincena -> descuento.
--
-- CAMPOS:
--   tipo_incidencia: TARDANZA_ENTRADA, TARDANZA_SALIDA, OMISION_ENTRADA,
--                    OMISION_SALIDA, SALIDA_ANTICIPADA.
--   minutos_min / minutos_max: rango de minutos para retardos (null si no aplica).
--   cantidad_acumulada: cantidad de incidencias del tipo/periodo que generan descuento.
--   periodo: semana, quincena, mes.
-- =============================================================================
DROP TABLE rh.incidencias_checado_config
CREATE TABLE rh.incidencias_checado_config
(
    id_config               INT IDENTITY(1,1) PRIMARY KEY,
    nombre                  NVARCHAR(100) NOT NULL,
    nombre_normalizado      NVARCHAR(100) NULL,
    descripcion             NVARCHAR(500) NOT NULL,
    descripcion_normalizada NVARCHAR(500) NULL,
    tipo_incidencia         VARCHAR(50) NOT NULL,
    minutos_min             INT NULL,
    minutos_max             INT NULL,
    registro_entrada BIT NOT NULL DEFAULT 0,
    registro_salida BIT NOT NULL DEFAULT 0,
    cantidad_acumulada      INT NOT NULL,
    periodo                 VARCHAR(20) NOT NULL,
    prioridad               INT NOT NULL DEFAULT 0,
    activo                  BIT NOT NULL DEFAULT 1,
    fecha_creacion          DATETIME NOT NULL DEFAULT GETDATE(),
    fecha_modificacion      DATETIME NULL
);


CREATE UNIQUE INDEX UX_incidencias_checado_config_nombre
    ON rh.incidencias_checado_config (nombre)
    WHERE activo = 1;


-- Semilla inicial
SET IDENTITY_INSERT rh.incidencias_checado_config ON;


INSERT INTO rh.incidencias_checado_config
    (id_config, nombre, nombre_normalizado, descripcion, descripcion_normalizada,
     tipo_incidencia, minutos_min, minutos_max, cantidad_acumulada, periodo,
     registro_entrada, registro_salida, prioridad, activo, fecha_creacion)
VALUES
    (1, N'Retardo de entrada menor a 20 min',
     N'Retardo de entrada menor a 20 min',
     N'Al acumular 3 retardos de entrada menores a 20 minutos en el mes, se genera descuento.',
     N'Al acumular 3 retardos de entrada menores a 20 minutos en el mes, se genera descuento.',
     'TARDANZA_ENTRADA', 1, 20, 3, 'mes', 0, 0, 10, 1, GETDATE()),

    (2, N'Retardo de entrada mayor o igual a 20 min',
     N'Retardo de entrada mayor o igual a 20 min',
     N'Un retardo de entrada mayor o igual a 20 minutos en el mes genera descuento.',
     N'Un retardo de entrada mayor o igual a 20 minutos en el mes genera descuento.',
     'TARDANZA_ENTRADA', 20, NULL, 1, 'mes',0, 0, 20, 1, GETDATE()),

    (3, N'Omisión de entrada',
     N'Omision de entrada',
     N'Una omisión de checado de entrada en la quincena genera descuento.',
     N'Una omision de checado de entrada en la quincena genera descuento.',
     'OMISION_ENTRADA', NULL, NULL, 1, 'quincena',1, 0, 30, 1, GETDATE()),

    (4, N'Omisión de salida',
     N'Omision de salida',
     N'Una omisión de checado de salida en la quincena genera descuento.',
     N'Una omision de checado de salida en la quincena genera descuento.',
     'OMISION_SALIDA', NULL, NULL, 1, 'quincena',0, 1, 40, 1, GETDATE()),
     
      (5, N'Salida anticipada', N'Salida anticipada',
         N'Una salida anticipada de 20 minutos o más en el mes genera descuento.',
         N'Una salida anticipada de 20 minutos o más en el mes genera descuento.',
         'SALIDA_ANTICIPADA', 20, NULL, 1, 'mes', 0,0, 50, 1,  GETDATE());
    


SET IDENTITY_INSERT rh.incidencias_checado_config OFF;
