namespace Lefarma.API.Domain.Entities.Telemetria;

public class EventoErrorTelemetria
{
    public long IdError { get; set; }
    public DateTime RecibidoEn { get; set; }
    public DateTime OcurridoEn { get; set; }
    public string LoteId { get; set; } = string.Empty;
    public string? VisitaId { get; set; }
    public string Huella { get; set; } = string.Empty;
    public string TipoError { get; set; } = string.Empty;
    public string Mensaje { get; set; } = string.Empty;
    public string? Stack { get; set; }
    public string? Url { get; set; }
    public string Ruta { get; set; } = string.Empty;
    public string? MetodoHttp { get; set; }
    public short? EstadoHttp { get; set; }
    public string? RequestId { get; set; }
    public string? Navegador { get; set; }
    public string? VersionApp { get; set; }
    public string? UsuarioHash { get; set; }
    public string? Rol { get; set; }
    public string? Contexto { get; set; }
    public string Entorno { get; set; } = string.Empty;
    public string? Servidor { get; set; }
}
