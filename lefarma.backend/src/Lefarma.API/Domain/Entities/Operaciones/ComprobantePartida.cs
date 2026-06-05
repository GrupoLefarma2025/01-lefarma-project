namespace Lefarma.API.Domain.Entities.Operaciones;

public class ComprobantePartida
{
    public int IdAsignacion { get; set; }
    public int IdComprobante { get; set; }
    public int IdPartida { get; set; }
    public int IdUsuarioAsigno { get; set; }
    public int? IdPasoWorkflow { get; set; }

    public decimal CantidadAsignada { get; set; }
    public decimal ImporteAsignado { get; set; }

    public string? Notas { get; set; }
    public DateTime FechaAsignacion { get; set; }

    public virtual Comprobante? Comprobante { get; set; }
    public virtual OrdenCompraPartida? Partida { get; set; }
}
