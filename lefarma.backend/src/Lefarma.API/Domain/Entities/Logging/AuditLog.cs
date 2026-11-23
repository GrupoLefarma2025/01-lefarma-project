namespace Lefarma.API.Domain.Entities.Logging;

public class BusinessAuditLog
{
    public long IdAuditLog { get; set; }
    public DateTime FechaOperacion { get; set; } = DateTime.UtcNow;

    public string? EntityName { get; set; }
    public string? EntityId { get; set; }
    public string? NombreEntidad { get; set; }
    public string Accion { get; set; } = string.Empty; 

    public string? UserId { get; set; }
    public string? NombreUsuario { get; set; }
    public string? IpCliente { get; set; }

    public string? MetodoHttp { get; set; }
    public string? RutaEndpoint { get; set; }
    public int StatusCode { get; set; }

    public bool Exitoso { get; set; } = true;
    public string? MensajeError { get; set; }

    public string? DatosAdicionales { get; set; }

    public Guid? RequestId { get; set; }
    public long? DurationMs { get; set; }
}
