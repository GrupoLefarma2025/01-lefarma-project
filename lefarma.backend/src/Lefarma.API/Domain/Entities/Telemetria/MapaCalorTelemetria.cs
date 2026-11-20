namespace Lefarma.API.Domain.Entities.Telemetria;

/// <summary>
/// Rejilla de posiciones del puntero de una vista de página. <see cref="Celdas"/>
/// guarda un entero de 32 bits por celda (columnas * filas), en little-endian.
/// </summary>
public class MapaCalorTelemetria
{
    public long IdMapa { get; set; }
    public DateTime RecibidoEn { get; set; }
    public DateTime OcurridoEn { get; set; }
    public string LoteId { get; set; } = string.Empty;
    public string? VisitaId { get; set; }
    public string Ruta { get; set; } = string.Empty;
    public short Columnas { get; set; }
    public short Filas { get; set; }
    public byte TamanoCelda { get; set; }
    public byte[] Celdas { get; set; } = [];
    public int Movimientos { get; set; }
    public int? ScrollMax { get; set; }
    public int? SegundosVisibles { get; set; }
    public short? ViewportAncho { get; set; }
    public short? ViewportAlto { get; set; }
    public string? VersionApp { get; set; }
    public string? UsuarioHash { get; set; }
    public string? Rol { get; set; }
    public string Entorno { get; set; } = string.Empty;
    public string? Servidor { get; set; }
}
