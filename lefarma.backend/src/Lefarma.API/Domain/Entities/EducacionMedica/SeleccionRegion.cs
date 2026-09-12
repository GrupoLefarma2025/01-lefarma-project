namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class SeleccionRegion
{
    public int IdRegion { get; set; }
    public int IdSeleccionMensual { get; set; }
    public string? Nombre { get; set; }
    public decimal? CentroLatitud { get; set; }
    public decimal? CentroLongitud { get; set; }
    public int CantidadHospitales { get; set; }
    public string? Algoritmo { get; set; }
    public DateTime FechaCalculo { get; set; }
    public int? IdEquipo { get; set; }
    public int? IdRegionCatalogo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
