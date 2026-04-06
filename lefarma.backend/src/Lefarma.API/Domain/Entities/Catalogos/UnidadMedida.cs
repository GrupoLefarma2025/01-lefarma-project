namespace Lefarma.API.Domain.Entities.Catalogos {
public class UnidadMedida
    {
        public int IdUnidadMedida { get; set; }
        public int IdMedida { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public required string Abreviatura { get; set; } = null!;
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        // Navigation properties
        public virtual Medida? Medida { get; set; }
        public virtual ICollection<GastoUnidadMedida> GastoUnidadesMedida { get; set; } = new List<GastoUnidadMedida>();
    }
}
