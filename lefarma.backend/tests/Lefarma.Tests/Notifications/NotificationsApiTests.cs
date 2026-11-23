using Xunit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
using System.Text.Json;
using Lefarma.API.Features.Notifications.DTOs;

namespace Lefarma.Tests.Notifications;

public class NotificationsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly string _testToken;

    public NotificationsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();

        _testToken = "test-token-for-integration-tests";
    }

    [Fact]
    public async Task SendNotification_ValidRequest_ReturnsSuccess()
    {
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

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        Assert.True(response.IsSuccessStatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.Contains("notificationId", responseContent);
    }

    [Fact]
    public async Task SendNotification_MissingTitle_ReturnsBadRequest()
    {
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

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendNotification_NoChannels_ReturnsBadRequest()
    {
        var request = new SendNotificationRequest
        {
            Title = "Test",
            Message = "Test",
            Channels = new List<NotificationChannelRequest>()
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetUserNotifications_ValidUserId_ReturnsNotifications()
    {
        const int userId = 21;

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.GetAsync($"/api/notifications/user/{userId}");

        Assert.True(response.IsSuccessStatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.NotNull(responseContent);
    }

    [Fact]
    public async Task GetUserNotifications_InvalidUserId_ReturnsBadRequest()
    {
        const int userId = -1;

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.GetAsync($"/api/notifications/user/{userId}");

        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_ValidRequest_ReturnsSuccess()
    {
        const int notificationId = 1;
        const int userId = 21;
        var request = new MarkReadRequest { UserId = userId };
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PatchAsync($"/api/notifications/{notificationId}/read", content);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task MarkAllAsRead_ValidUserId_ReturnsSuccess()
    {
        const int userId = 21;

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PatchAsync($"/api/notifications/user/{userId}/read-all", null);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task SendBulkNotification_ValidRequest_ReturnsSuccess()
    {
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

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send-bulk", content);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task SendByRole_ValidRequest_ReturnsSuccess()
    {
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

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send-by-role", content);

        Assert.Equal(System.Net.HttpStatusCode.NotImplemented, response.StatusCode);
    }

    [Fact]
    public async Task SseStream_ValidToken_EstablishesConnection()
    {
        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_test_token}");
        _client.DefaultRequestHeaders.Remove("Accept"); 

        var response = await _client.GetAsync("/api/notifications/stream");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("keep-alive", response.Headers.Connection?.ToString() ?? "");
    }

    [Fact]
    public async Task SseStream_NoToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/notifications/stream");

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
