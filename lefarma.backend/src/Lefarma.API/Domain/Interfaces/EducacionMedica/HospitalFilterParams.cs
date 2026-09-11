namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public class HospitalFilterParams
{
    public string? Search { get; set; }
    public string? ModoInstitucion { get; set; }
    public bool? ConSia { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegion { get; set; }
    public int? NumeroQuirofanosMin { get; set; }
    public decimal? AnestesiasTotalesMin { get; set; }
    public bool? Activo { get; set; }

    /// <summary>
    /// true = solo hospitales con coordenadas validas (latitud/longitud no nulas
    /// y no ambas en 0); false = solo los que no tienen. null = sin filtro.
    /// </summary>
    public bool? TieneCoordenadas { get; set; }

    /// <summary>Valores de Tipo a excluir (regla de elegibilidad explícita por consumidor).</summary>
    public List<string>? ExcluirTipos { get; set; }

    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
