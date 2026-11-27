SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

IF OBJECT_ID('rh.fn_dias_vacaciones_por_antiguedad', 'FN') IS NULL
BEGIN
    EXEC('
    CREATE FUNCTION rh.fn_dias_vacaciones_por_antiguedad (@antiguedad INT)
    RETURNS DECIMAL(5,2)
    AS
    BEGIN
        RETURN CASE
            WHEN @antiguedad <= 0 THEN 0
            WHEN @antiguedad BETWEEN 1 AND 5 THEN 10 + @antiguedad * 2
            ELSE 22 + CEILING((@antiguedad - 10) / 5.0) * 2
        END;
    END;');
END;
GO

IF OBJECT_ID('rh.fn_periodo_vacaciones', 'IF') IS NULL
BEGIN
    EXEC('
    CREATE FUNCTION rh.fn_periodo_vacaciones (@fecha_ingreso DATE, @fecha DATE)
    RETURNS TABLE
    AS
    RETURN
    WITH n AS (
        SELECT TOP (DATEDIFF(YEAR, @fecha_ingreso, @fecha) + 2)
               ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS numero
        FROM sys.all_objects
    ),
    periodos AS (
        SELECT numero,
               DATEADD(YEAR, numero, @fecha_ingreso) AS inicio,
               DATEADD(DAY, -1, DATEADD(YEAR, numero + 1, @fecha_ingreso)) AS fin
        FROM n
    )
    SELECT TOP 1
           numero,
           inicio,
           fin,
           DATEADD(MONTH, 18, DATEADD(DAY, 1, fin)) AS limite_disfrute
    FROM periodos
    WHERE @fecha BETWEEN inicio AND fin
    ORDER BY numero DESC;');
END;
GO

IF OBJECT_ID('rh.saldos_vacaciones_periodos', 'U') IS NULL
BEGIN
    CREATE TABLE rh.saldos_vacaciones_periodos
    (
        id_saldo                    INT IDENTITY(1,1) NOT NULL,
        id_usuario                  INT NOT NULL,
        id_empresa                  INT NOT NULL,
        fecha_inicio_periodo        DATE NOT NULL,
        fecha_fin_periodo           DATE NOT NULL,
        fecha_limite_disfrute       DATE NOT NULL,
        numero_periodo              INT NOT NULL,
        dias_generados              DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_generados DEFAULT (0),
        dias_vencidos               DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_vencidos DEFAULT (0),
        dias_compensados            DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_compensados DEFAULT (0),
        dias_ajustados              DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_ajustados DEFAULT (0),
        dias_ajustados_arrastre   DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_ajustados_arrastre DEFAULT (0),
        dias_tomados                DECIMAL(5,2) NOT NULL CONSTRAINT DF_svp_tomados DEFAULT (0),
        dias_pendientes             AS (dias_generados + dias_compensados + dias_ajustados + dias_ajustados_arrastre - dias_vencidos - dias_tomados) PERSISTED,
        activo                      BIT NOT NULL CONSTRAINT DF_svp_activo DEFAULT (1),
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_svp_creacion DEFAULT (GETDATE()),
        fecha_modificacion          DATETIME2 NULL CONSTRAINT DF_svp_modificacion DEFAULT (GETDATE()),
        id_usuario_modificacion     INT NULL,
        historial_ajustes           NVARCHAR(MAX) NULL,
        CONSTRAINT PK_saldos_vacaciones_periodos PRIMARY KEY CLUSTERED (id_saldo),
        CONSTRAINT FK_saldos_vacaciones_periodos_empresa FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas (id_empresa),
        CONSTRAINT CK_saldos_vacaciones_periodos_fechas CHECK (fecha_fin_periodo >= fecha_inicio_periodo),
        CONSTRAINT CK_saldos_vacaciones_periodos_limite CHECK (fecha_limite_disfrute > fecha_fin_periodo)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_periodos') AND name = 'UQ_saldos_vacaciones_usuario_periodo')
BEGIN
    CREATE UNIQUE INDEX UQ_saldos_vacaciones_usuario_periodo
        ON rh.saldos_vacaciones_periodos (id_usuario, fecha_inicio_periodo);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_periodos') AND name = 'IX_saldos_vacaciones_empresa_periodo')
BEGIN
    CREATE INDEX IX_saldos_vacaciones_empresa_periodo
        ON rh.saldos_vacaciones_periodos (id_empresa, fecha_inicio_periodo);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_periodos') AND name = 'IX_saldos_vacaciones_limite')
BEGIN
    CREATE INDEX IX_saldos_vacaciones_limite
        ON rh.saldos_vacaciones_periodos (fecha_limite_disfrute)
        INCLUDE (dias_pendientes);
END;
GO

IF OBJECT_ID('rh.saldos_vacaciones_arrastre', 'U') IS NULL
BEGIN
    CREATE TABLE rh.saldos_vacaciones_arrastre
    (
        id_arrastre                INT IDENTITY(1,1) NOT NULL,
        id_usuario                  INT NOT NULL,
        id_empresa                  INT NOT NULL,
        descripcion                 NVARCHAR(200) NOT NULL,
        fecha_corte                 DATE NOT NULL,
        dias_total                  DECIMAL(9,2) NOT NULL,
        dias_aplicados              DECIMAL(9,2) NOT NULL CONSTRAINT DF_sva_aplicados DEFAULT (0),
        dias_restante               AS (dias_total - dias_aplicados) PERSISTED,
        activo                      BIT NOT NULL CONSTRAINT DF_sva_activo DEFAULT (1),
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_sva_creacion DEFAULT (GETDATE()),
        fecha_modificacion          DATETIME2 NULL,
        id_usuario_modificacion     INT NULL,
        CONSTRAINT PK_saldos_vacaciones_arrastre PRIMARY KEY CLUSTERED (id_arrastre),
        CONSTRAINT FK_saldos_vacaciones_arrastre_empresa FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas (id_empresa),
        CONSTRAINT CK_saldos_vacaciones_arrastre_total_positivo CHECK (dias_total > 0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_arrastre') AND name = 'IX_saldos_vacaciones_arrastre_usuario')
BEGIN
    CREATE INDEX IX_saldos_vacaciones_arrastre_usuario
        ON rh.saldos_vacaciones_arrastre (id_usuario, activo, fecha_corte);
END;
GO

IF COL_LENGTH('rh.historial_saldos_vacaciones', 'fecha_inicio_periodo') IS NULL
BEGIN
    ALTER TABLE rh.historial_saldos_vacaciones
        ADD fecha_inicio_periodo DATE NULL,
            fecha_fin_periodo DATE NULL,
            fecha_limite_disfrute DATE NULL,
            numero_periodo INT NULL;
END;
GO

IF COL_LENGTH('rh.snapshot_saldos_vacaciones', 'fecha_inicio_periodo') IS NULL
BEGIN
    ALTER TABLE rh.snapshot_saldos_vacaciones
        ADD fecha_inicio_periodo DATE NULL,
            fecha_fin_periodo DATE NULL,
            fecha_limite_disfrute DATE NULL,
            numero_periodo INT NULL;
END;
GO
