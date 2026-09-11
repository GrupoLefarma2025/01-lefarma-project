namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class SeleccionHospital
{
    public int IdSeleccionHospital { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int? IdHospital { get; set; }
    public string? Region { get; set; }
    public string? EntidadFederativa { get; set; }
    public string? CiudadMunicipio { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? ProductoAPromocionar { get; set; }
    public string? Observaciones { get; set; }
    public decimal? LatitudSnapshot { get; set; }
    public decimal? LongitudSnapshot { get; set; }
    public int? IdRegion { get; set; }
    public string? Origen { get; set; }
    public int? IdRankingEjecucion { get; set; }
    public decimal? ScoreSugerencia { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public RankingEjecucion? Ejecucion { get; set; }
}
