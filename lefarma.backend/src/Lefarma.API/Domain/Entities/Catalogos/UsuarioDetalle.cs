namespace Lefarma.API.Domain.Entities.Catalogos;
public class UsuarioDetalle
{
    public int IdUsuario { get; set; }
    public int IdEmpresa { get; set; }
    public int IdSucursal { get; set; }
    public int? IdArea { get; set; }
    public int? IdCentroCosto { get; set; }

    public string? Puesto { get; set; }
    public string? NumeroEmpleado { get; set; }
    public string? FirmaPath { get; set; }

    public string? FirmaPathCifrada { get; set; }

    public string? FirmaControlJson { get; set; }

    public string? TelefonoOficina { get; set; }
    public string? Extension { get; set; }
    public string? Celular { get; set; }
    public string? TelegramChat { get; set; }

    public bool NotificarEmail { get; set; } = true;
    public bool NotificarApp { get; set; } = true;
    public bool NotificarWhatsapp { get; set; } = false;
    public bool NotificarSms { get; set; } = false;
    public bool NotificarTelegram { get; set; } = false;

    public bool NotificarSoloUrgentes { get; set; } = false;
    public bool NotificarResumenDiario { get; set; } = true;
    public bool NotificarRechazos { get; set; } = true;
    public bool NotificarVencimientos { get; set; } = true;

    public int? IdUsuarioDelegado { get; set; }
    public DateTime? DelegacionHasta { get; set; }

    public string? AvatarUrl { get; set; }
    public string TemaInterfaz { get; set; } = "light";
    public string? DashboardInicio { get; set; }

    public string? DestinatariosIncidenciasDefault { get; set; }

    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }

    public Empresa Empresa { get; set; } = null!;
    public Sucursal Sucursal { get; set; } = null!;
    public Area? Area { get; set; }
}
