using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Globalization;

namespace Lefarma.API.Shared.ModelBinders;

/// <summary>
/// Fuerza que los decimales se parseen con cultura invariante (punto como decimal),
/// evitando que el servidor con cultura es-MX interprete el punto como separador de miles.
/// </summary>
public class DecimalModelBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        var valueProviderResult = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);
        if (valueProviderResult == ValueProviderResult.None)
            return Task.CompletedTask;

        bindingContext.ModelState.SetModelValue(bindingContext.ModelName, valueProviderResult);

        var value = valueProviderResult.FirstValue;
        if (string.IsNullOrWhiteSpace(value))
            return Task.CompletedTask;

        // Reemplazar coma por punto y luego parsear con InvariantCulture
        value = value.Replace(',', '.');

        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var result))
        {
            bindingContext.Result = ModelBindingResult.Success(result);
        }
        else
        {
            bindingContext.ModelState.TryAddModelError(bindingContext.ModelName, "Formato decimal invalido.");
        }

        return Task.CompletedTask;
    }
}

public class DecimalModelBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        if (context.Metadata.ModelType == typeof(decimal) || context.Metadata.ModelType == typeof(decimal?))
            return new DecimalModelBinder();

        return null;
    }
}
