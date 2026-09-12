namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class ParametroModuloDto
{
    public string Clave { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string? Descripcion { get; set; }
}

public class UpsertParametroModuloRequest
{
    [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "La clave es obligatoria.")]
    public string Clave { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Range(0, double.MaxValue, ErrorMessage = "El valor debe ser positivo.")]
    public decimal Valor { get; set; }
}
