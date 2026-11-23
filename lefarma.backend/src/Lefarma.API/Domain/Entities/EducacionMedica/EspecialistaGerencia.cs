namespace Lefarma.API.Domain.Entities.EducacionMedica;

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
