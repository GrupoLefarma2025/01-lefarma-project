namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class RegionDto
{
    public int IdRegion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public bool Activo { get; set; }
    public int CantidadHospitales { get; set; }
    public List<RegionEstadoResumenDto> Estados { get; set; } = [];
}

public class RegionEstadoResumenDto
{
    public int CodigoEstado { get; set; }
    public string? NombreEstado { get; set; }
}

public class UpsertRegionRequest
{
    public string Nombre { get; set; } = string.Empty;
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public bool? Activo { get; set; }

    /// <summary>Estados que componen la región (reemplaza el mapeo completo de la región).</summary>
    public List<int> CodigoEstados { get; set; } = [];
}

public class EstadoCatalogoDto
{
    public int CodigoEstado { get; set; }
    public string? NombreEstado { get; set; }
    public int? IdRegionActual { get; set; }
    public string? NombreRegionActual { get; set; }
}

public class SugerenciaRegionResponseDto
{
    public SugerenciaRegionOpcionDto? PorEstado { get; set; }
    public SugerenciaRegionOpcionDto? PorGps { get; set; }
}

public class SugerenciaRegionOpcionDto
{
    public int IdRegion { get; set; }
    public string NombreRegion { get; set; } = string.Empty;

    /// <summary>Distancia en km al centroide (solo para la opción por GPS).</summary>
    public double? DistanciaKm { get; set; }
}

public class AplicarMapeoResponseDto
{
    public int TotalHospitales { get; set; }
    public List<AplicarMapeoDetalleDto> Detalles { get; set; } = [];

    /// <summary>Hospitales sin región que se asignarían por cercanía al centroide de región.</summary>
    public int TotalPorGps { get; set; }
    public List<AplicarMapeoGpsDetalleDto> DetallesGps { get; set; } = [];

    /// <summary>Hospitales que quedarían sin región tras ambos pases por falta de coordenadas.</summary>
    public int SinCoordenadas { get; set; }
}

public class AplicarMapeoGpsDetalleDto
{
    public int IdRegion { get; set; }
    public string? NombreRegion { get; set; }
    public int Hospitales { get; set; }
}

public class AplicarMapeoResultadoDto
{
    public int PorEstado { get; set; }
    public int PorGps { get; set; }
    public int Total => PorEstado + PorGps;
}

public class AplicarMapeoDetalleDto
{
    public int CodigoEstado { get; set; }
    public string? NombreEstado { get; set; }
    public int IdRegion { get; set; }
    public string? NombreRegion { get; set; }
    public int Hospitales { get; set; }
}

// ---- DTOs del mapeo estado -> región ----

public class RegionEstadoDto
{
    public int CodigoEstado { get; set; }
    public string? NombreEstado { get; set; }
    public int IdRegion { get; set; }
    public string? NombreRegion { get; set; }
}

public class UpsertRegionEstadoRequest
{
    public int IdRegion { get; set; }
}

public class AsignarRegionHospitalRequest
{
    public int? IdRegion { get; set; }
}
