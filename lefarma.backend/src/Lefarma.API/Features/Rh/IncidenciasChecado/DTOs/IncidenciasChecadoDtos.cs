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
    public List<IncidenciaCalculadaDto> IncidenciasCalculadas { get; set; } = new();
    public bool Justificada { get; set; }
    public bool EnTramite { get; set; }
    public bool Descuento { get; set; }
    public int? IdSolicitud { get; set; }
    public string? TipoSolicitudNombre { get; set; }
}

public class IncidenciaCalculadaDto
{
    public string TipoIncidencia { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public bool GeneraDescuento { get; set; }

    // Marca que tendría la incidencia si el día no estuviera justificado; se usa para
    // contabilizar el tope de descuentos justificados por mes.
    public bool GeneraDescuentoTeorico { get; set; }

    // Cuántas incidencias del mismo tipo/periodo generan un descuento (N de la regla).
    public int CantidadAcumulada { get; set; }

    // Posición del día entre los no justificados del periodo (1, 2, 3...). Null si el
    // día está justificado y por lo tanto no cuenta para la acumulación.
    public int? PosicionAcumulacion { get; set; }

    // Periodo de la acumulación, ej. "septiembre 2026" o "1.ª quincena de septiembre 2026".
    public string? EtiquetaPeriodo { get; set; }
}

public class ReglaDescuentoResponse
{
    public string Nombre { get; set; } = string.Empty;
    public string TipoIncidencia { get; set; } = string.Empty;
    public int CantidadAcumulada { get; set; }
    public string Periodo { get; set; } = string.Empty;
    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }
}

public class ReglasDescuentoResponse
{
    public List<ReglaDescuentoResponse> Reglas { get; set; } = new();
    public int LimiteDescuentosJustificadosMes { get; set; }
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
    public int Retardos { get; set; }
    public int SalidasAnticipadas { get; set; }
    public int Omisiones { get; set; }
    public int Justificadas { get; set; }
    public int Pendientes { get; set; }
    public int Descuento { get; set; }
}
