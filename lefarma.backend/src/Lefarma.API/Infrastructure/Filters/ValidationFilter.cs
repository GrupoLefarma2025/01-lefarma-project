using FluentValidation;
using FluentValidation.Results;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lefarma.API.Infrastructure.Filters
{
/// <summary>
    /// Filtro de validación global que automáticamente valida requests
    /// usando FluentValidation y retorna respuestas consistentes.
    /// También enriquece el WideEvent con información de errores de validación.
    /// </summary>
    public class ValidationFilter : IAsyncActionFilter
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IWideEventAccessor _wideEventAccessor;

        public ValidationFilter(IServiceProvider serviceProvider, IWideEventAccessor wideEventAccessor)
        {
            _serviceProvider = serviceProvider;
            _wideEventAccessor = wideEventAccessor;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Buscar el primer argumento que no sea null y no sea de tipo simple
            var requestType = context.ActionArguments
                .Values
                .Where(v => v != null &&
                           !v.GetType().IsPrimitive &&
                           !v.GetType().IsValueType &&
                           v.GetType() != typeof(string))
                .Select(v => v.GetType())
                .FirstOrDefault();

            if (requestType == null)
            {
                await next();
                return;
            }

            // Obtener el validator correspondiente
            var validatorType = typeof(IValidator<>).MakeGenericType(requestType);
            var validator = _serviceProvider.GetService(validatorType);

            if (validator == null)
            {
                await next();
                return;
            }

            var request = context.ActionArguments.FirstOrDefault(a => a.Value?.GetType() == requestType).Value;

            if (request == null)
            {
                await next();
                return;
            }

            // Validar usando reflection
            var validateMethod = validatorType.GetMethod(nameof(IValidator<object>.ValidateAsync));
            var task = (Task?)validateMethod?.Invoke(validator, new[] { request, default(CancellationToken) });

            if (task == null)
            {
                await next();
                return;
            }

            await task.ConfigureAwait(false);

            // Obtener el resultado de la validación
            var resultProperty = task.GetType().GetProperty("Result");
            var validationResult = resultProperty?.GetValue(task) as ValidationResult;

            if (validationResult == null)
            {
                await next();
                return;
            }

            if (!validationResult.IsValid)
            {
                // ✅ Extraer información del contexto de la acción
                var actionContext = ExtractActionContext(context, request);

                // ✅ Enriquecer WideEvent con errores de validación y contexto
                EnrichWideEventWithValidationErrors(validationResult, requestType, actionContext);

                // Convertir errores de FluentValidation a ErrorDetail
                var errorDetails = validationResult.Errors
                    .Select(e => new ErrorDetail
                    {
                        Code = $"Validation.{e.PropertyName}",
                        Description = e.ErrorMessage,
                        Field = e.PropertyName
                    })
                    .ToList();

                context.Result = new BadRequestObjectResult(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Los datos proporcionados no son válidos.",
                    Errors = errorDetails
                });
                return;
            }

            await next();
        }

        /// <summary>
        /// Extrae información del contexto de la acción (EntityType, EntityId, Action).
        /// </summary>
        private ActionContextInfo ExtractActionContext(ActionExecutingContext context, object request)
        {
            var actionName = context.ActionDescriptor.RouteValues["action"] ?? "Unknown";
            var controllerName = context.ActionDescriptor.RouteValues["controller"] ?? "Unknown";

            // Inferir EntityType desde el nombre del controller
            // Ejemplo: "AreasController" -> "Area"
            var entityType = controllerName.EndsWith("s")
                ? controllerName[..^1]  // Remover la 's' final
                : controllerName;

            // Inferir Action desde el nombre del método
            var action = InferActionFromMethodName(actionName);

            // Intentar extraer EntityId del request (para Update/Delete)
            int? entityId = null;

            // Buscar propiedades comunes de ID
            var idProperty = request.GetType().GetProperties()
                .FirstOrDefault(p =>
                    p.Name.Equals("Id", StringComparison.OrdinalIgnoreCase) ||
                    p.Name.Equals($"Id{entityType}", StringComparison.OrdinalIgnoreCase) ||
                    p.Name.EndsWith("Id", StringComparison.OrdinalIgnoreCase));

            if (idProperty != null && idProperty.PropertyType == typeof(int))
            {
                var value = idProperty.GetValue(request);
                if (value is int id && id > 0)
                {
                    entityId = id;
                }
            }

            // También buscar en route values
            if (!entityId.HasValue && context.RouteData.Values.TryGetValue("id", out var routeId))
            {
                if (int.TryParse(routeId?.ToString(), out var parsedId) && parsedId > 0)
                {
                    entityId = parsedId;
                }
            }

            return new ActionContextInfo
            {
                EntityType = entityType,
                EntityId = entityId,
                Action = action
            };
        }

        /// <summary>
        /// Infiere la acción CRUD desde el nombre del método.
        /// </summary>
        private string InferActionFromMethodName(string methodName)
        {
            var lowerMethod = methodName.ToLowerInvariant();

            if (lowerMethod.Contains("create") || lowerMethod.Contains("add") || lowerMethod.Contains("post"))
                return "Create";

            if (lowerMethod.Contains("update") || lowerMethod.Contains("edit") || lowerMethod.Contains("put"))
                return "Update";

            if (lowerMethod.Contains("delete") || lowerMethod.Contains("remove"))
                return "Delete";

            if (lowerMethod.Contains("get") || lowerMethod.Contains("list") || lowerMethod.Contains("search"))
                return "Read";

            return methodName; // Retornar el nombre original si no coincide
        }

        /// <summary>
        /// Enriquece el WideEvent con información detallada de los errores de validación.
        /// </summary>
        private void EnrichWideEventWithValidationErrors(
            ValidationResult validationResult,
            Type requestType,
            ActionContextInfo actionContext)
        {
            var wideEvent = _wideEventAccessor.Current;
            if (wideEvent == null) return;

            // ✅ Establecer EntityType, EntityId y Action
            wideEvent.EntityType = actionContext.EntityType;
            wideEvent.EntityId = actionContext.EntityId;
            wideEvent.Action = actionContext.Action;

            // Información básica del error
            wideEvent.ErrorType = "Validation";
            wideEvent.ErrorCode = "Validation.Failed";
            wideEvent.ErrorMessage = "Los datos proporcionados no son válidos.";
            wideEvent.IsRetriable = false;

            // Extraer información detallada de los errores
            var validationErrors = validationResult.Errors
                .Select(e => new
                {
                    Field = e.PropertyName,
                    Message = e.ErrorMessage,
                    Code = e.ErrorCode,
                    Severity = e.Severity.ToString()
                })
                .ToList();

            var fields = validationErrors
                .Select(e => e.Field)
                .Distinct()
                .ToList();

            var errorsByField = validationErrors
                .GroupBy(e => e.Field)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.Message).ToList()
                );

            // Agregar contexto rico al WideEvent
            wideEvent.AddContext("error", new Dictionary<string, object>
            {
                ["errorCount"] = validationErrors.Count,
                ["fieldCount"] = fields.Count,
                ["fields"] = fields,
                ["errors"] = validationErrors,
                ["errorsByField"] = errorsByField,
                ["requestType"] = requestType.Name
            });

            // Si hay información de severity, agregar resumen
            var errorsBySeverity = validationErrors
                .GroupBy(e => e.Severity)
                .ToDictionary(g => g.Key, g => g.Count());

            if (errorsBySeverity.Any())
            {
                wideEvent.AddContext("validation", new Dictionary<string, object>
                {
                    ["errorsBySeverity"] = errorsBySeverity
                });
            }
        }

        /// <summary>
        /// Clase auxiliar para almacenar información del contexto de la acción.
        /// </summary>
        private class ActionContextInfo
        {
            public string EntityType { get; set; } = string.Empty;
            public int? EntityId { get; set; }
            public string Action { get; set; } = string.Empty;
        }
    }
}