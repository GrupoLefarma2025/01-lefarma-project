namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RutaVisita
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    /// <summary>Hospital de la selección que origina la visita; NULL en visitas extraordinarias (ADR-00011).</summary>
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public TimeOnly? HoraSalida { get; set; }
    public TimeOnly? HoraLlegada { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
    /// <summary>1 = visita extraordinaria: hospital del catálogo fuera de la selección (ADR-00011).</summary>
    public bool EsExtraordinaria { get; set; }
}
