using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

public class IncidenciaChecadoConfigResponse
{
    public int IdConfig { get; set; }
    public string Nombre { get; set; } = null!;
    public string Descripcion { get; set; } = null!;
    public string TipoIncidencia { get; set; } = null!;
    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }
    public int CantidadAcumulada { get; set; }
    public string Periodo { get; set; } = null!;
    public int Prioridad { get; set; }
    public bool RegistroEntrada { get; set; }
    public bool RegistroSalida { get; set; }
    public bool ExcluirDiasHabilesConsumenSaldo { get; set; }
    public bool Activo { get; set; }
}

public class CreateIncidenciaChecadoConfigRequest
{
    [Required, MaxLength(100)]
    public string Nombre { get; set; } = null!;

    [Required, MaxLength(500)]
    public string Descripcion { get; set; } = null!;

    [Required, MaxLength(50)]
    public string TipoIncidencia { get; set; } = null!;

    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }

    [Range(1, int.MaxValue)]
    public int CantidadAcumulada { get; set; }

    [Required, MaxLength(20)]
    public string Periodo { get; set; } = null!;

    [Range(0, int.MaxValue)]
    public int Prioridad { get; set; }

    public bool RegistroEntrada { get; set; }
    public bool RegistroSalida { get; set; }
    public bool ExcluirDiasHabilesConsumenSaldo { get; set; }

    public bool Activo { get; set; } = true;
}

public class UpdateIncidenciaChecadoConfigRequest : CreateIncidenciaChecadoConfigRequest
{
    [Required]
    public int IdConfig { get; set; }
}
