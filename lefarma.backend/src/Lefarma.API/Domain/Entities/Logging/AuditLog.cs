namespace Lefarma.API.Domain.Entities.Logging;

/// <summary>
/// Registro de auditoría de operaciones de negocio (Create, Update, Delete).
/// Se guarda automáticamente para cada operación mutante con respuesta 2xx.
/// Complementa a ErrorLog (que captura fallos) y a app.AuditLog (que captura eventos de login).
/// </summary>
public class BusinessAuditLog
{
    public long IdAuditLog { get; set; }
    public DateTime FechaOperacion { get; set; } = DateTime.UtcNow;

    // Qué entidad y qué operación
    public string? EntityName { get; set; }
    public string? EntityId { get; set; }
    public string? NombreEntidad { get; set; }
    public string Accion { get; set; } = string.Empty; // Create, Update, Delete, etc.

    // Quién lo hizo
    public string? UserId { get; set; }
    public string? NombreUsuario { get; set; }
    public string? IpCliente { get; set; }

    // Contexto HTTP
    public string? MetodoHttp { get; set; }
    public string? RutaEndpoint { get; set; }
    public int StatusCode { get; set; }

    // Resultado
    public bool Exitoso { get; set; } = true;
    public string? MensajeError { get; set; }

    // Contexto adicional extraído del WideEvent (JSON)
    public string? DatosAdicionales { get; set; }

    // Correlación con WideEvent / ErrorLog
    public Guid? RequestId { get; set; }
    public long? DurationMs { get; set; }
}
