namespace Lefarma.API.Domain.Entities.Auth;
public class AuditLog
{
    public long IdAudit { get; set; }
    public int? IdUsuario { get; set; }
    public string? Usuario { get; set; }
    public string Accion { get; set; } = string.Empty;
    public string? Recurso { get; set; }
    public string? Detalles { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool Exitoso { get; set; } = true;
    public string? MensajeError { get; set; }
}
