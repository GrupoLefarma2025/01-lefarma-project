/* =============================================================================
   062 — Comentario del ajuste en el historial de saldos de vacaciones
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-23
   -----------------------------------------------------------------------------
   El trigger de 061 registra el cambio, pero no el motivo. Para que un UPDATE
   manual deje el motivo, el trigger lee el contexto de sesion
   'vacaciones_comentario' y lo guarda en la columna notas.

   Uso:
       EXEC sys.sp_set_session_context
            @key = N'vacaciones_comentario',
            @value = N'Motivo del ajuste';
       UPDATE rh.saldos_vacaciones_anuales ...;
       EXEC sys.sp_set_session_context
            @key = N'vacaciones_comentario', @value = NULL;

   Si no se define el contexto, notas queda NULL. El SP de sincronizacion define
   su propio comentario para las corridas del job.
   ========================================================================== */

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

ALTER TRIGGER rh.trg_saldos_vacaciones_historial
ON rh.saldos_vacaciones_anuales
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @comentario NVARCHAR(500) =
        CONVERT(NVARCHAR(500), SESSION_CONTEXT(N'vacaciones_comentario'));

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
        id_usuario_modificacion, fecha_cambio, ejecutado_por, app_name, host_name, notas
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
        HOST_NAME(),
        @comentario
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
