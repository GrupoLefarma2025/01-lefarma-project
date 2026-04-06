using ErrorOr;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Shared.Extensions
{
public static class ResultExtensions
    {
        public static IActionResult ToActionResult<T>(
            this ErrorOr<T> result,
            ControllerBase controller,
            Func<T, IActionResult> onSuccess)
        {
            if (result.IsError)
            {
                var wideEventAccessor = controller.HttpContext.RequestServices
                    .GetService<IWideEventAccessor>();

                EnrichWideEventWithError(result, wideEventAccessor);
                return result.FirstError.Type switch
                {
                    ErrorType.NotFound => controller.NotFound(CreateErrorResponse(result)),
                    ErrorType.Validation => controller.BadRequest(CreateErrorResponse(result)),
                    ErrorType.Conflict => controller.Conflict(CreateErrorResponse(result)),
                    _ => controller.StatusCode(
                        StatusCodes.Status500InternalServerError,
                        CreateErrorResponse(result))
                };
            }

            return onSuccess(result.Value);
        }

        /// <summary>
        /// Enriquece el WideEvent con información del error.
        /// </summary>
        private static void EnrichWideEventWithError<T>(ErrorOr<T> result, IWideEventAccessor? wideEventAccessor)
        {
            var wideEvent = wideEventAccessor?.Current;
            if (wideEvent == null) return;

            var firstError = result.FirstError;

            // información básica del error
            wideEvent.ErrorType = firstError.Type.ToString();
            wideEvent.ErrorCode = firstError.Code;
            wideEvent.ErrorMessage = firstError.Description;
            wideEvent.IsRetriable = IsRetriableError(firstError.Type);

            // Detalles de todos los errores
            var errorDetails = result.Errors.Select(e => new
            {
                Code = e.Code,
                Description = e.Description,
                Type = e.Type.ToString(),
                Field = e.Metadata?.ContainsKey("field") == true
                    ? e.Metadata["field"]?.ToString()
                    : null,
                Metadata = e.Metadata
            }).ToList();

            var errorContext = new Dictionary<string, object>
            {
                ["errorCount"] = result.Errors.Count,
                ["errors"] = errorDetails
            };

            // Información adicional para errores de validación
            if (firstError.Type == ErrorType.Validation)
            {
                var fields = errorDetails
                    .Where(e => !string.IsNullOrEmpty(e.Field))
                    .Select(e => e.Field!)
                    .Distinct()
                    .ToList();

                if (fields.Any())
                {
                    errorContext["fields"] = fields;
                    errorContext["fieldCount"] = fields.Count;
                }

                // Errores por campo
                var errorsByField = errorDetails
                    .Where(e => !string.IsNullOrEmpty(e.Field))
                    .GroupBy(e => e.Field)
                    .ToDictionary(
                        g => g.Key!,
                        g => g.Select(e => e.Description).ToList()
                    );

                if (errorsByField.Any())
                {
                    errorContext["errorsByField"] = errorsByField;
                }
            }

            wideEvent.AddContext("error", errorContext);
        }

        /// <summary>
        /// Determina si un error es reintentable.
        /// </summary>
        private static bool IsRetriableError(ErrorType errorType)
        {
            return errorType switch
            {
                ErrorType.Failure => true,
                ErrorType.Unexpected => true,
                _ => false
            };
        }

        private static ApiResponse<object> CreateErrorResponse<T>(ErrorOr<T> result)
        {
            var errorDetails = result.Errors.Select(e => new ErrorDetail
            {
                Code = e.Code,
                Description = e.Description,
                Field = e.Metadata?.ContainsKey("field") == true
                    ? e.Metadata["field"]?.ToString()
                    : null
            }).ToList();

            return new ApiResponse<object>
            {
                Success = false,
                Message = GetUserFriendlyMessage(result.FirstError),
                Data = null,
                Errors = errorDetails
            };
        }

        private static string GetUserFriendlyMessage(Error error)
        {
            return error.Code switch
            {
                "Database.Error" => "No se pudo completar la operación en la base de datos.",
                var code when code.EndsWith(".NotFound") => "No se encontró el recurso solicitado.",
                var code when code.EndsWith(".AlreadyExists") => "Ya existe un registro con los datos proporcionados.",
                var code when code.EndsWith(".HasDependencies") => "No se puede eliminar el recurso porque tiene registros asociados.",  // ✅
                var code when code.EndsWith(".ConcurrencyError") => "El recurso fue modificado por otro usuario. Recargue los datos.",
                var code when code.EndsWith(".DeleteFailed") => "No se pudo eliminar el recurso.",  // ✅ Nuevo
                var code when code.StartsWith("Validation.") => "Los datos proporcionados no son válidos.",
                "InternalServerError" => "Se produjo un error inesperado en el servidor.",
                _ => error.Type switch
                {
                    ErrorType.NotFound => "No se encontró el recurso solicitado.",
                    ErrorType.Validation => "Los datos proporcionados no son válidos.",
                    ErrorType.Conflict => "Existe un conflicto con la operación solicitada.",
                    ErrorType.Failure => "No se pudo completar la operación.",
                    ErrorType.Unexpected => "Se produjo un error inesperado.",
                    _ => "No se pudo completar la operación."
                }
            };
        }
    }
}
