namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class UpsertHospitalExtensionRequest
{
    public DateTime? Fecha { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public bool? ConSia { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public bool? EsZonaMetropolitana { get; set; }
    public bool? EsAlmacen { get; set; }
    public bool? EsFarmacia { get; set; }
    public bool? EsSedeTaller { get; set; }
    public bool? MostrarEducacionMedica { get; set; }
    public string? MotivoClasificacion { get; set; }
    public bool? RequiereRevision { get; set; }
}
