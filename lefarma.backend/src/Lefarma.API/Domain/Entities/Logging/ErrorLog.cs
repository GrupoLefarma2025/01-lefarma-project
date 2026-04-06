namespace Lefarma.API.Domain.Entities.Logging;
/// <summary>
/// Registro de errores en base de datos para análisis y debugging
/// </summary>
public class ErrorLog
{
    // Identificación
    public long IdErrorLog { get; set; }
    public Guid ErrorGuid { get; set; } = Guid.NewGuid();
    
    // Temporal
    public DateTime FechaError { get; set; } = DateTime.UtcNow;
    
    // Información del error
    public string TipoExcepcion { get; set; } = null!;
    public string MensajeError { get; set; } = null!;
    public string? MensajeDetallado { get; set; } // Con InnerException
    public string? StackTrace { get; set; }
    
    // Severidad
    public string Severidad { get; set; } = "Error"; // Error, Warning, Critical
    public string? Categoria { get; set; } // Database, Validation, Business, etc.
    
    // Contexto HTTP
    public string? MetodoHttp { get; set; }
    public string? RutaEndpoint { get; set; }
    public string? QueryString { get; set; }
    public int? StatusCode { get; set; }
    public string? IpCliente { get; set; }
    public string? UserAgent { get; set; }
    
    // Contexto de usuario
    public string? UserId { get; set; } // Del claim
    public string? NombreUsuario { get; set; }
    
    // Contexto de negocio (desde WideEvent)
    public string? EntityName { get; set; }
    public string? EntityId { get; set; }
    public string? OperacionNegocio { get; set; }
    public string? DatosAdicionales { get; set; } // JSON
    
    // Información técnica
    public string? Entorno { get; set; }
    public string? Servidor { get; set; }
    public long? DurationMs { get; set; }
    
    // WideEvent correlation
    public Guid? RequestId { get; set; }
    public Guid? TraceId { get; set; }
}
