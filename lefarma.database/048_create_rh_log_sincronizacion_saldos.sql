/* =============================================================================
   048 — Bitacora de ejecuciones de rh.sp_sincroniza_saldos_vacaciones
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-02
   -----------------------------------------------------------------------------
   Una fila por corrida:
     EN_PROCESO -> se inserta al arrancar, FUERA de la transaccion, para que un
                   ROLLBACK no borre el registro de que el proceso si corrio.
     OK         -> al terminar bien, con los contadores del upsert.
     ERROR      -> al fallar, con numero, mensaje, linea y procedimiento.

   No guarda detalle por empleado; para eso esta la columna historial_ajustes
   de rh.saldos_vacaciones_anuales y el historial de la app.

   Idempotente: se puede re-ejecutar sin error.
   ========================================================================== */

IF OBJECT_ID('rh.log_sincronizacion_saldos', 'U') IS NULL
BEGIN
    CREATE TABLE rh.log_sincronizacion_saldos
    (
        id_log          INT IDENTITY(1,1)   NOT NULL,
        fecha_inicio    DATETIME2(3)        NOT NULL
                        CONSTRAINT df_rh_log_sinc_fecha_inicio DEFAULT (SYSDATETIME()),
        fecha_fin       DATETIME2(3)        NULL,
        duracion_ms     INT                 NULL,
        anio            INT                 NOT NULL,
        estatus         VARCHAR(12)         NOT NULL,
        total_rh        INT                 NULL,
        creados         INT                 NULL,
        actualizados    INT                 NULL,
        omitidos        INT                 NULL,
        numero_error    INT                 NULL,
        mensaje_error   NVARCHAR(4000)      NULL,
        linea_error     INT                 NULL,
        procedure_error NVARCHAR(256)       NULL,
        ejecutado_por   NVARCHAR(128)       NOT NULL
                        CONSTRAINT df_rh_log_sinc_ejecutado_por DEFAULT (SUSER_SNAME()),
        CONSTRAINT pk_rh_log_sincronizacion_saldos PRIMARY KEY CLUSTERED (id_log),
        CONSTRAINT ck_rh_log_sinc_estatus CHECK (estatus IN ('EN_PROCESO', 'OK', 'ERROR'))
    );

    CREATE NONCLUSTERED INDEX ix_rh_log_sincronizacion_saldos_fecha
        ON rh.log_sincronizacion_saldos (fecha_inicio DESC);
END
