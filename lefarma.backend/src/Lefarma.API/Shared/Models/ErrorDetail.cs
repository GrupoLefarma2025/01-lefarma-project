namespace Lefarma.API.Shared.Models
{
public class ErrorDetail
    {
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Field { get; set; }
    }
}
