namespace Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;

public class PlantillaIncidenciaChecadoResponse
{
    public int IdPlantilla { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string CodigoCanal { get; set; } = string.Empty;
    public string? Asunto { get; set; }
    public string Cuerpo { get; set; } = string.Empty;
    public bool EsDefecto { get; set; }
    public bool Activo { get; set; }
}

public class NotificarIncidenciaItemRequest
{
    public long Nomina { get; set; }
    public DateTime Fecha { get; set; }
    public string? Nombre { get; set; }
    public string? Empresa { get; set; }
    public string? Departamento { get; set; }
    public string? Puesto { get; set; }
    public string? Entrada { get; set; }
    public string? Salida { get; set; }
    public string? Entro { get; set; }
    public string? Salio { get; set; }
    public string? IncidenciaEntrada { get; set; }
    public string? IncidenciaSalida { get; set; }
    public string? MsgError { get; set; }
    public bool Justificada { get; set; }
    public int? IdSolicitud { get; set; }
    public string? TipoSolicitudNombre { get; set; }
}

public class CanalNotificacionResult
{
    public string TipoCanal { get; set; } = string.Empty;
    public int NotificationId { get; set; }
    public bool Exitoso { get; set; }
}

public class NotificacionPersonaResult
{
    public long Nomina { get; set; }
    public string? Nombre { get; set; }
    public bool Exitoso { get; set; }
    public string? Error { get; set; }
    public List<CanalNotificacionResult> Canales { get; set; } = new();
}

public class NotificarIncidenciasResumenRequest
{
    public List<long> Nominas { get; set; } = new();
    public string? Periodo { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFin { get; set; }
    public string Asunto { get; set; } = string.Empty;
    public string Mensaje { get; set; } = string.Empty;
}

public class NotificarIncidenciasResumenResponse
{
    public List<NotificacionPersonaResult> Resultados { get; set; } = new();
}
