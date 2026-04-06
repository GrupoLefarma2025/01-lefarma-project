using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Shared.Logging;
using Serilog;
using System.Diagnostics;

namespace Lefarma.API.Infrastructure.Middleware;
/// <summary>
/// Middleware that creates and emits a WideEvent for each HTTP request.
/// Implements the "one rich event per request" logging philosophy (loggingsucks.com).
///
/// Flow:
/// 1. Create WideEvent at start -> store in HttpContext.Items
/// 2. Services can enrich it via IWideEventAccessor
/// 3. Emit ONE single log at the end (finally block)
/// 4. If error occurs, persist to database via ErrorLogService
/// </summary>
public sealed class WideEventLoggingMiddleware(
    RequestDelegate next,
    IServiceScopeFactory scopeFactory)
{
    private const string WideEventKey = "WideEvent";
    private readonly RequestDelegate _next = next;
    private readonly Serilog.ILogger _serilogLogger = Log.ForContext<WideEventLoggingMiddleware>();
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    public async Task InvokeAsync(HttpContext context)
    {
        // Habilitar buffering para poder releer el body en caso de error (POST/PUT/PATCH)
        context.Request.EnableBuffering();

        var stopwatch = Stopwatch.StartNew();
        var wideEvent = CreateWideEvent(context);

        // Store WideEvent in HttpContext.Items for enrichment by services
        context.Items[WideEventKey] = wideEvent;

        try
        {
            await _next(context);
            stopwatch.Stop();
            CompleteRequest(wideEvent, context, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            // Leer el body ANTES de guardar en BD (el context todavía está activo)
            TryEnrichWithRequestBody(wideEvent, context);
            EmitError(wideEvent, context, stopwatch.ElapsedMilliseconds, ex);
            throw;
        }
    }

    private WideEvent CreateWideEvent(HttpContext context)
    {
        var traceId = context.TraceIdentifier;
        Guid.TryParse(traceId, out var parsedTraceId);

        var wideEvent = new WideEvent
        {
            RequestId = Guid.NewGuid(),
            TraceId = parsedTraceId,
            Method = context.Request.Method,
            Endpoint = context.Request.Path.Value ?? "/",
            UserId = context.User.FindFirst("sub")?.Value ?? context.User.FindFirst("userId")?.Value,
            Timestamp = DateTime.UtcNow,
            Service = "Lefarma.API",
            Version = "1.0.0"
        };

        // HTTP Context
        var userAgent = context.Request.Headers.UserAgent.ToString();
        wideEvent.UserAgent = userAgent.Length > 512 ? userAgent[..512] : userAgent;
        wideEvent.IpAddress = GetClientIpAddress(context);

        return wideEvent;
    }

    private void CompleteRequest(WideEvent evt, HttpContext context, long durationMs)
    {
        evt.StatusCode = context.Response.StatusCode;
        evt.DurationMs = durationMs;
        evt.Status = GetStatusCategory(context.Response.StatusCode);

        // Si es error de cliente y no se ha enriquecido desde el servicio marcar que el error viene del resultado HTTP
        if (context.Response.StatusCode >= 400 && context.Response.StatusCode < 500
       && string.IsNullOrEmpty(evt.ErrorType))
        {
            evt.ErrorType = "HttpError";
            evt.ErrorCode = $"HTTP{context.Response.StatusCode}";
            evt.ErrorMessage = "Error en la petición HTTP";
        }

        // Si es error de servidor (>= 500), capturar request body y guardar en BD
        if (context.Response.StatusCode >= 500)
        {
            // Leer el body AQUÍ (síncrono, el context todavía está activo en el pipeline)
            TryEnrichWithRequestBody(evt, context);
            SaveErrorToDatabase(evt, null);
        }

        // Emit ONE single log with the enriched WideEvent
        evt.EmitWithSampling(_serilogLogger);
    }

    private void EmitError(WideEvent evt, HttpContext context, long durationMs, Exception ex)
    {
        evt.StatusCode = context.Response.StatusCode;
        evt.DurationMs = durationMs;
        evt.Status = "error";
        evt.ErrorType = ex.GetType().Name;
        evt.ErrorMessage = ex.Message;
        evt.ErrorCode = ex.HResult.ToString();

        // Guardar en BD (excepción no controlada)
         SaveErrorToDatabase(evt, ex);

        // Always emit full event for errors
        evt.Emit(_serilogLogger);
    }

    /// <summary>
    /// Lee el request body y lo agrega al WideEvent como 'request_data'.
    /// Solo aplica para POST/PUT/PATCH. Máximo 8KB para evitar guardar payloads grandes.
    /// </summary>
    private static void TryEnrichWithRequestBody(WideEvent wideEvent, HttpContext context)
    {
        try
        {
            if (context.Request.Method is not ("POST" or "PUT" or "PATCH"))
                return;

            if (!context.Request.Body.CanSeek)
                return;

            context.Request.Body.Position = 0;
            using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
            var body = reader.ReadToEnd();
            context.Request.Body.Position = 0;

            if (string.IsNullOrWhiteSpace(body))
                return;

            var truncated = body.Length > 8192 ? body[..8192] + "... [truncated]" : body;
            wideEvent.AddContext("request_data", truncated);
        }
        catch
        {
            // Ignorar errores al leer el body - nunca romper el flujo
        }
    }

    /// <summary>
    /// Guarda un error en la base de datos de forma asíncrona (fire-and-forget)
    /// </summary>
    private void SaveErrorToDatabase(WideEvent evt, Exception? ex)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var errorLogService = scope.ServiceProvider.GetRequiredService<IErrorLogService>();
                await errorLogService.LogErrorAsync(evt, ex);
            }
            catch (Exception dbEx)
            {
                // Último recurso: si falla el guardado en BD, al menos lo emitimos a Serilog
                _serilogLogger.Error(dbEx, "Failed to persist ErrorLog to database. RequestId: {RequestId}", evt.RequestId);
            }
        });
    }

    private static string GetClientIpAddress(HttpContext context)
    {
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            var firstIp = forwardedFor.Split(',').FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(firstIp))
                return firstIp;
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static string GetStatusCategory(int statusCode) => statusCode switch
    {
        < 200 => "informational",
        < 300 => "success",
        < 400 => "client_error",
        < 500 => "client_error",
        _ => "server_error"
    };
}

/// <summary>
/// Extension methods for registering WideEventLoggingMiddleware.
/// </summary>
public static class WideEventLoggingMiddlewareExtensions
{
    /// <summary>
    /// Adds Wide Event logging middleware to the pipeline.
    /// Creates one rich log event per HTTP request with full context.
    /// </summary>
    public static IApplicationBuilder UseWideEventLogging(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<WideEventLoggingMiddleware>();
    }
}
