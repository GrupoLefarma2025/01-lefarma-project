namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RankingEjecucion
{
    public int IdRankingEjecucion { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int IdConfiguracion { get; set; }
    public string VersionAlgoritmo { get; set; } = "scoring-v1.0";
    public int CantidadSolicitada { get; set; }
    public int CantidadCandidatos { get; set; }
    public string PesosEfectivosJson { get; set; } = string.Empty;
    public string? FiltrosJson { get; set; }
    public DateTime FechaEjecucion { get; set; }
    public int? IdUsuarioEjecucion { get; set; }

    public ConfigRanking Configuracion { get; set; } = null!;
    public ICollection<RankingEjecucionHospital> Hospitales { get; set; } = [];
}
