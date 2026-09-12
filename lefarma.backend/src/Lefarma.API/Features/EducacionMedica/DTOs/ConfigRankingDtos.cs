using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class ConfigRankingDto
{
    public int IdConfiguracion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool Activo { get; set; }
    public bool Usada { get; set; }
    public DateOnly? FechaVigenciaInicio { get; set; }
    public DateOnly? FechaVigenciaFin { get; set; }
    public DateTime FechaCreacion { get; set; }
    public List<ConfigRankingFactorDto> Factores { get; set; } = [];
}

public class ConfigRankingConVersionesDto : ConfigRankingDto
{
    public List<ConfigRankingVersionDto> Versiones { get; set; } = [];
}

public class ConfigRankingFactorDto
{
    public int IdFactor { get; set; }
    public string Clave { get; set; } = string.Empty;
    public string? Grupo { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public decimal Peso { get; set; }
    public bool Activo { get; set; }
    public string? TipoNormalizacion { get; set; }
    public string? ParametrosJson { get; set; }
}

public class ConfigRankingVersionDto
{
    public int IdConfiguracion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class UpsertConfigRankingRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; }

    [Required(ErrorMessage = "Debe enviar al menos un factor.")]
    [MinLength(1)]
    public List<UpsertConfigRankingFactorRequest> Factores { get; set; } = [];
}

public class UpsertConfigRankingFactorRequest
{
    [Required]
    [MaxLength(50)]
    public string Clave { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Grupo { get; set; }

    [Required(ErrorMessage = "El nombre del factor es obligatorio.")]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "La descripcion del factor es obligatoria.")]
    [MaxLength(300)]
    public string Descripcion { get; set; } = string.Empty;

    [Range(0, 100, ErrorMessage = "El peso debe estar entre 0 y 100.")]
    public decimal Peso { get; set; }

    public bool Activo { get; set; } = true;

    [MaxLength(30)]
    public string? TipoNormalizacion { get; set; }

    public string? ParametrosJson { get; set; }
}
