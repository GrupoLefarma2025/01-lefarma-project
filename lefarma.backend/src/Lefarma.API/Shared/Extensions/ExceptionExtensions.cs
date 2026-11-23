using System.Text;

namespace Lefarma.API.Shared.Extensions;
public static class ExceptionExtensions
{
    public static string GetDetailedMessage(this Exception exception, bool includeStackTrace = false)
    {
        if (exception == null)
            return string.Empty;

        var sb = new StringBuilder();
        
        sb.Append($"{exception.GetType().Name}: {exception.Message}");

        var innerException = exception.InnerException;
        var depth = 1;
        while (innerException != null && depth <= 5) 
        {
            sb.Append($" | Inner[{depth}]: {innerException.GetType().Name}: {innerException.Message}");
            innerException = innerException.InnerException;
            depth++;
        }

        if (includeStackTrace && !string.IsNullOrWhiteSpace(exception.StackTrace))
        {
            sb.Append($" | StackTrace: {exception.StackTrace}");
        }

        return sb.ToString();
    }

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
