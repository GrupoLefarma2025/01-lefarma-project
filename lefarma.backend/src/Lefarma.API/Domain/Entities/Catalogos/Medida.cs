namespace Lefarma.API.Domain.Entities.Catalogos
{
    public class Medida
    {
        public int IdMedida { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public virtual ICollection<UnidadMedida> UnidadesMedida { get; set; } = new List<UnidadMedida>();
    }
}
