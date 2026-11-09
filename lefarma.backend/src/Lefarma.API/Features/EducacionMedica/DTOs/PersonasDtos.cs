using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class EjecutivoRegionDto
{
    public int IdEjecutivoRegion { get; set; }
    public int IdUsuario { get; set; }
    public string NombreUsuario { get; set; } = string.Empty;
    public int IdRegionCatalogo { get; set; }
    public string NombreRegion { get; set; } = string.Empty;
    public int IdTipoGerencia { get; set; }
    public string NombreGerencia { get; set; } = string.Empty;
    public bool Activo { get; set; }
}

public class EjecutivoSuplenteDto
{
    public int IdEjecutivoSuplente { get; set; }
    public int IdUsuario { get; set; }
    public string NombreUsuario { get; set; } = string.Empty;
    public int? IdTipoGerencia { get; set; }
    public string NombreGerencia { get; set; } = "Todas";
    public int? IdRegionCatalogo { get; set; }
    public string NombreRegion { get; set; } = "Todas";
    public bool Activo { get; set; }
}

public class CrearEjecutivoSuplenteRequest
{
    [Required(ErrorMessage = "El usuario es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El usuario es obligatorio.")]
    public int IdUsuario { get; set; }

    /// <summary>NULL = todas las gerencias.</summary>
    public int? IdTipoGerencia { get; set; }

    /// <summary>NULL = todas las regiones.</summary>
    public int? IdRegionCatalogo { get; set; }

    public bool Activo { get; set; } = true;
}

public class ActualizarEjecutivoSuplenteRequest
{
    /// <summary>NULL = todas las gerencias.</summary>
    public int? IdTipoGerencia { get; set; }

    /// <summary>NULL = todas las regiones.</summary>
    public int? IdRegionCatalogo { get; set; }

    public bool? Activo { get; set; }
}

public class CrearEjecutivoRegionRequest
{
    [Required(ErrorMessage = "El ejecutivo es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El ejecutivo es obligatorio.")]
    public int IdUsuario { get; set; }

    [Required(ErrorMessage = "La región es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La región es obligatoria.")]
    public int IdRegionCatalogo { get; set; }
}

public class ActualizarEjecutivoRegionRequest
{
    [Required(ErrorMessage = "La región es obligatoria.")]
    [Range(1, int.MaxValue, ErrorMessage = "La región es obligatoria.")]
    public int IdRegionCatalogo { get; set; }

    public bool? Activo { get; set; }
}

public class EspecialistaGerenciaDto
{
    public int IdEspecialistaGerencia { get; set; }
    public int IdTipoGerencia { get; set; }
    public string NombreGerencia { get; set; } = string.Empty;
    public bool Activo { get; set; }
}

public class EspecialistaRegionDto
{
    public int IdEspecialistaRegion { get; set; }
    public int IdRegionCatalogo { get; set; }
    public string NombreRegion { get; set; } = string.Empty;
    public bool Activo { get; set; }
}

public class EspecialistaDto
{
    public int IdUsuario { get; set; }
    public string NombreUsuario { get; set; } = string.Empty;
    public List<EspecialistaGerenciaDto> Gerencias { get; set; } = [];
    public EspecialistaRegionDto? RegionPreferida { get; set; }
    public bool Activo { get; set; }
}

public class GuardarEspecialistaRequest
{
    [Required(ErrorMessage = "El especialista es obligatorio.")]
    [Range(1, int.MaxValue, ErrorMessage = "El especialista es obligatorio.")]
    public int IdUsuario { get; set; }

    [MinLength(1, ErrorMessage = "Selecciona al menos una gerencia.")]
    public List<int> IdsTipoGerencia { get; set; } = [];

    public int? IdRegionCatalogo { get; set; }
}
