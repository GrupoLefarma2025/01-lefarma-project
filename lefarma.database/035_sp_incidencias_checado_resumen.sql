/* =============================================================================
   rh.incidencias_checado_resumen  --  version con @tipo
   Base   : Lefarma (produccion)
   Fecha  : 2026-09-23
   -----------------------------------------------------------------------------
   CAMBIOS vs la version anterior
     1. Fuente: [AsistenciasDev].[dbo].[incidenciasChecado]
             ->  [ESFR-DOCTS].[Asistencias].[dbo].[incidenciasChecado]
        Motivo: AsistenciasDev esta vencida (2026-06-01..2026-07-23) y no trae
        nada de septiembre. Los datos reales estan en el servidor SVR-LR-DOCTS,
        alcanzable solo via el linked server ESFR-DOCTS.
     2. Parametro @tipo: 'consulta' | 'detalle' | 'empresa'.
     3. @IdEmpresa INT recibe el id_empresa del catalogo catalogos.tempresas.
     4. @tipo va ULTIMO en la firma a proposito, para no romper llamadas
        posicionales antiguas:
            EXEC rh.incidencias_checado_resumen '2026-09-01', '2026-09-29';
     5. Detalle reescrito: una fila por incidencia, sin minutos crudos, con la
        marca de incidencia por lado y el justificante que la cubre.
   -----------------------------------------------------------------------------
   REGLAS DE MARCA (detalle)
     IncidenciaEntrada = 'Si' si la regla disparada es TARDANZA_ENTRADA u
                         OMISION_ENTRADA. Entrar ANTES de la hora de entrada
                         nunca es incidencia.
     IncidenciaSalida  = 'Si' si la regla disparada es TARDANZA_SALIDA,
                         SALIDA_ANTICIPADA u OMISION_SALIDA. Marcar la salida
                         DESPUES de la hora de salida nunca es incidencia.
   -----------------------------------------------------------------------------
   JUSTIFICANTE (detalle)
     Se busca en rh.solicitudes_personal la solicitud que cubre la fecha:
       - si la solicitud tiene filas en rh.solicitudes_personal_detalle, cubre
         SOLO esas fechas;
       - si no, cubre desde fecha_inicio hasta fecha_fin (y si fecha_fin es
         NULL cubre unicamente fecha_inicio).
     Estado: se excluyen CANCELADA y RECHAZADA. Si hay una CERRADA se marca
     Justificada = 'Si'; si solo hay en curso, EnTramite = 'Si'.
     Se muestra el tipo de solicitud (vacacion, permiso, incapacidad,
     incidencia) y el folio.
   -----------------------------------------------------------------------------
   PRECAUCION
     Este script es para Lefarma (produccion). Si lo corres contra LefarmaDev o
     LefarmaDev2, cambia [Lefarma].* por [LefarmaDev] / [LefarmaDev2].
   -----------------------------------------------------------------------------
   SALIDAS
     'empresa' -> id_empresa + nombre desde catalogos.tempresas
     'consulta'-> una fila por nomina: TotalIncidencias, Tardanzas,
                  SalidasAnticipadas, Omisiones, Descuentos
     'detalle' -> una fila por incidencia con marcas por lado, nombre de la
                  incidencia y el justificante que la cubre.
   ========================================================================== */

ALTER PROCEDURE rh.incidencias_checado_resumen
    @FechaInicio DATE        = NULL,
    @FechaFin    DATE        = NULL,
    @Nomina      VARCHAR(50) = NULL,       -- filtrar por nomina
    @IdEmpresa   INT         = NULL,       -- filtrar por id_empresa (catalogos.tempresas)
    @tipo        VARCHAR(20) = 'consulta'  -- 'consulta' | 'detalle' | 'empresa'
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
    -- @tipo = 'empresa' : catalogo de empresas
    ----------------------------------------------------------------
    IF @tipo = 'empresa'
    BEGIN
        SELECT id_empresa, nombre
        FROM   [Lefarma].[catalogos].[tempresas]
        WHERE  activo = 1
        ORDER BY nombre;
        RETURN;
    END

    IF @FechaInicio IS NULL OR @FechaFin IS NULL
    BEGIN
        RAISERROR('Para ''consulta'' y ''detalle'' se requieren @FechaInicio y @FechaFin.', 16, 1);
        RETURN;
    END

    IF @tipo = 'detalle' AND RTRIM(ISNULL(@Nomina, '')) = ''
    BEGIN
        RAISERROR('Para ''detalle'' es obligatorio enviar @Nomina.', 16, 1);
        RETURN;
    END

    ----------------------------------------------------------------
    -- Motor comun: una sola pasada, materializada en #det
    -- El ";" antes del WITH es obligatorio: la instruccion anterior es un
    -- bloque IF y T-SQL exige terminador antes de un CTE (Msg 319).
    ----------------------------------------------------------------
    ;WITH incidencias AS (
        SELECT  f.Fecha,
                f.Nomina,
                f.Nombre,
                f.Empresa,
                f.Departamento,
                f.Puesto,
                f.Entrada,
                f.Salida,
                f.Entro,
                f.Salio
        FROM    [ESFR-DOCTS].[Asistencias].[dbo].[incidenciasChecado] f
        LEFT JOIN [Lefarma].[config].[usuario_detalle] ud
               ON ud.activo = 1
              AND TRY_CAST(ud.numero_empleado AS BIGINT) = f.Nomina
        WHERE   f.Fecha BETWEEN @FechaInicio AND @FechaFin
          AND   f.Nomina IS NOT NULL
          AND   (@Nomina    IS NULL OR f.Nomina = TRY_CAST(@Nomina AS BIGINT))
          AND   (@IdEmpresa IS NULL OR ud.id_empresa = @IdEmpresa)
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
    -- Dias habiles que no generan incidencia: consume_saldo = 0 Y permite_saldo_negativo = 0
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
          AND   dh.permite_saldo_negativo = 0
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
                j.Folio,
                j.TipoJustificante,
                j.CategoriaJustificante,
                j.EstadoJustificante,
                j.EstadoCodigo,
                CASE WHEN j.EstadoCodigo = 'CERRADA' THEN 1 ELSE 0 END AS Justificada,
                CASE WHEN j.Folio IS NOT NULL AND j.EstadoCodigo <> 'CERRADA'
                     THEN 1 ELSE 0 END AS EnTramite
        FROM    filtradas f
        OUTER APPLY (
            SELECT TOP (1)
                   sp.folio     AS Folio,
                   ts.nombre    AS TipoJustificante,
                   ts.categoria AS CategoriaJustificante,
                   we.nombre    AS EstadoJustificante,
                   we.codigo    AS EstadoCodigo
            FROM       [Lefarma].[rh].[solicitudes_personal]  sp
            INNER JOIN [Lefarma].[config].[usuario_detalle]   ud
                    ON ud.id_usuario = ISNULL(sp.id_usuario_solicitante, sp.id_usuario_creador)
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
            ORDER BY CASE WHEN we.codigo = 'CERRADA' THEN 0 ELSE 1 END, sp.id_solicitud
        ) j
    ),
    -- NumeroFila SOLO cuenta incidencias NO justificadas: los dias justificados
    -- no consumen acumulacion, igual que en
    -- IncidenciaChecadoConfigService.EnriquecerDescuentosAsync
    -- (test No_Cuenta_Dias_Justificados_Para_La_Acumulacion).
    numeradas AS (
        SELECT  *,
                SUM(CASE WHEN Justificada = 0 THEN 1 ELSE 0 END) OVER (
                    PARTITION BY Nomina, id_config, PeriodoInicio
                    ORDER BY Fecha
                    ROWS UNBOUNDED PRECEDING
                ) AS NumeroFila
        FROM    con_justificante
    )
    SELECT * INTO #det FROM numeradas;

    ----------------------------------------------------------------
    -- Salidas
    ----------------------------------------------------------------
    IF @tipo = 'detalle'
    BEGIN
        SELECT  d.Fecha,
                d.Nomina,
                d.Nombre,
                d.Empresa,
                d.Departamento,
                d.Puesto,
                d.Entrada    AS EntradaProgramada,
                d.Entro      AS EntradaMarcada,
                d.EntroReal  AS EntradaUsada,
                d.Salida     AS SalidaProgramada,
                d.Salio      AS SalidaMarcada,
                d.SalioReal  AS SalidaUsada,
                CASE WHEN d.tipo_incidencia IN ('TARDANZA_ENTRADA', 'OMISION_ENTRADA')
                     THEN 'Si' ELSE 'No' END AS IncidenciaEntrada,
                CASE WHEN d.tipo_incidencia IN ('TARDANZA_SALIDA', 'SALIDA_ANTICIPADA', 'OMISION_SALIDA')
                     THEN 'Si' ELSE 'No' END AS IncidenciaSalida,
                d.NombreIncidencia,
                d.tipo_incidencia,
                CASE WHEN d.Justificada = 1 THEN 'Si' ELSE 'No' END AS Justificada,
                CASE WHEN d.EnTramite  = 1 THEN 'Si' ELSE 'No' END AS EnTramite,
                d.TipoJustificante,
                d.CategoriaJustificante,
                d.Folio              AS FolioJustificante,
                d.EstadoJustificante
        FROM    #det d
        ORDER BY d.Fecha, d.id_config;
    END
    ELSE
    BEGIN
        SELECT  Nomina,
                MAX(Nombre)            AS Nombre,
                MAX(Empresa)           AS Empresa,
                MAX(Departamento)      AS Departamento,
                MAX(Puesto)            AS Puesto,
                COUNT(*)               AS TotalIncidencias,
                SUM(CASE WHEN tipo_incidencia IN ('TARDANZA_ENTRADA', 'TARDANZA_SALIDA') THEN 1 ELSE 0 END) AS Tardanzas,
                SUM(CASE WHEN tipo_incidencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END)                      AS SalidasAnticipadas,
                SUM(CASE WHEN tipo_incidencia IN ('OMISION_ENTRADA', 'OMISION_SALIDA') THEN 1 ELSE 0 END)   AS Omisiones,
                SUM(CASE WHEN Justificada = 1 THEN 1 ELSE 0 END)                                            AS Justificadas,
                -- Solo lo no justificado acumula y descuenta, igual que
                -- IncidenciaChecadoConfigService.EnriquecerDescuentosAsync
                SUM(CASE WHEN Justificada = 0
                          AND NumeroFila % NULLIF(cantidad_acumulada, 0) = 0
                         THEN 1 ELSE 0 END)                                                                 AS Descuentos
        FROM    #det
        GROUP BY Nomina
        ORDER BY Nombre;
    END

    DROP TABLE #det;
END
GO

/* ====================== EJEMPLOS DE USO (ejecutables) ====================== */

-- 1) Catalogo de empresas del catalogo catalogos.tempresas
EXEC rh.incidencias_checado_resumen @tipo = 'empresa';
GO

-- 2) Resumen de un rango, sin filtros
EXEC rh.incidencias_checado_resumen
     @tipo = 'consulta',
     @FechaInicio = '2026-09-01',
     @FechaFin    = '2026-09-29';
GO

-- 3) Resumen filtrado por empresa (recibe el id_empresa del catalogo)
EXEC rh.incidencias_checado_resumen
     @tipo = 'consulta',
     @FechaInicio = '2026-09-01',
     @FechaFin    = '2026-09-29',
     @IdEmpresa   = 1;
GO

-- 4) Detalle de una nomina (exige @Nomina): marcas por lado y justificante
EXEC rh.incidencias_checado_resumen
     @tipo        = 'detalle',
     @FechaInicio = '2026-09-01',
     @FechaFin    = '2026-09-29',
     @Nomina      = '1033577';
GO
