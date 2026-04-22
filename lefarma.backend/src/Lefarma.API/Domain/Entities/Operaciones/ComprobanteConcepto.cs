namespace Lefarma.API.Domain.Entities.Operaciones;

public class ComprobanteConcepto
{
    public int IdConcepto { get; set; }
    public int IdComprobante { get; set; }
    public int NumeroConcepto { get; set; }

    public string? ClaveProdServ { get; set; }
    public string? ClaveUnidad { get; set; }
    public string Descripcion { get; set; } = null!;
    public decimal Cantidad { get; set; }
    public decimal ValorUnitario { get; set; }
    public decimal Descuento { get; set; }
    public decimal Importe { get; set; }
    public decimal? TasaIva { get; set; }
    public decimal? ImporteIva { get; set; }

    // Acumulados actualizados por el servicio al asignar partidas
    public decimal CantidadAsignada { get; set; }
    public decimal ImporteAsignado { get; set; }

    // Navigation
    public virtual Comprobante? Comprobante { get; set; }
    public virtual ICollection<ComprobantePartida> Asignaciones { get; set; } = [];
}
