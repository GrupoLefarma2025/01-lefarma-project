namespace Lefarma.API.Features.Profile.DTOs;
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

    public List<string> Roles { get; init; } = [];
    public List<string> Permissions { get; init; } = [];

    public bool PuedeSeleccionarEmpresas { get; init; }

    public string? AreaEmpleado { get; init; }

    public string? PuestoEmpleado { get; init; }

    public UsuarioDetalleData? Detalle { get; init; }
}

public record UsuarioDetalleData
{
    public int IdEmpresa { get; init; }
    public int IdSucursal { get; init; }
    public int? IdArea { get; init; }
    public int? IdCentroCosto { get; init; }
    public string? Puesto { get; init; }
    public string? NumeroEmpleado { get; init; }
    public string? FirmaPath { get; init; }
    public string? FirmaPathCifrada { get; init; }
    public int FirmaSubidas { get; init; }
    public bool FirmaCambioHabilitado { get; init; }
    public bool FirmaCambioSolicitado { get; init; }
    public bool FirmaEnComprobacion { get; init; }
    public DateTime? FechaSolicitudCambioFirma { get; init; }
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

public record UpdateProfileRequest
{
    public string? NombreCompleto { get; init; }
    public string? Correo { get; init; }

    public int? IdCentroCosto { get; init; }
    public string? Puesto { get; init; }
    public string? NumeroEmpleado { get; init; }
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
