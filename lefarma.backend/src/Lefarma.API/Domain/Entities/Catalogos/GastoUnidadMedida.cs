namespace Lefarma.API.Domain.Entities.Catalogos {
public class GastoUnidadMedida
    {
        public int IdGasto { get; set; }
        public int IdUnidadMedida { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }

        // Navigation properties
        public virtual Gasto? Gasto { get; set; }
        public virtual UnidadMedida? UnidadMedida { get; set; }
    }
}
