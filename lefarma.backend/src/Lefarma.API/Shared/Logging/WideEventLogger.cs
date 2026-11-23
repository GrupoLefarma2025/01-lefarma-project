using Serilog;

namespace Lefarma.API.Shared.Logging;
public static class WideEventLogger
{
    private static readonly global::Serilog.ILogger _baseLogger = global::Serilog.Log.ForContext(typeof(WideEventLogger));

    public static WideEvent StartRequest(
        string method,
        string endpoint,
        string? userId = null,
        Guid? traceId = null)
    {
        return new WideEvent
        {
            RequestId = Guid.NewGuid(),
            TraceId = traceId,
            Method = method,
            Endpoint = endpoint,
            UserId = userId,
            Timestamp = DateTime.UtcNow
        };
    }

    public static void CompleteRequest(
        WideEvent evt,
        string status,
        int statusCode,
        long durationMs,
        string? errorType = null,
        string? errorMessage = null,
        string? errorCode = null,
        bool isRetriable = false)
    {
        evt.Status = status;
        evt.StatusCode = statusCode;
        evt.DurationMs = durationMs;
        evt.ErrorType = errorType;
        evt.ErrorMessage = errorMessage;
        evt.ErrorCode = errorCode;
        evt.IsRetriable = isRetriable;

        evt.EmitWithSampling(_baseLogger);
    }

    public static void EmitError(
        WideEvent evt,
        string errorType,
        string errorMessage,
        string? errorCode = null)
    {
        evt.Status = "error";
        evt.StatusCode = 500;
        evt.ErrorType = errorType;
        evt.ErrorMessage = errorMessage;
        evt.ErrorCode = errorCode;

        evt.Emit(_baseLogger);
    }
}
