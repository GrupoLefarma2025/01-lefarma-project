namespace Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

public class IncidenciaChecadoResponse
{
    public DateTime Fecha { get; set; }
    public long? Nomina { get; set; }
    public string Nombre { get; set; } = string.Empty;
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
    public bool Justificada { get; set; }
    public int? IdSolicitud { get; set; }
    public string? TipoSolicitudNombre { get; set; }
}

public class IncidenciasChecadoRequest
{
    public int? Anio { get; set; }
    public int? Mes { get; set; }
    public DateTime? FechaDesde { get; set; }
    public DateTime? FechaHasta { get; set; }
    public TimeSpan? HoraEntradaDesde { get; set; }
    public TimeSpan? HoraEntradaHasta { get; set; }
    public TimeSpan? HoraSalidaDesde { get; set; }
    public TimeSpan? HoraSalidaHasta { get; set; }
    public string? Nombre { get; set; }
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
}

public class IncidenciasChecadoConsultaRequest
{
    public int? Anio { get; set; }
    public int? Mes { get; set; }
    public int? Dia { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFin { get; set; }
    public long? Nomina { get; set; }
    public string? Nombre { get; set; }
    public string? Empresa { get; set; }
    public string? Departamento { get; set; }
    public string? Puesto { get; set; }
    public bool TieneIncidenciaEntrada { get; set; } = true;
    public bool TieneIncidenciaSalida { get; set; } = true;
    public bool TieneIncidenciaOmision { get; set; } = true;
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class IncidenciasChecadoResumenEmpleadoRequest
{
    public string? Periodo { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFin { get; set; }
    public long? Nomina { get; set; }
    public string? Nombre { get; set; }
    public string? Empresa { get; set; }
    public string? Departamento { get; set; }
    public string? Puesto { get; set; }
    public bool TieneIncidenciaEntrada { get; set; } = true;
    public bool TieneIncidenciaSalida { get; set; } = true;
    public bool TieneIncidenciaOmision { get; set; } = true;
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class IncidenciasChecadoResumenEmpleadoResponse
{
    public long Nomina { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Empresa { get; set; }
    public string? Departamento { get; set; }
    public string? Puesto { get; set; }
    public int TotalIncidencias { get; set; }
    public int Tardanzas { get; set; }
    public int SalidasAnticipadas { get; set; }
    public int Omisiones { get; set; }
    public int Justificadas { get; set; }
    public int Pendientes { get; set; }
}
