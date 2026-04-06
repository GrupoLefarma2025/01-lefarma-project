namespace Lefarma.API.Shared.Logging;
/// <summary>
/// Wide Event - a single rich event emitted per request with full business context.
/// Based on loggingsucks.com philosophy.
/// </summary>
public class WideEvent
{
    // Identification
    public Guid RequestId { get; set; } = Guid.NewGuid();
    public Guid? TraceId { get; set; }
    public string? SpanId { get; set; }

    // Service Info
    public string Service { get; set; } = "Lefarma.API";
    public string Version { get; set; } = "1.0.0";

    // Request Info
    public string Method { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? UserSubscription { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }

    // Outcome
    public string Status { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorType { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorCode { get; set; }
    public bool IsRetriable { get; set; }

    // Business Context (enriched by handlers)
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? Action { get; set; }
    public Dictionary<string, object> AdditionalContext { get; set; } = new();

    // Timestamp
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Emit this wide event to the logger.
    /// </summary>
    public void Emit(global::Serilog.ILogger logger)
    {
        logger.Information("{@WideEvent}", this);
    }

    /// <summary>
    /// Emit with tail sampling - always emits full WideEvent.
    /// Errors and slow requests: 100% sampled.
    /// Normal requests: configurable percentage (default 5%).
    /// </summary>
    public void EmitWithSampling(global::Serilog.ILogger logger, long slowRequestThresholdMs = 2000, double samplingRate = 1.0)  // 100% for testing
    {
        // Always emit full WideEvent for errors and slow requests
        if (Status == "error" || DurationMs > slowRequestThresholdMs)
        {
            logger.Information("{@WideEvent}", this);
        }
        else
        {
            // Sample normal requests based on rate
            var random = new Random();
            if (random.NextDouble() < samplingRate)
            {
                logger.Information("{@WideEvent}", this);
            }
            // Otherwise: don't emit anything (true one-event-per-request philosophy)
        }
    }

    /// <summary>
    /// Enrich with business context from the handler.
    /// </summary>
    public WideEvent Enrich(string entityType, int entityId, string action)
    {
        EntityType = entityType;
        EntityId = entityId;
        Action = action;
        return this;
    }

    /// <summary>
    /// Enrich with just entity type and action (no ID yet).
    /// </summary>
    public WideEvent Enrich(string entityType, string action)
    {
        EntityType = entityType;
        Action = action;
        return this;
    }

    /// <summary>
    /// Add additional context dictionary.
    /// </summary>
    public WideEvent AddContext(string key, object value)
    {
        AdditionalContext[key] = value;
        return this;
    }
}
