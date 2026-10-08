-- ============================================================
-- 0002_20261005-1400_viaticos_schema-municipios-sp-job.lefarma.sql
-- Descripcion: Consolida en UN solo script todo el cluster de municipios
--              (antes repartido en educacion-medica/0015 + 038 + 039):
--
--              1) Crea el schema [viaticos] (idempotente).
--              2) Migracion defensiva: si en el entorno existen los objetos
--                 viejos en [educacion_medica], mueve las tablas con
--                 ALTER SCHEMA TRANSFER y elimina el SP viejo.
--              3) Crea viaticos.municipios_cat      -> catalogo maestro.
--              4) Crea viaticos.municipios_osm_staging -> bandeja del job.
--              5) CREATE OR ALTER viaticos.sp_actualiza_municipios
--                 (volcado idempotente bandeja -> catalogo).
--              5b) CREATE OR ALTER viaticos.sp_carga_municipios_osm
--                 (baja municipios de OpenStreetMap via Python con
--                 sp_execute_external_script; reemplaza al ps1).
--              6) Recrea el job SP_Jobs_ActualizaMunicipios_<BD> (uno por
--                 base, sufijo DB_NAME()) apuntando al schema nuevo.
--
-- App: viaticos
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Idempotente: puede reejecutarse; no duplica schema, tablas, indice, SP ni job.
-- NO se aplica automaticamente: requiere ejecucion manual.
--
-- NOTA DEL JOB: se crea uno por base con sufijo DB_NAME()
-- (SP_Jobs_ActualizaMunicipios_LefarmaDev / _Lefarma) y sus pasos apuntan a
-- la base contra la que se ejecuta el script. Ejecutar en cada base destino;
-- ambas instancias coexisten en el mismo servidor (msdb compartido). El job
-- legado sin sufijo se elimina si existiera.
--
-- REQUISITO PYTHON: el paso 1 ejecuta Python via sp_execute_external_script
-- (Machine Learning Services). El servidor ya lo tiene habilitado
-- (external scripts enabled = 1 y servicio Launchpad corriendo).
--
-- CORRECCION 2026-10-05: la primera corrida real del job fallo con
-- HTTP 406 de overpass-api.de (User-Agent default de urllib bloqueado por su
-- politica de uso). El Python ahora manda UA descriptivo, cae al mirror
-- overpass.kumi.systems si el principal falla, y reporta el error HTTP con el
-- cuerpo de la respuesta para diagnostico en el historial del job.
--
-- CORRECCION 2026-10-07: Overpass falla de forma transitoria y por endpoint
-- (ej. HTTP 500 en private.coffee y kumi en horas distintas). Antes, un solo
-- estado caido abortaba la carga completa. Ahora: (1) los estados caidos o
-- vacios se reportan con AVISO y se cargan los demas (solo se aborta si no
-- vino ningun municipio); (2) el error resume los tres endpoints; (3) el
-- volcado acota la desactivacion a los estados presentes en el lote, llena
-- coordenadas por (estado, nombre) y no da altas en estados ya poblados
-- (el catalogo ya tiene autoridad: carga INEGI).
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) Schema nuevo
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'viaticos')
BEGIN
    EXEC('CREATE SCHEMA viaticos;');
    PRINT 'Schema [viaticos] creado.';
END
ELSE
    PRINT 'Schema [viaticos] ya existe. Skip.';
GO

-- 2) Migracion defensiva desde educacion_medica (solo si existiera en el entorno)
IF OBJECT_ID('educacion_medica.municipios_cat') IS NOT NULL
   AND OBJECT_ID('viaticos.municipios_cat') IS NULL
BEGIN
    ALTER SCHEMA viaticos TRANSFER educacion_medica.municipios_cat;
    PRINT 'Tabla [educacion_medica].[municipios_cat] movida a [viaticos].';
END
GO

IF OBJECT_ID('educacion_medica.municipios_osm_staging') IS NOT NULL
   AND OBJECT_ID('viaticos.municipios_osm_staging') IS NULL
BEGIN
    ALTER SCHEMA viaticos TRANSFER educacion_medica.municipios_osm_staging;
    PRINT 'Tabla [educacion_medica].[municipios_osm_staging] movida a [viaticos].';
END
GO

IF OBJECT_ID('educacion_medica.sp_actualiza_municipios') IS NOT NULL
BEGIN
    DROP PROCEDURE educacion_medica.sp_actualiza_municipios;
    PRINT 'SP [educacion_medica].[sp_actualiza_municipios] eliminado (reemplazado por viaticos).';
END
GO

-- 3) viaticos.municipios_cat: catalogo maestro editable (audit columns: es maestro)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'municipios_cat')
BEGIN
    CREATE TABLE viaticos.municipios_cat
    (
        id_municipio            INT IDENTITY(1,1) NOT NULL,
        codigo_estado         INT NOT NULL,   -- FK logica -> Asokam.genEstadosCat.codigoEstado
        nombre                NVARCHAR(150) NOT NULL,
        clave_municipio       NVARCHAR(30) NULL,  -- identificador OpenStreetMap (admin_level=6: municipio en Mexico)
        latitud               DECIMAL(9,6) NULL,  -- centroide OSM; centra el mapa del selector
        longitud              DECIMAL(9,6) NULL,
        activo                BIT NOT NULL CONSTRAINT DF_municipios_cat_activo DEFAULT (1),
        fecha_creacion        DATETIME2 NOT NULL CONSTRAINT DF_municipios_cat_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion    DATETIME2 NOT NULL CONSTRAINT DF_municipios_cat_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_municipios_cat PRIMARY KEY (id_municipio),
        CONSTRAINT UQ_municipios_cat_estado_nombre UNIQUE (codigo_estado, nombre)
    );
    PRINT 'Tabla [viaticos].[municipios_cat] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[municipios_cat] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.municipios_cat') AND name = 'IX_municipios_cat_codigo_estado')
BEGIN
    CREATE INDEX IX_municipios_cat_codigo_estado
        ON viaticos.municipios_cat (codigo_estado) INCLUDE (nombre);
    PRINT 'Indice [IX_municipios_cat_codigo_estado] creado.';
END
ELSE
    PRINT 'Indice [IX_municipios_cat_codigo_estado] ya existe. Skip.';
GO

-- 4) viaticos.municipios_osm_staging: bandeja de carga del job semanal.
--    El SP viaticos.sp_carga_municipios_osm (Python) baja los municipios de
--    Overpass y los inserta aqui; luego EXEC viaticos.sp_actualiza_municipios
--    los vuelca al catalogo (upsert por clave_municipio/codigo_estado) y
--    vacia la bandeja.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'municipios_osm_staging')
BEGIN
    CREATE TABLE viaticos.municipios_osm_staging
    (
        id_staging              INT IDENTITY(1,1) NOT NULL,
        clave_municipio       NVARCHAR(30) NOT NULL,   -- id OSM (nodo/relacion)
        codigo_estado         INT NOT NULL,            -- resuelto desde el estado OSM (ISO3166-2 / admin)
        nombre                NVARCHAR(150) NOT NULL,
        latitud               DECIMAL(9,6) NULL,
        longitud              DECIMAL(9,6) NULL,
        cargado_en            DATETIME2 NOT NULL CONSTRAINT DF_municipios_osm_staging_cargado_en DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_municipios_osm_staging PRIMARY KEY (id_staging)
    );
    PRINT 'Tabla [viaticos].[municipios_osm_staging] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[municipios_osm_staging] ya existe. Skip.';
GO

-- 5) SP de volcado: bandeja -> catalogo (upsert idempotente)
CREATE OR ALTER PROCEDURE viaticos.sp_actualiza_municipios
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @en_bandeja INT = (SELECT COUNT(*) FROM viaticos.municipios_osm_staging);
    IF @en_bandeja = 0
    BEGIN
        PRINT 'Bandeja [municipios_osm_staging] vacia: nada que actualizar.';
        RETURN;
    END

    -- 1) Actualizar existentes por clave OSM (id estable de OpenStreetMap).
    UPDATE mc
    SET mc.nombre             = s.nombre,
        mc.codigo_estado      = s.codigo_estado,
        mc.latitud            = s.latitud,
        mc.longitud           = s.longitud,
        mc.activo             = 1,
        mc.fecha_modificacion = SYSUTCDATETIME()
    FROM viaticos.municipios_cat AS mc
    JOIN viaticos.municipios_osm_staging AS s
        ON s.clave_municipio = mc.clave_municipio
    WHERE mc.clave_municipio IS NOT NULL;
    DECLARE @actualizados INT = @@ROWCOUNT;

    -- 1b) Llenar coordenadas de filas sin clave OSM (p. ej. las cargadas de
    --     INEGI) cuando el nombre coincide dentro del estado, ignorando el
    --     prefijo "Municipio de " y diferencias de acento.
    UPDATE mc
    SET mc.latitud            = COALESCE(s.latitud, mc.latitud),
        mc.longitud           = COALESCE(s.longitud, mc.longitud),
        mc.fecha_modificacion = SYSUTCDATETIME()
    FROM viaticos.municipios_cat AS mc
    JOIN viaticos.municipios_osm_staging AS s
        ON s.codigo_estado = mc.codigo_estado
       AND REPLACE(s.nombre, N'Municipio de ', N'') COLLATE Latin1_General_CI_AI
           = mc.nombre COLLATE Latin1_General_CI_AI
    WHERE mc.clave_municipio IS NULL
      AND (s.latitud IS NOT NULL OR s.longitud IS NOT NULL);
    DECLARE @coordenadas INT = @@ROWCOUNT;

    -- 2) Insertar altas nuevas: solo si el estado NO tiene filas activas en el
    --    catalogo (el catalogo ya tiene autoridad, p. ej. carga INEGI; OSM no
    --    da altas donde ya existe el estado, para no duplicar variantes de
    --    nombre) y sin duplicados dentro del lote.
    INSERT INTO viaticos.municipios_cat
        (codigo_estado, nombre, clave_municipio, latitud, longitud, activo, fecha_creacion, fecha_modificacion)
    SELECT s.codigo_estado, s.nombre, s.clave_municipio, s.latitud, s.longitud, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM viaticos.municipios_osm_staging AS s
    WHERE NOT EXISTS (SELECT 1 FROM viaticos.municipios_cat mc WHERE mc.clave_municipio = s.clave_municipio)
      AND NOT EXISTS (SELECT 1 FROM viaticos.municipios_cat mc2
                      WHERE mc2.codigo_estado = s.codigo_estado AND mc2.nombre = s.nombre)
      AND NOT EXISTS (SELECT 1 FROM viaticos.municipios_cat mc3
                      WHERE mc3.codigo_estado = s.codigo_estado AND mc3.activo = 1)
      AND NOT EXISTS (SELECT 1 FROM viaticos.municipios_osm_staging s2
                      WHERE s2.codigo_estado = s.codigo_estado AND s2.nombre = s.nombre
                        AND s2.id_staging < s.id_staging);
    DECLARE @insertados INT = @@ROWCOUNT;

    -- 3) Desactivar los OSM que ya no vienen, SOLO de estados presentes en el
    --    lote (un estado caido o vacio no toca sus filas; altas manuales intactas).
    UPDATE mc
    SET mc.activo             = 0,
        mc.fecha_modificacion = SYSUTCDATETIME()
    FROM viaticos.municipios_cat AS mc
    WHERE mc.clave_municipio IS NOT NULL
      AND mc.activo = 1
      AND EXISTS (SELECT 1 FROM viaticos.municipios_osm_staging s2
                  WHERE s2.codigo_estado = mc.codigo_estado)
      AND NOT EXISTS (SELECT 1 FROM viaticos.municipios_osm_staging s
                      WHERE s.clave_municipio = mc.clave_municipio);
    DECLARE @desactivados INT = @@ROWCOUNT;

    -- 4) Vaciar bandeja.
    DELETE FROM viaticos.municipios_osm_staging;

    PRINT CONCAT('Municipios: ', @insertados, ' insertados, ', @actualizados, ' actualizados, ',
                 @coordenadas, ' coordenadas por nombre, ',
                 @desactivados, ' desactivados. Bandeja: ', @en_bandeja, ' filas consumidas.');
END
GO

-- 5b) SP de carga: baja los municipios de OpenStreetMap (Overpass) via
--     Python nativo de SQL Server (sp_execute_external_script) y los deja
--     en la bandeja. Reemplaza al ps1: el job lo ejecuta como paso 1.
CREATE OR ALTER PROCEDURE viaticos.sp_carga_municipios_osm
AS
BEGIN
    SET NOCOUNT ON;

    -- Bandeja limpia: reejecutable sin duplicar.
    DELETE FROM viaticos.municipios_osm_staging;

    INSERT INTO viaticos.municipios_osm_staging (clave_municipio, codigo_estado, nombre, latitud, longitud)
    EXEC sp_execute_external_script
        @language = N'Python',
        @script = N'
import json
import time
import urllib.error
import urllib.parse
import urllib.request

import pandas as pd

# ISO 3166-2 -> codigoEstado de Asokam.genEstadosCat (seed del script 0010).
ESTADOS = [
    ("MX-AGU", 485), ("MX-BCN", 486), ("MX-BCS", 487), ("MX-CAM", 490),
    ("MX-CHP", 492), ("MX-CHH", 488), ("MX-CMX", 493), ("MX-COA", 491),
    ("MX-COL", 489), ("MX-DUR", 494), ("MX-GRO", 495), ("MX-GUA", 496),
    ("MX-HID", 497), ("MX-JAL", 498), ("MX-MEX", 501), ("MX-MIC", 499),
    ("MX-MOR", 500), ("MX-NAY", 502), ("MX-NLE", 503), ("MX-OAX", 504),
    ("MX-PUE", 505), ("MX-QUE", 507), ("MX-ROO", 506), ("MX-SLP", 509),
    ("MX-SIN", 508), ("MX-SON", 510), ("MX-TAB", 511), ("MX-TAM", 513),
    ("MX-TLA", 512), ("MX-VER", 514), ("MX-YUC", 515), ("MX-ZAC", 516),
]

UA = "GrupoLefarma-MunicipiosSync/1.0 (sistemas@grupolefarma.com.mx)"
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

def consulta_overpass(consulta):
    datos = urllib.parse.urlencode({"data": consulta}).encode("utf-8")
    errores = []
    for url in ENDPOINTS:
        try:
            peticion = urllib.request.Request(url, data=datos)
            peticion.add_header("User-Agent", UA)
            peticion.add_header("Accept", "application/json")
            with urllib.request.urlopen(peticion, timeout=300) as respuesta:
                return json.loads(respuesta.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            errores.append(url.split("/")[2] + ": HTTP " + str(e.code))
        except Exception as e:
            errores.append(url.split("/")[2] + ": " + type(e).__name__)
        time.sleep(1.1)
    raise RuntimeError("Overpass fallo en todos los endpoints: " + " | ".join(errores))

filas = []
fallidos = []
vacios = []

for iso, codigo in ESTADOS:
    consulta = (
        "[out:json][timeout:300];"
        + "area[\"ISO3166-2\"=\"" + iso + "\"][admin_level=4]->.e;"
        + "rel(area.e)[\"boundary\"=\"administrative\"][\"admin_level\"=\"6\"];"
        + "out center tags;"
    )
    contenido = None
    ultimo = ""
    # Overpass devuelve 500/429 de forma transitoria por endpoint: reintentar
    # antes de dar un estado por perdido.
    for intento in range(1, 4):
        try:
            contenido = consulta_overpass(consulta)
            break
        except RuntimeError as e:
            ultimo = str(e)
            time.sleep(8 * intento)
    if contenido is None:
        fallidos.append(iso + ": " + ultimo)
        time.sleep(3)
        continue

    elementos = contenido.get("elements", [])
    if not elementos:
        vacios.append(iso)
    for elemento in elementos:
        etiquetas = elemento.get("tags") or {}
        nombre = etiquetas.get("name")
        if not nombre:
            continue
        centro = elemento.get("center") or {}
        filas.append({
            "clave_municipio": "r" + str(elemento.get("id")),
            "codigo_estado": int(codigo),
            "nombre": str(nombre),
            "latitud": centro.get("lat"),
            "longitud": centro.get("lon"),
        })
    time.sleep(3)  # cortesia con Overpass (pide 1 req/s; se deja margen)

# TOLERANCIA POR ESTADO: los estados caidos o vacios se reportan y NO se
# vuelcan; sus filas del catalogo quedan intactas porque el paso 2 acota la
# desactivacion a los estados presentes en la bandeja. Solo se aborta si no
# vino ningun municipio.
if fallidos:
    print("AVISO: Overpass no respondio para " + str(len(fallidos))
          + " estado(s); se cargan los demas: " + " | ".join(fallidos))
if vacios:
    print("AVISO: 0 municipios para: " + " | ".join(vacios))
if len(filas) == 0:
    raise RuntimeError("Overpass devolvio 0 municipios; NO se vuelca al catalogo.")

df = pd.DataFrame(filas, columns=["clave_municipio", "codigo_estado", "nombre", "latitud", "longitud"])
# NaN -> NULL para las coordenadas faltantes
OutputDataSet = df.astype(object).where(pd.notnull(df), None)
'
END
GO

-- Resumen (aqui el contexto sigue siendo la base destino)
SELECT
    (SELECT COUNT(*) FROM viaticos.municipios_cat) AS municipios,
    (SELECT COUNT(*) FROM viaticos.municipios_cat WHERE activo = 1) AS activos,
    (SELECT COUNT(*) FROM viaticos.municipios_osm_staging) AS en_bandeja;
GO

-- 6) Job semanal de SQL Agent (domingos 03:00), uno por base (sufijo DB_NAME()).
--    Sin USE msdb: todas las llamadas van calificadas msdb.dbo.* y DB_NAME()
--    sigue apuntando a la base destino del script.

/* --- Limpieza: job legado sin sufijo (si existiera) ------------------------ */
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'SP_Jobs_ActualizaMunicipios')
    EXEC msdb.dbo.sp_delete_job @job_name = N'SP_Jobs_ActualizaMunicipios', @delete_unused_schedule = 1;
GO

/* --- 6.1) Crear el job (elimina el de esta base si ya existia) ------------- */
DECLARE @db_actual  sysname       = DB_NAME();
DECLARE @job_name   sysname       = N'SP_Jobs_ActualizaMunicipios_' + @db_actual;
DECLARE @job_desc   NVARCHAR(512) = N'Actualiza viaticos.municipios_cat de ' + @db_actual + N' desde OpenStreetMap (Overpass). Domingos 03:00. Paso 1 baja a staging (Python), paso 2 ejecuta viaticos.sp_actualiza_municipios.';
DECLARE @sched_name sysname       = N'Domingo_0300_' + @db_actual;
DECLARE @job_id     UNIQUEIDENTIFIER;

IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @job_name)
    EXEC msdb.dbo.sp_delete_job @job_name = @job_name, @delete_unused_schedule = 1;

EXEC msdb.dbo.sp_add_job
     @job_name           = @job_name,
     @enabled            = 1,
     @description        = @job_desc,
     @owner_login_name   = N'poweru',
     @notify_level_eventlog = 2,
     @job_id             = @job_id OUTPUT;

/* --- 6.2) Paso 1: bajar de OpenStreetMap a la bandeja (Python) ------------ */
EXEC msdb.dbo.sp_add_jobstep
     @job_id      = @job_id,
     @step_id     = 1,
     @step_name   = N'1 - Baja municipios de OpenStreetMap (Python)',
     @subsystem   = N'TSQL',
     @command     = N'EXEC viaticos.sp_carga_municipios_osm;',
     @database_name = @db_actual,
     @retry_attempts = 1,
     @retry_interval = 10,
     @on_success_action = 3,   -- ir al siguiente paso
     @on_fail_action  = 2;     -- terminar con falla

/* --- 6.3) Paso 2: volcar bandeja -> catalogo ------------------------------ */
EXEC msdb.dbo.sp_add_jobstep
     @job_id      = @job_id,
     @step_id     = 2,
     @step_name   = N'2 - Aplica sp_actualiza_municipios',
     @subsystem   = N'TSQL',
     @command     = N'EXEC viaticos.sp_actualiza_municipios;',
     @database_name = @db_actual,
     @on_success_action = 1,   -- terminar con exito
     @on_fail_action  = 2;     -- terminar con falla

/* --- 6.4) Horario: domingos 03:00 ------------------------------------------ */
EXEC msdb.dbo.sp_add_jobschedule
     @job_id                = @job_id,
     @name                  = @sched_name,
     @enabled               = 1,
     @freq_type             = 8,      -- semanal
     @freq_interval         = 1,      -- domingo
     @freq_subday_type      = 1,      -- a hora fija
     @freq_recurrence_factor = 1,     -- cada 1 semana
     @active_start_time     = 30000;  -- 03:00:00

/* --- 6.5) Asignar al servidor local ---------------------------------------- */
EXEC msdb.dbo.sp_add_jobserver
     @job_id   = @job_id,
     @server_name = N'(local)';
GO

PRINT 'FIN script 0002 viaticos.';
GO