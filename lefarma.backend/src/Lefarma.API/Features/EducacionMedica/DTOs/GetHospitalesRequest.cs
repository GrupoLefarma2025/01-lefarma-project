namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class GetHospitalesRequest
{
    public string? Search { get; set; }
    public string? ModoInstitucion { get; set; }
    public bool? ConSia { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public int? NumeroQuirofanosMin { get; set; }
    public decimal? AnestesiasTotalesMin { get; set; }
    public bool? Activo { get; set; }
    public bool? TieneCoordenadas { get; set; }

    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
