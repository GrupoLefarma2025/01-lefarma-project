namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class ParametroAnestesia
{
    public int IdParametroAnestesia { get; set; }
    public int Anio { get; set; }
    public string Clave { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string? Descripcion { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
