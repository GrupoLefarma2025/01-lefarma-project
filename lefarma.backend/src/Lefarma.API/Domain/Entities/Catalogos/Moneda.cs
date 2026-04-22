namespace Lefarma.API.Domain.Entities.Catalogos
{
    public class Moneda
    {
        public int IdMoneda { get; set; }
        public string Codigo { get; set; } = null!;        // ISO 4217: MXN, USD, HNL
        public string Nombre { get; set; } = null!;        // "Peso Mexicano"
        public string Simbolo { get; set; } = null!;       // "$", "L", "€"
        public string Locale { get; set; } = null!;        // "es-MX", "en-US"
        public decimal TipoCambio { get; set; } = 1;       // Relativo a la moneda base
        public bool EsDefault { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
