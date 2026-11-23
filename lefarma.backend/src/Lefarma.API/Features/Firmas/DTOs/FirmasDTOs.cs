namespace Lefarma.API.Features.Firmas.DTOs;

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

    public bool EnComprobacion { get; set; }
    public DateTime? FechaRemision { get; set; }
    public bool TieneIne { get; set; }
    public string? FirmaPendientePath { get; set; }

    public int? IdUsuarioHabilito { get; set; }
    public string? NombreUsuarioHabilito { get; set; }
    public DateTime? FechaHabilitoFirma { get; set; }
}

public class FirmaHistorialEventoResponse
{
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public string? Motivo { get; set; }
}

public class RechazarFirmaRequest
{
    public string Motivo { get; set; } = string.Empty;
}

public class ArchivoProtegidoResponse
{
    public byte[] Contenido { get; set; } = [];
    public string ContentType { get; set; } = "application/octet-stream";
    public string NombreArchivo { get; set; } = string.Empty;
}
