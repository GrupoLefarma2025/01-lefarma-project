namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Catálogo de estados de Asokam (dbo.genEstadosCat). Solo lectura para lookups.
/// </summary>
public class GenEstado
{
    public int CodigoEstado { get; set; }
    public string? NombreEstado { get; set; }
}
