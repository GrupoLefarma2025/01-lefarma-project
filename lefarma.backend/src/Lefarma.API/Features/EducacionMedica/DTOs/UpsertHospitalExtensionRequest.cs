namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class UpsertHospitalExtensionRequest
{
    public DateTime? Fecha { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public bool? ConSia { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public bool? EsZonaMetropolitana { get; set; }
}
