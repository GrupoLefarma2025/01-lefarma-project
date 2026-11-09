/* =============================================================================
   rh.incidencias_checado_resumen_v2  --  version con vacaciones y justificantes
   Base   : Lefarma (produccion)
   Fecha  : 2026-11-04
   -----------------------------------------------------------------------------
   EJECUTAR TODO EL ARCHIVO, no lineas sueltas. El procedimiento se crea en un
   solo lote; las CTE y #det dependen de ese lote completo. Si el cliente divide
   el script por ';' (DBeaver, etc.), usar SSMS o:
       sqlcmd -S <servidor> -d Lefarma -C -i 045_sp_incidencias_checado_resumen_vacaciones_justificadas.sql
   -----------------------------------------------------------------------------
   BASE DE ESTA VERSION
     Se parte de la definicion vigente en produccion (Lefarma), que usa
     @Empresa VARCHAR(100) y @Nomina INT. NO se parte del archivo 035 del repo,
     que tiene otra firma (@IdEmpresa) y no esta aplicado en produccion.
   -----------------------------------------------------------------------------
   CAMBIOS vs la version vigente en produccion
     1. Se identifican los dias cubiertos por un justificante:
          - Justificada            = existe solicitud CERRADA que cubre la fecha
                                     (cualquier categoria: vacacion, permiso,
                                     incapacidad o incidencia).
          - JustificadaIncidencia  = existe solicitud CERRADA de categoria
                                     Incidencia (categoria = 1) que cubre la fecha.
        En ambos casos se excluyen solicitudes CANCELADA y RECHAZADA.
     2. Se agrega NumeroFilaSinJustificar: acumulado por regla/periodo que NO
        cuenta los dias justificados. Con el se calcula el total de dias a
        descontar considerando justificaciones.
     3. @tipo = 'consulta' agrega estas columnas:
          - VacacionesEnTramite      : dias de vacaciones en el rango cuya
                                       solicitud NO esta CERRADA.
          - VacacionesAprobadas      : dias de vacaciones en el rango cuya
                                       solicitud esta CERRADA.
          - DiasVacacionesRestantes  : saldo pendiente del anio de @FechaInicio
                                       en rh.saldos_vacaciones_anuales.
          - IncidenciasJustificadas  : incidencias cubiertas por un justificante
                                       CERRADO de categoria Incidencia.
          - TotalDiasDescontar       : dias distintos con al menos una incidencia
                                       no justificada que alcanza la acumulacion
                                       de su regla. Es el total final considerando
                                       justificaciones.
        Descuentos se conserva como estaba: conteo por incidencia que alcanza la
        acumulacion, SIN considerar justificaciones.
   -----------------------------------------------------------------------------
   REGLAS DE VACACIONES
     - Solo solicitudes de categoria Vacaciones (rh.tipo_solicitud.categoria = 3).
     - Se excluyen CANCELADA y RECHAZADA.
     - Los dias se cuentan con rh.solicitudes_personal_detalle dentro del rango.
       Si la solicitud no tiene filas de detalle, se usa el rango
       fecha_inicio..fecha_fin recortado a @FechaInicio..@FechaFin.
   -----------------------------------------------------------------------------
   PRECAUCION
     Este script es para Lefarma (produccion). Si lo corres contra LefarmaDev o
     LefarmaDev2, cambia [Lefarma].[rh].* y [Lefarma].[config].* por
     [LefarmaDev] / [LefarmaDev2] respectivamente.
   -----------------------------------------------------------------------------
   USO
     EXEC rh.incidencias_checado_resumen_v2 @tipo = 'empresa';

     EXEC rh.incidencias_checado_resumen_v2
          @tipo = 'consulta', @FechaInicio = '2026-09-01', @FechaFin = '2026-09-29';

     EXEC rh.incidencias_checado_resumen_v2
          @tipo = 'consulta', @FechaInicio = '2026-09-01', @FechaFin = '2026-09-29',
          @Empresa = 'ARTRICENTER';

     EXEC rh.incidencias_checado_resumen_v2
          @tipo = 'detalle', @FechaInicio = '2026-09-01', @FechaFin = '2026-09-29',
          @Nomina = '1033577';

   SALIDAS
     'empresa' -> Empresa (catalogo real de la fuente, sirve como valor de @Empresa)
     'consulta'-> una fila por nomina: TotalIncidencias, Tardanzas,
                  SalidasAnticipadas, Omisiones, VacacionesEnTramite,
                  VacacionesAprobadas, DiasVacacionesRestantes,
                  IncidenciasJustificadas, Descuentos, TotalDiasDescontar
     'detalle' -> una fila por incidencia, con MinutosRetrasoEntrada
                  (positivo = llego tarde) y MinutosSalidaVsHorario
                  (negativo = salio antes), mas PeriodoInicio / NumeroFila /
                  GeneraDescuento para auditar el calculo de Descuentos.
   ========================================================================== */

GO

CREATE OR ALTER PROCEDURE [rh].[incidencias_checado_resumen_v2]
    @FechaInicio DATE         = '19000101',
    @FechaFin    DATE         = '19000101',
    @Nomina      int = 0,       -- filtrar por nomina
    @Empresa     VARCHAR(100) = 'TODAS',       -- filtrar por nombre de empresa
    @tipo        VARCHAR(20)  = 'consulta'  -- 'consulta' | 'detalle' | 'empresa'
AS
BEGIN
    SET NOCOUNT ON;

    SET @tipo = LOWER(LTRIM(RTRIM(ISNULL(@tipo, 'consulta'))));

    -- Validaciones
    IF @tipo NOT IN ('consulta', 'detalle', 'empresa')
    BEGIN
        RAISERROR('Tipo invalido. Use ''consulta'', ''detalle'' o ''empresa''.', 16, 1);
        RETURN;
    END

    ----------------------------------------------------------------
    -- @tipo = 'empresa' : catalogo para armar el filtro de la consulta
    ----------------------------------------------------------------
    IF @tipo = 'empresa'
    BEGIN
        SELECT DISTINCT Empresa
        FROM   [ESFR-DOCTS].[Asistencias].[dbo].[incidenciasChecado]
        WHERE  Empresa IS NOT NULL
          AND  fecha >= getdate() - 30
        UNION ALL
        SELECT 'TODAS' AS Empresa
        ORDER BY Empresa;
        RETURN;
    END

    ----------------------------------------------------------------
    -- Motor comun: una sola pasada, materializada en #det
    -- El ";" antes del WITH es obligatorio: la instruccion anterior es un
    -- bloque IF y T-SQL exige terminador antes de un CTE (Msg 319).
    ----------------------------------------------------------------
    IF @tipo IN ('consulta', 'detalle')
    BEGIN
        ;WITH incidencias AS (
            SELECT  Fecha,
                    Nomina,
                    Nombre,
                    Empresa,
                    Departamento,
                    Puesto,
                    Entrada,
                    Salida,
                    Entro,
                    Salio
            FROM    [ESFR-DOCTS].[Asistencias].[dbo].[incidenciasChecado]
            WHERE   Fecha BETWEEN @FechaInicio AND @FechaFin
              AND   Nomina IS NOT NULL
              AND   Nomina = CASE WHEN @Nomina <> 0 THEN @Nomina ELSE Nomina END
              AND   Empresa = CASE WHEN @Empresa <> 'TODAS' THEN @Empresa ELSE Empresa END
        ),
        checadas AS (
            SELECT  *,
                    CASE
                        WHEN Entro IS NOT NULL AND Salio IS NOT NULL AND Entro = Salio THEN
                            CASE
                                WHEN ABS(DATEDIFF(MINUTE, ISNULL(Entrada, '00:00'), Entro))
                                     <= ABS(DATEDIFF(MINUTE, ISNULL(Salida,  '00:00'), Salio))
                                THEN Entro
                                ELSE NULL
                            END
                        WHEN Entro IS NOT NULL AND (Salio IS NULL OR Entro <> Salio) THEN Entro
                        ELSE NULL
                    END AS EntroReal,
                    CASE
                        WHEN Entro IS NOT NULL AND Salio IS NOT NULL AND Entro = Salio THEN
                            CASE
                                WHEN ABS(DATEDIFF(MINUTE, ISNULL(Entrada, '00:00'), Entro))
                                     <= ABS(DATEDIFF(MINUTE, ISNULL(Salida,  '00:00'), Salio))
                                THEN NULL
                                ELSE Salio
                            END
                        WHEN Salio IS NOT NULL AND (Entro IS NULL OR Entro <> Salio) THEN Salio
                        ELSE NULL
                    END AS SalioReal
            FROM    incidencias
        ),
        con_checado AS (
            SELECT  *,
                    CASE WHEN EntroReal IS NOT NULL THEN 1 ELSE 0 END AS ChecoEntrada,
                    CASE WHEN SalioReal IS NOT NULL THEN 1 ELSE 0 END AS ChecoSalida
            FROM    checadas
        ),
        reglas AS (
            SELECT  id_config,
                    nombre,
                    tipo_incidencia,
                    minutos_min,
                    minutos_max,
                    cantidad_acumulada,
                    periodo,
                    registro_entrada,
                    registro_salida,
                    excluir_dias_habiles_consumen_saldo
            FROM    [Lefarma].[rh].[incidencias_checado_config]
            WHERE   activo = 1
        ),
        -- Dias habiles que no generan incidencia: consume_saldo = 0
        dias_sin_incidencia AS (
            SELECT DISTINCT
                TRY_CAST(ud.numero_empleado AS BIGINT) AS Nomina,
                dh.fecha                                AS Fecha
            FROM    [Lefarma].[rh].[dias_habiles] dh
            INNER JOIN [Lefarma].[config].[usuario_detalle] ud
                ON ud.id_empresa = dh.id_empresa
               AND ud.activo = 1
               AND ud.numero_empleado IS NOT NULL
               AND ud.numero_empleado <> ''
            WHERE   dh.activo = 1
              AND   dh.consume_saldo = 0
              --AND   dh.permite_saldo_negativo = 0
              AND   dh.fecha BETWEEN @FechaInicio AND @FechaFin
        ),
        coincidencias AS (
            SELECT  c.*,
                    r.id_config,
                    r.nombre            AS NombreIncidencia,
                    r.tipo_incidencia,
                    r.cantidad_acumulada,
                    r.periodo,
                    r.excluir_dias_habiles_consumen_saldo,
                    CASE r.tipo_incidencia
                        WHEN 'TARDANZA_ENTRADA' THEN
                            CASE WHEN c.ChecoEntrada = 1
                                  AND c.Entrada IS NOT NULL
                                  AND c.EntroReal IS NOT NULL
                                  AND DATEDIFF(MINUTE, c.Entrada, c.EntroReal) > 0
                                  AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.Entrada, c.EntroReal) >= r.minutos_min)
                                  AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.Entrada, c.EntroReal) <= r.minutos_max)
                                 THEN 1 ELSE 0 END
                        WHEN 'TARDANZA_SALIDA' THEN
                            CASE WHEN c.ChecoSalida = 1
                                  AND c.Salida IS NOT NULL
                                  AND c.SalioReal IS NOT NULL
                                  AND DATEDIFF(MINUTE, c.Salida, c.SalioReal) > 0
                                  AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.Salida, c.SalioReal) >= r.minutos_min)
                                  AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.Salida, c.SalioReal) <= r.minutos_max)
                                 THEN 1 ELSE 0 END
                        WHEN 'SALIDA_ANTICIPADA' THEN
                            CASE WHEN c.ChecoSalida = 1
                                  AND c.Salida IS NOT NULL
                                  AND c.SalioReal IS NOT NULL
                                  AND c.SalioReal < c.Salida
                                  AND DATEDIFF(MINUTE, c.SalioReal, c.Salida) > 0
                                  AND (r.minutos_min IS NULL OR DATEDIFF(MINUTE, c.SalioReal, c.Salida) >= r.minutos_min)
                                  AND (r.minutos_max IS NULL OR DATEDIFF(MINUTE, c.SalioReal, c.Salida) <= r.minutos_max)
                                 THEN 1 ELSE 0 END
                        WHEN 'OMISION_ENTRADA' THEN
                            CASE WHEN r.registro_entrada = 1
                                  AND c.Entrada IS NOT NULL
                                  AND c.ChecoEntrada = 0
                                 THEN 1 ELSE 0 END
                        WHEN 'OMISION_SALIDA' THEN
                            CASE WHEN r.registro_salida = 1
                                  AND c.Salida IS NOT NULL
                                  AND c.ChecoSalida = 0
                                 THEN 1 ELSE 0 END
                        ELSE 0
                    END AS Coincide
            FROM    con_checado c
            CROSS JOIN reglas r
        ),
        filtradas AS (
            SELECT  *,
                    CASE f.periodo
                        WHEN 'semana'   THEN DATEADD(DAY, -((DATEPART(WEEKDAY, Fecha) + 5) % 7), Fecha)
                        WHEN 'mes'      THEN DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 1)
                        ELSE CASE
                                WHEN DAY(Fecha) <= 15 THEN DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 1)
                                ELSE DATEFROMPARTS(YEAR(Fecha), MONTH(Fecha), 16)
                             END
                    END AS PeriodoInicio
            FROM    coincidencias f
            WHERE   f.Coincide = 1
              AND   NOT (f.excluir_dias_habiles_consumen_saldo = 1
                         AND EXISTS (
                             SELECT 1
                             FROM   dias_sin_incidencia d
                             WHERE  d.Nomina = f.Nomina
                               AND  d.Fecha  = f.Fecha
                         ))
        ),
        con_justificante AS (
            SELECT  f.*,
                    CASE WHEN j.TieneCerrada = 1 THEN 1 ELSE 0 END           AS Justificada,
                    CASE WHEN j.TieneCerradaIncidencia = 1 THEN 1 ELSE 0 END AS JustificadaIncidencia
            FROM    filtradas f
            OUTER APPLY (
                SELECT
                    MAX(CASE WHEN we.codigo = 'CERRADA' THEN 1 ELSE 0 END) AS TieneCerrada,
                    MAX(CASE WHEN we.codigo = 'CERRADA' AND ts.categoria = 1 THEN 1 ELSE 0 END) AS TieneCerradaIncidencia
                FROM       [Lefarma].[rh].[solicitudes_personal]  sp
                INNER JOIN [Lefarma].[config].[usuario_detalle]   ud
                        ON ud.id_usuario = ISNULL(sp.id_usuario_solicitante, sp.id_usuario_creador)
                       AND ud.activo = 1
                INNER JOIN [Lefarma].[rh].[tipo_solicitud]        ts
                        ON ts.id_tipo_solicitud = sp.id_tipo_solicitud
                INNER JOIN [Lefarma].[config].[workflow_estados]  we
                        ON we.id_estado = sp.id_estado
                WHERE TRY_CAST(ud.numero_empleado AS BIGINT) = f.Nomina
                  AND sp.fecha_inicio IS NOT NULL
                  AND we.codigo NOT IN ('CANCELADA', 'RECHAZADA')
                  AND (
                        CASE
                            WHEN EXISTS (SELECT 1 FROM [Lefarma].[rh].[solicitudes_personal_detalle] x
                                         WHERE x.id_solicitud = sp.id_solicitud)
                            THEN CASE WHEN EXISTS (SELECT 1 FROM [Lefarma].[rh].[solicitudes_personal_detalle] x
                                                   WHERE x.id_solicitud = sp.id_solicitud
                                                     AND x.fecha = f.Fecha)
                                      THEN 1 ELSE 0 END
                            WHEN f.Fecha >= CONVERT(date, sp.fecha_inicio)
                             AND f.Fecha <= ISNULL(CONVERT(date, sp.fecha_fin), CONVERT(date, sp.fecha_inicio))
                            THEN 1
                            ELSE 0
                        END
                      ) = 1
            ) j
        )
        SELECT  *
        INTO    #det
        FROM (
            SELECT  *,
                    ROW_NUMBER() OVER (
                        PARTITION BY Nomina, id_config, PeriodoInicio
                        ORDER BY Fecha
                    ) AS NumeroFila,
                    SUM(CASE WHEN Justificada = 0 THEN 1 ELSE 0 END) OVER (
                        PARTITION BY Nomina, id_config, PeriodoInicio
                        ORDER BY Fecha
                        ROWS UNBOUNDED PRECEDING
                    ) AS NumeroFilaSinJustificar
            FROM    con_justificante
        ) AS numeradas;

        ----------------------------------------------------------------
        -- Vacaciones del periodo (por nomina)
        -- Se cuentan los dias de detalle dentro del rango. Si la solicitud
        -- no tiene detalle, se usa fecha_inicio..fecha_fin recortado.
        ----------------------------------------------------------------
        ;WITH vacaciones AS (
            SELECT  TRY_CAST(ud.numero_empleado AS BIGINT) AS Nomina,
                    sp.id_solicitud,
                    we.codigo                              AS EstadoCodigo,
                    CONVERT(date, sp.fecha_inicio)         AS FechaInicio,
                    CONVERT(date, ISNULL(sp.fecha_fin, sp.fecha_inicio)) AS FechaFin,
                    CASE WHEN EXISTS (SELECT 1 FROM [Lefarma].[rh].[solicitudes_personal_detalle] x
                                      WHERE x.id_solicitud = sp.id_solicitud)
                         THEN 1 ELSE 0 END AS TieneDetalle
            FROM       [Lefarma].[rh].[solicitudes_personal]  sp
            INNER JOIN [Lefarma].[config].[usuario_detalle]   ud
                    ON ud.id_usuario = ISNULL(sp.id_usuario_solicitante, sp.id_usuario_creador)
                   AND ud.activo = 1
            INNER JOIN [Lefarma].[rh].[tipo_solicitud]        ts
                    ON ts.id_tipo_solicitud = sp.id_tipo_solicitud
                   AND ts.categoria = 3          -- Vacaciones
            INNER JOIN [Lefarma].[config].[workflow_estados]  we
                    ON we.id_estado = sp.id_estado
            WHERE we.codigo NOT IN ('CANCELADA', 'RECHAZADA')
              AND sp.fecha_inicio IS NOT NULL
              AND CONVERT(date, sp.fecha_inicio) <= @FechaFin
              AND CONVERT(date, ISNULL(sp.fecha_fin, sp.fecha_inicio)) >= @FechaInicio
              AND (@Nomina = 0 OR TRY_CAST(ud.numero_empleado AS BIGINT) = @Nomina)
        ),
        vacaciones_dias AS (
            SELECT v.Nomina,
                   v.EstadoCodigo,
                   COUNT(*) AS Dias
            FROM       vacaciones v
            INNER JOIN [Lefarma].[rh].[solicitudes_personal_detalle] d
                    ON d.id_solicitud = v.id_solicitud
            WHERE CONVERT(date, d.fecha) BETWEEN @FechaInicio AND @FechaFin
            GROUP BY v.Nomina, v.EstadoCodigo

            UNION ALL

            SELECT v.Nomina,
                   v.EstadoCodigo,
                   DATEDIFF(DAY,
                       CASE WHEN v.FechaInicio < @FechaInicio THEN @FechaInicio ELSE v.FechaInicio END,
                       CASE WHEN v.FechaFin    > @FechaFin    THEN @FechaFin    ELSE v.FechaFin    END) + 1
            FROM   vacaciones v
            WHERE  v.TieneDetalle = 0
        )
        SELECT  Nomina,
                SUM(CASE WHEN EstadoCodigo = 'CERRADA' THEN Dias ELSE 0 END) AS VacacionesAprobadas,
                SUM(CASE WHEN EstadoCodigo <> 'CERRADA' THEN Dias ELSE 0 END) AS VacacionesEnTramite
        INTO #vac
        FROM vacaciones_dias
        GROUP BY Nomina;

        ----------------------------------------------------------------
        -- Saldo de vacaciones del anio de @FechaInicio (por nomina)
        ----------------------------------------------------------------
        SELECT  TRY_CAST(ud.numero_empleado AS BIGINT) AS Nomina,
                SUM(ISNULL(s.dias_pendientes, 0)) AS DiasVacacionesRestantes
        INTO #saldo
        FROM       [Lefarma].[rh].[saldos_vacaciones_anuales] s
        INNER JOIN [Lefarma].[config].[usuario_detalle]       ud
                ON ud.id_usuario = s.id_usuario
               AND ud.activo = 1
        WHERE s.activo = 1
          AND s.anio = YEAR(@FechaInicio)
          AND (@Nomina = 0 OR TRY_CAST(ud.numero_empleado AS BIGINT) = @Nomina)
        GROUP BY TRY_CAST(ud.numero_empleado AS BIGINT);
    END

    ----------------------------------------------------------------
    -- Salidas
    ----------------------------------------------------------------
    IF @tipo = 'detalle'
    BEGIN
        SELECT  Fecha,
                Nomina,
                Nombre,
                Empresa,
                Departamento,
                Puesto,
                Entrada                               AS EntradaProgramada,
                Entro                                 AS EntradaMarcada,
                EntroReal                             AS EntradaUsada,
                DATEDIFF(MINUTE, Entrada, EntroReal)  AS MinutosRetrasoEntrada,
                Salida                                AS SalidaProgramada,
                Salio                                 AS SalidaMarcada,
                SalioReal                             AS SalidaUsada,
                DATEDIFF(MINUTE, Salida, SalioReal)   AS MinutosSalidaVsHorario,
                NombreIncidencia,
                tipo_incidencia,
                PeriodoInicio,
                NumeroFila,
                cantidad_acumulada                    AS AcumulanParaDescuento,
                CASE WHEN NumeroFila % NULLIF(cantidad_acumulada, 0) = 0
                     THEN 1 ELSE 0 END                AS GeneraDescuento
        FROM    #det
        ORDER BY Fecha, id_config;
    END

    IF @tipo = 'consulta'
    BEGIN
        SELECT  d.Nomina,
                MAX(d.Nombre)            AS Nombre,
                MAX(d.Empresa)           AS Empresa,
                MAX(d.Departamento)      AS Departamento,
                MAX(d.Puesto)            AS Puesto,
                COUNT(*)                 AS TotalIncidencias,
                SUM(CASE WHEN d.tipo_incidencia IN ('TARDANZA_ENTRADA', 'TARDANZA_SALIDA') THEN 1 ELSE 0 END) AS Tardanzas,
                SUM(CASE WHEN d.tipo_incidencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END)                      AS SalidasAnticipadas,
                SUM(CASE WHEN d.tipo_incidencia IN ('OMISION_ENTRADA', 'OMISION_SALIDA') THEN 1 ELSE 0 END)   AS Omisiones,
                ISNULL(MAX(v.VacacionesEnTramite), 0)      AS VacacionesEnTramite,
                ISNULL(MAX(v.VacacionesAprobadas), 0)      AS VacacionesAprobadas,
                ISNULL(MAX(s.DiasVacacionesRestantes), 0)  AS DiasVacacionesRestantes,
                SUM(CASE WHEN d.JustificadaIncidencia = 1 THEN 1 ELSE 0 END) AS IncidenciasJustificadas,
                SUM(CASE WHEN d.NumeroFila % NULLIF(d.cantidad_acumulada, 0) = 0 THEN 1 ELSE 0 END) AS Descuentos,
                COUNT(DISTINCT CASE WHEN d.Justificada = 0
                                     AND d.NumeroFilaSinJustificar % NULLIF(d.cantidad_acumulada, 0) = 0
                                    THEN d.Fecha END) AS TotalDiasDescontar
        FROM    #det d
        LEFT JOIN #vac   v ON v.Nomina = d.Nomina
        LEFT JOIN #saldo s ON s.Nomina = d.Nomina
        GROUP BY d.Nomina
        ORDER BY MAX(d.Nombre);
    END

    DROP TABLE #det;
    DROP TABLE #vac;
    DROP TABLE #saldo;
END
GO
