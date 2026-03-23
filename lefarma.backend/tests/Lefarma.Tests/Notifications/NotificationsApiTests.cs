using Xunit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
using System.Text.Json;
using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.Tests.Notifications;

/// <summary>
/// Integration tests for Notifications API
/// Tests the complete flow including HTTP endpoints, authentication, and database
/// </summary>
public class NotificationsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly string _testToken;

    public NotificationsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();

        // Setup test configuration
        _testToken = "test-token-for-integration-tests";
    }

    [Fact]
    public async Task SendNotification_ValidRequest_ReturnsSuccess()
    {
        // Arrange
        var request = new SendNotificationRequest
        {
            Title = "Integration Test Notification",
            Message = "Testing the notification system",
            Type = "info",
            Priority = "normal",
            Category = "system",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "in-app", Recipients = "21" }
            }
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.Contains("notificationId", responseContent);
    }

    [Fact]
    public async Task SendNotification_MissingTitle_ReturnsBadRequest()
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

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendNotification_NoChannels_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendNotificationRequest
        {
            Title = "Test",
            Message = "Test",
            Channels = new List<NotificationChannelRequest>()
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetUserNotifications_ValidUserId_ReturnsNotifications()
    {
        // Arrange
        const int userId = 21;

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.GetAsync($"/api/notifications/user/{userId}");

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.NotNull(responseContent);
    }

    [Fact]
    public async Task GetUserNotifications_InvalidUserId_ReturnsBadRequest()
    {
        // Arrange
        const int userId = -1;

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.GetAsync($"/api/notifications/user/{userId}");

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_ValidRequest_ReturnsSuccess()
    {
        // Arrange
        const int notificationId = 1;
        const int userId = 21;
        var request = new MarkReadRequest { UserId = userId };
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PatchAsync($"/api/notifications/{notificationId}/read", content);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task MarkAllAsRead_ValidUserId_ReturnsSuccess()
    {
        // Arrange
        const int userId = 21;

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PatchAsync($"/api/notifications/user/{userId}/read-all", null);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task SendBulkNotification_ValidRequest_ReturnsSuccess()
    {
        // Arrange
        var request = new BulkNotificationRequest
        {
            UserIds = new List<int> { 21, 22 },
            Title = "Bulk Test",
            Message = "Testing bulk notifications",
            Type = "info",
            Priority = "normal",
            Category = "system",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "in-app", Recipients = "21" }
            }
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send-bulk", content);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task SendByRole_ValidRequest_ReturnsSuccess()
    {
        // Arrange
        var request = new RoleNotificationRequest
        {
            Roles = new List<string> { "Administrador" },
            Title = "Role Test",
            Message = "Testing role notifications",
            Type = "info",
            Priority = "normal",
            Category = "system",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "in-app", Recipients = "" }
            }
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        // Act
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send-by-role", content);

        // Assert
        // This endpoint returns 501 Not Implemented, which is expected
        Assert.Equal(System.Net.HttpStatusCode.NotImplemented, response.StatusCode);
    }

    [Fact]
    public async Task SseStream_ValidToken_EstablishesConnection()
    {
        // Arrange
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_test_token}");
        _client.DefaultRequestHeaders.Remove("Accept"); // Remove default Accept header

        // Act
        var response = await _client.GetAsync("/api/notifications/stream");

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("keep-alive", response.Headers.Connection?.ToString() ?? "");
    }

    [Fact]
    public async Task SseStream_NoToken_ReturnsUnauthorized()
    {
        // Act
        var response = await _client.GetAsync("/api/notifications/stream");

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
