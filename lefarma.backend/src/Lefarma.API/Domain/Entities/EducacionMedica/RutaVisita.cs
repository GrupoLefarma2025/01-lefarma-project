namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class RutaVisita
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public int IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int Orden { get; set; }
    public TimeOnly? HoraSalida { get; set; }
    public TimeOnly? HoraLlegada { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }
}
