namespace Lefarma.API.Features.Telemetria.Modelo;

/// <summary>
/// Evento ya normalizado por el servidor, listo para el almacén. La carga útil del
/// navegador se convierte a estos tipos en la ingesta, no aquí.
/// </summary>
public abstract record EventoTelemetria(DateTime OcurridoEn);

/// <summary>Error del navegador, empaquetado o de una petición HTTP fallida.</summary>
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

/// <summary>Clic en un botón, enlace o elemento de menú.</summary>
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

/// <summary>Rejilla de calor acumulada por visita; una fila por rejilla cerrada.</summary>
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

/// <summary>Resumen de una visita terminada.</summary>
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
