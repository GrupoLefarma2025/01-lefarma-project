namespace Lefarma.API.Domain.Entities.Viaticos;

/// <summary>
/// Visita de Educación Médica cubierta por una cotización de viáticos (ADR-00014).
/// Una fila por visita; varias filas por solicitud. `IdRuta`/`IdRutaVisita` son
/// referencias lógicas a educacion_medica (sin FK física para no acoplar módulos).
/// </summary>
public class SolicitudOrigenEmVisita
{
    public int IdSolicitud { get; set; }
    public int IdRuta { get; set; }
    public int IdRutaVisita { get; set; }
    public int? IdSeleccionMensual { get; set; }
    public DateTime FechaCreacion { get; set; }

    public Solicitud? Solicitud { get; set; }
}
