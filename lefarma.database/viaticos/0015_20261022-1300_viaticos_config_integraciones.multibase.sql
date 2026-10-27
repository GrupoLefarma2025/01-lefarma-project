-- ============================================================
-- 0015_20261022-1300_viaticos_config_integraciones.multibase.sql
-- Descripcion: Credenciales y endpoints de integraciones externas del
--              modulo de viaticos (Uber, ClickBus, Distribusion, etc.),
--              para que NO vivan en appsettings ni en el codigo.
--
--              Aplica a las DOS bases en un solo archivo:
--                1) Lefarma      (produccion)
--                2) LefarmaDev2  (desarrollo)
--
--              Una fila por proveedor + entorno, con unicidad garantizada
--              y columnas de auditoria. El motor/API debe leer la fila
--              activa del entorno vigente.
--
--              SEGURIDAD: client_secret se guarda aqui. Restringir el
--              SELECT al login de la aplicacion, no exponer la tabla por
--              API y no volcar su contenido en logs.
--
-- Idempotente. NO se aplica automaticamente.
-- ============================================================

/* ============================================================
   1) LEFARMA  (produccion)
   ============================================================ */

USE [Lefarma];
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID('viaticos.config_integraciones', 'U') IS NULL
BEGIN
    CREATE TABLE viaticos.config_integraciones (
        id_integracion               INT IDENTITY(1,1) NOT NULL,
        proveedor                    NVARCHAR(40)  NOT NULL,
        entorno                      NVARCHAR(20)  NOT NULL
            CONSTRAINT DF_config_integraciones_entorno DEFAULT ('produccion'),
        activo                       BIT           NOT NULL
            CONSTRAINT DF_config_integraciones_activo DEFAULT (1),
        client_id                    NVARCHAR(200) NULL,
        client_secret                NVARCHAR(400) NULL,
        token_url                    NVARCHAR(300) NULL,
        api_base_url                 NVARCHAR(300) NULL,
        redirect_uri                 NVARCHAR(300) NULL,
        scopes                       NVARCHAR(400) NULL,
        notas                        NVARCHAR(400) NULL,
        fecha_creacion_modificacion  DATETIME2(0)  NOT NULL
            CONSTRAINT DF_config_integraciones_fecha DEFAULT (SYSUTCDATETIME()),
        id_usuario_creacion          INT NULL,
        id_usuario_modificacion      INT NULL,
        CONSTRAINT PK_config_integraciones PRIMARY KEY (id_integracion),
        CONSTRAINT UQ_config_integraciones_proveedor_entorno UNIQUE (proveedor, entorno),
        CONSTRAINT CK_config_integraciones_entorno CHECK (entorno IN ('sandbox', 'produccion'))
    );
    PRINT '[Lefarma] Tabla [viaticos].[config_integraciones] creada.';
END
ELSE
    PRINT '[Lefarma] Tabla [viaticos].[config_integraciones] ya existe. Skip.';
GO

DECLARE @semilla TABLE (
    proveedor NVARCHAR(40) NOT NULL,
    entorno   NVARCHAR(20) NOT NULL,
    PRIMARY KEY (proveedor, entorno)
);
INSERT INTO @semilla (proveedor, entorno) VALUES ('uber', 'sandbox');

MERGE viaticos.config_integraciones AS destino
USING @semilla AS origen
    ON destino.proveedor = origen.proveedor AND destino.entorno = origen.entorno
WHEN NOT MATCHED THEN
    INSERT (proveedor, entorno, activo, client_id, client_secret, token_url, api_base_url, redirect_uri, scopes, notas)
    VALUES (
        'uber',
        'sandbox',
        1,
        'NLAVp9Uz4bTNAPLMd6w6ITtFJl_AEHsa',
        '',                                   -- client_secret: ver UPDATE al final
        'https://sandbox-login.uber.com/oauth/v2/token',
        'https://sandbox-api.uber.com',
        '',
        '',
        'App Lefarma Viaticos (TEST). Suite 3PL Consumer APIs: solo expone el scope partner-loyalty.link-account; pendiente el scope de cotizacion de viajes.'
    );

PRINT '[Lefarma] Semilla de integraciones aplicada.';
GO

SELECT DB_NAME() AS base, id_integracion, proveedor, entorno, activo,
       client_id,
       CASE WHEN client_secret IS NULL OR client_secret = '' THEN '(sin secreto)' ELSE '(definido)' END AS secreto,
       token_url, api_base_url
FROM viaticos.config_integraciones
ORDER BY proveedor, entorno;
GO


/* ============================================================
   2) LEFARMADEV2  (desarrollo)
   ============================================================ */

USE [LefarmaDev2];
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID('viaticos.config_integraciones', 'U') IS NULL
BEGIN
    CREATE TABLE viaticos.config_integraciones (
        id_integracion               INT IDENTITY(1,1) NOT NULL,
        proveedor                    NVARCHAR(40)  NOT NULL,
        entorno                      NVARCHAR(20)  NOT NULL
            CONSTRAINT DF_config_integraciones_entorno DEFAULT ('produccion'),
        activo                       BIT           NOT NULL
            CONSTRAINT DF_config_integraciones_activo DEFAULT (1),
        client_id                    NVARCHAR(200) NULL,
        client_secret                NVARCHAR(400) NULL,
        token_url                    NVARCHAR(300) NULL,
        api_base_url                 NVARCHAR(300) NULL,
        redirect_uri                 NVARCHAR(300) NULL,
        scopes                       NVARCHAR(400) NULL,
        notas                        NVARCHAR(400) NULL,
        fecha_creacion_modificacion  DATETIME2(0)  NOT NULL
            CONSTRAINT DF_config_integraciones_fecha DEFAULT (SYSUTCDATETIME()),
        id_usuario_creacion          INT NULL,
        id_usuario_modificacion      INT NULL,
        CONSTRAINT PK_config_integraciones PRIMARY KEY (id_integracion),
        CONSTRAINT UQ_config_integraciones_proveedor_entorno UNIQUE (proveedor, entorno),
        CONSTRAINT CK_config_integraciones_entorno CHECK (entorno IN ('sandbox', 'produccion'))
    );
    PRINT '[LefarmaDev2] Tabla [viaticos].[config_integraciones] creada.';
END
ELSE
    PRINT '[LefarmaDev2] Tabla [viaticos].[config_integraciones] ya existe. Skip.';
GO

DECLARE @semilla TABLE (
    proveedor NVARCHAR(40) NOT NULL,
    entorno   NVARCHAR(20) NOT NULL,
    PRIMARY KEY (proveedor, entorno)
);
INSERT INTO @semilla (proveedor, entorno) VALUES ('uber', 'sandbox');

MERGE viaticos.config_integraciones AS destino
USING @semilla AS origen
    ON destino.proveedor = origen.proveedor AND destino.entorno = origen.entorno
WHEN NOT MATCHED THEN
    INSERT (proveedor, entorno, activo, client_id, client_secret, token_url, api_base_url, redirect_uri, scopes, notas)
    VALUES (
        'uber',
        'sandbox',
        1,
        'NLAVp9Uz4bTNAPLMd6w6ITtFJl_AEHsa',
        '',                                   -- client_secret: ver UPDATE al final
        'https://sandbox-login.uber.com/oauth/v2/token',
        'https://sandbox-api.uber.com',
        '',
        '',
        'App Lefarma Viaticos (TEST). Suite 3PL Consumer APIs: solo expone el scope partner-loyalty.link-account; pendiente el scope de cotizacion de viajes.'
    );

PRINT '[LefarmaDev2] Semilla de integraciones aplicada.';
GO

SELECT DB_NAME() AS base, id_integracion, proveedor, entorno, activo,
       client_id,
       CASE WHEN client_secret IS NULL OR client_secret = '' THEN '(sin secreto)' ELSE '(definido)' END AS secreto,
       token_url, api_base_url
FROM viaticos.config_integraciones
ORDER BY proveedor, entorno;
GO


/* ============================================================
   3) SECRETO REAL (ejecutar a mano, UNA vez por base)
   ------------------------------------------------------------
   El client_secret NO se versiona: se pega aqui y se ejecuta
   directo en el servidor. Repetir el bloque cambiando la base.
   ============================================================ */

-- USE [Lefarma];
-- UPDATE viaticos.config_integraciones
--    SET client_secret = '<PEGAR_AQUI_EL_CLIENT_SECRET>',
--        fecha_creacion_modificacion = SYSUTCDATETIME()
--  WHERE proveedor = 'uber' AND entorno = 'sandbox';
-- GO

-- USE [LefarmaDev2];
-- UPDATE viaticos.config_integraciones
--    SET client_secret = '<PEGAR_AQUI_EL_CLIENT_SECRET>',
--        fecha_creacion_modificacion = SYSUTCDATETIME()
--  WHERE proveedor = 'uber' AND entorno = 'sandbox';
-- GO

PRINT 'FIN script 0015 viaticos config_integraciones (multibase).';
GO
