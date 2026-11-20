using System.Data;
using Dapper;
using Lefarma.API.Domain.Entities.Telemetria;
using Lefarma.API.Features.Telemetria.Almacen;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Telemetria.Consulta;

/// <summary>
/// Consultas de solo lectura del panel. Todo se agrega en SQL Server; el único
/// cálculo en memoria es el cruce de las rejillas del mapa de calor.
/// </summary>
public interface ITelemetriaConsulta
{
    Task<ResumenTelemetria> ObtenerResumenAsync(DateTime desde, DateTime hasta, long descartados, int maximos, CancellationToken cancellationToken);

    Task<IReadOnlyList<HuellaErrorResumen>> ObtenerErroresAsync(string? texto, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken);

    Task<IReadOnlyList<OcurrenciaError>> ObtenerOcurrenciasAsync(string huella, int pagina, int tamano, CancellationToken cancellationToken);

    Task<IReadOnlyList<BotonResumen>> ObtenerBotonesAsync(string? ruta, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken);

    Task<MapaCalorResumen?> ObtenerMapaCalorAsync(string ruta, DateTime desde, DateTime hasta, int? viewportAncho, CancellationToken cancellationToken);

    Task<IReadOnlyList<RutaResumen>> ObtenerRutasAsync(DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken);

    Task<IReadOnlyList<HuellaErrorResumen>> ObtenerHuellasNuevasAsync(DateTime desde, int minimo, int maximo, CancellationToken cancellationToken);
}

public sealed class TelemetriaConsulta(
    ApplicationDbContext contexto,
    ILogger<TelemetriaConsulta> log) : ITelemetriaConsulta
{
    private const int MaximoErrores = 50;
    private const int MaximoBotones = 100;
    private const int MaximoMapasPorConsulta = 2_000;

    public async Task<ResumenTelemetria> ObtenerResumenAsync(DateTime desde, DateTime hasta, long descartados, int maximos, CancellationToken cancellationToken)
    {
        try
        {
            var hoy = DateTime.UtcNow.Date;
            var erroresHoy = await contexto.TelemetriaErrores.LongCountAsync(e => e.RecibidoEn >= hoy, cancellationToken);
            var errores = await contexto.TelemetriaErrores.LongCountAsync(e => e.RecibidoEn >= desde && e.RecibidoEn < hasta, cancellationToken);
            var clics = await contexto.TelemetriaClics.LongCountAsync(e => e.RecibidoEn >= desde && e.RecibidoEn < hasta, cancellationToken);
            var visitas = await contexto.TelemetriaVisitas.LongCountAsync(e => e.RecibidoEn >= desde && e.RecibidoEn < hasta, cancellationToken);

            var topErrores = await ObtenerErroresAsync(null, desde, hasta, maximos, cancellationToken);
            var topBotones = await ObtenerBotonesAsync(null, desde, hasta, maximos, cancellationToken);

            return new ResumenTelemetria(
                (int)Math.Min(erroresHoy, int.MaxValue),
                (int)Math.Min(errores, int.MaxValue),
                (int)Math.Min(clics, int.MaxValue),
                (int)Math.Min(visitas, int.MaxValue),
                descartados,
                topErrores,
                topBotones);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "No se pudo calcular el resumen de telemetría.");
            return new ResumenTelemetria(0, 0, 0, 0, descartados, [], []);
        }
    }

    public async Task<IReadOnlyList<HuellaErrorResumen>> ObtenerErroresAsync(string? texto, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT huella AS Huella,
                   MIN(tipo_error) AS TipoError,
                   MIN(mensaje) AS Mensaje,
                   MIN(ruta) AS Ruta,
                   COUNT(*) AS Ocurrencias,
                   COUNT(DISTINCT usuario_hash) AS UsuariosAfectados,
                   MIN(ocurrido_en) AS PrimeraVez,
                   MAX(ocurrido_en) AS UltimaVez
            FROM telemetria.evento_error
            WHERE recibido_en >= @desde AND recibido_en < @hasta
              AND (@texto IS NULL OR CHARINDEX(@texto, mensaje) > 0 OR huella = @texto)
            GROUP BY huella
            ORDER BY COUNT(*) DESC
            OFFSET 0 ROWS FETCH NEXT @maximo ROWS ONLY;
            """;

        return await ConsultarAsync<HuellaErrorResumen>(sql, new
        {
            desde,
            hasta,
            texto = string.IsNullOrWhiteSpace(texto) ? null : texto.Trim(),
            maximo = Math.Clamp(maximo, 1, MaximoErrores)
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<OcurrenciaError>> ObtenerOcurrenciasAsync(string huella, int pagina, int tamano, CancellationToken cancellationToken)
    {
        try
        {
            var salto = (Math.Max(pagina, 1) - 1) * Math.Clamp(tamano, 1, 100);
            return await contexto.TelemetriaErrores
                .AsNoTracking()
                .Where(e => e.Huella == huella)
                .OrderByDescending(e => e.RecibidoEn)
                .ThenByDescending(e => e.OcurridoEn)
                .Skip(salto)
                .Take(Math.Clamp(tamano, 1, 100))
                .Select(e => new OcurrenciaError(
                    e.RecibidoEn,
                    e.OcurridoEn,
                    e.Mensaje,
                    e.Stack,
                    e.Ruta,
                    e.Navegador,
                    e.UsuarioHash,
                    e.EstadoHttp,
                    e.RequestId,
                    e.Entorno))
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "No se pudieron leer las ocurrencias de {Huella}.", huella);
            return [];
        }
    }

    public async Task<IReadOnlyList<BotonResumen>> ObtenerBotonesAsync(string? ruta, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken)
    {
        const string sql = """
            WITH base AS
            (
                SELECT ruta, elemento, etiqueta, usuario_hash, ocurrido_en,
                       LAG(ocurrido_en) OVER (PARTITION BY usuario_hash, ruta, elemento ORDER BY ocurrido_en) AS anterior
                FROM telemetria.evento_clic
                WHERE recibido_en >= @desde AND recibido_en < @hasta
                  AND (@ruta IS NULL OR ruta = @ruta)
            )
            SELECT ruta AS Ruta,
                   ISNULL(elemento, '') AS Elemento,
                   MAX(etiqueta) AS Etiqueta,
                   COUNT(*) AS Clics,
                   COUNT(DISTINCT usuario_hash) AS UsuariosUnicos,
                   SUM(CASE WHEN anterior IS NOT NULL AND DATEDIFF_BIG(millisecond, anterior, ocurrido_en) < 1000 THEN 1 ELSE 0 END) AS ClicsDeEnojo,
                   MAX(ocurrido_en) AS UltimoClic
            FROM base
            GROUP BY ruta, elemento
            ORDER BY COUNT(*) DESC
            OFFSET 0 ROWS FETCH NEXT @maximo ROWS ONLY;
            """;

        return await ConsultarAsync<BotonResumen>(sql, new
        {
            desde,
            hasta,
            ruta = string.IsNullOrWhiteSpace(ruta) ? null : ruta.Trim(),
            maximo = Math.Clamp(maximo, 1, MaximoBotones)
        }, cancellationToken);
    }

    public async Task<MapaCalorResumen?> ObtenerMapaCalorAsync(string ruta, DateTime desde, DateTime hasta, int? viewportAncho, CancellationToken cancellationToken)
    {
        try
        {
            var filas = await contexto.TelemetriaMapasCalor
                .AsNoTracking()
                .Where(m => m.Ruta == ruta
                    && m.RecibidoEn >= desde
                    && m.RecibidoEn < hasta
                    && (viewportAncho == null || m.ViewportAncho == viewportAncho))
                .OrderByDescending(m => m.RecibidoEn)
                .Take(MaximoMapasPorConsulta)
                .Select(m => new { m.Columnas, m.Filas, m.TamanoCelda, m.Celdas, m.Movimientos })
                .ToListAsync(cancellationToken);

            if (filas.Count == 0)
                return null;

            // Las rejillas de distinto tamaño no se pueden sumar: se usa la más común.
            var dominante = filas
                .GroupBy(f => new { f.Columnas, f.Filas, f.TamanoCelda })
                .OrderByDescending(g => g.Count())
                .First()
                .Key;

            var total = new int[dominante.Columnas * dominante.Filas];
            long movimientos = 0;
            var usadas = 0;

            foreach (var fila in filas.Where(f =>
                         f.Columnas == dominante.Columnas
                         && f.Filas == dominante.Filas
                         && f.TamanoCelda == dominante.TamanoCelda))
            {
                var celdas = TelemetriaRepositorio.AEnteros(fila.Celdas);
                for (var i = 0; i < total.Length && i < celdas.Length; i++)
                    total[i] += celdas[i];

                movimientos += fila.Movimientos;
                usadas++;
            }

            return new MapaCalorResumen(
                ruta,
                dominante.Columnas,
                dominante.Filas,
                dominante.TamanoCelda,
                movimientos,
                usadas,
                total);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "No se pudo calcular el mapa de calor de {Ruta}.", ruta);
            return null;
        }
    }

    public async Task<IReadOnlyList<RutaResumen>> ObtenerRutasAsync(DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT ruta AS Ruta,
                   SUM(clics) AS Clics,
                   SUM(errores) AS Errores,
                   SUM(visitas) AS Visitas
            FROM
            (
                SELECT ruta, CAST(COUNT(*) AS int) AS clics, 0 AS errores, 0 AS visitas
                FROM telemetria.evento_clic
                WHERE recibido_en >= @desde AND recibido_en < @hasta
                GROUP BY ruta
                UNION ALL
                SELECT ruta, 0, CAST(COUNT(*) AS int), 0
                FROM telemetria.evento_error
                WHERE recibido_en >= @desde AND recibido_en < @hasta
                GROUP BY ruta
                UNION ALL
                SELECT ruta_entrada, 0, 0, CAST(COUNT(*) AS int)
                FROM telemetria.visita
                WHERE recibido_en >= @desde AND recibido_en < @hasta
                GROUP BY ruta_entrada
            ) AS x
            GROUP BY ruta
            ORDER BY SUM(clics) + SUM(errores) + SUM(visitas) DESC
            OFFSET 0 ROWS FETCH NEXT @maximo ROWS ONLY;
            """;

        return await ConsultarAsync<RutaResumen>(sql, new
        {
            desde,
            hasta,
            maximo = Math.Clamp(maximo, 1, 200)
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<HuellaErrorResumen>> ObtenerHuellasNuevasAsync(DateTime desde, int minimo, int maximo, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT huella AS Huella,
                   MIN(tipo_error) AS TipoError,
                   MIN(mensaje) AS Mensaje,
                   MIN(ruta) AS Ruta,
                   COUNT(*) AS Ocurrencias,
                   COUNT(DISTINCT usuario_hash) AS UsuariosAfectados,
                   MIN(ocurrido_en) AS PrimeraVez,
                   MAX(ocurrido_en) AS UltimaVez
            FROM telemetria.evento_error
            WHERE recibido_en >= @desde
            GROUP BY huella
            HAVING COUNT(*) >= @minimo
            ORDER BY COUNT(*) DESC
            OFFSET 0 ROWS FETCH NEXT @maximo ROWS ONLY;
            """;

        return await ConsultarAsync<HuellaErrorResumen>(sql, new
        {
            desde,
            minimo = Math.Max(minimo, 2),
            maximo = Math.Clamp(maximo, 1, MaximoErrores)
        }, cancellationToken);
    }

    private async Task<IReadOnlyList<T>> ConsultarAsync<T>(string sql, object parametros, CancellationToken cancellationToken)
    {
        try
        {
            var conexion = contexto.Database.GetDbConnection();
            if (conexion.State != ConnectionState.Open)
                await conexion.OpenAsync(cancellationToken);

            var filas = await conexion.QueryAsync<T>(
                new CommandDefinition(sql, parametros, cancellationToken: cancellationToken));

            return filas.AsList();
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Falló una consulta de telemetría ({Tipo}).", typeof(T).Name);
            return [];
        }
    }
}
