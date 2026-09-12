using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class CrearEquipoPareoRequest
{
    [Required(ErrorMessage = "El ejecutivo de ventas es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El ejecutivo de ventas es obligatorio.")]
    public int IdEjecutivo { get; set; }

    [Required(ErrorMessage = "El especialista de producto es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El especialista de producto es obligatorio.")]
    public int IdEspecialista { get; set; }

    [Required(ErrorMessage = "La región del equipo es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La región del equipo es obligatoria.")]
    public int IdRegion { get; set; }

    public DateOnly? FechaInicio { get; set; }
}

public class AsignarRegionEquipoRequest
{
    [Required(ErrorMessage = "La región del equipo es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La región del equipo es obligatoria.")]
    public int IdRegion { get; set; }
}
