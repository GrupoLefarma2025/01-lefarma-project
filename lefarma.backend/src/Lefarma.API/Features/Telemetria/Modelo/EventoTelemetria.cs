namespace Lefarma.API.Features.Telemetria.Modelo;

public abstract record EventoTelemetria(DateTime OcurridoEn);

public sealed record EventoError(
    DateTime OcurridoEn,
    string TipoError,
    string Mensaje,
    string Ruta,
    string Huella,
    string? Stack = null,
    string? Url = null,
    string? MetodoHttp = null,
    int? EstadoHttp = null,
    string? RequestId = null,
    string? Navegador = null,
    string? Contexto = null) : EventoTelemetria(OcurridoEn);

public sealed record EventoClic(
    DateTime OcurridoEn,
    string Ruta,
    string? Elemento = null,
    string? Etiqueta = null,
    string? TipoElemento = null,
    int? X = null,
    int? Y = null,
    int? ViewportAncho = null,
    int? ViewportAlto = null) : EventoTelemetria(OcurridoEn);

public sealed record EventoMapaCalor(
    DateTime OcurridoEn,
    string Ruta,
    int[] Celdas,
    int Columnas,
    int Filas,
    int TamanoCelda,
    int ViewportAncho,
    int ViewportAlto,
    int? ScrollMax = null,
    int? SegundosVisibles = null) : EventoTelemetria(OcurridoEn);

public sealed record EventoVisita(
    DateTime OcurridoEn,
    string RutaEntrada,
    DateTime? Inicio = null,
    DateTime? Fin = null,
    int? Segundos = null,
    int? ScrollMax = null,
    string? Navegador = null,
    string? Sistema = null,
    int? ViewportAncho = null,
    int? ViewportAlto = null) : EventoTelemetria(OcurridoEn);
