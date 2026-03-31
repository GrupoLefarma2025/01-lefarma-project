namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class Pago
    {
        public int IdPago { get; set; }
        public int IdOrdenCompra { get; set; }
        public decimal Monto { get; set; }
        public int IdMedioPago { get; set; }
        public string? Referencia { get; set; }
        public string? Nota { get; set; }
        public EstadoPago Estado { get; set; } = EstadoPago.Pendiente;
        public int IdUsuarioRegistra { get; set; }
        public DateTime FechaRegistro { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public virtual OrdenCompra? OrdenCompra { get; set; }
    }
}
