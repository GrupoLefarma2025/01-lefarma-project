using FluentValidation;
using FluentValidation.Results;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lefarma.API.Infrastructure.Filters
{
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
            var requestType = context.ActionArguments
                .Values
                .Where(v => v != null &&
                           !v!.GetType().IsPrimitive &&
                           !v.GetType().IsValueType &&
                           v.GetType() != typeof(string))
                .Select(v => v!.GetType())
                .FirstOrDefault();

            if (requestType == null)
            {
                await next();
                return;
            }

            var validatorType = typeof(IValidator<>).MakeGenericType(requestType);
            var validator = _serviceProvider.GetService(validatorType) as IValidator;

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

            var validationContext = new ValidationContext<object>(request);
            var validationResult = await validator.ValidateAsync(validationContext, CancellationToken.None);

            if (validationResult == null)
            {
                await next();
                return;
            }

            if (!validationResult.IsValid)
            {
                var actionContext = ExtractActionContext(context, request);

                EnrichWideEventWithValidationErrors(validationResult, requestType, actionContext);

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

        private ActionContextInfo ExtractActionContext(ActionExecutingContext context, object request)
        {
            var actionName = context.ActionDescriptor.RouteValues["action"] ?? "Unknown";
            var controllerName = context.ActionDescriptor.RouteValues["controller"] ?? "Unknown";

            var entityType = controllerName.EndsWith("s")
                ? controllerName[..^1]  
                : controllerName;

            var action = InferActionFromMethodName(actionName);

            int? entityId = null;

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

            return methodName; 
        }

        private void EnrichWideEventWithValidationErrors(
            ValidationResult validationResult,
            Type requestType,
            ActionContextInfo actionContext)
        {
            var wideEvent = _wideEventAccessor.Current;
            if (wideEvent == null) return;

            wideEvent.EntityType = actionContext.EntityType;
            wideEvent.EntityId = actionContext.EntityId;
            wideEvent.Action = actionContext.Action;

            wideEvent.ErrorType = "Validation";
            wideEvent.ErrorCode = "Validation.Failed";
            wideEvent.ErrorMessage = "Los datos proporcionados no son válidos.";
            wideEvent.IsRetriable = false;

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

            wideEvent.AddContext("error", new Dictionary<string, object>
            {
                ["errorCount"] = validationErrors.Count,
                ["fieldCount"] = fields.Count,
                ["fields"] = fields,
                ["errors"] = validationErrors,
                ["errorsByField"] = errorsByField,
                ["requestType"] = requestType.Name
            });

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

        private class ActionContextInfo
        {
            public string EntityType { get; set; } = string.Empty;
            public int? EntityId { get; set; }
            public string Action { get; set; } = string.Empty;
        }
    }
}