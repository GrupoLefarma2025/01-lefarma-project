namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RankingEjecucionHospital
{
    public int IdEjecucionHospital { get; set; }
    public int IdRankingEjecucion { get; set; }
    public int IdHospital { get; set; }
    public int Posicion { get; set; }
    public decimal ScoreTotal { get; set; }
    public decimal PorcentajeCompletitud { get; set; }
    public bool EsTopSugerido { get; set; }
    public string Decision { get; set; } = "SinDecision";
    public string FactoresJson { get; set; } = string.Empty;

    public RankingEjecucion Ejecucion { get; set; } = null!;
}
