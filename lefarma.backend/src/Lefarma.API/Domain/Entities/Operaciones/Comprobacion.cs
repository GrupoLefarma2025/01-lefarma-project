namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class Comprobacion
    {
        public int IdComprobacion { get; set; }
        public int IdOrdenCompra { get; set; }
        public TipoComprobacion Tipo { get; set; }
        public EstadoComprobacion Estado { get; set; } = EstadoComprobacion.Pendiente;

        public string? Uuid { get; set; }
        public string? RfcEmisor { get; set; }
        public string? RfcReceptor { get; set; }
        public decimal? Subtotal { get; set; }
        public decimal? TotalIva { get; set; }
        public decimal? TotalRetenciones { get; set; }
        public decimal? Total { get; set; }
        public DateTime? FechaCfdi { get; set; }

        public decimal? MontoManual { get; set; }
        public string? Descripcion { get; set; }

        public int IdUsuarioSube { get; set; }
        public int? IdUsuarioValida { get; set; }
        public string? MotivoRechazo { get; set; }
        public DateTime FechaSubida { get; set; }
        public DateTime? FechaValidacion { get; set; }

        public virtual OrdenCompra? OrdenCompra { get; set; }
    }
}
