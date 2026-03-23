using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using Lefarma.API.Features.Notifications.Services;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Entities;

namespace Lefarma.Tests.Notifications;

/// <summary>
/// Unit tests for NotificationService
/// Tests the core notification logic without external dependencies
/// </summary>
public class NotificationServiceTests
{
    private readonly Mock<INotificationRepository> _mockRepository;
    private readonly Mock<ILogger<NotificationService>> _mockLogger;
    private readonly NotificationService _service;

    public NotificationServiceTests()
    {
        _mockRepository = new Mock<INotificationRepository>();
        _mockLogger = new Mock<ILogger<NotificationService>>();
        _service = new NotificationService(_mockRepository.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task SendAsync_ValidRequest_ReturnsSuccessResponse()
    {
        // Arrange
        var request = new SendNotificationRequest
        {
            Title = "Test Notification",
            Message = "Test message",
            Type = "info",
            Priority = "normal",
            Category = "system",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "in-app", Recipients = "21" }
            }
        };

        var notification = new Notification
        {
            Id = 1,
            Title = request.Title,
            Message = request.Message,
            Type = request.Type,
            Priority = request.Priority,
            Category = request.Category
        };

        _mockRepository
            .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        // Act
        var result = await _service.SendAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.NotificationId);
        Assert.True(result.ChannelResults.ContainsKey("in-app"));
    }

    [Fact]
    public async Task SendAsync_EmptyTitle_ThrowsArgumentException()
    {
        // Arrange
        var request = new SendNotificationRequest
        {
            Title = "",
            Message = "Test",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "in-app", Recipients = "21" }
            }
        };

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => _service.SendAsync(request));
    }

    [Fact]
    public async Task SendAsync_NoChannels_ThrowsArgumentException()
    {
        // Arrange
        var request = new SendNotificationRequest
        {
            Title = "Test",
            Message = "Test",
            Channels = new List<NotificationChannelRequest>()
        };

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => _service.SendAsync(request));
    }

    [Fact]
    public async Task GetUserNotificationsAsync_ValidUserId_ReturnsNotifications()
    {
        // Arrange
        const int userId = 21;
        var notifications = new List<UserNotification>
        {
            new()
            {
                Id = 1,
                UserId = userId,
                IsRead = false,
                Notification = new Notification
                {
                    Id = 1,
                    Title = "Test",
                    Message = "Test message",
                    Type = "info"
                }
            }
        };

        _mockRepository
            .Setup(r => r.GetUserNotificationsAsync(userId, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(notifications);

        // Act
        var result = await _service.GetUserNotificationsAsync(userId, false);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(userId, result[0].UserId);
        Assert.False(result[0].IsRead);
    }

    [Fact]
    public async Task GetUserNotificationsAsync_UnreadOnly_ReturnsOnlyUnread()
    {
        // Arrange
        const int userId = 21;
        var notifications = new List<UserNotification>
        {
            new() { Id = 1, UserId = userId, IsRead = false },
            new() { Id = 2, UserId = userId, IsRead = true }
        };

        _mockRepository
            .Setup(r => r.GetUserNotificationsAsync(userId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notifications.Where(n => !n.IsRead).ToList());

        // Act
        var result = await _service.GetUserNotificationsAsync(userId, true);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.All(result, n => Assert.False(n.IsRead));
    }

    [Fact]
    public async Task MarkAsReadAsync_ValidNotificationId_CallsRepository()
    {
        // Arrange
        const int notificationId = 1;
        const int userId = 21;

        _mockRepository
            .Setup(r => r.MarkAsReadAsync(notificationId, userId, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _service.MarkAsReadAsync(notificationId, userId);

        // Assert
        _mockRepository.Verify(r => r.MarkAsReadAsync(notificationId, userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllAsReadAsync_ValidUserId_CallsRepository()
    {
        // Arrange
        const int userId = 21;

        _mockRepository
            .Setup(r => r.MarkAllAsReadAsync(userId, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _service.MarkAllAsReadAsync(userId);

        // Assert
        _mockRepository.Verify(r => r.MarkAllAsReadAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
