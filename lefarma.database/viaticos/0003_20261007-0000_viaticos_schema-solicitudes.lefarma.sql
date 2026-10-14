-- ============================================================
-- 0003_20261007-0000_viaticos_schema-solicitudes.lefarma.sql
-- Descripcion: Esquema del wizard de viaticos en [viaticos]. Cubre las
--              cuatro tablas del modelo de solicitudes y sus satelites:
--
--              1) viaticos.solicitudes        -> maestro (lleva auditoria).
--              2) viaticos.solicitud_opciones -> opciones de vuelo/hotel
--                                                 propuestas al solicitante.
--              3) viaticos.solicitud_ajustes  -> ajustes manuales hechos por
--                                                 admin sobre una solicitud
--                                                 autorizada con cambios.
--              4) viaticos.solicitud_eventos  -> bitacora de transiciones
--                                                 del workflow.
--
--              Mas los indices que consume el backend:
--              - UNIQUE (id_usuario_solicitante, periodo, estado)
--                  para el concentrado "una solicitud por
--                  (usuario, periodo, estado)".
--              - (periodo, estado) para el listado del admin.
--
-- App: viaticos
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (familia lefarma).
-- Idempotente: puede reejecutarse; no duplica schema, tablas, FK ni indice.
-- NO se aplica automaticamente: requiere ejecucion manual.
--
-- REGLAS DE AUDITORIA (AGENTS.md del repo):
--   - Maestro (solicitudes): columnas activo, fecha_creacion,
--     fecha_modificacion. Borrado fisico del maestro queda fuera del
--     alcance del script (lo decide la aplicacion).
--   - Hijas (solicitud_opciones, solicitud_ajustes, solicitud_eventos):
--     sin columna activo; borrado fisico (hard DELETE). ON DELETE CASCADE
--     desde solicitudes para que un hard DELETE del maestro limpie sus
--     satelites sin dejar basura.
--
-- REGLA DE NEGOCIO "autorizada_con_ajustes requiere >=1 ajuste":
--   No se materializa con trigger ni con CHECK (los CHECK de SQL Server
--   no pueden interrogar otras tablas de forma fiable y un trigger
--   ocultaria la validacion al codigo de aplicacion). La regla la valida
--   el backend en el endpoint que transiciona a 'autorizada_con_ajustes'
--   (debe existir al menos una fila en solicitud_ajustes con id_solicitud
--   = @id). El estado del wizard vive en solicitudes.datos_json y los
--   ajustes concretos en solicitud_ajustes.
-- ============================================================

SET NOCOUNT ON;
GO

-- 1) Schema nuevo (idempotente)
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'viaticos')
BEGIN
    EXEC('CREATE SCHEMA viaticos;');
    PRINT 'Schema [viaticos] creado.';
END
ELSE
    PRINT 'Schema [viaticos] ya existe. Skip.';
GO

-- 2) viaticos.solicitudes: maestro del wizard.
--    Estado del wizard serializado en datos_json; aqui vive la fuente
--    de verdad para el concentrado y el listado del admin.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitudes')
BEGIN
    CREATE TABLE viaticos.solicitudes
    (
        id_solicitud               INT IDENTITY(1,1) NOT NULL,
        id_usuario_solicitante     INT NOT NULL,                          -- empleado que la envia (referencia logica a RR.HH.)
        periodo                    CHAR(7) NOT NULL,                      -- formato yyyy-MM, p.ej. '2026-10'
        gerencia                   NVARCHAR(150) NOT NULL,                -- gerencia del solicitante al momento de crear
        estado                     NVARCHAR(30) NOT NULL,                 -- ver CK_solicitudes_estado abajo
        datos_json                 NVARCHAR(MAX) NOT NULL,                -- snapshot serializado del wizard (pasos 1..N)
        activo                     BIT NOT NULL CONSTRAINT DF_solicitudes_activo DEFAULT (1),
        fecha_creacion             DATETIME2 NOT NULL CONSTRAINT DF_solicitudes_fecha_creacion DEFAULT SYSUTCDATETIME(),
        fecha_modificacion         DATETIME2 NOT NULL CONSTRAINT DF_solicitudes_fecha_modificacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_solicitudes PRIMARY KEY (id_solicitud),
        CONSTRAINT CK_solicitudes_estado CHECK (estado IN
            ('borrador','enviada','autorizada','autorizada_con_ajustes','rechazada')),
        CONSTRAINT CK_solicitudes_periodo_formato CHECK
            (periodo LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
    );
    PRINT 'Tabla [viaticos].[solicitudes] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitudes] ya existe. Skip.';
GO

-- 3) viaticos.solicitud_opciones: opciones de vuelo/hotel adjuntas a la
--    solicitud. El frontend le muestra al solicitante varias opciones por
--    linea; "fue_elegida = 1" marca la ganadora (max 1 por (id_solicitud,
--    tipo) lo valida la aplicacion; no se fuerza con indice unico para
--    permitir el caso "aun no eligio" -> todas en 0).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_opciones')
BEGIN
    CREATE TABLE viaticos.solicitud_opciones
    (
        id_opcion                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        tipo                       NVARCHAR(20) NOT NULL,                 -- 'vuelo' | 'hotel'
        linea                      NVARCHAR(150) NOT NULL,                -- p.ej. 'CDG -> BCN 2026-11-12' / 'Hotel Majestic 2 noches'
        datos_json                 NVARCHAR(MAX) NULL,                    -- detalles extra serializados (itinerario, amenidades, etc.)
        precio                     DECIMAL(12,2) NULL,                    -- precio en moneda local
        moneda                     NVARCHAR(5) NULL,                      -- p.ej. 'MXN', 'USD', 'EUR'
        url_compra                 NVARCHAR(500) NULL,                    -- link de la fuente para que admin valide
        fuente                     NVARCHAR(150) NOT NULL,                -- 'GoogleFlights', 'Skyscanner', 'Booking', etc.
        fue_elegida                BIT NOT NULL CONSTRAINT DF_solicitud_opciones_fue_elegida DEFAULT (0),
        ruta_captura               NVARCHAR(500) NULL,                    -- ruta del screenshot en wwwroot/media/archivos/viaticos
        capturada_en               DATETIME2 NULL,                        -- cuando se tomo el screenshot
        CONSTRAINT PK_solicitud_opciones PRIMARY KEY (id_opcion),
        CONSTRAINT FK_solicitud_opciones_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE,
        CONSTRAINT CK_solicitud_opciones_tipo CHECK (tipo IN ('vuelo','hotel'))
    );
    PRINT 'Tabla [viaticos].[solicitud_opciones] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_opciones] ya existe. Skip.';
GO

-- 4) viaticos.solicitud_ajustes: ajustes manuales hechos por admin al
--    transicionar a 'autorizada_con_ajustes'. motivo es OBLIGATORIO
--    (sin DEFAULT) para que quede rastro del por que. id_opcion es NULL
--    cuando el ajuste toca datos del wizard (campo vive en
--    solicitudes.datos_json), no NULL cuando el ajuste es sobre una
--    opcion concreta (precio, vuelo cambiado, etc.).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_ajustes')
BEGIN
    CREATE TABLE viaticos.solicitud_ajustes
    (
        id_ajuste                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        id_opcion                  INT NULL,                              -- NULL -> ajuste a un campo del wizard (no a una opcion)
        campo                      NVARCHAR(100) NOT NULL,                -- ruta del campo ajustado, p.ej. 'wizard.transporte.aerolinea'
        valor_anterior             NVARCHAR(MAX) NULL,                    -- valor antes del ajuste (NULL si el campo no existia)
        valor_nuevo                NVARCHAR(MAX) NULL,                    -- valor despues del ajuste (NULL si se elimino)
        motivo                     NVARCHAR(1000) NOT NULL,               -- obligatorio: el admin explica el por que
        id_usuario_admin           INT NOT NULL,                          -- admin que aplico el ajuste
        fecha_creacion             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_solicitud_ajustes PRIMARY KEY (id_ajuste),
        CONSTRAINT FK_solicitud_ajustes_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE
        -- Sin FK hacia solicitud_opciones, a proposito. Tres razones, en orden:
        --  1) junto a la FK de solicitudes produce DOS caminos hacia esta tabla
        --     (solicitudes -> ajustes y solicitudes -> opciones -> ajustes) y SQL
        --     Server rechaza el CREATE TABLE completo con el error 1785
        --     "may cause cycles or multiple cascade paths";
        --  2) con NO ACTION se rompe la aplicacion: SolicitudesController
        --     .GuardarOpciones hace RemoveRange(solicitud.Opciones) y las vuelve a
        --     insertar en cada PUT /solicitudes/{id}/opciones, asi que el borrado
        --     fallaria en cuanto exista un solo ajuste;
        --  3) con SET NULL tampoco: SET NULL cuenta igual como cascade path.
        -- id_opcion queda como INT NULL + indice (IX_solicitud_ajustes_opcion):
        -- es un dato de auditoria y debe sobrevivir a que se reescriba el juego de
        -- opciones, no desaparecer con el.
    );
    PRINT 'Tabla [viaticos].[solicitud_ajustes] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_ajustes] ya existe. Skip.';
GO

-- 5) viaticos.solicitud_eventos: bitacora append-only de transiciones
--    del workflow (enviada, autorizada, rechazada, ajuste_aplicado,
--    opcion_elegida, etc.). payload_json guarda el contexto minimo
--    (id_opcion afectada, motivo corto, etc.). Sin activo: cuando la
--    solicitud se borra, los eventos se van con ella.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE schema_id = SCHEMA_ID('viaticos') AND name = 'solicitud_eventos')
BEGIN
    CREATE TABLE viaticos.solicitud_eventos
    (
        id_evento                  INT IDENTITY(1,1) NOT NULL,
        id_solicitud               INT NOT NULL,
        tipo                       NVARCHAR(50) NOT NULL,                 -- 'creada','enviada','autorizada','rechazada','ajuste_aplicado','opcion_elegida',...
        payload_json               NVARCHAR(MAX) NULL,                    -- contexto del evento (id_opcion, motivo, etc.)
        id_usuario                 INT NOT NULL,                          -- quien disparo el evento
        fecha_creacion             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_solicitud_eventos PRIMARY KEY (id_evento),
        CONSTRAINT FK_solicitud_eventos_solicitud
            FOREIGN KEY (id_solicitud) REFERENCES viaticos.solicitudes (id_solicitud)
            ON DELETE CASCADE
    );
    PRINT 'Tabla [viaticos].[solicitud_eventos] creada.';
END
ELSE
    PRINT 'Tabla [viaticos].[solicitud_eventos] ya existe. Skip.';
GO

-- 6) Indices

-- 6.1) UNIQUE (id_usuario_solicitante, periodo, estado):
--      El concentrado "mi solicitud vigente en este periodo" se sirve
--      directo desde este indice. Impide dos solicitudes en el mismo
--      (usuario, periodo, estado); si el solicitante reintenta tras un
--      rechazo, debe pasar por un nuevo estado (o se reabre la misma).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitudes') AND name = 'UQ_solicitudes_usuario_periodo_estado')
BEGIN
    CREATE UNIQUE INDEX UQ_solicitudes_usuario_periodo_estado
        ON viaticos.solicitudes (id_usuario_solicitante, periodo, estado);
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] creado.';
END
ELSE
    PRINT 'Indice [UQ_solicitudes_usuario_periodo_estado] ya existe. Skip.';
GO

-- 6.2) (periodo, estado): filtro principal del listado del admin
--      (todas las solicitudes de octubre 2026 que estan en 'enviada').
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitudes') AND name = 'IX_solicitudes_periodo_estado')
BEGIN
    CREATE INDEX IX_solicitudes_periodo_estado
        ON viaticos.solicitudes (periodo, estado) INCLUDE (id_usuario_solicitante, gerencia);
    PRINT 'Indice [IX_solicitudes_periodo_estado] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitudes_periodo_estado] ya existe. Skip.';
GO

-- 6.3) Hijas por id_solicitud: el admin que ve una solicitud enumera
--      sus opciones, ajustes y eventos en una sola consulta cada uno.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_opciones') AND name = 'IX_solicitud_opciones_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_opciones_solicitud
        ON viaticos.solicitud_opciones (id_solicitud) INCLUDE (tipo, linea, precio, fue_elegida);
    PRINT 'Indice [IX_solicitud_opciones_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_opciones_solicitud] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_ajustes') AND name = 'IX_solicitud_ajustes_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_ajustes_solicitud
        ON viaticos.solicitud_ajustes (id_solicitud) INCLUDE (campo, id_usuario_admin, fecha_creacion);
    PRINT 'Indice [IX_solicitud_ajustes_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_ajustes_solicitud] ya existe. Skip.';
GO

-- id_opcion se indexa pero NO lleva FK (ver el comentario en el CREATE TABLE):
-- referencia a solicitud_opciones solo como dato de auditoria.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_ajustes') AND name = 'IX_solicitud_ajustes_opcion')
BEGIN
    CREATE INDEX IX_solicitud_ajustes_opcion
        ON viaticos.solicitud_ajustes (id_opcion) WHERE id_opcion IS NOT NULL;
    PRINT 'Indice [IX_solicitud_ajustes_opcion] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_ajustes_opcion] ya existe. Skip.';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('viaticos.solicitud_eventos') AND name = 'IX_solicitud_eventos_solicitud')
BEGIN
    CREATE INDEX IX_solicitud_eventos_solicitud
        ON viaticos.solicitud_eventos (id_solicitud, fecha_creacion);
    PRINT 'Indice [IX_solicitud_eventos_solicitud] creado.';
END
ELSE
    PRINT 'Indice [IX_solicitud_eventos_solicitud] ya existe. Skip.';
GO

PRINT 'FIN script 0003 viaticos (solicitudes + opciones + ajustes + eventos).';
GO