namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class TipoGerenciaDto
{
    public int IdTipoGerencia { get; set; }
    public string Descripcion { get; set; } = string.Empty;

    /// <summary>Hospitales con extensión activa asignados a esta gerencia.</summary>
    public int TotalHospitales { get; set; }
}
