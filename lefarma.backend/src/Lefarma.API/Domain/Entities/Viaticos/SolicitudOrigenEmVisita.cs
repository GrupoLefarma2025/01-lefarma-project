namespace Lefarma.API.Domain.Entities.Viaticos;

public class SolicitudOrigenEmVisita
{
    public int IdSolicitud { get; set; }
    public int IdRuta { get; set; }
    public int IdRutaVisita { get; set; }
    public int? IdSeleccionMensual { get; set; }
    public DateTime FechaCreacion { get; set; }

    public Solicitud? Solicitud { get; set; }
}
