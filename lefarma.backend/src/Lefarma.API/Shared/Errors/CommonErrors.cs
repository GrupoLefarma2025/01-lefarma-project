using ErrorOr;

namespace Lefarma.API.Shared.Errors
{
/// <summary>
    /// Errores comunes predefinidos para toda la aplicación.
    /// </summary>
    public static class CommonErrors
    {
        public static Error NotFound(string entityName, string? identifier = null) => Error.NotFound(
            code: $"{entityName}.NotFound",
            description: identifier != null
                ? $"{entityName} con identificador '{identifier}' no encontrado."
                : $"No se encontraron registros de {entityName}.");

        public static Error Validation(string field, string message) => Error.Validation(
            code: $"Validation.{field}",
            description: message,
            metadata: new Dictionary<string, object> { ["field"] = field });

        public static Error AlreadyExists(string entityName, string field, string value) => Error.Conflict(
            code: $"{entityName}.AlreadyExists",
            description: $"Ya existe {entityName} con {field} '{value}'.");

        public static Error DeleteFailed(string entityName, string? customMessage = null) => Error.Failure(
            code: $"{entityName}.DeleteFailed",
            description: customMessage ?? $"No se pudo eliminar {entityName}. Intente nuevamente.");

        public static Error HasDependencies(string entityName) => Error.Conflict(
            code: $"{entityName}.HasDependencies",
            description: $"No se puede eliminar {entityName} porque tiene registros asociados.");

        public static Error ConcurrencyError(string entityName) => Error.Conflict(
            code: $"{entityName}.ConcurrencyError",
            description: $"{entityName} fue modificado por otro usuario. Recargue los datos.");

        public static Error InternalServerError(string message = "Se produjo un error inesperado.") => Error.Unexpected(
            code: "InternalServerError",
            description: message);

        public static Error DatabaseError(string operation) => Error.Failure(
            code: "Database.Error",
            description: $"Error al {operation} en la base de datos.");

        public static Error Conflict(string entityName, string reason) => Error.Conflict(
            code: $"{entityName}.Conflict",
            description: reason);

        public static Error Failure(string entityName, string message) => Error.Failure(
            code: $"{entityName}.Failure",
            description: message);
    }
}
