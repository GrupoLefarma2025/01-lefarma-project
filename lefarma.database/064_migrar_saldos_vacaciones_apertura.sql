SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('rh.backup_saldos_vacaciones_anuales_20261126', 'U') IS NULL
BEGIN
    SELECT *
    INTO rh.backup_saldos_vacaciones_anuales_20261126
    FROM rh.saldos_vacaciones_anuales;
END;
GO

IF OBJECT_ID('rh.backup_saldos_vacaciones_periodos_20261126', 'U') IS NULL
BEGIN
    SELECT *
    INTO rh.backup_saldos_vacaciones_periodos_20261126
    FROM rh.saldos_vacaciones_periodos
    WHERE 1 = 0;

    SELECT *
    INTO rh.backup_saldos_vacaciones_arrastre_20261126
    FROM rh.saldos_vacaciones_arrastre
    WHERE 1 = 0;
END;
GO

SET IDENTITY_INSERT rh.saldos_vacaciones_periodos ON;

INSERT INTO rh.saldos_vacaciones_periodos
(
    id_saldo,
    id_usuario,
    id_empresa,
    fecha_inicio_periodo,
    fecha_fin_periodo,
    fecha_limite_disfrute,
    numero_periodo,
    dias_generados,
    dias_vencidos,
    dias_compensados,
    dias_ajustados,
    dias_ajustados_arrastre,
    dias_tomados,
    activo,
    fecha_creacion,
    fecha_modificacion,
    id_usuario_modificacion,
    historial_ajustes
)
SELECT
    s.id_saldo,
    s.id_usuario,
    s.id_empresa,
    p.inicio,
    p.fin,
    p.limite_disfrute,
    p.numero,
    rh.fn_dias_vacaciones_por_antiguedad(p.numero),
    s.dias_vencidos,
    s.dias_compensados,
    CASE WHEN s.dias_ajustados < 0 THEN s.dias_ajustados ELSE 0 END,
    CASE WHEN s.dias_ajustados > 0 THEN s.dias_ajustados ELSE 0 END,
    s.dias_tomados,
    1,
    s.fecha_creacion,
    s.fecha_modificacion,
    s.id_usuario_modificacion,
    s.historial_ajustes
FROM rh.saldos_vacaciones_anuales AS s
INNER JOIN Asokam.app.usuarios AS u
    ON u.IdUsuario = s.id_usuario
INNER JOIN [ESFR-DOCTS].Asistencias.dbo.vwEmpleados AS e
    ON e.correo = u.Correo
CROSS APPLY rh.fn_periodo_vacaciones(CAST(e.fechaingreso AS DATE), CAST(GETDATE() AS DATE)) AS p
WHERE s.anio = 2026
  AND s.activo = 1
  AND NOT EXISTS (
      SELECT 1
      FROM rh.saldos_vacaciones_periodos AS x
      WHERE x.id_usuario = s.id_usuario
        AND x.fecha_inicio_periodo = p.inicio
  );

SET IDENTITY_INSERT rh.saldos_vacaciones_periodos OFF;
GO

INSERT INTO rh.saldos_vacaciones_arrastre
(
    id_usuario,
    id_empresa,
    descripcion,
    fecha_corte,
    dias_total,
    dias_aplicados,
    activo,
    fecha_creacion
)
SELECT
    s.id_usuario,
    s.id_empresa,
    'Puente de carga por aniversario 2026',
    CAST('2026-10-13' AS DATE),
    s.dias_ajustados,
    0,
    1,
    GETDATE()
FROM rh.saldos_vacaciones_anuales AS s
WHERE s.anio = 2026
  AND s.activo = 1
  AND s.dias_ajustados > 0
  AND NOT EXISTS (
      SELECT 1
      FROM rh.saldos_vacaciones_arrastre AS h
      WHERE h.id_usuario = s.id_usuario
        AND h.descripcion = 'Puente de carga por aniversario 2026'
  );
GO

SELECT
    (SELECT COUNT(*) FROM rh.saldos_vacaciones_anuales WHERE anio = 2026 AND activo = 1) AS saldos_2026,
    (SELECT COUNT(*) FROM rh.saldos_vacaciones_periodos) AS periodos_creados,
    (SELECT COUNT(*) FROM rh.saldos_vacaciones_arrastre) AS arrastres_creados,
    (SELECT SUM(dias_tomados) FROM rh.saldos_vacaciones_anuales WHERE anio = 2026 AND activo = 1) AS tomados_antes,
    (SELECT SUM(dias_tomados) FROM rh.saldos_vacaciones_periodos) AS tomados_despues,
    (SELECT SUM(dias_pendientes) FROM rh.saldos_vacaciones_anuales WHERE anio = 2026 AND activo = 1) AS pendientes_antes,
    (SELECT SUM(dias_pendientes) FROM rh.saldos_vacaciones_periodos) AS pendientes_despues;
GO

SELECT s.id_usuario, u.NombreCompleto, e.fechaingreso
FROM rh.saldos_vacaciones_anuales AS s
INNER JOIN Asokam.app.usuarios AS u ON u.IdUsuario = s.id_usuario
INNER JOIN [ESFR-DOCTS].Asistencias.dbo.vwEmpleados AS e ON e.correo = u.Correo
WHERE s.anio = 2026
  AND s.activo = 1
  AND NOT EXISTS (
      SELECT 1
      FROM rh.saldos_vacaciones_periodos AS x
      WHERE x.id_usuario = s.id_usuario
  );
GO

SELECT s.id_usuario, s.fecha_inicio_periodo, s.fecha_fin_periodo, s.fecha_limite_disfrute,
       s.dias_generados, s.dias_ajustados, s.dias_ajustados_arrastre, s.dias_tomados, s.dias_pendientes
FROM rh.saldos_vacaciones_periodos AS s
WHERE s.id_usuario = 32;
GO
