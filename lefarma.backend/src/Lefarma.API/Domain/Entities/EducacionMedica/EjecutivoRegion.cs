namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Región(es) asignada(s) a un ejecutivo de ventas (ADR-00015). La gerencia
/// del ejecutivo se deriva de <see cref="RegionCatalogo.IdTipoGerencia"/>.
/// </summary>
public class EjecutivoRegion
{
    public int IdEjecutivoRegion { get; set; }
    public int IdUsuario { get; set; }
    public int IdRegionCatalogo { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RegionCatalogo? Region { get; set; }
}
