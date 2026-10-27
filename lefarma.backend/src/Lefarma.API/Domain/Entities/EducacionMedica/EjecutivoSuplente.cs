namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Usuario que puede cubrir como ejecutivo de ventas cuando una región no tiene
/// ejecutivo primario (ADR-00015). Null en gerencia/región = cobertura total.
/// El motor busca primero un <see cref="EjecutivoRegion"/> activo.
/// </summary>
public class EjecutivoSuplente
{
    public int IdEjecutivoSuplente { get; set; }
    public int IdUsuario { get; set; }
    public int? IdTipoGerencia { get; set; }
    public int? IdRegionCatalogo { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public TipoGerencia? TipoGerencia { get; set; }
    public RegionCatalogo? Region { get; set; }
}
