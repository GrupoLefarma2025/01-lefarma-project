namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    public record HandlerResult(bool Exitoso, string? Error = null)
    {
        public static HandlerResult Ok() => new(true);
        public static HandlerResult Fail(string error) => new(false, error);
    }
}
