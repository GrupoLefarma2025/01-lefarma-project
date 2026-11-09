namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Gerencia que puede atender un especialista de producto (ADR-00015).
/// La ausencia de filas se interpreta como NO elegible.
/// </summary>
public class EspecialistaGerencia
{
    public int IdEspecialistaGerencia { get; set; }
    public int IdUsuario { get; set; }
    public int IdTipoGerencia { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public TipoGerencia? TipoGerencia { get; set; }
}
