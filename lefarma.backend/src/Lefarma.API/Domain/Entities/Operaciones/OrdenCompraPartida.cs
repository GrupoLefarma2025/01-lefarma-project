namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class OrdenCompraPartida
    {
        public int IdPartida { get; set; }
        public int IdOrden { get; set; }
        public int NumeroPartida { get; set; }
        public string Descripcion { get; set; } = null!;
        public decimal Cantidad { get; set; }
        public int IdUnidadMedida { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Descuento { get; set; }
        public decimal PorcentajeIva { get; set; } = 16;
        public decimal TotalRetenciones { get; set; }
        public decimal OtrosImpuestos { get; set; }
        public bool Deducible { get; set; } = true;
        // ((PrecioUnitario * Cantidad) - Descuento) * (1 + IVA/100) - Retenciones + OtrosImpuestos
        public decimal Total { get; set; }

        public virtual OrdenCompra? Orden { get; set; }
    }
}
