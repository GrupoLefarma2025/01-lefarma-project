namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class ConfigRanking
{
    public int IdConfiguracion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool Activo { get; set; }
    public DateOnly? FechaVigenciaInicio { get; set; }
    public DateOnly? FechaVigenciaFin { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public ICollection<ConfigRankingFactor> Factores { get; set; } = [];
}
