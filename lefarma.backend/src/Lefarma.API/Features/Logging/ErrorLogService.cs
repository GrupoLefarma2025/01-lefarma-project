using Lefarma.API.Domain.Entities.Logging;
using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Lefarma.API.Features.Logging;
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
                ErrorGuid = Guid.NewGuid(),
                FechaError = DateTime.UtcNow,

                TipoExcepcion = exception?.GetType().FullName ?? wideEvent.ErrorType ?? "HttpError",
                MensajeError = exception?.Message.Length > 2048 
                    ? exception.Message[..2045] + "..." 
                    : (exception?.Message ?? wideEvent.ErrorMessage ?? "Error HTTP sin excepción"),
                MensajeDetallado = mensajeDetallado,
                StackTrace = exception?.StackTrace ?? ExtractStackTraceFromContext(wideEvent),

                Severidad = DetermineSeverity(exception, wideEvent.StatusCode),
                Categoria = exception != null ? DetermineCategory(exception) : DetermineCategoryFromStatusCode(wideEvent.StatusCode),

                MetodoHttp = wideEvent.Method,
                RutaEndpoint = wideEvent.Endpoint,
                QueryString = null, 
                StatusCode = wideEvent.StatusCode,
                IpCliente = wideEvent.IpAddress,
                UserAgent = wideEvent.UserAgent?.Length > 1024 
                    ? wideEvent.UserAgent[..1021] + "..." 
                    : wideEvent.UserAgent,

                UserId = wideEvent.UserId,
                NombreUsuario = wideEvent.UserName ?? wideEvent.UserId,

                EntityName = wideEvent.EntityType,
                EntityId = wideEvent.EntityId?.ToString(),
                OperacionNegocio = wideEvent.Action,
                DatosAdicionales = wideEvent.AdditionalContext.Count > 0
                    ? JsonSerializer.Serialize(wideEvent.AdditionalContext)
                    : null,

                Entorno = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
                Servidor = Environment.MachineName,
                DurationMs = wideEvent.DurationMs,

                RequestId = wideEvent.RequestId,
                TraceId = wideEvent.TraceId
            };

            await _context.Set<ErrorLog>().AddAsync(errorLog, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return errorLog.ErrorGuid;
        }
        catch
        {
            return null;
        }
    }

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

    private static string DetermineSeverity(Exception? exception, int statusCode)
    {
        if (exception != null)
        {
            if (exception is OutOfMemoryException or StackOverflowException)
                return "Critical";

            if (exception is DbUpdateException or TimeoutException)
                return "Error";
        }

        if (statusCode >= 400 && statusCode < 500)
            return "Warning";

        if (statusCode >= 500)
            return "Error";

        return "Error";
    }

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
