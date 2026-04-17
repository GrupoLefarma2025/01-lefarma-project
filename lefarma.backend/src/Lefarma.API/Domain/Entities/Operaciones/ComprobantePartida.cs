namespace Lefarma.API.Domain.Entities.Operaciones;

/// <summary>
/// Tabla puente entre comprobante y partida de orden de compra.
/// id_concepto es NULL para comprobantes sin CFDI (ticket, nota, recibo).
/// </summary>
public class ComprobantePartida
{
    public int IdAsignacion { get; set; }
    public int IdComprobante { get; set; }
    public int? IdConcepto { get; set; }      // NULL para comprobantes sin CFDI
    public int IdPartida { get; set; }
    public int IdUsuarioAsigno { get; set; }
    public int? IdPasoWorkflow { get; set; }

    public decimal CantidadAsignada { get; set; }
    public decimal ImporteAsignado { get; set; }

    public string? Notas { get; set; }
    public DateTime FechaAsignacion { get; set; }

    // Navigation
    public virtual Comprobante? Comprobante { get; set; }
    public virtual ComprobanteConcepto? Concepto { get; set; }
    public virtual OrdenCompraPartida? Partida { get; set; }
}
