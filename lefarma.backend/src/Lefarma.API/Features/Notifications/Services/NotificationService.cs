using System.Security.Claims;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Notifications;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Features.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Notifications.Services;
public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repository;
    private readonly ITemplateService _templateService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NotificationService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ApplicationDbContext _dbContext;
    private readonly AsokamDbContext _asokamDbContext;
    private readonly ISseService _sseService;

    public NotificationService(
        INotificationRepository repository,
        ITemplateService templateService,
        IServiceProvider serviceProvider,
        ILogger<NotificationService> logger,
        IHttpContextAccessor httpContextAccessor,
        ApplicationDbContext dbContext,
        AsokamDbContext asokamDbContext,
        ISseService sseService)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _templateService = templateService ?? throw new ArgumentNullException(nameof(templateService));
        _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _asokamDbContext = asokamDbContext ?? throw new ArgumentNullException(nameof(asokamDbContext));
        _sseService = sseService ?? throw new ArgumentNullException(nameof(sseService));
    }

    public async Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending notification: {Title} to {ChannelCount} channels",
            request.Title, request.Channels.Count);

        var notification = new Notification
        {
            Title = request.Title,
            Message = request.Message,
            Type = request.Type,
            Priority = request.Priority,
            Category = request.Category,
            TemplateId = request.TemplateId,
            TemplateData = request.TemplateData != null
                ? JsonSerializer.Serialize(request.TemplateData)
                : null,
            ScheduledFor = request.ScheduledFor,
            ExpiresAt = request.ExpiresAt,
            CreatedBy = "system" 
        };

        notification = await _repository.CreateAsync(notification, ct);

        _logger.LogDebug("Notification created with ID: {NotificationId}", notification.Id);

        var channelResults = new Dictionary<string, ChannelResult>();
        var notificationChannels = new List<NotificationChannel>();

        foreach (var channelRequest in request.Channels)
        {
            _logger.LogDebug("Processing channel: {ChannelType}", channelRequest.ChannelType);

            try
            {
                var channel = GetChannelByKey(channelRequest.ChannelType);
                if (channel == null)
                {
                    _logger.LogWarning("Channel not found: {ChannelType}", channelRequest.ChannelType);
                    channelResults[channelRequest.ChannelType] = new ChannelResult
                    {
                        Success = false,
                        Message = $"Channel '{channelRequest.ChannelType}' not registered"
                    };
                    continue;
                }

                var resolvedRecipients = await ResolveRecipientsToEmailsAsync(channelRequest, ct);

                string messageBody = request.Message;
                if (!string.IsNullOrWhiteSpace(request.TemplateId))
                {
                    _logger.LogDebug("Rendering template: {TemplateId}", request.TemplateId);
                    messageBody = await _templateService.RenderAsync(
                        request.TemplateId,
                        request.TemplateData ?? new Dictionary<string, object>(),
                        ct);
                }

                var notificationMessage = new NotificationMessage
                {
                    Title = request.Title,
                    Body = messageBody,
                    Recipients = string.Join(";", resolvedRecipients),
                    Data = channelRequest.ChannelSpecificData ?? new Dictionary<string, object>()
                };

                if (!string.IsNullOrWhiteSpace(request.TemplateId))
                {
                    notificationMessage.Data["templateId"] = request.TemplateId;
                    notificationMessage.Data["templateData"] = request.TemplateData ?? new Dictionary<string, object>();
                }

                var channelResult = await channel.SendAsync(notificationMessage, ct);

                var notificationChannel = new NotificationChannel
                {
                    NotificationId = notification.Id,
                    ChannelType = channelRequest.ChannelType,
                    Status = channelResult.Success ? "sent" : "failed",
                    Recipient = string.Join(";", resolvedRecipients),
                    SentAt = channelResult.Success ? DateTime.UtcNow : null,
                    ErrorMessage = channelResult.Success ? null : channelResult.Message,
                    ExternalId = channelResult.ExternalId
                };
                notificationChannels.Add(notificationChannel);

                channelResults[channelRequest.ChannelType] = channelResult;

                _logger.LogInformation(
                    "Channel {ChannelType} processing completed. Success: {Success}",
                    channelRequest.ChannelType,
                    channelResult.Success);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing channel: {ChannelType}", channelRequest.ChannelType);

                channelResults[channelRequest.ChannelType] = new ChannelResult
                {
                    Success = false,
                    Message = "Error al procesar el canal de notificación."
                };

                notificationChannels.Add(new NotificationChannel
                {
                    NotificationId = notification.Id,
                    ChannelType = channelRequest.ChannelType,
                    Status = "failed",
                    Recipient = "",
                    ErrorMessage = ex.Message
                });
            }
        }

        var inAppChannelRequest = request.Channels.FirstOrDefault(c => c.ChannelType == "in-app");
        if (inAppChannelRequest != null)
        {
            await CreateUserNotificationsAsync(notification, inAppChannelRequest, ct);
        }

        notification.Channels = notificationChannels;
        await _repository.UpdateAsync(notification, ct);

        _logger.LogInformation(
            "Notification {NotificationId} sent successfully to {SuccessCount}/{TotalCount} channels",
            notification.Id,
            channelResults.Count(r => r.Value.Success),
            channelResults.Count);

        return new SendNotificationResponse
        {
            NotificationId = notification.Id,
            ChannelResults = channelResults,
            CreatedAt = notification.CreatedAt
        };
    }

    public async Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending bulk notification to {UserCount} users", request.UserIds.Count);

        const int MaxConcurrency = 10;
        using var semaphore = new SemaphoreSlim(MaxConcurrency);

        var tasks = request.UserIds.Select(async userId =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                var userRequest = new SendNotificationRequest
                {
                    Channels = request.Channels.Select(c => new NotificationChannelRequest
                    {
                        ChannelType = c.ChannelType,
                        UserIds = c.UserIds,
                        RoleNames = c.RoleNames,
                        ChannelSpecificData = new Dictionary<string, object>(c.ChannelSpecificData ?? []) { ["userId"] = userId }
                    }).ToList(),
                    Title = request.Title,
                    Message = request.Message,
                    Type = request.Type,
                    Priority = request.Priority,
                    Category = request.Category,
                    TemplateId = request.TemplateId,
                    TemplateData = request.TemplateData,
                    ScheduledFor = request.ScheduledFor,
                    ExpiresAt = request.ExpiresAt
                };

                return (Response: await SendAsync(userRequest, ct), Error: (Exception?)null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending bulk notification to user {UserId}", userId);
                return (Response: (SendNotificationResponse?)null, Error: ex);
            }
            finally
            {
                semaphore.Release();
            }
        }).ToList();

        var taskResults = await Task.WhenAll(tasks);

        var results = new Dictionary<string, ChannelResult>();
        int successCount = 0;
        int firstNotificationId = 0;

        foreach (var (response, _) in taskResults)
        {
            if (response == null) continue;

            successCount++;
            if (firstNotificationId == 0)
                firstNotificationId = response.NotificationId;

            foreach (var kvp in response.ChannelResults)
            {
                if (!results.ContainsKey(kvp.Key))
                {
                    results[kvp.Key] = new ChannelResult
                    {
                        Success = true,
                        SentRecipients = new List<string>(),
                        FailedRecipients = new List<string>()
                    };
                }

                if (kvp.Value.Success)
                    results[kvp.Key].SentRecipients?.AddAll(kvp.Value.SentRecipients ?? []);
                else
                    results[kvp.Key].FailedRecipients?.AddAll(kvp.Value.FailedRecipients ?? []);
            }
        }

        _logger.LogInformation(
            "Bulk notification completed: {SuccessCount}/{UserCount} users successful",
            successCount,
            request.UserIds.Count);

        return new SendNotificationResponse
        {
            NotificationId = firstNotificationId,
            ChannelResults = results,
            CreatedAt = DateTime.UtcNow
        };
    }

    public async Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default)
    {
        _logger.LogInformation("Sending notification to roles: {Roles}", string.Join(", ", request.Roles));

throw new NotImplementedException(
            "SendByRoleAsync is not yet implemented. " +
            "Requires integration with the role/user management system.");
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Getting notifications for user {UserId}, unreadOnly: {UnreadOnly}",
            userId,
            unreadOnly);

        var notifications = await _repository.GetByUserIdAsync(userId, unreadOnly, ct);

        var dtos = notifications.Select(n => new NotificationDto
        {
            Id = n.Id,
            Title = n.Title,
            Message = n.Message,
            Type = n.Type,
            Priority = n.Priority,
            CreatedAt = n.CreatedAt,
            IsRead = false, 
            ReceivedVia = n.Channels.Select(c => c.ChannelType).ToList()
        }).ToList();

        foreach (var dto in dtos)
        {
            var userNotification = await _repository.GetUserNotificationAsync(dto.Id, userId, ct);
            if (userNotification != null)
            {
                dto.IsRead = userNotification.IsRead;
            }
        }

        return dtos;
    }

    public async Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Marking notification {NotificationId} as read for user {UserId}",
            notificationId,
            userId);

        var userNotification = await _repository.GetUserNotificationAsync(notificationId, userId, ct);

        if (userNotification == null)
        {
            _logger.LogWarning(
                "User notification not found: NotificationId={NotificationId}, UserId={UserId}",
                notificationId,
                userId);
            return;
        }

        if (userNotification.IsRead)
        {
            _logger.LogDebug("Notification already marked as read");
            return;
        }

        userNotification.IsRead = true;
        userNotification.ReadAt = DateTime.UtcNow;

        await _repository.UpdateUserNotificationAsync(userNotification, ct);

        _logger.LogInformation(
            "Notification {NotificationId} marked as read for user {UserId}",
            notificationId,
            userId);
    }

    public async Task MarkAllAsReadAsync(int userId, CancellationToken ct = default)
    {
        _logger.LogInformation("Marking all notifications as read for user {UserId}", userId);

        var notifications = await _repository.GetByUserIdAsync(userId, false, ct);

        int markedCount = 0;
        foreach (var notification in notifications)
        {
            var userNotification = await _repository.GetUserNotificationAsync(notification.Id, userId, ct);
            if (userNotification != null && !userNotification.IsRead)
            {
                userNotification.IsRead = true;
                userNotification.ReadAt = DateTime.UtcNow;
                await _repository.UpdateUserNotificationAsync(userNotification, ct);
                markedCount++;
            }
        }

        _logger.LogInformation(
            "Marked {MarkedCount} notifications as read for user {UserId}",
            markedCount,
            userId);
    }

    private INotificationChannel? GetChannelByKey(string channelType)
    {
        return _serviceProvider.GetKeyedService<INotificationChannel>(channelType);
    }

    private async Task<List<string>> ResolveRecipientsToEmailsAsync(
        NotificationChannelRequest channelRequest,
        CancellationToken ct)
    {
        var emails = new List<string>();
        var userIds = new List<int>();

        if (channelRequest.UserIds != null && channelRequest.UserIds.Any())
        {
            userIds.AddRange(channelRequest.UserIds);
        }

        if (channelRequest.RoleNames != null && channelRequest.RoleNames.Any())
        {
            var roleUserIds = await GetUserIdsByRoleNamesAsync(channelRequest.RoleNames, ct);
            userIds.AddRange(roleUserIds);
        }

        if (channelRequest.Emails != null && channelRequest.Emails.Count > 0)
        {
            foreach (var correo in channelRequest.Emails)
            {
                if (EsCorreoValido(correo))
                {
                    emails.Add(correo.Trim());
                }
            }
        }

        userIds = userIds.Distinct().ToList();

        if (userIds.Any())
        {
            var users = await _asokamDbContext.Usuarios
                .Where(u => userIds.Contains(u.IdUsuario) && u.EsActivo && !u.EsAnonimo && !u.EsRobot)
                .Select(u => u.Correo)
                .Where(email => !string.IsNullOrWhiteSpace(email))
                .Distinct()
                .ToListAsync(ct);

            emails.AddRange(users!);
            _logger.LogDebug("Resolved {UserCount} users to {EmailCount} emails", userIds.Count, users.Count);
        }

        return emails.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    internal static bool EsCorreoValido(string? correo)
    {
        if (string.IsNullOrWhiteSpace(correo))
        {
            return false;
        }

        try
        {
            _ = new System.Net.Mail.MailAddress(correo.Trim());
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private async Task<List<int>> GetUserIdsByRoleNamesAsync(List<string> roleNames, CancellationToken ct)
    {
        var roles = await _asokamDbContext.UsuariosRoles
            .Include(ur => ur.Rol)
            .Where(ur => roleNames.Contains(ur.Rol.NombreRol))
            .Select(ur => ur.IdUsuario)
            .Distinct()
            .ToListAsync(ct);

        _logger.LogDebug("Found {UserCount} users with roles: {Roles}", roles.Count, string.Join(", ", roleNames));
        return roles;
    }

    private async Task CreateUserNotificationsAsync(
        Notification notification,
        NotificationChannelRequest inAppChannelRequest,
        CancellationToken ct)
    {
        _logger.LogDebug("Creating user notifications for in-app channel");

        var userIds = new List<int>();

        if (inAppChannelRequest.UserIds != null && inAppChannelRequest.UserIds.Any())
        {
            userIds.AddRange(inAppChannelRequest.UserIds);
        }

        if (inAppChannelRequest.RoleNames != null && inAppChannelRequest.RoleNames.Any())
        {
            var roleUserIds = await GetUserIdsByRoleNamesAsync(inAppChannelRequest.RoleNames, ct);
            userIds.AddRange(roleUserIds);
        }

        if (userIds.Count == 0)
        {
            var currentUserId = getCurrentUserId();
            if (currentUserId.HasValue)
            {
                userIds.Add(currentUserId.Value);
                _logger.LogDebug("Using current authenticated user for in-app notification");
            }
            else
            {
                _logger.LogWarning("No valid user IDs found for in-app channel. Skipping UserNotification creation.");
                return;
            }
        }

        userIds = userIds.Distinct().ToList();

        foreach (var userId in userIds)
        {
            try
            {
                var userNotification = new UserNotification
                {
                    NotificationId = notification.Id,
                    UserId = userId,
                    IsRead = false,
                    ReceivedVia = JsonSerializer.Serialize(new[] { "in-app" })
                };

                await _repository.CreateUserNotificationAsync(userNotification, ct);

                _logger.LogDebug(
                    "User notification created: UserId={UserId}, NotificationId={NotificationId}",
                    userId,
                    notification.Id);

                var notificationDto = new
                {
                    id = userNotification.Id,
                    notificationId = notification.Id,
                    userId = userId,
                    isRead = false,
                    createdAt = userNotification.CreatedAt,
                    notification = new
                    {
                        id = notification.Id,
                        title = notification.Title,
                        message = notification.Message,
                        type = notification.Type,
                        priority = notification.Priority,
                        category = notification.Category,
                        createdAt = notification.CreatedAt
                    }
                };

                await _sseService.NotifyAsync(userId, "notification", new
                {
                    type = "notification",
                    data = notificationDto
                }, ct);

                _logger.LogInformation(
                    "SSE notification sent to user {UserId} for notification {NotificationId}",
                    userId,
                    notification.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error creating user notification: UserId={UserId}, NotificationId={NotificationId}",
                    userId,
                    notification.Id);
            }
        }
    }

    private int? getCurrentUserId()
    {
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User == null)
            {
                return null;
            }

            var userIdClaim = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

}

internal static class CollectionExtensions
{
    public static void AddAll<T>(this ICollection<T> collection, IEnumerable<T> items)
    {
        foreach (var item in items)
        {
            collection.Add(item);
        }
    }
}
