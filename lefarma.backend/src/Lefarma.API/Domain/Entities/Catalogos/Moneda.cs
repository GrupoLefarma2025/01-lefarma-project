namespace Lefarma.API.Domain.Entities.Catalogos
{
    public class Moneda
    {
        public int IdMoneda { get; set; }
        public string Codigo { get; set; } = null!;        
        public string Nombre { get; set; } = null!;        
        public string Simbolo { get; set; } = null!;       
        public string Locale { get; set; } = null!;        
        public decimal TipoCambio { get; set; } = 1;       
        public bool PosicionIzquierda { get; set; } = true;
        public bool EsDefault { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
