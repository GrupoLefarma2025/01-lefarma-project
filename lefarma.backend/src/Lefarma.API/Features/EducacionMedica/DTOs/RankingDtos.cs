using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class GenerarRankingRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "La cantidad debe ser mayor a cero.")]
    public int Cantidad { get; set; } = 64;

    [MaxLength(100, ErrorMessage = "La búsqueda no puede exceder 100 caracteres.")]
    public string? Search { get; set; }

    [MaxLength(100, ErrorMessage = "El código de estado no puede exceder 100 caracteres.")]
    public string? CodigoEstado { get; set; }

    public bool? ZonaMetropolitana { get; set; }

    /// <summary>Filtro por región asignada al hospital (regiones_cat).</summary>
    public int? IdRegion { get; set; }
}

public class AgregarHospitalesLoteRequest
{
    public int? IdRankingEjecucion { get; set; }

    [Required(ErrorMessage = "Debe enviar al menos un hospital.")]
    [MinLength(1, ErrorMessage = "Debe enviar al menos un hospital.")]
    public List<HospitalLoteItemRequest> Hospitales { get; set; } = [];
}

public class HospitalLoteItemRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int IdHospital { get; set; }

    public string? ProductoAPromocionar { get; set; }
}

public class RankingEjecucionDto
{
    public int IdRankingEjecucion { get; set; }
    public int IdSeleccionMensual { get; set; }
    public ConfigRankingResumenDto Configuracion { get; set; } = null!;
    public string VersionAlgoritmo { get; set; } = string.Empty;
    public int CantidadSolicitada { get; set; }
    public int CantidadCandidatos { get; set; }

    /// <summary>Hospitales ya agregados a la selección al momento de consultar la ejecución;
    /// el default de pre-marcado es max(0, CantidadSolicitada - CantidadYaAgregados).</summary>
    public int CantidadYaAgregados { get; set; }
    public Dictionary<string, decimal> PesosEfectivos { get; set; } = [];
    public List<RankingFactorCatalogoDto> FactoresCatalogo { get; set; } = [];
    public RankingFiltrosDto? Filtros { get; set; }
    public List<RankingHospitalItemDto> Ranking { get; set; } = [];
}

/// <summary>
/// Nombre y descripcion legibles de un factor, desde config_ranking_factores de la
/// configuracion usada por la ejecucion. Permite mostrar textos amigables en la UI
/// sin depender de las claves tecnicas.
/// </summary>
public class RankingFactorCatalogoDto
{
    public string Clave { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string? Grupo { get; set; }
}

public class RankingFiltrosDto
{
    public RankingGerenciaFiltroDto? Gerencia { get; set; }
    public bool Activo { get; set; }
    public List<string> ExcluyeTipos { get; set; } = [];
    public bool ExcluyeYaAgregados { get; set; }
    public string? Search { get; set; }
    public string? CodigoEstado { get; set; }
    public string? EstadoNombre { get; set; }
    public bool? ZonaMetropolitana { get; set; }
    public int? IdRegion { get; set; }
    public string? NombreRegion { get; set; }
    public string ReglaVersion { get; set; } = string.Empty;
}

public class RankingGerenciaFiltroDto
{
    public int Id { get; set; }
    public string Descripcion { get; set; } = string.Empty;
}

public class EstadoFiltroDto
{
    public string Codigo { get; set; } = string.Empty;
    public string? Nombre { get; set; }
}

public class FiltrosDisponiblesDto
{
    public List<EstadoFiltroDto> Estados { get; set; } = [];
    public List<RegionFiltroDto> Regiones { get; set; } = [];
    public int Locales { get; set; }
    public int Foraneos { get; set; }
    public int SinClasificacion { get; set; }
    public int TotalCandidatos { get; set; }
}

public class RegionFiltroDto
{
    public int IdRegion { get; set; }
    public string Nombre { get; set; } = string.Empty;
}

public class ConfigRankingResumenDto
{
    public int IdConfiguracion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool Activo { get; set; }
    public bool Usada { get; set; }
    public DateOnly? FechaVigenciaInicio { get; set; }
    public DateOnly? FechaVigenciaFin { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class RankingHospitalItemDto
{
    public int IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? Institucion { get; set; }
    public string? CodigoEstado { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public int Posicion { get; set; }
    public decimal ScoreTotal { get; set; }
    public decimal PorcentajeCompletitud { get; set; }
    public bool EsTopSugerido { get; set; }
    public bool? DatoCoordenadasDisponible { get; set; }
    public List<RankingFactorItemDto> Factores { get; set; } = [];
}

public class RankingFactorItemDto
{
    public string Clave { get; set; } = string.Empty;
    public string? Grupo { get; set; }
    public decimal? ValorCrudo { get; set; }
    public decimal ScoreFactor { get; set; }
    public decimal PesoConfigurado { get; set; }
    public decimal PesoEfectivo { get; set; }
    public decimal PuntosAportados { get; set; }
    public bool DatoDisponible { get; set; }
    public bool Aplicado { get; set; }
    public string? MotivoNoAplicado { get; set; }
}
