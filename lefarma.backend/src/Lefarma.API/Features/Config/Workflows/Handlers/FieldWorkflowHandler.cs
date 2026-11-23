using Lefarma.API.Domain.Interfaces.Config;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    public class FieldWorkflowHandler : IWorkflowActionHandler
    {
        public string HandlerKey => "Field";

        public IReadOnlySet<string> TiposEntidadCompatibles => new HashSet<string> { "ALL" };

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

            if (context.Handler.Requerido && !tieneValor)
                return Task.FromResult(HandlerResult.Fail($"El campo '{campo.EtiquetaUsuario}' es obligatorio para esta acción."));

            if (tieneValor)
            {
                var rawValue = context.DatosAdicionales![campo.NombreTecnico]?.ToString();
                var prop = context.Entidad.GetType().GetProperty(campo.PropiedadEntidad);
                if (prop is null)
                    return Task.FromResult(HandlerResult.Fail($"Field: propiedad '{campo.PropiedadEntidad}' no existe en {context.Entidad.GetType().Name}."));

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

                    prop.SetValue(context.Entidad, typed);
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
