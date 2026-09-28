-- =============================================================================
-- MIGRACIÓN: Auditoría de ajustes manuales en saldos de vacaciones
-- DESCRIPCIÓN: Agrega a rh.saldos_vacaciones_anuales las columnas del último
--              ajuste manual hecho por RH (quién, cuándo y motivo). Los valores
--              de saldo ajustables son dias_ajustados, dias_vencidos y
--              dias_compensados. dias_pendientes es columna computada y se
--              recalcula sola.
-- NOTAS:       Script idempotente y defensivo: verifica existencia de la tabla
--              y de cada columna antes de alterar. Ejecutar en cada base que
--              tenga la tabla (Lefarma, LefarmaDev, LefarmaDev2).
-- =============================================================================

IF OBJECT_ID('rh.saldos_vacaciones_anuales', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_anuales')
          AND name = 'id_usuario_modificacion')
    BEGIN
        ALTER TABLE rh.saldos_vacaciones_anuales
            ADD id_usuario_modificacion INT NULL;
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_anuales')
          AND name = 'fecha_modificacion')
    BEGIN
        ALTER TABLE rh.saldos_vacaciones_anuales
            ADD fecha_modificacion DATETIME2 NULL;
    END

    IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('rh.saldos_vacaciones_anuales')
          AND name = 'motivo_ajuste')
    BEGIN
        ALTER TABLE rh.saldos_vacaciones_anuales
            ADD motivo_ajuste NVARCHAR(300) NULL;
    END
END
GO
