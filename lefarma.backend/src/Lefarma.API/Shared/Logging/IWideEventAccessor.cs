namespace Lefarma.API.Shared.Logging;
/// <summary>
/// Provides access to the current request's WideEvent for enrichment.
/// Based on loggingsucks.com philosophy - one rich event per request.
/// </summary>
public interface IWideEventAccessor
{
    /// <summary>
    /// Gets the WideEvent for the current request.
    /// Returns null if no request is active.
    /// </summary>
    WideEvent? Current { get; }
}

/// <summary>
/// Implementation that stores the WideEvent in HttpContext.Items.
/// </summary>
internal sealed class HttpContextWideEventAccessor(HttpContext httpContext) : IWideEventAccessor
{
    private const string WideEventKey = "WideEvent";

    public WideEvent? Current => httpContext.Items[WideEventKey] as WideEvent;
}

/// <summary>
/// Null implementation for when no HttpContext is available (e.g., background services).
/// </summary>
public sealed class NullWideEventAccessor : IWideEventAccessor
{
    public WideEvent? Current => null;
}
