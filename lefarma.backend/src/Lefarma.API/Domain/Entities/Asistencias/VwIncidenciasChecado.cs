using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Domain.Entities.Asistencias;

[Keyless]
public class VwIncidenciasChecado
{
    public DateTime Fecha { get; set; }
    public long? Nomina { get; set; }
    public string Nombre { get; set; } = null!;
    public string? Empresa { get; set; }
    public string? Departamento { get; set; }
    public string? Puesto { get; set; }
    public string? Checa { get; set; }
    public string? NombreDiaSemana { get; set; }
    public int? DiaSemana { get; set; }
    public string? Turno { get; set; }
    public string? Horario { get; set; }
    public TimeSpan? Entrada { get; set; }
    public TimeSpan? Salida { get; set; }
    public TimeSpan? Entro { get; set; }
    public TimeSpan? Salio { get; set; }
    public string? MsgError { get; set; }
    public string? IncidenciaEntrada { get; set; }
    public string? IncidenciaSalida { get; set; }
}
