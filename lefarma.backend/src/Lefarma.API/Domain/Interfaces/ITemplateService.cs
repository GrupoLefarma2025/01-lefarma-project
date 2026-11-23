namespace Lefarma.API.Domain.Interfaces;
public interface ITemplateService
{
    Task<string> RenderAsync(string templateId, Dictionary<string, object> data, CancellationToken ct = default);

    Task<bool> TemplateExistsAsync(string templateId, CancellationToken ct = default);

    Task RegisterTemplateAsync(string templateId, string content, TemplateType type);
}
