namespace Lefarma.API.Domain.Entities.Logging;
public class ErrorLog
{
    public long IdErrorLog { get; set; }
    public Guid ErrorGuid { get; set; } = Guid.NewGuid();
    
    public DateTime FechaError { get; set; } = DateTime.UtcNow;
    
    public string TipoExcepcion { get; set; } = null!;
    public string MensajeError { get; set; } = null!;
    public string? MensajeDetallado { get; set; } 
    public string? StackTrace { get; set; }
    
    public string Severidad { get; set; } = "Error"; 
    public string? Categoria { get; set; } 
    
    public string? MetodoHttp { get; set; }
    public string? RutaEndpoint { get; set; }
    public string? QueryString { get; set; }
    public int? StatusCode { get; set; }
    public string? IpCliente { get; set; }
    public string? UserAgent { get; set; }
    
    public string? UserId { get; set; } 
    public string? NombreUsuario { get; set; }
    
    public string? EntityName { get; set; }
    public string? EntityId { get; set; }
    public string? OperacionNegocio { get; set; }
    public string? DatosAdicionales { get; set; } 
    
    public string? Entorno { get; set; }
    public string? Servidor { get; set; }
    public long? DurationMs { get; set; }
    
    public Guid? RequestId { get; set; }
    public Guid? TraceId { get; set; }
}
