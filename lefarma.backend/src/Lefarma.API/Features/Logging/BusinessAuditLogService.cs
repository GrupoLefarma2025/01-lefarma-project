using Lefarma.API.Domain.Entities.Logging;
using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using System.Text.Json;

namespace Lefarma.API.Features.Logging;

/// <summary>
/// Persiste auditoría de operaciones de negocio en logs.audit_logs.
/// Se invoca automáticamente desde WideEventLoggingMiddleware para POST/PUT/PATCH/DELETE exitosos
/// cuando el servicio ha enriquecido el WideEvent con EntityType.
/// </summary>
public class BusinessAuditLogService(ApplicationDbContext context) : IBusinessAuditLogService
{
    private readonly ApplicationDbContext _context = context;

    public async Task LogAsync(WideEvent wideEvent, CancellationToken cancellationToken = default)
    {
        try
        {
            var nombreEntidad = ExtractNombre(wideEvent);

            var auditLog = new BusinessAuditLog
            {
                FechaOperacion = DateTime.UtcNow,

                EntityName = wideEvent.EntityType,
                EntityId = wideEvent.EntityId?.ToString(),
                NombreEntidad = nombreEntidad,
                Accion = wideEvent.Action ?? MapMethodToAccion(wideEvent.Method),

                UserId = wideEvent.UserId,
                NombreUsuario = wideEvent.UserName ?? wideEvent.UserId,
                IpCliente = wideEvent.IpAddress,

                MetodoHttp = wideEvent.Method,
                RutaEndpoint = wideEvent.Endpoint,
                StatusCode = wideEvent.StatusCode,

                Exitoso = wideEvent.StatusCode < 400,
                MensajeError = wideEvent.StatusCode >= 400 ? wideEvent.ErrorMessage : null,

                DatosAdicionales = wideEvent.AdditionalContext.Count > 0
                    ? JsonSerializer.Serialize(wideEvent.AdditionalContext)
                    : null,

                RequestId = wideEvent.RequestId,
                DurationMs = wideEvent.DurationMs
            };

            await _context.Set<BusinessAuditLog>().AddAsync(auditLog, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Si falla el audit log, no romper la aplicación
        }
    }

    /// <summary>
    /// Extrae el nombre legible de la entidad desde AdditionalContext.
    /// BaseService guarda: wideEvent.AddContext(EntityName.ToLower(), { "nombre": "...", ... })
    /// </summary>
    private static string? ExtractNombre(WideEvent wideEvent)
    {
        if (string.IsNullOrEmpty(wideEvent.EntityType))
            return null;

        var key = wideEvent.EntityType.ToLower();
        if (wideEvent.AdditionalContext.TryGetValue(key, out var entry)
            && entry is Dictionary<string, object> dict
            && dict.TryGetValue("nombre", out var nombre)
            && nombre is string nombreStr
            && !string.IsNullOrEmpty(nombreStr))
        {
            return nombreStr;
        }

        return null;
    }

    private static string MapMethodToAccion(string? method) => method?.ToUpper() switch
    {
        "POST" => "Create",
        "PUT" or "PATCH" => "Update",
        "DELETE" => "Delete",
        _ => method ?? "Unknown"
    };
}
