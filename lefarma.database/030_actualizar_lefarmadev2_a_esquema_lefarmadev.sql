-- =====================================================================
-- MEGASCRIPT: Actualizar LefarmaDev2 -> esquema LefarmaDev
-- Generado: 2026-08-24
-- Origen de verdad: LefarmaDev  @ 192.168.4.2 (92 tablas)
-- Destino:          LefarmaDev2 @ 192.168.4.2 (88 tablas)
--
-- REGLA DEL USUARIO (2026-08-24): NO SE BORRA NADA.
--   Este script es 100% aditivo: crea tablas/SP y ajusta columnas.
--   No contiene ningun DROP ni DELETE.
--
-- CONTENIDO (diff verificado en vivo 2026-08-24 contra LefarmaDev2):
--   [+] 1 schema nuevo: educacion_medica (no existe en Dev2)
--   [+] 5 tablas nuevas (todas ausentes en Dev2, verificadas):
--       - educacion_medica.tipo_gerencia
--       - educacion_medica.parametros_anestesias
--       - educacion_medica.programas_anuales
--       - educacion_medica.hospital_extension
--       - rh.envios_solicitudes
--   [~] 3 columnas ajustadas en tablas comunes (estado viejo verificado):
--       - config.workflow_bitacora.id_orden              INT NOT NULL -> INT NULL
--       - config.workflow_participantes.requiere_jefe_inmediato  BIT NULL -> BIT NOT NULL (default 0)
--       - operaciones.comprobantes_partidas.activo       BIT NOT NULL -> BIT NULL
--   [+] 1 procedimiento nuevo: rh.incidencias_checado_resumen
--       (referencias adaptadas [LefarmaDev]. -> [LefarmaDev2].;
--        [AsistenciasDev] se deja tal cual — vive en este mismo servidor)
--
-- NO SE TOCA:
--   - rh.dias_no_habiles y rh.dias_usuario EXISTEN en Dev2 y SE CONSERVAN
--     (en LefarmaDev no existen; es una divergencia aceptada).
--   - dbo.pruebaeliminar no existe en Dev2; no aplica.
--   - Las tablas extra de Dev2 (dbo.eliminar_orden, dbo.oc_eliminame,
--     dbo.ordenes_compra_eliminadas, etc.) se conservan intactas.
--
-- ADVERTENCIAS:
--   1) Tomar BACKUP de LefarmaDev2 antes de ejecutar.
--   2) Ejecutar completo en una transaccion; revisar, luego COMMIT.
-- =====================================================================

USE LefarmaDev2;
GO

-- =====================================================================
-- SECCION 0: SCHEMA NUEVO educacion_medica
-- (CREATE SCHEMA debe ser unica instruccion del batch -> EXEC dinamico)
-- =====================================================================
IF SCHEMA_ID('educacion_medica') IS NULL
    EXEC('CREATE SCHEMA educacion_medica');
GO

-- =====================================================================
-- SECCION 1: TABLAS NUEVAS
-- =====================================================================

IF OBJECT_ID('educacion_medica.tipo_gerencia', 'U') IS NULL
BEGIN
    CREATE TABLE educacion_medica.tipo_gerencia (
        id_tipo_gerencia        INT           IDENTITY(1,1) NOT NULL,
        descripcion             VARCHAR(50)   NOT NULL,
        activo                  BIT           NOT NULL CONSTRAINT DF_tipo_gerencia_activo DEFAULT ((1)),
        fecha_creacion          DATETIME2     NOT NULL CONSTRAINT DF_tipo_gerencia_fecrea DEFAULT (sysutcdatetime()),
        fecha_modificacion      DATETIME2     NOT NULL CONSTRAINT DF_tipo_gerencia_femod DEFAULT (sysutcdatetime()),
        id_usuario_creacion     INT           NULL,
        id_usuario_modificacion INT           NULL,
        CONSTRAINT PK_tipo_gerencia PRIMARY KEY CLUSTERED (id_tipo_gerencia),
        CONSTRAINT UQ_tipo_gerencia_descripcion UNIQUE NONCLUSTERED (descripcion)
    );
END
GO

IF OBJECT_ID('educacion_medica.parametros_anestesias', 'U') IS NULL
BEGIN
    CREATE TABLE educacion_medica.parametros_anestesias (
        id_parametro_anestesia  INT            IDENTITY(1,1) NOT NULL,
        anio                    INT            NOT NULL,
        clave                   VARCHAR(50)    NOT NULL,
        valor                   DECIMAL(10,6)  NOT NULL,
        descripcion             NVARCHAR(250)  NULL,
        orden                   INT            NOT NULL CONSTRAINT DF_parametros_anestesias_orden DEFAULT ((0)),
        activo                  BIT            NOT NULL CONSTRAINT DF_parametros_anestesias_activo DEFAULT ((1)),
        fecha_creacion          DATETIME2      NOT NULL CONSTRAINT DF_parametros_anestesias_fecrea DEFAULT (sysutcdatetime()),
        fecha_modificacion      DATETIME2      NOT NULL CONSTRAINT DF_parametros_anestesias_femod DEFAULT (sysutcdatetime()),
        id_usuario_creacion     INT            NULL,
        id_usuario_modificacion INT            NULL,
        CONSTRAINT PK_parametros_anestesias PRIMARY KEY CLUSTERED (id_parametro_anestesia),
        CONSTRAINT UQ_parametros_anestesias_anio_clave UNIQUE NONCLUSTERED (anio, clave)
    );
END
GO

-- programas_anuales depende de tipo_gerencia (FK) — crear despues
IF OBJECT_ID('educacion_medica.programas_anuales', 'U') IS NULL
BEGIN
    CREATE TABLE educacion_medica.programas_anuales (
        id_programa_anual       INT            IDENTITY(1,1) NOT NULL,
        fecha                   DATE           NOT NULL,
        definicion              NVARCHAR(200)  NULL,
        periodo_inicio          TINYINT        NULL,
        periodo_fin             TINYINT        NULL,
        id_tipo_gerencia        INT            NULL,
        tipo_hospital           VARCHAR(20)    NULL,
        numero_hospitales       INT            NULL,
        meta_al_anio            INT            NULL,
        productos_a_promocionar NVARCHAR(300)  NULL,
        semanas_trabajo         DECIMAL(8,2)   NULL,
        talleres_semana         DECIMAL(8,2)   NULL,
        talleres_especialista   DECIMAL(8,2)   NULL,
        especialistas_necesarios INT           NULL,
        especialistas_disponibles_imss INT     NULL,
        especialistas_disponibles_descentralizados INT NULL,
        especialistas_a_contratar INT          NULL,
        activo                  BIT            NOT NULL CONSTRAINT DF_programas_anuales_activo DEFAULT ((1)),
        fecha_creacion          DATETIME2      NOT NULL CONSTRAINT DF_programas_anuales_fecrea DEFAULT (sysutcdatetime()),
        fecha_modificacion      DATETIME2      NOT NULL CONSTRAINT DF_programas_anuales_femod DEFAULT (sysutcdatetime()),
        id_usuario_creacion     INT            NULL,
        id_usuario_modificacion INT            NULL,
        CONSTRAINT PK_programas_anuales PRIMARY KEY CLUSTERED (id_programa_anual)
    );

    ALTER TABLE educacion_medica.programas_anuales
        WITH CHECK ADD CONSTRAINT FK_programas_anuales_tipo_gerencia
        FOREIGN KEY (id_tipo_gerencia)
        REFERENCES educacion_medica.tipo_gerencia (id_tipo_gerencia);
END
GO

-- hospital_extension depende de tipo_gerencia (FK)
IF OBJECT_ID('educacion_medica.hospital_extension', 'U') IS NULL
BEGIN
    CREATE TABLE educacion_medica.hospital_extension (
        id_hospital_extension   INT            IDENTITY(1,1) NOT NULL,
        id_hospital             INT            NOT NULL,
        fecha                   DATE           NOT NULL,
        id_tipo_gerencia        INT            NULL,
        con_sia                 BIT            NULL,
        numero_quirofanos       INT            NULL,
        anestesias_totales      DECIMAL(18,2)  NULL,
        anestesias_generales    DECIMAL(18,2)  NULL,
        anestesias_regionales   DECIMAL(18,2)  NULL,
        anestesias_epidurales   DECIMAL(18,2)  NULL,
        anestesias_subdurales   DECIMAL(18,2)  NULL,
        anestesias_mixtas_obesos DECIMAL(18,2) NULL,
        anestesias_mixtas_no_obesos DECIMAL(18,2) NULL,
        activo                  BIT            NOT NULL CONSTRAINT DF_hospital_extension_activo DEFAULT ((1)),
        fecha_creacion          DATETIME2      NOT NULL CONSTRAINT DF_hospital_extension_fecrea DEFAULT (sysutcdatetime()),
        fecha_modificacion      DATETIME2      NOT NULL CONSTRAINT DF_hospital_extension_femod DEFAULT (sysutcdatetime()),
        id_usuario_creacion     INT            NULL,
        id_usuario_modificacion INT            NULL,
        CONSTRAINT PK_hospital_extension PRIMARY KEY CLUSTERED (id_hospital_extension),
        CONSTRAINT UQ_hospital_extension_id_hospital UNIQUE NONCLUSTERED (id_hospital)
    );

    ALTER TABLE educacion_medica.hospital_extension
        WITH CHECK ADD CONSTRAINT FK_hospital_extension_tipo_gerencia
        FOREIGN KEY (id_tipo_gerencia)
        REFERENCES educacion_medica.tipo_gerencia (id_tipo_gerencia);
END
GO

-- NOTA: en Dev, hospital_extension.id_hospital NO tiene FK a hospitales
-- (solo indice unico). Se replica igual.

IF OBJECT_ID('rh.envios_solicitudes', 'U') IS NULL
BEGIN
    CREATE TABLE rh.envios_solicitudes (
        id_envio               INT            IDENTITY(1,1) NOT NULL,
        id_solicitud           INT            NOT NULL,
        id_usuario_envio       INT            NOT NULL,
        estado                 VARCHAR(20)    NOT NULL CONSTRAINT DF_envios_solicitudes_estado DEFAULT ('PENDIENTE'),
        token_seguridad        NVARCHAR(100)  NOT NULL,
        id_tipo_solicitud      INT            NULL,
        id_usuario_solicitante INT            NULL,
        fecha_envio            DATETIME       NOT NULL CONSTRAINT DF_envios_solicitudes_fecenv DEFAULT (getdate()),
        fecha_respuesta        DATETIME       NULL,
        id_usuario_respuesta   INT            NULL,
        comentario_respuesta   NVARCHAR(500)  NULL,
        fecha_creacion         DATETIME       NULL CONSTRAINT DF_envios_solicitudes_fecrea DEFAULT (getdate()),
        fecha_modificacion     DATETIME       NULL CONSTRAINT DF_envios_solicitudes_femod DEFAULT (getdate()),
        activo                 BIT            NOT NULL CONSTRAINT DF_envios_solicitudes_activo DEFAULT ((1)),
        CONSTRAINT PK_envios_solicitudes PRIMARY KEY CLUSTERED (id_envio),
        CONSTRAINT UQ_envios_solicitudes_token UNIQUE NONCLUSTERED (token_seguridad)
    );

    CREATE NONCLUSTERED INDEX IX_spe_solicitud
        ON rh.envios_solicitudes (id_solicitud);

    ALTER TABLE rh.envios_solicitudes
        WITH CHECK ADD CONSTRAINT FK_spe_solicitud
        FOREIGN KEY (id_solicitud)
        REFERENCES rh.solicitudes_personal (id_solicitud);
END
GO

-- =====================================================================
-- SECCION 2: CAMBIOS DE COLUMNAS EN TABLAS COMUNES
-- (estado actual de Dev2 verificado en vivo 2026-08-24)
-- =====================================================================

-- 2.1 config.workflow_bitacora.id_orden: INT NOT NULL -> INT NULL (sin default)
ALTER TABLE config.workflow_bitacora
    ALTER COLUMN id_orden INT NULL;
GO

-- 2.2 config.workflow_participantes.requiere_jefe_inmediato: BIT NULL -> BIT NOT NULL
--     Estrategia: llenar NULLs con 0, soltar default, ALTER, re-crear default ((0))
UPDATE config.workflow_participantes
SET requiere_jefe_inmediato = 0
WHERE requiere_jefe_inmediato IS NULL;
GO

DECLARE @df_name NVARCHAR(200);
SELECT @df_name = dc.name
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('config.workflow_participantes')
  AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('config.workflow_participantes'), 'requiere_jefe_inmediato', 'ColumnId');
IF @df_name IS NOT NULL
    EXEC('ALTER TABLE config.workflow_participantes DROP CONSTRAINT ' + @df_name);
GO

ALTER TABLE config.workflow_participantes
    ALTER COLUMN requiere_jefe_inmediato BIT NOT NULL;
GO

ALTER TABLE config.workflow_participantes
    ADD CONSTRAINT DF_workflow_participantes_rji DEFAULT ((0)) FOR requiere_jefe_inmediato;
GO

-- 2.3 operaciones.comprobantes_partidas.activo: BIT NOT NULL -> BIT NULL
DECLARE @df_name2 NVARCHAR(200);
SELECT @df_name2 = dc.name
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('operaciones.comprobantes_partidas')
  AND dc.parent_column_id = COLUMNPROPERTY(OBJECT_ID('operaciones.comprobantes_partidas'), 'activo', 'ColumnId');
IF @df_name2 IS NOT NULL
    EXEC('ALTER TABLE operaciones.comprobantes_partidas DROP CONSTRAINT ' + @df_name2);
GO

ALTER TABLE operaciones.comprobantes_partidas
    ALTER COLUMN activo BIT NULL;
GO

ALTER TABLE operaciones.comprobantes_partidas
    ADD CONSTRAINT DF_comprobantes_partidas_activo DEFAULT ((1)) FOR activo;
GO

-- =====================================================================
-- SECCION 3: (ELIMINADA)
-- En la version para prod esta seccion eliminaba 2 tablas huerfanas.
-- POR INSTRUCCION DEL USUARIO (2026-08-24): aqui NO SE BORRA NADA.
-- rh.dias_no_habiles y rh.dias_usuario se conservan en Dev2.
-- =====================================================================

-- =====================================================================
-- SECCION 4: PROCEDIMIENTO NUEVO: rh.incidencias_checado_resumen
--
-- Nota: referencias internas adaptadas a [LefarmaDev2].
-- [AsistenciasDev] vive en ESTE MISMO servidor (192.168.4.2), asi que
-- funciona sin cambios (a diferencia del caso de produccion).
-- =====================================================================

IF OBJECT_ID('rh.incidencias_checado_resumen', 'P') IS NULL
BEGIN
    EXEC('
CREATE   PROCEDURE rh.incidencias_checado_resumen
    @FechaInicio DATE,
    @FechaFin    DATE,
    @Nomina      VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
	WITH incidencias AS (
	    SELECT  Fecha,
	            Nomina,
	            Nombre,
	            Empresa,
	            Departamento,
	            Puesto,
	            Entrada,
	            Salida,
	            Entro,
	            Salio
	    FROM    [AsistenciasDev].[dbo].[incidenciasChecado]
	     WHERE   Fecha BETWEEN @FechaInicio AND @FechaFin
          AND   Nomina IS NOT NULL
          AND   (@Nomina IS NULL OR Nomina = @Nomina)
	),
	checadas AS (
	    SELECT  *,
	            CASE
	                WHEN Entro IS NOT NULL AND Salio IS NOT NULL AND Entro = Salio THEN
	                    CASE
	                        WHEN ABS(DATEDIFF(MINUTE, ISNULL(Entrada, ''00:00''), Entro))
	                             <= ABS(DATEDIFF(MINUTE, ISNULL(Salida,  ''00:00''), Salio))
                        THEN Entro
                        ELSE NULL
	                    END
	                WHEN Entro IS NOT NULL AND (Salio IS NULL OR Entro <> Salio) THEN Entro
	                ELSE NULL
	            END AS EntroReal,
	            CASE
	                WHEN Entro IS NOT NULL AND Salio IS NOT NULL AND Entro = Salio THEN
	                    CASE
	                        WHEN ABS(DATEDIFF(MINUTE, ISNULL(Entrada, ''00:00''), Entro))
	                             <= ABS(DATEDIFF(MINUTE, ISNULL(Salida,  ''00:00''), Salio))
                        THEN NULL
                        ELSE Salio
	                    END
	                WHEN Salio IS NOT NULL AND (Entro IS NULL OR Entro <> Salio) THEN Salio
	                ELSE NULL
	            END AS SalioReal
	    FROM    incidencias
	),
	con_checado AS (
	    SELECT  *,
	            CASE WHEN EntroReal IS NOT NULL THEN 1 ELSE 0 END AS ChecoEntrada,
	            CASE WHEN SalioReal IS NOT NULL THEN 1 ELSE 0 END AS ChecoSalida
	    FROM    checadas
	),
	reglas AS (
	    SELECT  id_config,
	            nombre,
	            tipo_incidencia,
	            minutos_min,
	            minutos_max,
	            cantidad_acumulada,
	            periodo,
	            registro_entrada,
	            registro_salida,
	            excluir_dias_habiles_consumen_saldo
	    FROM    [LefarmaDev2].[rh].[incidencias_checado_config]
	    WHERE   activo = 1
	),
	dias_sin_incidencia AS (
	    SELECT DISTINCT
	        TRY_CAST(ud.numero_empleado AS BIGINT) AS Nomina,
	        dh.fecha                                AS Fecha
	    FROM    [LefarmaDev2].[rh].[dias_habiles] dh
	    INNER JOIN [LefarmaDev2].[config].[usuario_detalle] ud
	        ON ud.id_empresa = dh.id_empresa
	       AND ud.activo = 1
	       AND ud.numero_empleado IS NOT NULL
	       AND ud.numero_empleado <> ''''
	    WHERE   dh.activo = 1
	      AND   dh.consume_saldo = 0
	      AND   dh.permite_saldo_negativo = 0
	      AND   dh.fecha BETWEEN @FechaInicio AND @FechaFin
	),
	coincidencias AS (
	    SELECT  c.*,
	            r.id_config,
	            r.nombre            AS NombreIncidencia,
	            r.tipo_incidencia,
	            r.cantidad_acumulada,
	            r.periodo,
	            r.excluir_dias_habiles_consumen_saldo,
	            CASE r.tipo_incidencia
	                WHEN ''TARDANZA_ENTRADA'' THEN
	                    CASE WHEN c.ChecoEntrada = 1
                          AND c.Entrada IS NOT NULL
                          AND c.EntroReal IS NOT NULL
                          AND DATEDIFF(MINUTE, c.Entrada, c.EntroReal) > 0
                          AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.Entrada, c.EntroReal) >= r.minutos_min)
                          AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.Entrada, c.EntroReal) <= r.minutos_max)
	                 THEN 1 ELSE 0 END
	                WHEN ''TARDANZA_SALIDA'' THEN
	                    CASE WHEN c.ChecoSalida = 1
                          AND c.Salida IS NOT NULL
                          AND c.SalioReal IS NOT NULL
                          AND DATEDIFF(MINUTE, c.Salida, c.SalioReal) > 0
                          AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.Salida, c.SalioReal) >= r.minutos_min)
                          AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.Salida, c.SalioReal) <= r.minutos_max)
                         THEN 1 ELSE 0 END
	                WHEN ''SALIDA_ANTICIPADA'' THEN
	                    CASE WHEN c.ChecoSalida = 1
                          AND c.Salida IS NOT NULL
                          AND c.SalioReal IS NOT NULL
                          AND c.SalioReal < c.Salida
                          AND DATEDIFF(MINUTE, c.SalioReal, c.Salida) > 0
                          AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.SalioReal, c.Salida) >= r.minutos_min)
                          AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.SalioReal, c.Salida) <= r.minutos_max)
                         THEN 1 ELSE 0 END
	                WHEN ''OMISION_ENTRADA'' THEN
	                    CASE WHEN r.registro_entrada = 1
                          AND c.Entrada IS NOT NULL
                          AND c.ChecoEntrada = 0
                         THEN 1 ELSE 0 END
	                WHEN ''OMISION_SALIDA'' THEN
	                    CASE WHEN r.registro_salida = 1
                          AND c.Salida IS NOT NULL
                          AND c.ChecoSalida = 0
                         THEN 1 ELSE 0 END
	                ELSE 0
	            END AS Coincide
	    FROM    con_checado c
	    CROSS JOIN reglas r
	),
	filtradas AS (
	    SELECT  *,
	            CASE f.periodo
	                WHEN ''semana''   THEN DATEADD(DAY, -((DATEPART(WEEKDAY, Fecha) + 5) % 7), Fecha)
	                WHEN ''mes''      THEN DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 1)
	                ELSE CASE
	                        WHEN DAY(Fecha) <= 15 THEN DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 1)
	                        ELSE DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 16)
	                     END
	            END AS PeriodoInicio
	    FROM    coincidencias f
	    WHERE   f.Coincide = 1
	      AND   NOT (f.excluir_dias_habiles_consumen_saldo = 1
	                 AND EXISTS (
	                     SELECT 1
	                     FROM   dias_sin_incidencia d
	                     WHERE  d.Nomina = f.Nomina
	                       AND  d.Fecha  = f.Fecha
	                 ))
	),
	numeradas AS (
	    SELECT  *,
	            ROW_NUMBER() OVER (
	                PARTITION BY Nomina, id_config, PeriodoInicio
	                ORDER BY Fecha
	            ) AS NumeroFila
	    FROM    filtradas
	)
	SELECT  Nomina,
	        MAX(Nombre)            AS Nombre,
	        MAX(Empresa)           AS Empresa,
	        MAX(Departamento)      AS Departamento,
	        MAX(Puesto)            AS Puesto,
	        COUNT(*)               AS TotalIncidencias,
	        SUM(CASE WHEN tipo_incidencia IN (''TARDANZA_ENTRADA'', ''TARDANZA_SALIDA'') THEN 1 ELSE 0 END) AS Tardanzas,
	        SUM(CASE WHEN tipo_incidencia = ''SALIDA_ANTICIPADA'' THEN 1 ELSE 0 END)                      AS SalidasAnticipadas,
	        SUM(CASE WHEN tipo_incidencia IN (''OMISION_ENTRADA'', ''OMISION_SALIDA'') THEN 1 ELSE 0 END)   AS Omisiones,
	        SUM(CASE WHEN NumeroFila % NULLIF(cantidad_acumulada, 0) = 0 THEN 1 ELSE 0 END)              AS Descuentos
	FROM    numeradas
	GROUP BY Nomina
	ORDER BY Nombre;
END
    ');
END
GO

-- =====================================================================
-- SECCION 5: VERIFICACION POST-EXECUCION
-- =====================================================================
-- Debe devolver 93 tablas base (88 actuales + 5 nuevas):
SELECT COUNT(*) AS tablas_base
FROM LefarmaDev2.INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE';

-- Informativo (NO borra nada): tablas de Dev2 que LefarmaDev no tiene.
-- Se espera que aparezcan las extra de Dev2 (eliminar_orden, oc_eliminame,
-- ordenes_compra_eliminadas, etc.) — se CONSERVAN por decision del usuario.
SELECT TABLE_SCHEMA, TABLE_NAME
FROM LefarmaDev2.INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND NOT EXISTS (
      SELECT 1 FROM LefarmaDev.INFORMATION_SCHEMA.TABLES d
      WHERE d.TABLE_SCHEMA = TABLE_SCHEMA AND d.TABLE_NAME = TABLE_NAME AND d.TABLE_TYPE = 'BASE TABLE');

-- Las 5 tablas nuevas deben existir (devuelve 5):
SELECT TABLE_SCHEMA, TABLE_NAME
FROM LefarmaDev2.INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (
      (TABLE_SCHEMA = 'educacion_medica' AND TABLE_NAME IN ('tipo_gerencia','parametros_anestesias','programas_anuales','hospital_extension'))
   OR (TABLE_SCHEMA = 'rh' AND TABLE_NAME = 'envios_solicitudes')
  );
GO
