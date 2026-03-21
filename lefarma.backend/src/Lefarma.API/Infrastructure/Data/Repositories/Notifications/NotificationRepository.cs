using Lefarma.API.Domain.Entities.Notifications;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Notifications;

/// <summary>
/// Repository implementation for notification data access.
/// Manages persistence of notifications and user notification relationships.
/// </summary>
public class NotificationRepository : INotificationRepository
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationRepository> _logger;

    public NotificationRepository(
        ApplicationDbContext context,
        ILogger<NotificationRepository> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
    public async Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default)
    {
        _logger.LogDebug("Creating notification: {Title}", notification.Title);

        notification.CreatedAt = DateTime.UtcNow;
        notification.UpdatedAt = DateTime.UtcNow;

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Notification created with ID: {NotificationId}", notification.Id);

        return notification;
    }

    /// <inheritdoc/>
    public async Task<Notification?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.Notifications
            .Include(n => n.Channels)
            .Include(n => n.UserNotifications)
            .FirstOrDefaultAsync(n => n.Id == id, ct);
    }

    /// <inheritdoc/>
    public async Task<List<Notification>> GetByUserIdAsync(int userId, bool unreadOnly = false, CancellationToken ct = default)
    {
        var query = _context.UserNotifications
            .Where(un => un.UserId == userId);

        if (unreadOnly)
        {
            query = query.Where(un => !un.IsRead);
        }

        var userNotificationIds = await query
            .Select(un => un.NotificationId)
            .Distinct()
            .ToListAsync(ct);

        var notifications = await _context.Notifications
            .Where(n => userNotificationIds.Contains(n.Id))
            .Include(n => n.Channels)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(ct);

        // Set IsRead and ReceivedVia for each notification
        foreach (var notification in notifications)
        {
            var userNotifs = await _context.UserNotifications
                .Where(un => un.NotificationId == notification.Id && un.UserId == userId)
                .ToListAsync(ct);

            if (userNotifs.Any())
            {
                var firstUserNotif = userNotifs.First();
                // We'll add these as temporary properties for DTO mapping
                notification.GetType().GetProperty("IsRead")?.SetValue(notification, firstUserNotif.IsRead);
            }
        }

        return notifications;
    }

    /// <inheritdoc/>
    public async Task<UserNotification?> GetUserNotificationAsync(int notificationId, int userId, CancellationToken ct = default)
    {
        return await _context.UserNotifications
            .FirstOrDefaultAsync(un => un.NotificationId == notificationId && un.UserId == userId, ct);
    }

    /// <inheritdoc/>
    public async Task<UserNotification> CreateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Creating user notification: NotificationId={NotificationId}, UserId={UserId}",
            userNotification.NotificationId,
            userNotification.UserId);

        userNotification.CreatedAt = DateTime.UtcNow;

        _context.UserNotifications.Add(userNotification);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "User notification created with ID: {UserNotificationId}",
            userNotification.Id);

        return userNotification;
    }

    /// <inheritdoc/>
    public async Task UpdateAsync(Notification notification, CancellationToken ct = default)
    {
        _logger.LogDebug("Updating notification: {NotificationId}", notification.Id);

        notification.UpdatedAt = DateTime.UtcNow;

        _context.Notifications.Update(notification);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Notification updated: {NotificationId}", notification.Id);
    }

    /// <inheritdoc/>
    public async Task UpdateUserNotificationAsync(UserNotification userNotification, CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Updating user notification: {UserNotificationId}",
            userNotification.Id);

        _context.UserNotifications.Update(userNotification);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "User notification updated: {UserNotificationId}",
            userNotification.Id);
    }
}
