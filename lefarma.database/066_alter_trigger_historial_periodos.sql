SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

IF OBJECT_ID('rh.trg_saldos_vacaciones_historial', 'TR') IS NOT NULL
    DROP TRIGGER rh.trg_saldos_vacaciones_historial;
GO

CREATE TRIGGER rh.trg_saldos_vacaciones_historial
ON rh.saldos_vacaciones_periodos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @comentario NVARCHAR(500) =
            CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'vacaciones_comentario'));

        INSERT INTO rh.historial_saldos_vacaciones
        (
            id_saldo, id_usuario, id_empresa, anio, tipo_cambio,
            fecha_inicio_periodo, fecha_fin_periodo, fecha_limite_disfrute, numero_periodo,
            dias_generados_antes, dias_generados_despues,
            dias_vencidos_antes, dias_vencidos_despues,
            dias_compensados_antes, dias_compensados_despues,
            dias_ajustados_antes, dias_ajustados_despues,
            dias_tomados_antes, dias_tomados_despues,
            dias_pendientes_antes, dias_pendientes_despues,
            activo_antes, activo_despues,
            id_usuario_modificacion, fecha_cambio, ejecutado_por, app_name, host_name, notas
        )
        SELECT
            i.id_saldo, i.id_usuario, i.id_empresa, YEAR(i.fecha_inicio_periodo),
            CASE
                WHEN d.id_saldo IS NULL THEN N'CREACION'
                ELSE STUFF(
                        CASE WHEN i.dias_generados <> d.dias_generados THEN N',GENERADOS' ELSE N'' END
                      + CASE WHEN i.dias_vencidos <> d.dias_vencidos THEN N',VENCIDOS' ELSE N'' END
                      + CASE WHEN i.dias_compensados <> d.dias_compensados THEN N',COMPENSADOS' ELSE N'' END
                      + CASE WHEN i.dias_ajustados <> d.dias_ajustados THEN N',AJUSTADOS' ELSE N'' END
                      + CASE WHEN i.dias_ajustados_arrastre <> d.dias_ajustados_arrastre THEN N',AJUSTADOS_ARRASTRE' ELSE N'' END
                      + CASE WHEN i.dias_tomados <> d.dias_tomados THEN N',TOMADOS' ELSE N'' END
                      + CASE WHEN i.activo <> d.activo THEN N',ACTIVO' ELSE N'' END
                      + CASE WHEN ISNULL(i.historial_ajustes, N'') <> ISNULL(d.historial_ajustes, N'') THEN N',HISTORIAL_AJUSTES' ELSE N'' END
                    , 1, 1, N'')
            END,
            i.fecha_inicio_periodo, i.fecha_fin_periodo, i.fecha_limite_disfrute, i.numero_periodo,
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
            HOST_NAME(),
            @comentario
        FROM inserted AS i
        LEFT JOIN deleted AS d ON d.id_saldo = i.id_saldo
        WHERE d.id_saldo IS NULL
           OR i.dias_generados <> d.dias_generados
           OR i.dias_vencidos <> d.dias_vencidos
           OR i.dias_compensados <> d.dias_compensados
           OR i.dias_ajustados <> d.dias_ajustados
           OR i.dias_ajustados_arrastre <> d.dias_ajustados_arrastre
           OR i.dias_tomados <> d.dias_tomados
           OR i.activo <> d.activo
           OR ISNULL(i.historial_ajustes, N'') <> ISNULL(d.historial_ajustes, N'');
    END TRY
    BEGIN CATCH
        IF XACT_STATE() = -1
            THROW;
    END CATCH
END;
GO

ALTER TABLE rh.historial_saldos_vacaciones
    ALTER COLUMN anio INT NULL;
GO

ENABLE TRIGGER rh.trg_saldos_vacaciones_historial ON rh.saldos_vacaciones_periodos;
GO
