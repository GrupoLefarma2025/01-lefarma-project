using System.Security.Claims;
using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Modelo;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Telemetria.Ingesta;

public enum ResultadoIngesta
{
    Encolado,
    Deshabilitada,
    NoDisponible,
    Rechazado
}

public sealed record RespuestaIngesta(string LoteId, ResultadoIngesta Resultado, int Eventos, string Mensaje);

public sealed class TelemetriaIngesta
{
    private const int MaximoEventosAnonimos = 5;

    private readonly TelemetriaOpciones _opciones;
    private readonly TelemetriaCola _cola;
    private readonly IAtribucionUsuario _atribucion;
    private readonly IHostEnvironment _entorno;
    private readonly ILogger<TelemetriaIngesta> _log;

    public TelemetriaIngesta(
        IOptions<TelemetriaOpciones> opciones,
        TelemetriaCola cola,
        IAtribucionUsuario atribucion,
        IHostEnvironment entorno,
        ILogger<TelemetriaIngesta> log)
    {
        _opciones = opciones.Value;
        _cola = cola;
        _atribucion = atribucion;
        _entorno = entorno;
        _log = log;
    }

    public async Task<RespuestaIngesta> IngresarAsync(SobreTelemetriaDto sobre, ClaimsPrincipal? usuario, bool anonimo, CancellationToken cancellationToken = default)
    {
        var loteId = sobre.LoteId!;

        if (!_opciones.Habilitada)
        {
            return new RespuestaIngesta(loteId, ResultadoIngesta.Deshabilitada, 0, "La telemetría está deshabilitada.");
        }

        if (anonimo && !EsAnonimoValido(sobre))
        {
            return new RespuestaIngesta(loteId, ResultadoIngesta.Rechazado, 0, "El envío anónimo solo admite errores de arranque.");
        }

        var usuarioHash = anonimo ? null : await _atribucion.ObtenerHashAsync(ObtenerIdentificador(usuario), cancellationToken);
        var rol = anonimo ? null : ObtenerRol(usuario);
        var peticion = new DatosPeticion(usuarioHash, rol, _entorno.EnvironmentName, Environment.MachineName);

        var eventos = new List<EventoTelemetria>(sobre.Eventos.Count);
        foreach (var evento in sobre.Eventos)
        {
            var mapeado = Mapear(evento);
            if (mapeado is null)
            {
                continue;
            }

            if (mapeado is not EventoError && RutaExcluida(evento.Ruta))
            {
                continue;
            }

            eventos.Add(mapeado);
        }

        if (eventos.Count == 0)
        {
            return new RespuestaIngesta(loteId, ResultadoIngesta.Encolado, 0, "Sin eventos que almacenar.");
        }

        var enviadoEn = sobre.EnviadoEn is null
            ? DateTime.UtcNow
            : Normalizar(sobre.EnviadoEn.Value);

        var lote = new LoteTelemetria(
            loteId,
            DateTime.UtcNow,
            enviadoEn,
            sobre.VisitaId,
            sobre.VersionApp,
            eventos,
            peticion);

        if (!_cola.Encolar(lote))
        {
            _log.LogWarning("La cola de telemetría está llena; se descartaron {Eventos} eventos del lote {Lote}.", eventos.Count, loteId);
            return new RespuestaIngesta(loteId, ResultadoIngesta.NoDisponible, 0, "La cola de telemetría está llena.");
        }

        return new RespuestaIngesta(loteId, ResultadoIngesta.Encolado, eventos.Count, "Recibido.");
    }

    private static bool EsAnonimoValido(SobreTelemetriaDto sobre) =>
        sobre.Eventos.Count is > 0 and <= MaximoEventosAnonimos
        && sobre.Eventos.All(evento =>
            string.Equals(evento.Tipo?.Trim(), "error", StringComparison.OrdinalIgnoreCase)
            && string.Equals(evento.TipoError?.Trim(), "arranque", StringComparison.OrdinalIgnoreCase));

    private bool RutaExcluida(string? ruta)
    {
        if (string.IsNullOrWhiteSpace(ruta))
        {
            return false;
        }

        return _opciones.RutasExcluidas.Any(excluida =>
            ruta.StartsWith(excluida, StringComparison.OrdinalIgnoreCase));
    }

    private static EventoTelemetria? Mapear(EventoTelemetriaDto evento)
    {
        var ocurridoEn = evento.OcurridoEn is null ? DateTime.UtcNow : Normalizar(evento.OcurridoEn.Value);
        var ruta = RecortarRuta(evento.Ruta!);

        return evento.Tipo!.Trim().ToLowerInvariant() switch
        {
            "error" => new EventoError(
                ocurridoEn,
                evento.TipoError!.Trim().ToLowerInvariant(),
                evento.Mensaje!,
                ruta,
                HuellaTelemetria.Calcular(evento.TipoError!, evento.Mensaje!, evento.Stack, ruta),
                evento.Stack,
                evento.Url,
                evento.MetodoHttp,
                evento.EstadoHttp,
                evento.RequestId,
                evento.Navegador,
                evento.Contexto),

            "clic" => new EventoClic(
                ocurridoEn,
                ruta,
                evento.Elemento,
                evento.Etiqueta,
                evento.TipoElemento,
                evento.X,
                evento.Y,
                evento.ViewportAncho,
                evento.ViewportAlto),

            "mapa_calor" => new EventoMapaCalor(
                ocurridoEn,
                ruta,
                evento.Celdas!.ToArray(),
                evento.Columnas ?? 0,
                evento.Filas ?? 0,
                evento.TamanoCelda ?? 0,
                evento.ViewportAncho ?? 0,
                evento.ViewportAlto ?? 0,
                evento.ScrollMax,
                evento.SegundosVisibles),

            "visita" => new EventoVisita(
                ocurridoEn,
                ruta,
                evento.Inicio,
                evento.Fin,
                evento.Segundos,
                evento.ScrollMax,
                evento.Navegador,
                evento.Sistema,
                evento.ViewportAncho,
                evento.ViewportAlto),

            _ => null
        };
    }

    private static string RecortarRuta(string ruta)
    {
        var limpia = ruta.Split('?', 2)[0].Trim();
        return limpia.Length <= 512 ? limpia : limpia[..512];
    }

    private static DateTime Normalizar(DateTime momento) =>
        momento.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(momento, DateTimeKind.Utc)
            : momento.ToUniversalTime();

    private static string? ObtenerIdentificador(ClaimsPrincipal? usuario) =>
        usuario?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? usuario?.FindFirst("sub")?.Value
        ?? usuario?.FindFirst("userId")?.Value;

    private static string? ObtenerRol(ClaimsPrincipal? usuario) =>
        usuario?.FindFirstValue(ClaimTypes.Role)
        ?? usuario?.FindFirst("role")?.Value;
}
