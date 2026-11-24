/* =============================================================================
   063 — Snapshot diario de saldos de vacaciones
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-23
   -----------------------------------------------------------------------------
   Guarda una foto por usuario y dia de los dias que tiene: generados, vencidos,
   compensados, ajustados, tomados y pendientes. El SP de sincronizacion inserta
   la foto al inicio de su corrida; si corre dos veces el mismo dia, no duplica.
   Es una bitacora de consulta; no modifica rh.saldos_vacaciones_anuales.
   ========================================================================== */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'rh.snapshot_saldos_vacaciones', N'U') IS NULL
BEGIN
    CREATE TABLE rh.snapshot_saldos_vacaciones
    (
        id_snapshot       BIGINT IDENTITY(1,1) NOT NULL,
        fecha_snapshot    DATE NOT NULL,
        id_saldo          INT NOT NULL,
        id_usuario        INT NOT NULL,
        id_empresa        INT NOT NULL,
        anio              INT NOT NULL,
        dias_generados    DECIMAL(9,2) NOT NULL,
        dias_vencidos     DECIMAL(9,2) NOT NULL,
        dias_compensados  DECIMAL(9,2) NOT NULL,
        dias_ajustados    DECIMAL(9,2) NOT NULL,
        dias_tomados      DECIMAL(9,2) NOT NULL,
        dias_pendientes   DECIMAL(9,2) NOT NULL,
        fecha_captura     DATETIME2(3) NOT NULL
            CONSTRAINT DF_snapshot_saldos_vacaciones_fecha DEFAULT SYSDATETIME(),
        id_log            INT NULL,
        CONSTRAINT PK_snapshot_saldos_vacaciones PRIMARY KEY (id_snapshot),
        CONSTRAINT UQ_snapshot_saldos_vacaciones_fecha_saldo UNIQUE (fecha_snapshot, id_saldo)
    );

    CREATE INDEX IX_snapshot_saldos_vacaciones_usuario
        ON rh.snapshot_saldos_vacaciones (id_usuario, fecha_snapshot);

    CREATE INDEX IX_snapshot_saldos_vacaciones_anio
        ON rh.snapshot_saldos_vacaciones (anio, fecha_snapshot);
END;
GO
