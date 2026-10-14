namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Entrada de la bitácora de ajustes post-cierre (ADR-00010).</summary>
public class AjustePostCierreDto
{
    public int IdAjuste { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int IdEntidad { get; set; }
    public string Accion { get; set; } = string.Empty;
    public string? ValoresAntes { get; set; }
    public string? ValoresDespues { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public DateTime FechaAjuste { get; set; }
}
