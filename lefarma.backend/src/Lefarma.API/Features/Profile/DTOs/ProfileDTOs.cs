namespace Lefarma.API.Features.Profile.DTOs;

/// <summary>
/// Response con información del perfil del usuario autenticado
/// </summary>
public record ProfileResponse
{
    public int IdUsuario { get; init; }
    public string SamAccountName { get; init; } = string.Empty;
    public string? Dominio { get; init; }
    public string? NombreCompleto { get; init; }
    public string? Correo { get; init; }
    public bool EsActivo { get; init; }
    public DateTime? UltimoLogin { get; init; }
    public DateTime FechaCreacion { get; init; }

    // Roles y permisos del usuario
    public List<string> Roles { get; init; } = [];
    public List<string> Permisos { get; init; } = [];

    // Detalles del usuario
    public UsuarioDetalleData? Detalle { get; init; }
}

/// <summary>
/// Datos de detalle del usuario
/// </summary>
public record UsuarioDetalleData
{
    public int? IdCentroCosto { get; init; }
    public string? Puesto { get; init; }
    public string? NumeroEmpleado { get; init; }
    public string? FirmaDigital { get; init; }
    public string? TelefonoOficina { get; init; }
    public string? Extension { get; init; }
    public string? Celular { get; init; }
    public string? TelegramChat { get; init; }
    public bool NotificarEmail { get; init; }
    public bool NotificarApp { get; init; }
    public bool NotificarWhatsapp { get; init; }
    public bool NotificarSms { get; init; }
    public bool NotificarTelegram { get; init; }
    public bool NotificarSoloUrgentes { get; init; }
    public bool NotificarResumenDiario { get; init; }
    public bool NotificarRechazos { get; init; }
    public bool NotificarVencimientos { get; init; }
    public int? IdUsuarioDelegado { get; init; }
    public DateTime? DelegacionHasta { get; init; }
    public string? AvatarUrl { get; init; }
    public string TemaInterfaz { get; init; } = "light";
    public string? DashboardInicio { get; init; }
}

/// <summary>
/// Request para actualizar el perfil del usuario autenticado
/// </summary>
public record UpdateProfileRequest
{
    // Datos básicos del usuario
    public string? NombreCompleto { get; init; }
    public string? Correo { get; init; }

    // Datos de detalle editables
    public int? IdCentroCosto { get; init; }
    public string? Puesto { get; init; }
    public string? NumeroEmpleado { get; init; }
    public string? FirmaDigital { get; init; }
    public string? TelefonoOficina { get; init; }
    public string? Extension { get; init; }
    public string? Celular { get; init; }
    public string? TelegramChat { get; init; }
    public bool? NotificarEmail { get; init; }
    public bool? NotificarApp { get; init; }
    public bool? NotificarWhatsapp { get; init; }
    public bool? NotificarSms { get; init; }
    public bool? NotificarTelegram { get; init; }
    public bool? NotificarSoloUrgentes { get; init; }
    public bool? NotificarResumenDiario { get; init; }
    public bool? NotificarRechazos { get; init; }
    public bool? NotificarVencimientos { get; init; }
    public int? IdUsuarioDelegado { get; init; }
    public DateTime? DelegacionHasta { get; init; }
    public string? AvatarUrl { get; init; }
    public string? TemaInterfaz { get; init; }
    public string? DashboardInicio { get; init; }
}
