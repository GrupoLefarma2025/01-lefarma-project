using System.Text;

namespace Lefarma.API.Shared.Extensions;
/// <summary>
/// Extensiones para manejo de excepciones
/// </summary>
public static class ExceptionExtensions
{
    /// <summary>
    /// Obtiene un mensaje detallado de la excepción incluyendo InnerException
    /// </summary>
    /// <param name="exception">La excepción a formatear</param>
    /// <param name="includeStackTrace">Si se debe incluir el stack trace (default: false)</param>
    /// <returns>Mensaje formateado con tipo, mensaje y InnerException si existe</returns>
    public static string GetDetailedMessage(this Exception exception, bool includeStackTrace = false)
    {
        if (exception == null)
            return string.Empty;

        var sb = new StringBuilder();
        
        // Agregar tipo de excepción y mensaje principal
        sb.Append($"{exception.GetType().Name}: {exception.Message}");

        // Agregar InnerException si existe (recursivamente)
        var innerException = exception.InnerException;
        var depth = 1;
        while (innerException != null && depth <= 5) // Limitar a 5 niveles de profundidad
        {
            sb.Append($" | Inner[{depth}]: {innerException.GetType().Name}: {innerException.Message}");
            innerException = innerException.InnerException;
            depth++;
        }

        // Agregar stack trace si se solicita (útil en desarrollo, no en producción)
        if (includeStackTrace && !string.IsNullOrWhiteSpace(exception.StackTrace))
        {
            sb.Append($" | StackTrace: {exception.StackTrace}");
        }

        return sb.ToString();
    }

    /// <summary>
    /// Obtiene el mensaje más específico de la excepción (del InnerException más profundo)
    /// </summary>
    /// <param name="exception">La excepción</param>
    /// <returns>Mensaje del InnerException más profundo o mensaje principal</returns>
    public static string GetInnermostMessage(this Exception exception)
    {
        if (exception == null)
            return string.Empty;

        var innermost = exception;
        while (innermost.InnerException != null)
        {
            innermost = innermost.InnerException;
        }

        return innermost.Message;
    }
}
