using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Shared.Logging;
using Serilog;
using System.Diagnostics;
using System.Security.Claims;

namespace Lefarma.API.Infrastructure.Middleware;
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
        context.Request.EnableBuffering();

        var stopwatch = Stopwatch.StartNew();
        var wideEvent = CreateWideEvent(context);

        context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;

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
            UserId = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.User.FindFirst("sub")?.Value
                ?? context.User.FindFirst("userId")?.Value,
            UserName = context.User.FindFirstValue(ClaimTypes.Name)
                ?? context.User.FindFirst("preferred_username")?.Value
                ?? context.User.Identity?.Name,
            Timestamp = DateTime.UtcNow,
            Service = "Lefarma.API",
            Version = "1.0.0"
        };

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

        if (context.Response.StatusCode >= 400 && context.Response.StatusCode < 500
       && string.IsNullOrEmpty(evt.ErrorType))
        {
            evt.ErrorType = "HttpError";
            evt.ErrorCode = $"HTTP{context.Response.StatusCode}";
            evt.ErrorMessage = "Error en la petición HTTP";
        }

        if (context.Response.StatusCode >= 500)
        {
            TryEnrichWithRequestBody(evt, context);
            SaveErrorToDatabase(evt, null);
        }

        if (context.Response.StatusCode is >= 200 and < 300
            && context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE"
            && !string.IsNullOrEmpty(evt.EntityType))
        {
            SaveAuditToDatabase(evt);
        }

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

         SaveErrorToDatabase(evt, ex);

        evt.Emit(_serilogLogger);
    }

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
        }
    }

    private void SaveAuditToDatabase(WideEvent evt)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var auditLogService = scope.ServiceProvider.GetRequiredService<IBusinessAuditLogService>();
                await auditLogService.LogAsync(evt);
            }
            catch (Exception dbEx)
            {
                _serilogLogger.Error(dbEx, "Failed to persist BusinessAuditLog to database. RequestId: {RequestId}", evt.RequestId);
            }
        });
    }

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

public static class WideEventLoggingMiddlewareExtensions
{
    public static IApplicationBuilder UseWideEventLogging(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<WideEventLoggingMiddleware>();
    }
}
