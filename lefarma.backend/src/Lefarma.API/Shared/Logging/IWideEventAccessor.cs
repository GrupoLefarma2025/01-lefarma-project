namespace Lefarma.API.Shared.Logging;
public interface IWideEventAccessor
{
    WideEvent? Current { get; }
}

internal sealed class HttpContextWideEventAccessor(HttpContext httpContext) : IWideEventAccessor
{
    private const string WideEventKey = "WideEvent";

    public WideEvent? Current => httpContext.Items[WideEventKey] as WideEvent;
}

public sealed class NullWideEventAccessor : IWideEventAccessor
{
    public WideEvent? Current => null;
}
