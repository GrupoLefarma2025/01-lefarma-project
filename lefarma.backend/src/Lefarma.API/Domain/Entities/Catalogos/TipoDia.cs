namespace Lefarma.API.Domain.Entities.Catalogos
{
    public class TipoDia
    {
        public int IdTipoDia { get; set; }
        public string Clave { get; set; } = null!;
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
    }
}
