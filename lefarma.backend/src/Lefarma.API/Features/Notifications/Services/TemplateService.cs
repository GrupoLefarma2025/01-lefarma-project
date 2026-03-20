using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Razor;

namespace Lefarma.API.Features.Notifications.Services;

/// <summary>
/// Service for rendering Razor templates for notifications.
/// Uses IRazorViewEngine to compile and render .cshtml templates at runtime.
/// </summary>
public class TemplateService : ITemplateService
{
    private readonly IRazorViewEngine _razorViewEngine;
    private readonly ITempDataProvider _tempDataProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TemplateService> _logger;
    private readonly Dictionary<string, (string Content, TemplateType Type)> _databaseTemplates;

    public TemplateService(
        IRazorViewEngine razorViewEngine,
        ITempDataProvider tempDataProvider,
        IServiceProvider serviceProvider,
        ILogger<TemplateService> logger)
    {
        _razorViewEngine = razorViewEngine;
        _tempDataProvider = tempDataProvider;
        _serviceProvider = serviceProvider;
        _logger = logger;
        _databaseTemplates = new Dictionary<string, (string, TemplateType)>(StringComparer.OrdinalIgnoreCase);
    }

    /// <inheritdoc/>
    public async Task<string> RenderAsync(string templateId, Dictionary<string, object> data, CancellationToken ct = default)
    {
        _logger.LogDebug("Rendering template: {TemplateId}", templateId);

        try
        {
            // Build view path based on template ID
            var viewPath = GetViewPath(templateId);

            // Try to find the view in the file system
            var viewEngineResult = _razorViewEngine.FindView(
                actionContext: GetActionContext(),
                viewName: viewPath,
                isMainPage: false);

            // If not found in file system, check database templates
            if (!viewEngineResult.Success)
            {
                _logger.LogDebug("View not found in file system: {ViewPath}", viewPath);

                if (_databaseTemplates.TryGetValue(templateId, out var dbTemplate))
                {
                    // For database templates, we use simple variable substitution
                    return await RenderDatabaseTemplateAsync(dbTemplate.Content, data, ct);
                }

                throw new InvalidOperationException(
                    $"Template '{templateId}' not found. Expected path: {viewPath}");
            }

            // Create ViewModel from data
            var viewModel = CreateViewModel(data);

            // Render the Razor view
            var htmlContent = await RenderViewAsync(viewEngineResult.View, viewModel);

            _logger.LogDebug("Template rendered successfully: {TemplateId}", templateId);

            return htmlContent;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rendering template: {TemplateId}", templateId);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> TemplateExistsAsync(string templateId, CancellationToken ct = default)
    {
        var viewPath = GetViewPath(templateId);

        // Check file system
        var viewEngineResult = _razorViewEngine.FindView(
            actionContext: GetActionContext(),
            viewName: viewPath,
            isMainPage: false);

        if (viewEngineResult.Success)
        {
            return true;
        }

        // Check database templates
        return await Task.FromResult(_databaseTemplates.ContainsKey(templateId));
    }

    /// <inheritdoc/>
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

        // For Razor templates, we'll store them but they won't be compiled at runtime
        // This is a limitation - runtime compilation of Razor from strings requires additional setup
        if (type == TemplateType.Html)
        {
            _logger.LogWarning(
                "Dynamic Razor templates cannot be compiled at runtime. " +
                "Template '{TemplateId}' will use simple substitution. " +
                "For full Razor support, create .cshtml files in Views/Notifications/",
                templateId);
        }

        _databaseTemplates[templateId] = (content, type);

        await Task.CompletedTask;
    }

    /// <summary>
    /// Gets the view path for a template ID.
    /// Maps template IDs to Razor view file paths.
    /// </summary>
    private static string GetViewPath(string templateId)
    {
        // Convert template ID to view path
        // Examples:
        // "OrderCreated" -> "/Views/Notifications/OrderCreated.cshtml"
        // "Email/Welcome" -> "/Views/Notifications/Email/Welcome.cshtml"
        // "Telegram/Alert" -> "/Views/Notifications/Telegram/Alert.cshtml"

        return $"/Views/Notifications/{templateId}";
    }

    /// <summary>
    /// Creates a ViewModel from the data dictionary.
    /// </summary>
    private static NotificationTemplateViewModel CreateViewModel(Dictionary<string, object> data)
    {
        var viewModel = new NotificationTemplateViewModel();

        if (data.TryGetValue("customerName", out var customerName))
        {
            viewModel.CustomerName = customerName?.ToString();
        }

        if (data.TryGetValue("orderId", out var orderId))
        {
            viewModel.OrderId = orderId?.ToString();
        }

        if (data.TryGetValue("totalAmount", out var totalAmount) && totalAmount != null)
        {
            if (totalAmount is decimal decimalAmount)
            {
                viewModel.TotalAmount = decimalAmount;
            }
            else if (decimal.TryParse(totalAmount.ToString(), out var parsedAmount))
            {
                viewModel.TotalAmount = parsedAmount;
            }
        }

        if (data.TryGetValue("items", out var items) && items is List<NotificationItemViewModel> itemsList)
        {
            viewModel.Items = itemsList;
        }

        if (data.TryGetValue("message", out var message))
        {
            viewModel.Message = message?.ToString();
        }

        // All remaining data goes to CustomData
        viewModel.CustomData = data
            .Where(kvp => !new[] { "customerName", "orderId", "totalAmount", "items", "message" }
                .Contains(kvp.Key, StringComparer.OrdinalIgnoreCase))
            .ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value);

        return viewModel;
    }

    /// <summary>
    /// Renders a Razor view to string.
    /// </summary>
    private async Task<string> RenderViewAsync(IRazorView view, NotificationTemplateViewModel viewModel)
    {
        using var stringWriter = new StringWriter();

        var viewContext = new ViewContext
        {
            View = view,
            ViewData = new ViewDataDictionary<NotificationTemplateViewModel>(
                metadataProvider: new EmptyModelMetadataProvider(),
                modelState: new ModelStateDictionary())
            {
                Model = viewModel
            },
            Writer = stringWriter,
            HttpContext = GetActionContext().HttpContext,
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
            ActionDescriptor = new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor()
        };

        await view.RenderAsync(viewContext);

        return stringWriter.ToString();
    }

    /// <summary>
    /// Renders a database template using simple variable substitution.
    /// Supports {{variableName}} syntax.
    /// </summary>
    private static async Task<string> RenderDatabaseTemplateAsync(string content, Dictionary<string, object> data, CancellationToken ct)
    {
        var result = content;

        foreach (var kvp in data)
        {
            var placeholder = $"{{{{{kvp.Key}}}}}";
            var value = kvp.Value?.ToString() ?? string.Empty;
            result = result.Replace(placeholder, value);
        }

        return await Task.FromResult(result);
    }

    /// <summary>
    /// Creates an ActionContext for view rendering.
    /// </summary>
    private Microsoft.AspNetCore.Mvc.ActionContext GetActionContext()
    {
        var httpContext = new DefaultHttpContext
        {
            RequestServices = _serviceProvider
        };

        return new Microsoft.AspNetCore.Mvc.ActionContext(
            httpContext,
            new Microsoft.AspNetCore.Routing.RouteData(),
            new Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor());
    }
}
