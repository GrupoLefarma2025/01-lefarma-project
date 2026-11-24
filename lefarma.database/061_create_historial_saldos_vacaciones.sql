/* =============================================================================
   061 — Historial por usuario de los saldos de vacaciones
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-23
   -----------------------------------------------------------------------------
   Crea rh.historial_saldos_vacaciones y el trigger que registra cada alta o
   cambio de dias en rh.saldos_vacaciones_anuales: generados, vencidos,
   compensados, ajustados y tomados. Incluye una fila de estado inicial por
   cada saldo existente.
   ========================================================================== */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'rh.historial_saldos_vacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE rh.historial_saldos_vacaciones
    (
        id_cambio                BIGINT IDENTITY(1,1) NOT NULL,
        id_saldo                 INT NOT NULL,
        id_usuario               INT NOT NULL,
        id_empresa               INT NOT NULL,
        anio                     INT NOT NULL,
        tipo_cambio              NVARCHAR(200) NOT NULL,
        dias_generados_antes     DECIMAL(9,2) NULL,
        dias_generados_despues   DECIMAL(9,2) NULL,
        dias_vencidos_antes      DECIMAL(9,2) NULL,
        dias_vencidos_despues    DECIMAL(9,2) NULL,
        dias_compensados_antes   DECIMAL(9,2) NULL,
        dias_compensados_despues DECIMAL(9,2) NULL,
        dias_ajustados_antes     DECIMAL(9,2) NULL,
        dias_ajustados_despues   DECIMAL(9,2) NULL,
        dias_tomados_antes       DECIMAL(9,2) NULL,
        dias_tomados_despues     DECIMAL(9,2) NULL,
        dias_pendientes_antes    DECIMAL(9,2) NULL,
        dias_pendientes_despues  DECIMAL(9,2) NULL,
        activo_antes             BIT NULL,
        activo_despues           BIT NULL,
        id_usuario_modificacion  INT NULL,
        fecha_cambio             DATETIME2(3) NOT NULL
                                 CONSTRAINT DF_historial_saldos_vacaciones_fecha DEFAULT (SYSDATETIME()),
        ejecutado_por            NVARCHAR(128) NOT NULL,
        app_name                 NVARCHAR(128) NULL,
        host_name                NVARCHAR(128) NULL,
        notas                    NVARCHAR(500) NULL,
        CONSTRAINT PK_historial_saldos_vacaciones PRIMARY KEY CLUSTERED (id_cambio)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'rh.historial_saldos_vacaciones') AND name = N'IX_historial_saldos_vacaciones_usuario')
    CREATE INDEX IX_historial_saldos_vacaciones_usuario
        ON rh.historial_saldos_vacaciones (id_usuario, anio, fecha_cambio)
        INCLUDE (tipo_cambio, dias_pendientes_antes, dias_pendientes_despues);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'rh.historial_saldos_vacaciones') AND name = N'IX_historial_saldos_vacaciones_saldo')
    CREATE INDEX IX_historial_saldos_vacaciones_saldo
        ON rh.historial_saldos_vacaciones (id_saldo, fecha_cambio);
GO

IF NOT EXISTS (SELECT 1 FROM rh.historial_saldos_vacaciones)
BEGIN
    INSERT INTO rh.historial_saldos_vacaciones
    (
        id_saldo, id_usuario, id_empresa, anio, tipo_cambio,
        dias_generados_antes, dias_generados_despues,
        dias_vencidos_antes, dias_vencidos_despues,
        dias_compensados_antes, dias_compensados_despues,
        dias_ajustados_antes, dias_ajustados_despues,
        dias_tomados_antes, dias_tomados_despues,
        dias_pendientes_antes, dias_pendientes_despues,
        activo_antes, activo_despues,
        id_usuario_modificacion, fecha_cambio, ejecutado_por, app_name, host_name
    )
    SELECT
        s.id_saldo, s.id_usuario, s.id_empresa, s.anio, N'ESTADO_INICIAL',
        NULL, s.dias_generados,
        NULL, s.dias_vencidos,
        NULL, s.dias_compensados,
        NULL, s.dias_ajustados,
        NULL, s.dias_tomados,
        NULL, s.dias_pendientes,
        NULL, s.activo,
        s.id_usuario_modificacion, SYSDATETIME(), N'MIGRACION_061', N'script 061', HOST_NAME()
    FROM rh.saldos_vacaciones_anuales AS s;
END;
GO

IF OBJECT_ID(N'rh.trg_saldos_vacaciones_historial', N'TR') IS NOT NULL
    DROP TRIGGER rh.trg_saldos_vacaciones_historial;
GO

CREATE TRIGGER rh.trg_saldos_vacaciones_historial
ON rh.saldos_vacaciones_anuales
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO rh.historial_saldos_vacaciones
    (
        id_saldo, id_usuario, id_empresa, anio, tipo_cambio,
        dias_generados_antes, dias_generados_despues,
        dias_vencidos_antes, dias_vencidos_despues,
        dias_compensados_antes, dias_compensados_despues,
        dias_ajustados_antes, dias_ajustados_despues,
        dias_tomados_antes, dias_tomados_despues,
        dias_pendientes_antes, dias_pendientes_despues,
        activo_antes, activo_despues,
        id_usuario_modificacion, fecha_cambio, ejecutado_por, app_name, host_name
    )
    SELECT
        i.id_saldo, i.id_usuario, i.id_empresa, i.anio,
        CASE
            WHEN d.id_saldo IS NULL THEN N'CREACION'
            ELSE STUFF(
                    CASE WHEN i.dias_generados <> d.dias_generados THEN N',GENERADOS' ELSE N'' END
                  + CASE WHEN i.dias_vencidos <> d.dias_vencidos THEN N',VENCIDOS' ELSE N'' END
                  + CASE WHEN i.dias_compensados <> d.dias_compensados THEN N',COMPENSADOS' ELSE N'' END
                  + CASE WHEN i.dias_ajustados <> d.dias_ajustados THEN N',AJUSTADOS' ELSE N'' END
                  + CASE WHEN i.dias_tomados <> d.dias_tomados THEN N',TOMADOS' ELSE N'' END
                  + CASE WHEN i.activo <> d.activo THEN N',ACTIVO' ELSE N'' END
                  + CASE WHEN ISNULL(i.historial_ajustes, N'') <> ISNULL(d.historial_ajustes, N'') THEN N',HISTORIAL_AJUSTES' ELSE N'' END
                , 1, 1, N'')
        END,
        d.dias_generados, i.dias_generados,
        d.dias_vencidos, i.dias_vencidos,
        d.dias_compensados, i.dias_compensados,
        d.dias_ajustados, i.dias_ajustados,
        d.dias_tomados, i.dias_tomados,
        d.dias_pendientes, i.dias_pendientes,
        d.activo, i.activo,
        i.id_usuario_modificacion,
        SYSDATETIME(),
        SUSER_SNAME(),
        APP_NAME(),
        HOST_NAME()
    FROM inserted AS i
    LEFT JOIN deleted AS d ON d.id_saldo = i.id_saldo
    WHERE d.id_saldo IS NULL
       OR i.dias_generados <> d.dias_generados
       OR i.dias_vencidos <> d.dias_vencidos
       OR i.dias_compensados <> d.dias_compensados
       OR i.dias_ajustados <> d.dias_ajustados
       OR i.dias_tomados <> d.dias_tomados
       OR i.activo <> d.activo
       OR ISNULL(i.historial_ajustes, N'') <> ISNULL(d.historial_ajustes, N'');
END;
GO
