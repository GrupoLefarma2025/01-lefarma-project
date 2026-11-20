namespace Lefarma.API.Domain.Entities.Telemetria;

/// <summary>Una visita (sesión de navegación) con su entrada y duración.</summary>
public class VisitaTelemetria
{
    public long IdVisita { get; set; }
    public DateTime RecibidoEn { get; set; }
    public string LoteId { get; set; } = string.Empty;
    public string? VisitaId { get; set; }
    public string RutaEntrada { get; set; } = string.Empty;
    public DateTime? Inicio { get; set; }
    public DateTime? Fin { get; set; }
    public int? Segundos { get; set; }
    public int? ScrollMax { get; set; }
    public string? Navegador { get; set; }
    public string? Sistema { get; set; }
    public short? ViewportAncho { get; set; }
    public short? ViewportAlto { get; set; }
    public string? VersionApp { get; set; }
    public string? UsuarioHash { get; set; }
    public string? Rol { get; set; }
    public string Entorno { get; set; } = string.Empty;
    public string? Servidor { get; set; }
}
