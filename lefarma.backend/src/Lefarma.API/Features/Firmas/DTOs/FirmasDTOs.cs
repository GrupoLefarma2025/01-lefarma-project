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

    /// <summary>Hay una firma con INE esperando aprobación de RH.</summary>
    public bool EnComprobacion { get; set; }
    public DateTime? FechaRemision { get; set; }
    /// <summary>La remisión en comprobación tiene foto de INE disponible.</summary>
    public bool TieneIne { get; set; }
    /// <summary>Ruta relativa (bajo /media/archivos) de la firma pendiente de aprobación.</summary>
    public string? FirmaPendientePath { get; set; }

    public int? IdUsuarioHabilito { get; set; }
    public string? NombreUsuarioHabilito { get; set; }
    public DateTime? FechaHabilitoFirma { get; set; }
}

/// <summary>
/// Evento del historial de la firma de un usuario (firma_control JSON).
/// </summary>
public class FirmaHistorialEventoResponse
{
    /// <summary>subida | eliminacion | solicitud | habilitacion | remision | aprobacion | rechazo</summary>
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    /// <summary>Solo en rechazo: motivo indicado por RH.</summary>
    public string? Motivo { get; set; }
}

/// <summary>
/// Request para rechazar una firma en comprobación.
/// </summary>
public class RechazarFirmaRequest
{
    public string Motivo { get; set; } = string.Empty;
}

/// <summary>
/// Archivo protegido descifrado (firma o foto de INE) para servirse por endpoint autenticado.
/// </summary>
public class ArchivoProtegidoResponse
{
    public byte[] Contenido { get; set; } = [];
    public string ContentType { get; set; } = "application/octet-stream";
    public string NombreArchivo { get; set; } = string.Empty;
}
