using HandlebarsDotNet;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Notifications.Services;
public class TemplateService : ITemplateService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TemplateService> _logger;
    private readonly Dictionary<string, (string Content, TemplateType Type)> _databaseTemplates;

    public TemplateService(
        IServiceProvider serviceProvider,
        ILogger<TemplateService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _databaseTemplates = new Dictionary<string, (string Content, TemplateType Type)>(StringComparer.OrdinalIgnoreCase);

        RegisterHelpers();
    }

    private static void RegisterHelpers()
    {
        Handlebars.RegisterHelper("formatDate", (writer, context, parameters) =>
        {
            if (parameters.Length > 0 && parameters[0] is DateTime date)
            {
                writer.WriteSafeString(date.ToString("dd/MM/yyyy"));
            }
        });

        Handlebars.RegisterHelper("formatCurrency", (writer, context, parameters) =>
        {
            if (parameters.Length > 0 && decimal.TryParse(parameters[0]?.ToString(), out var amount))
            {
                writer.WriteSafeString(amount.ToString("C"));
            }
        });

        Handlebars.RegisterHelper("uppercase", (writer, context, parameters) =>
        {
            if (parameters.Length > 0)
            {
                writer.WriteSafeString(parameters[0]?.ToString()?.ToUpper());
            }
        });

        Handlebars.RegisterHelper("lowercase", (writer, context, parameters) =>
        {
            if (parameters.Length > 0)
            {
                writer.WriteSafeString(parameters[0]?.ToString()?.ToLower());
            }
        });

        Handlebars.RegisterHelper("ifEquals", (output, options, context, arguments) =>
        {
            if (arguments.Length >= 2 &&
                arguments[0]?.ToString() == arguments[1]?.ToString())
            {
                options.Template(output, context);
            }
            else
            {
                options.Inverse(output, context);
            }
        });
    }

    public async Task<string> RenderAsync(string templateId, Dictionary<string, object> data, CancellationToken ct = default)
    {
        _logger.LogDebug("Rendering template: {TemplateId}", templateId);

        try
        {
            if (!_databaseTemplates.TryGetValue(templateId, out var template))
            {
                throw new InvalidOperationException(
                    $"Template '{templateId}' not found. " +
                    $"Register the template using RegisterTemplateAsync() first.");
            }

            var result = template.Type == TemplateType.Html
                ? await RenderHandlebarsTemplateAsync(template.Content, data, ct)
                : await RenderSimpleTemplateAsync(template.Content, data, ct);

            _logger.LogDebug("Template rendered successfully: {TemplateId}", templateId);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rendering template: {TemplateId}", templateId);
            throw;
        }
    }

    public async Task<bool> TemplateExistsAsync(string templateId, CancellationToken ct = default)
    {
        return await Task.FromResult(_databaseTemplates.ContainsKey(templateId));
    }

    public async Task RegisterTemplateAsync(string templateId, string content, TemplateType type)
    {
        _logger.LogDebug("Registering template: {TemplateId} with type: {Type}", templateId, type);

        if (string.IsNullOrWhiteSpace(templateId))
        {
            throw new ArgumentException("Template ID cannot be null or empty.", nameof(templateId));
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("Template content cannot be null or empty.", nameof(content));
        }

        if (type == TemplateType.Html)
        {
            try
            {
                Handlebars.Compile(content);
                _logger.LogDebug("Handlebars template compiled successfully: {TemplateId}", templateId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to precompile Handlebars template: {TemplateId}. Will compile at runtime.", templateId);
            }
        }

        _databaseTemplates[templateId] = (content, type);

        await Task.CompletedTask;
    }

    private static Task<string> RenderHandlebarsTemplateAsync(string template, Dictionary<string, object> data, CancellationToken ct)
    {
        try
        {
            var handlebarsTemplate = Handlebars.Compile(template);

            var result = handlebarsTemplate(data);

            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Error rendering Handlebars template", ex);
        }
    }

    private static Task<string> RenderSimpleTemplateAsync(string template, Dictionary<string, object> data, CancellationToken ct)
    {
        var result = template;

        foreach (var kvp in data)
        {
            var placeholder = $"{{{{{kvp.Key}}}}}";
            var value = kvp.Value?.ToString() ?? string.Empty;
            result = result.Replace(placeholder, value);
        }

        return Task.FromResult(result);
    }
}
