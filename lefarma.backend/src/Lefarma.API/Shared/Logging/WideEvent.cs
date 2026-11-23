namespace Lefarma.API.Shared.Logging;
public class WideEvent
{
    public Guid RequestId { get; set; } = Guid.NewGuid();
    public Guid? TraceId { get; set; }
    public string? SpanId { get; set; }

    public string Service { get; set; } = "Lefarma.API";
    public string Version { get; set; } = "1.0.0";

    public string Method { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserSubscription { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }

    public string Status { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorType { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorCode { get; set; }
    public bool IsRetriable { get; set; }

    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? Action { get; set; }
    public Dictionary<string, object> AdditionalContext { get; set; } = new();

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public void Emit(global::Serilog.ILogger logger)
    {
        logger.Information("{@WideEvent}", this);
    }

    public void EmitWithSampling(global::Serilog.ILogger logger, long slowRequestThresholdMs = 2000, double samplingRate = 1.0)  
    {
        if (Status == "error" || DurationMs > slowRequestThresholdMs)
        {
            logger.Information("{@WideEvent}", this);
        }
        else
        {
            var random = new Random();
            if (random.NextDouble() < samplingRate)
            {
                logger.Information("{@WideEvent}", this);
            }
        }
    }

    public WideEvent Enrich(string entityType, int entityId, string action)
    {
        EntityType = entityType;
        EntityId = entityId;
        Action = action;
        return this;
    }

    public WideEvent Enrich(string entityType, string action)
    {
        EntityType = entityType;
        Action = action;
        return this;
    }

    public WideEvent AddContext(string key, object value)
    {
        AdditionalContext[key] = value;
        return this;
    }
}
