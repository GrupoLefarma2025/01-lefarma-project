using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class SeleccionMensualDto
{
    public int IdSeleccionMensual { get; set; }
    public DateOnly FechaSeleccion { get; set; }
    public int? IdTipoGerencia { get; set; }
    public string? TipoGerencia { get; set; }
    public DateOnly? FechaInicioVigencia { get; set; }
    public DateOnly? FechaFinVigencia { get; set; }
    public int? TalleresObjetivoMes { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime? FirmaGvFecha { get; set; }
    public DateTime? FirmaGgFecha { get; set; }
    public int TotalHospitales { get; set; }
    public int TotalRegiones { get; set; }
}

public class SeleccionHospitalDto
{
    public int IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? Region { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public string? Institucion { get; set; }
    public int? NumeroQuirofanos { get; set; }
    public decimal? AnestesiasTotales { get; set; }
    public string? ProductoAPromocionar { get; set; }
    public string? Observaciones { get; set; }
    public decimal? LatitudSnapshot { get; set; }
    public decimal? LongitudSnapshot { get; set; }
    public int? IdRegion { get; set; }
    public string? NombreRegion { get; set; }
    public decimal? ScoreSugerencia { get; set; }
    public string Origen { get; set; } = "Manual";
}

public class SeleccionRegionDto
{
    public int IdRegion { get; set; }
    public string? Nombre { get; set; }
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public int CantidadHospitales { get; set; }
    public int? IdEquipo { get; set; }
    public string? NombreEquipo { get; set; }
    public int? IdRegionCatalogo { get; set; }
    public string? Algoritmo { get; set; }
    public DateTime FechaCalculo { get; set; }
    public bool AdvertenciaMinimo { get; set; }
}

/// <summary>
/// Hospital que pertenece a otra seleccion (otra gerencia, vigencia solapada)
/// y esta cerca de algun hospital de la seleccion actual: por distancia
/// (<= radio_clustering_km), mismo estado o misma ciudad. Uso: coordinacion de viajes.
/// </summary>
public class HospitalCercanoOtraSeleccionDto
{
    public int IdSeleccionHospitalAjeno { get; set; }
    public int? IdHospital { get; set; }
    public string? NombreHospital { get; set; }
    public string? GerenciaOrigen { get; set; }
    public int IdSeleccionMensualOrigen { get; set; }
    public DateOnly FechaSeleccionOrigen { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public decimal? Latitud { get; set; }
    public decimal? Longitud { get; set; }
    public decimal? DistanciaKm { get; set; }
    public string Criterio { get; set; } = string.Empty;
    public int? IdSeleccionHospitalCercano { get; set; }
    public string? NombreHospitalCercano { get; set; }
}

public class SeleccionDetalleDto : SeleccionMensualDto
{
    public List<SeleccionHospitalDto> Hospitales { get; set; } = [];
    public List<SeleccionRegionDto> Regiones { get; set; } = [];
}

public class CrearSeleccionMensualRequest
{
    [Required(ErrorMessage = "La fecha de selección es obligatoria.")]
    public DateOnly FechaSeleccion { get; set; }

    public int? IdTipoGerencia { get; set; }

    [Required(ErrorMessage = "La fecha de inicio de vigencia es obligatoria.")]
    public DateOnly FechaInicioVigencia { get; set; }

    [Required(ErrorMessage = "La fecha de fin de vigencia es obligatoria.")]
    public DateOnly FechaFinVigencia { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "El objetivo de talleres debe ser mayor a cero.")]
    public int? TalleresObjetivoMes { get; set; }
}

public class AgregarHospitalSeleccionRequest
{
    [Required(ErrorMessage = "El hospital es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El hospital es obligatorio.")]
    public int IdHospital { get; set; }

    public string? ProductoAPromocionar { get; set; }

    public string? Observaciones { get; set; }
}

public class AsignarEquipoRegionRequest
{
    [Required(ErrorMessage = "El equipo es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El equipo es obligatorio.")]
    public int IdEquipo { get; set; }
}

public class MoverHospitalARegionRequest
{
    [Required(ErrorMessage = "La región es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La región es obligatoria.")]
    public int IdRegion { get; set; }
}

public class DividirRegionRequest
{
    [Required(ErrorMessage = "El motivo de la división es obligatorio.")]
    [MinLength(5, ErrorMessage = "El motivo de la división es obligatorio.")]
    public string Motivo { get; set; } = string.Empty;
}

public class AutorizarSeleccionRequest
{
    [Required(ErrorMessage = "El rol de la firma es obligatorio (GV o GG).")]
    [RegularExpression("^(GV|GG)$", ErrorMessage = "El rol de la firma debe ser GV o GG.")]
    public string Rol { get; set; } = string.Empty;
}

public class AgruparSeleccionResponse
{
    public List<SeleccionRegionDto> Regiones { get; set; } = [];
    public List<string> Avisos { get; set; } = [];
}
