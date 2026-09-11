namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class ParametroAnestesiaDto
{
    public int IdParametroAnestesia { get; set; }
    public int Anio { get; set; }
    public string Clave { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string? Descripcion { get; set; }
    public int Orden { get; set; }
}
