using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Consulta;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Telemetria;

/// <summary>
/// Consulta de la telemetría capturada por el navegador y de los errores que
/// ya guarda el servidor. Todo es de solo lectura.
/// </summary>
[ApiController]
[Route("api/telemetria")]
[EndpointGroupName("Telemetria")]
[HasPermission(Permissions.Telemetria.View)]
public sealed class TelemetriaConsultaController : ControllerBase
{
    private const int DiasPorDefecto = 7;

    private readonly ITelemetriaConsulta _consulta;
    private readonly TelemetriaCola _cola;
    private readonly ApplicationDbContext _contexto;

    public TelemetriaConsultaController(
        ITelemetriaConsulta consulta,
        TelemetriaCola cola,
        ApplicationDbContext contexto)
    {
        _consulta = consulta;
        _cola = cola;
        _contexto = contexto;
    }

    [HttpGet("resumen")]
    public async Task<IActionResult> Resumen(
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken cancellationToken)
    {
        var (inicio, fin) = Rango(desde, hasta);
        var descartados = _cola.ObtenerEstado().Descartados;
        var resumen = await _consulta.ObtenerResumenAsync(inicio, fin, descartados, 10, cancellationToken);
        return Ok(Respuesta(resumen, "Resumen de telemetría."));
    }

    [HttpGet("errores-navegador")]
    public async Task<IActionResult> ErroresNavegador(
        [FromQuery] string? texto,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken cancellationToken)
    {
        var (inicio, fin) = Rango(desde, hasta);
        var errores = await _consulta.ObtenerErroresAsync(texto, inicio, fin, 50, cancellationToken);
        return Ok(Respuesta(errores, "Errores agrupados por huella."));
    }

    [HttpGet("errores-navegador/{huella}/ocurrencias")]
    public async Task<IActionResult> Ocurrencias(
        string huella,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamano = 20,
        CancellationToken cancellationToken = default)
    {
        var ocurrencias = await _consulta.ObtenerOcurrenciasAsync(huella, pagina, tamano, cancellationToken);
        return Ok(Respuesta(ocurrencias, "Ocurrencias del error."));
    }

    [HttpGet("botones")]
    public async Task<IActionResult> Botones(
        [FromQuery] string? ruta,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken cancellationToken)
    {
        var (inicio, fin) = Rango(desde, hasta);
        var botones = await _consulta.ObtenerBotonesAsync(ruta, inicio, fin, 100, cancellationToken);
        return Ok(Respuesta(botones, "Clics agrupados por botón."));
    }

    [HttpGet("mapa-calor")]
    public async Task<IActionResult> MapaCalor(
        [FromQuery] string ruta,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int? viewportAncho,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(ruta))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La ruta es obligatoria."
            });
        }

        var (inicio, fin) = Rango(desde, hasta);
        var mapa = await _consulta.ObtenerMapaCalorAsync(ruta, inicio, fin, viewportAncho, cancellationToken);
        if (mapa is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "No hay movimientos registrados para esa ruta en el periodo."
            });
        }

        return Ok(Respuesta(mapa, "Mapa de calor de la ruta."));
    }

    [HttpGet("rutas")]
    public async Task<IActionResult> Rutas(
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        CancellationToken cancellationToken)
    {
        var (inicio, fin) = Rango(desde, hasta);
        var rutas = await _consulta.ObtenerRutasAsync(inicio, fin, 100, cancellationToken);
        return Ok(Respuesta(rutas, "Rutas con actividad."));
    }

    /// <summary>
    /// Errores que ya guarda el servidor en <c>ErrorLog</c> (SQL Server). Es la
    /// vista de lo que hoy existe, sin duplicarlo en la telemetría.
    /// </summary>
    [HttpGet("errores-servidor")]
    public async Task<IActionResult> ErroresServidor(
        [FromQuery] string? severidad,
        [FromQuery] string? texto,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamano = 20,
        CancellationToken cancellationToken = default)
    {
        var (inicio, fin) = Rango(desde, hasta);
        pagina = Math.Max(1, pagina);
        tamano = Math.Clamp(tamano, 1, 100);

        var consulta = _contexto.ErrorLogs
            .AsNoTracking()
            .Where(e => e.FechaError >= inicio && e.FechaError < fin);

        if (!string.IsNullOrWhiteSpace(severidad))
        {
            consulta = consulta.Where(e => e.Severidad == severidad);
        }

        if (!string.IsNullOrWhiteSpace(texto))
        {
            var buscado = texto.Trim();
            consulta = consulta.Where(e =>
                e.MensajeError.Contains(buscado) || e.TipoExcepcion.Contains(buscado));
        }

        var total = await consulta.CountAsync(cancellationToken);
        var elementos = await consulta
            .OrderByDescending(e => e.FechaError)
            .Skip((pagina - 1) * tamano)
            .Take(tamano)
            .Select(e => new ErrorServidorResumen(
                e.IdErrorLog,
                e.FechaError,
                e.Severidad,
                e.TipoExcepcion,
                e.MensajeError,
                e.RutaEndpoint,
                e.MetodoHttp,
                e.StatusCode,
                e.NombreUsuario,
                e.DurationMs,
                e.RequestId))
            .ToListAsync(cancellationToken);

        var resultado = new PaginaErrorServidor(total, pagina, tamano, elementos);
        return Ok(Respuesta(resultado, "Errores guardados por el servidor."));
    }

    private static (DateTime Inicio, DateTime Fin) Rango(DateTime? desde, DateTime? hasta)
    {
        var fin = hasta ?? DateTime.UtcNow;
        var inicio = desde ?? fin.AddDays(-DiasPorDefecto);
        return inicio < fin ? (inicio, fin) : (fin.AddDays(-DiasPorDefecto), fin);
    }

    private static ApiResponse<T> Respuesta<T>(T datos, string mensaje) =>
        new() { Success = true, Message = mensaje, Data = datos };
}
