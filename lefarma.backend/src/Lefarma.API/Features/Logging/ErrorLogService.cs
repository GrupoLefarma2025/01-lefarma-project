using Lefarma.API.Domain.Entities.Logging;
using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Lefarma.API.Features.Logging;

/// <summary>
/// Implementación del servicio de logging de errores a base de datos
/// </summary>
public class ErrorLogService(ApplicationDbContext context) : IErrorLogService
{
    private readonly ApplicationDbContext _context = context;

    public async Task<Guid?> LogErrorAsync(WideEvent wideEvent, Exception? exception = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var mensajeDetallado = exception?.GetDetailedMessage(includeStackTrace: false) 
                ?? ExtractErrorFromContext(wideEvent);

            var errorLog = new ErrorLog
            {
                // Identificación
                ErrorGuid = Guid.NewGuid(),
                FechaError = DateTime.UtcNow,

                // Información del error
                TipoExcepcion = exception?.GetType().FullName ?? wideEvent.ErrorType ?? "HttpError",
                MensajeError = exception?.Message.Length > 2048 
                    ? exception.Message[..2045] + "..." 
                    : (exception?.Message ?? wideEvent.ErrorMessage ?? "Error HTTP sin excepción"),
                MensajeDetallado = mensajeDetallado,
                StackTrace = exception?.StackTrace ?? ExtractStackTraceFromContext(wideEvent),

                // Severidad - determinar basado en el tipo de excepción o status code
                Severidad = DetermineSeverity(exception, wideEvent.StatusCode),
                Categoria = exception != null ? DetermineCategory(exception) : DetermineCategoryFromStatusCode(wideEvent.StatusCode),

                // Contexto HTTP del WideEvent
                MetodoHttp = wideEvent.Method,
                RutaEndpoint = wideEvent.Endpoint,
                QueryString = null, // Se puede extraer del HttpContext si es necesario
                StatusCode = wideEvent.StatusCode,
                IpCliente = wideEvent.IpAddress,
                UserAgent = wideEvent.UserAgent?.Length > 1024 
                    ? wideEvent.UserAgent[..1021] + "..." 
                    : wideEvent.UserAgent,

                // Contexto de usuario
                UserId = wideEvent.UserId,
                NombreUsuario = null, // Podría enriquecerse con datos del user claims

                // Contexto de negocio del WideEvent
                EntityName = wideEvent.EntityType,
                EntityId = wideEvent.EntityId?.ToString(),
                OperacionNegocio = wideEvent.Action,
                DatosAdicionales = wideEvent.AdditionalContext.Count > 0
                    ? JsonSerializer.Serialize(wideEvent.AdditionalContext)
                    : null,

                // Información técnica
                Entorno = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
                Servidor = Environment.MachineName,
                DurationMs = wideEvent.DurationMs,

                // Correlación con WideEvent
                RequestId = wideEvent.RequestId,
                TraceId = wideEvent.TraceId
            };

            await _context.Set<ErrorLog>().AddAsync(errorLog, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return errorLog.ErrorGuid;
        }
        catch
        {
            // Si falla el logging a BD, retornar null sin romper la aplicación
            // El error será capturado por el fallback en el middleware (Serilog)
            return null;
        }
    }

    /// <summary>
    /// Extrae el stack trace del AdditionalContext del WideEvent.
    /// Los servicios lo guardan en context[entityName]["stackTrace"]
    /// </summary>
    private static string? ExtractStackTraceFromContext(WideEvent wideEvent)
    {
        foreach (var entry in wideEvent.AdditionalContext.Values)
        {
            if (entry is Dictionary<string, object> contextDict
                && contextDict.TryGetValue("stackTrace", out var stackTraceValue)
                && stackTraceValue is string stackTrace
                && !string.IsNullOrEmpty(stackTrace))
            {
                return stackTrace;
            }
        }

        return null;
    }

    /// <summary>
    /// Extrae el mensaje de error detallado del AdditionalContext del WideEvent.
    /// Los servicios guardan el error con GetDetailedMessage() en context[entityName]["error"]
    /// </summary>
    private static string? ExtractErrorFromContext(WideEvent wideEvent)
    {
        foreach (var entry in wideEvent.AdditionalContext.Values)
        {
            if (entry is Dictionary<string, object> contextDict 
                && contextDict.TryGetValue("error", out var errorValue) 
                && errorValue is string errorMessage 
                && !string.IsNullOrEmpty(errorMessage))
            {
                return errorMessage;
            }
        }

        return null;
    }

    /// <summary>
    /// Determina la severidad del error basado en el tipo de excepción y status code
    /// </summary>
    private static string DetermineSeverity(Exception? exception, int statusCode)
    {
        // Si hay excepción, evaluar primero
        if (exception != null)
        {
            // Critical: errores que requieren atención inmediata
            if (exception is OutOfMemoryException or StackOverflowException)
                return "Critical";

            // Error de DB
            if (exception is DbUpdateException or TimeoutException)
                return "Error";
        }

        // Errores de cliente (4xx) son Warning
        if (statusCode >= 400 && statusCode < 500)
            return "Warning";

        // Errores de servidor (5xx) son Error
        if (statusCode >= 500)
            return "Error";

        return "Error";
    }

    /// <summary>
    /// Determina la categoría del error basado en el tipo de excepción
    /// </summary>
    private static string DetermineCategory(Exception exception)
    {
        return exception switch
        {
            DbUpdateException => "Database",
            TimeoutException => "Timeout",
            UnauthorizedAccessException => "Security",
            InvalidOperationException => "Business",
            ArgumentException or ArgumentNullException => "Validation",
            HttpRequestException => "External",
            _ => "General"
        };
    }

    /// <summary>
    /// Determina la categoría del error basado en el status code cuando no hay excepción
    /// </summary>
    private static string DetermineCategoryFromStatusCode(int statusCode)
    {
        return statusCode switch
        {
            400 => "Validation",
            401 or 403 => "Security",
            404 => "NotFound",
            409 => "Conflict",
            500 => "ServerError",
            502 or 503 or 504 => "ServiceUnavailable",
            _ => "HttpError"
        };
    }
}
