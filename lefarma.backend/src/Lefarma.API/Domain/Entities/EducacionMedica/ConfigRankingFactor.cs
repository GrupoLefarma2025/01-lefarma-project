namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class ConfigRankingFactor
{
    public int IdFactor { get; set; }
    public int IdConfiguracion { get; set; }
    public string Clave { get; set; } = string.Empty;
    public string? Grupo { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public decimal Peso { get; set; }
    public bool Activo { get; set; }
    public string? TipoNormalizacion { get; set; }
    public string? ParametrosJson { get; set; }

    public ConfigRanking Configuracion { get; set; } = null!;
}
