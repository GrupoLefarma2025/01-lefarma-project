namespace Lefarma.API.Features.Firmas.DTOs;

/// <summary>
/// Fila del listado de usuarios con firma para la página de RH.
/// </summary>
public class FirmaUsuarioResponse
{
    public int IdUsuario { get; set; }
    public string? SamAccountName { get; set; }
    public string? NombreCompleto { get; set; }
    public string? Correo { get; set; }
    public string? Area { get; set; }

    public string? FirmaPath { get; set; }
    public int FirmaSubidas { get; set; }
    public bool FirmaCambioHabilitado { get; set; }
    public bool FirmaCambioSolicitado { get; set; }
    public DateTime? FechaSolicitudCambioFirma { get; set; }

    public int? IdUsuarioHabilito { get; set; }
    public string? NombreUsuarioHabilito { get; set; }
    public DateTime? FechaHabilitoFirma { get; set; }
}

/// <summary>
/// Evento del historial de la firma de un usuario (firma_control JSON).
/// </summary>
public class FirmaHistorialEventoResponse
{
    /// <summary>subida | eliminacion | solicitud | habilitacion</summary>
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
}
