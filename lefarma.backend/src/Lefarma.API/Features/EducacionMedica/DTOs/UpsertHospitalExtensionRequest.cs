namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class UpsertHospitalExtensionRequest
{
    public DateTime? Fecha { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public bool? ConSia { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public bool? EsZonaMetropolitana { get; set; }
    /// <summary>Clasificación del contacto (curación manual del catálogo).</summary>
    public bool? EsAlmacen { get; set; }
    public bool? EsFarmacia { get; set; }
    public bool? EsSedeTaller { get; set; }
    /// <summary>1 = aparece en el catálogo de Educación Médica.</summary>
    public bool? MostrarEducacionMedica { get; set; }
    /// <summary>Motivo de la clasificación (opcional, editable).</summary>
    public string? MotivoClasificacion { get; set; }
    /// <summary>1 = dejar el registro pendiente de revisión.</summary>
    public bool? RequiereRevision { get; set; }
}
