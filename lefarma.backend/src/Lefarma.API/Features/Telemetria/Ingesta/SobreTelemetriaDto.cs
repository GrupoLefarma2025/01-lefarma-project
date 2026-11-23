namespace Lefarma.API.Features.Telemetria.Ingesta;

public sealed class SobreTelemetriaDto
{
    public string? LoteId { get; set; }

    public DateTime? EnviadoEn { get; set; }

    public string? VisitaId { get; set; }

    public string? VersionApp { get; set; }

    public List<EventoTelemetriaDto> Eventos { get; set; } = [];
}

public sealed class EventoTelemetriaDto
{
    public string? Tipo { get; set; }

    public DateTime? OcurridoEn { get; set; }

    public string? Ruta { get; set; }

    public string? TipoError { get; set; }

    public string? Mensaje { get; set; }

    public string? Stack { get; set; }

    public string? Url { get; set; }

    public string? MetodoHttp { get; set; }

    public int? EstadoHttp { get; set; }

    public string? RequestId { get; set; }

    public string? Navegador { get; set; }

    public string? Contexto { get; set; }

    public string? Elemento { get; set; }

    public string? Etiqueta { get; set; }

    public string? TipoElemento { get; set; }

    public int? X { get; set; }

    public int? Y { get; set; }

    public int? ViewportAncho { get; set; }

    public int? ViewportAlto { get; set; }

    public List<int>? Celdas { get; set; }

    public int? Columnas { get; set; }

    public int? Filas { get; set; }

    public int? TamanoCelda { get; set; }

    public int? ScrollMax { get; set; }

    public int? SegundosVisibles { get; set; }

    public DateTime? Inicio { get; set; }

    public DateTime? Fin { get; set; }

    public int? Segundos { get; set; }

    public string? Sistema { get; set; }
}
