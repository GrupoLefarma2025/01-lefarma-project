namespace Lefarma.API.Domain.Entities.Telemetria;

public class EventoClicTelemetria
{
    public long IdClic { get; set; }
    public DateTime RecibidoEn { get; set; }
    public DateTime OcurridoEn { get; set; }
    public string LoteId { get; set; } = string.Empty;
    public string? VisitaId { get; set; }
    public string Ruta { get; set; } = string.Empty;
    public string? Elemento { get; set; }
    public string? Etiqueta { get; set; }
    public string? TipoElemento { get; set; }
    public int? X { get; set; }
    public int? Y { get; set; }
    public short? ViewportAncho { get; set; }
    public short? ViewportAlto { get; set; }
    public string? VersionApp { get; set; }
    public string? UsuarioHash { get; set; }
    public string? Rol { get; set; }
    public string Entorno { get; set; } = string.Empty;
    public string? Servidor { get; set; }
}
