using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    /// <summary>
    /// Maneja campos de entrada (Selector, Checkbox, Texto, Número) vinculados a una acción.
    /// Si handler.Requerido = true → valida que el valor esté presente en DatosAdicionales.
    /// Siempre guarda el valor en la propiedad correspondiente de OrdenCompra (si se proporcionó).
    /// Reemplaza el par RequiredFields + FieldUpdater: una sola fila por campo en la BD.
    /// </summary>
    public class FieldWorkflowHandler : IWorkflowActionHandler
    {
        public string HandlerKey => "Field";

        public Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
        {
            if (context.Handler?.Campo is not { } campo)
                return Task.FromResult(HandlerResult.Fail("Field: el handler no tiene un campo vinculado."));

            if (string.IsNullOrWhiteSpace(campo.PropiedadEntidad))
                return Task.FromResult(HandlerResult.Fail($"Field: el campo '{campo.EtiquetaUsuario}' no tiene propiedad_entidad configurada."));

            var tieneValor = context.DatosAdicionales is not null &&
                             context.DatosAdicionales.TryGetValue(campo.NombreTecnico, out var rawObj) &&
                             rawObj is not null &&
                             !string.IsNullOrWhiteSpace(rawObj.ToString());

            // Validate if required
            if (context.Handler.Requerido && !tieneValor)
                return Task.FromResult(HandlerResult.Fail($"El campo '{campo.EtiquetaUsuario}' es obligatorio para esta acción."));

            // Save to entity if value was provided
            if (tieneValor)
            {
                var rawValue = context.DatosAdicionales![campo.NombreTecnico]?.ToString();
                var prop = typeof(OrdenCompra).GetProperty(campo.PropiedadEntidad);
                if (prop is null)
                    return Task.FromResult(HandlerResult.Fail($"Field: propiedad '{campo.PropiedadEntidad}' no existe en OrdenCompra."));

                try
                {
                    object? typed = campo.TipoControl.ToLowerInvariant() switch
                    {
                        "checkbox" or "booleano" => bool.TryParse(rawValue, out var b) ? b : (object?)null,
                        "selector" or "numero"   => int.TryParse(rawValue, out var n) ? n : (object?)null,
                        _                        => rawValue
                    };

                    if (typed is null)
                        return Task.FromResult(HandlerResult.Fail($"Field: valor inválido para '{campo.EtiquetaUsuario}'."));

                    prop.SetValue(context.Orden, typed);
                }
                catch (Exception ex)
                {
                    return Task.FromResult(HandlerResult.Fail($"Field: error al aplicar '{campo.EtiquetaUsuario}': {ex.Message}"));
                }
            }

            return Task.FromResult(HandlerResult.Ok());
        }
    }
}
