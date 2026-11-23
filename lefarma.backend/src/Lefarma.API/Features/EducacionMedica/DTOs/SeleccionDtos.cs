using System.ComponentModel.DataAnnotations;
using Lefarma.API.Features.Config.Workflows.DTOs;

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
    public bool TieneRutas { get; set; }

    public DateTime FechaCreacion { get; set; }
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public int? IdEstado { get; set; }
    public string? EstadoNombre { get; set; }
    public string? EstadoColor { get; set; }
    public string? PasoActualNombre { get; set; }
    public string? NombreUsuarioCreacion { get; set; }
    public List<AccionDisponibleResponse> Acciones { get; set; } = [];
    public bool PermiteEdicion { get; set; }
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
    public int? IdEquipo { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public decimal? ScoreSugerencia { get; set; }
    public string? Origen { get; set; }
    public string? TipoAlta { get; set; }
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
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public int? IdRegionCatalogo { get; set; }
    public string? Algoritmo { get; set; }
    public DateTime FechaCalculo { get; set; }
    public bool AdvertenciaMinimo { get; set; }
}

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
    [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$", ErrorMessage = "El periodo debe tener formato YYYY-MM.")]
    public string? Periodo { get; set; }

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

public class AsignarEjecutivoRegionRequest
{
    [Required(ErrorMessage = "El ejecutivo es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El ejecutivo es obligatorio.")]
    public int IdEjecutivo { get; set; }

    public int? IdEspecialista { get; set; }
}

public class AsignarEjecutivoHospitalRequest
{
    public int? IdEjecutivo { get; set; }
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

public class AgruparSeleccionResponse
{
    public List<SeleccionRegionDto> Regiones { get; set; } = [];
    public List<string> Avisos { get; set; } = [];
}
