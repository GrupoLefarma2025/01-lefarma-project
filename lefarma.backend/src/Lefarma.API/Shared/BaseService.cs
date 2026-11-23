using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;

namespace Lefarma.API.Shared.Services;
public abstract class BaseService
{
    private readonly IWideEventAccessor _wideEventAccessor;
    protected abstract string EntityName { get; }

    protected BaseService(IWideEventAccessor wideEventAccessor)
    {
        _wideEventAccessor = wideEventAccessor;
    }

    protected void EnrichWideEvent(
        string action,
        int? entityId = null,
        string? nombre = null,
        int? count = null,
        List<string>? items = null,
        bool? notFound = null,
        bool? duplicate = null,
        bool? deleteFailed = null,
        string? error = null,
        Exception? exception = null,
        Dictionary<string, object>? additionalContext = null)
    {
        var wideEvent = _wideEventAccessor.Current;
        if (wideEvent == null) return;

        wideEvent.Enrich(EntityName, action);

        if (entityId.HasValue)
            wideEvent.EntityId = entityId.Value;

        var context = new Dictionary<string, object>();

        if (!string.IsNullOrEmpty(nombre))
            context["nombre"] = nombre;

        if (count.HasValue)
            context["count"] = count.Value;

        if (items != null && items.Any())
            context["items"] = items;

        if (notFound == true)
            context["notFound"] = true;

        if (duplicate == true)
            context["duplicate"] = true;

        if (deleteFailed == true)
            context["deleteFailed"] = true;

        if (exception != null)
        {
            context["error"] = exception.GetDetailedMessage();
            if (!string.IsNullOrWhiteSpace(exception.StackTrace))
                context["stackTrace"] = exception.StackTrace;
        }
        else if (!string.IsNullOrEmpty(error))
        {
            context["error"] = error;
        }

        if (additionalContext != null)
        {
            foreach (var kvp in additionalContext)
            {
                context[kvp.Key] = kvp.Value;
            }
        }

        if (context.Any())
            wideEvent.AddContext(EntityName.ToLowerInvariant(), context);
    }
}