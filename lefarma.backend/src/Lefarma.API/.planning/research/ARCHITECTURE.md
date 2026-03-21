# Architecture Research

**Domain:** Sistema de Cuentas por Pagar + Notificaciones Multi-Canal
**Researched:** 2026-03-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   React SPA  │  │  In-App Notif │  │  Mobile/Web   │              │
│  │   (Frontend) │  │   Component  │  │     Views     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘              │
│         │                 │
├─────────┼─────────────────┼─────────────────────────────────────────────┤
│         │         API Layer (ASP.NET Core)                             │
│         ▼                 ▼
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                   API Controllers / Endpoints                     │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │ │
│  │  │   Orders    │ │   Treasury  │ │   Reports   │ │  Catalog  │ │ │
│  │  │   Controller│ │  Controller │ │  Controller │ │ Controller│ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘ │ │
│  └─────────┼───────────────┼───────────────┼─────────────┼────────┘ │
└────────────┼───────────────┼───────────────┼─────────────┼──────────┘
             │               │               │             │
             ▼               ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Application Layer                               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    Application Services                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │ │
│  │  │ Order       │ │ Payment     │ │ Notification│ │ Authz     │ │ │
│  │  │ Service     │ │ Service     │ │ Service     │ │ Service   │ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘ │ │
│  └─────────┼───────────────┼───────────────┼─────────────┼────────┘ │
└────────────┼───────────────┼───────────────┼─────────────┼──────────┘
             │               │               │             │
             ▼               ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Domain Layer                                   │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      Domain Entities & Logic                      │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │ │
│  │  │ Purchase│ │ Invoice │ │ Payment │ │ Approval│ │ User      │ │ │
│  │  │ Order   │ │         │ │         │ │ Flow    │ │           │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
             │               │               │             │
             ▼               ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Infrastructure Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │   Entity     │ │  External    │ │  Notification│ │   File       │  │
│  │   Framework  │ │  Workflow    │ │  Providers   │ │   Storage    │  │
│  │   Core (EF)  │ │  API Client  │ │  (Email/TG)  │ │   (XML/PDF)  │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
└─────────┼───────────────────┼───────────────┼───────────────┼──────────┘
          │                   │               │               │
          ▼                   ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         External Services                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ SQL Server   │ │  Workflow    │ │   SMTP       │ │   Telegram   │  │
│  │ (Primary DB) │ │  Engine API  │ │   Server     │ │     API      │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **React SPA** | Frontend UI, forms, dashboards, in-app notifications | Vite + TypeScript + TanStack Query |
| **API Controllers** | HTTP request handling, validation, authorization | ASP.NET Core Minimal APIs or Controllers |
| **Application Services** | Business logic orchestration, use case implementation | C# services with dependency injection |
| **Domain Entities** | Core business logic, invariants, domain rules | EF Core entities with domain events |
| **Notification Service** | Multi-channel notification dispatch, preferences, templates | Background service with message queue |
| **Authorization Service** | Multi-tenant permission checking, policy enforcement | ASP.NET Core Authorization handlers |
| **Workflow Client** | External workflow engine integration, approval flow orchestration | Typed HTTP client with retry logic |
| **EF Core** | Data access, repository pattern implementation, multi-tenant queries | DbContext with global query filters |
| **Notification Providers** | Email, Telegram, in-app notification delivery | SmtpClient, Telegram Bot API, SignalR |

## Recommended Project Structure

```
src/
├── Domain/                           # Core business logic (no dependencies)
│   ├── Entities/                     # Domain entities
│   │   ├── PurchaseOrder.cs          # Orden de compra
│   │   ├── Invoice.cs                # Facturas/comprobantes
│   │   ├── Payment.cs                # Pagos programados y realizados
│   │   ├── ApprovalFlow.cs           # Estado de aprobación
│   │   ├── User.cs                   # Usuarios del sistema
│   │   ├── Company.cs                # Empresas (tenant)
│   │   └── Branch.cs                 # Sucursales
│   ├── Interfaces/                   # Contracts for outer layers
│   │   ├── IRepository.cs            # Repository pattern
│   │   ├── IUnitOfWork.cs            # Unit of work pattern
│   │   ├── INotificationService.cs   # Notification abstraction
│   │   └── IWorkflowClient.cs        # External workflow API
│   ├── ValueObjects/                 # Immutable value types
│   │   ├── Money.cs                  # Amount + Currency
│   │   ├── Email.cs                  # Validated email
│   │   └── TaxId.cs                  # RFC/Moneda
│   └── Specifications/               # Business rules encapsulation
│       ├── PendingApprovalSpec.cs    # Orders needing approval
│       └── OverduePaymentSpec.cs     # Payments past due
│
├── Application/                      # Use cases orchestration
│   ├── Services/                     # Application services
│   │   ├── OrderService.cs           # Order CRUD + validation
│   │   ├── PaymentService.cs         # Payment scheduling
│   │   ├── NotificationService.cs    # Multi-channel dispatch
│   │   ├── ReportService.cs          # Report generation
│   │   └── AuthorizationService.cs   # Multi-tenant authz
│   ├── DTOs/                         # Data transfer objects
│   │   ├── Requests/                 # API request models
│   │   │   ├── CreateOrderRequest.cs
│   │   │   └── UpdatePaymentRequest.cs
│   │   └── Responses/                # API response models
│   │       ├── OrderResponse.cs
│   │       └── NotificationResponse.cs
│   ├── Interfaces/                   # Infrastructure contracts
│   │   ├── INotificationProvider.cs  # Email, Telegram, InApp
│   │   └── IWorkflowAdapter.cs       # External workflow adapter
│   └── Validators/                   # FluentValidation rules
│       ├── CreateOrderValidator.cs
│       └── PaymentValidator.cs
│
├── Infrastructure/                   # External concerns implementation
│   ├── Persistence/                  # Database access
│   │   ├── DbContext/
│   │   │   └── LefarmaDbContext.cs   # EF Core context
│   │   ├── Repositories/             # Repository implementations
│   │   │   ├── Repository.cs         # Base repository
│   │   │   ├── OrderRepository.cs
│   │   │   └── PaymentRepository.cs
│   │   ├── Configurations/           # EF Core entity configs
│   │   │   ├── OrderConfiguration.cs
│   │   │   └── CompanyConfiguration.cs
│   │   └── Migrations/               # Database migrations
│   ├── Notifications/                # Notification infrastructure
│   │   ├── Providers/                # Channel implementations
│   │   │   ├── EmailProvider.cs      # SMTP implementation
│   │   │   ├── TelegramProvider.cs   # Telegram Bot API
│   │   │   └── InAppProvider.cs      # SignalR/WebSocket
│   │   ├── Templates/                # Message templates
│   │   │   ├── EmailTemplateEngine.cs
│   │   │   └── TemplateRepository.cs
│   │   ├── Queue/                    # Background processing
│   │   │   ├── NotificationQueue.cs  # In-memory or RabbitMQ
│   │   │   └── BackgroundWorker.cs   # Hosted service
│   │   └── Preferences/              # User notification settings
│   │       └── NotificationPreferencesRepository.cs
│   ├── Workflow/                     # External workflow integration
│   │   ├── Clients/
│   │   │   └── WorkflowApiClient.cs  # Typed HttpClient
│   │   ├── Adapters/
│   │   │   └── WorkflowAdapter.cs    # Domain ↔ External mapping
│   │   └── Webhooks/                 # Workflow status callbacks
│   │       └── WorkflowController.cs # Receives status updates
│   ├── Identity/                     # Authentication & authorization
│   │   ├── Authorization/            # Policy-based authorization
│   │   │   ├── Requirements/         # Custom authorization reqs
│   │   │   │   ├── CompanyAccessRequirement.cs
│   │   │   │   ├── BranchAccessRequirement.cs
│   │   │   │   └── PermissionRequirement.cs
│   │   │   └── Handlers/             # Authorization handlers
│   │   │       ├── CompanyAccessHandler.cs
│   │   │       └── PermissionHandler.cs
│   │   └── TenantResolution/         # Multi-tenant context
│   │       ├── ITenantProvider.cs
│   │       └── TenantMiddleware.cs   # Extracts tenant from request
│   ├── Files/                        # File storage (XML/PDF)
│   │   ├── FileStorageService.cs     # Local/Cloud storage abstraction
│   │   └── Validators/               # File validation
│   │       └── InvoiceFileValidator.cs
│   └── Logging/                      # Logging & telemetry
│       └── LoggingService.cs
│
├── API/                              # Presentation layer
│   ├── Controllers/                  # API endpoints
│   │   ├── OrdersController.cs
│   │   ├── PaymentsController.cs
│   │   ├── NotificationsController.cs
│   │   ├── ReportsController.cs
│   │   └── CatalogsController.cs
│   ├── Middleware/                   # Request/response pipeline
│   │   ├── TenantMiddleware.cs       # Multi-tenant resolution
│   │   ├── ExceptionHandler.cs       # Global error handling
│   │   └── AuditLogMiddleware.cs     # Audit trail
│   ├── Filters/                      # Action filters
│   │   └── AuthorizeAttribute.cs     # Custom authorization
│   └── Extensions/                   # Service registration
│       └── ServiceCollectionExtensions.cs
│
└── Shared/                           # Cross-cutting concerns
    ├── Constants/                    # App-wide constants
    │   └── Permissions.cs            # Permission definitions
    ├── Exceptions/                   # Custom exceptions
    │   ├── DomainException.cs
    │   └── AuthorizationException.cs
    ├── Utilities/                    # Helper utilities
    │   ├── DateHelper.cs
    │   └── CurrencyHelper.cs
    └── Notifications/                # Shared notification DTOs
        ├── NotificationEvent.cs
        └── NotificationChannel.cs

tests/
├── Domain.Tests/                     # Unit tests for domain logic
├── Application.Tests/                # Application service tests
├── Infrastructure.Tests/             # Infrastructure tests
└── API.Tests/                        # Integration tests
```

### Structure Rationale

- **Domain/:** Core business rules, no external dependencies. Keeps business logic pure and testable. Follows the **Dependency Inversion Principle** from Microsoft's architectural principles — dependencies point inward toward abstractions.

- **Application/:** Orchestrates use cases, depends on Domain interfaces. Implements **Explicit Dependencies Principle** — all dependencies are injected via constructors.

- **Infrastructure/:** Implements interfaces defined in Domain/Application. This follows **Persistence Ignorance** principle — domain entities don't know about EF Core or external APIs.

- **API/:** Thin presentation layer, delegates to Application services. Follows **Separation of Concerns** — UI logic separate from business rules.

- **Shared/:** Cross-cutting utilities used by all layers. Avoids duplication (DRY principle) without coupling.

## Architectural Patterns

### Pattern 1: Clean Architecture with Dependency Inversion

**What:** Layered architecture where dependencies point inward. Domain layer is the core — Application depends on Domain, Infrastructure implements Domain interfaces, API orchestrates everything.

**When to use:**
- Complex business rules requiring testability
- Multi-tenant system with shared domain logic
- Need to evolve infrastructure independently (e.g., switch notification providers)

**Trade-offs:**
- ✅ Highly testable, loosely coupled
- ✅ Easy to swap implementations (e.g., SMTP → SendGrid)
- ❌ More initial boilerplate (interfaces, registrations)
- ❌ Steeper learning curve for junior devs

**Example:**
```csharp
// Domain layer - defines the contract
namespace Domain.Interfaces;

public interface INotificationService
{
    Task SendNotificationAsync(
        NotificationEvent notification,
        CancellationToken ct = default);
}

// Application layer - uses the interface
namespace Application.Services;

public class OrderService
{
    private readonly INotificationService _notificationService;

    // Explicit Dependencies Principle
    public OrderService(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    public async Task CreateOrderAsync(CreateOrderRequest request)
    {
        // Business logic...

        // Send notification via interface
        await _notificationService.SendNotificationAsync(
            new NotificationEvent(
                type: "OrderCreated",
                recipients: [request.CreatedBy],
                channels: [NotificationChannel.InApp, NotificationChannel.Email]
            )
        );
    }
}

// Infrastructure layer - implements the interface
namespace Infrastructure.Notifications;

public class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationProvider> _providers;

    public NotificationService(IEnumerable<INotificationProvider> providers)
    {
        _providers = providers;
    }

    public async Task SendNotificationAsync(
        NotificationEvent notification,
        CancellationToken ct = default)
    {
        var tasks = notification.Channels
            .Select(channel => _providers
                .First(p => p.SupportsChannel(channel))
                .SendAsync(notification, ct));

        await Task.WhenAll(tasks);
    }
}
```

### Pattern 2: Policy-Based Multi-Tenant Authorization

**What:** Use ASP.NET Core's authorization policies with custom requirements and handlers for fine-grained, tenant-aware permissions.

**When to use:**
- Multi-tenant system where permissions vary by tenant
- Complex authorization rules (company + branch + role combinations)
- Need to authorize based on resource ownership, not just roles

**Trade-offs:**
- ✅ Flexible, reusable authorization logic
- ✅ Type-safe, testable authorization requirements
- ✅ Integrates with ASP.NET Core's `[Authorize]` attribute
- ❌ More complex than simple role checks
- ❌ Requires careful handler registration

**Example:**
```csharp
// Infrastructure/Identity/Authorization/Requirements/CompanyAccessRequirement.cs
public class CompanyAccessRequirement : IAuthorizationRequirement
{
    public string RequiredPermission { get; }
    public bool RequiresAllBranchesAccess { get; }

    public CompanyAccessRequirement(
        string requiredPermission,
        bool requiresAllBranchesAccess = false)
    {
        RequiredPermission = requiredPermission;
        RequiresAllBranchesAccess = requiresAllBranchesAccess;
    }
}

// Infrastructure/Identity/Authorization/Handlers/CompanyAccessHandler.cs
public class CompanyAccessHandler :
    AuthorizationHandler<CompanyAccessRequirement>
{
    private readonly IUserRepository _userRepository;
    private readonly ITenantProvider _tenantProvider;

    public CompanyAccessHandler(
        IUserRepository userRepository,
        ITenantProvider tenantProvider)
    {
        _userRepository = userRepository;
        _tenantProvider = tenantProvider;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CompanyAccessRequirement requirement)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId is null) return;

        var tenantId = _tenantProvider.GetTenantId();
        var user = await _userRepository.GetAsync(userId);

        // Check if user has permission for this tenant
        var hasPermission = user.Permissions
            .Any(p =>
                p.TenantId == tenantId &&
                p.Permission == requirement.RequiredPermission);

        if (!hasPermission) return;

        // If checking specific resource (company/branch)
        if (context.Resource is TenantResource resource)
        {
            var hasAccess = user.Companies
                .Any(c => c.CompanyId == resource.CompanyId &&
                    (requirement.RequiresAllBranchesAccess ||
                     c.Branches.Contains(resource.BranchId)));

            if (!hasAccess) return;
        }

        context.Succeed(requirement);
    }
}

// API/Controllers/OrdersController.cs
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "Orders.View")]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
    {
        // Only users with Orders.View permission can access
        // Handler ensures tenant isolation
    }

    [HttpPost("{orderId}/approve")]
    [Authorize(Policy = "Orders.Approve")]
    public async Task<ActionResult> ApproveOrder(Guid orderId)
    {
        // Only users with Orders.Approve permission
        // Handler checks company/branch access
    }
}

// API/Extensions/ServiceCollectionExtensions.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAuthorization(
        this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            // Policy for viewing orders
            options.AddPolicy("Orders.View", policy =>
                policy.Requirements.Add(
                    new CompanyAccessRequirement("Orders.View")));

            // Policy for approving orders (requires more permissions)
            options.AddPolicy("Orders.Approve", policy =>
                policy.Requirements.Add(
                    new CompanyAccessRequirement(
                        "Orders.Approve",
                        requiresAllBranchesAccess: false)));
        });

        // Register handlers
        services.AddSingleton<IAuthorizationHandler, CompanyAccessHandler>();

        return services;
    }
}
```

### Pattern 3: Notification Provider Strategy Pattern

**What:** Abstract notification delivery behind `INotificationProvider` interface, with implementations for each channel (Email, Telegram, InApp). Factory pattern selects appropriate provider based on user preferences.

**When to use:**
- Multiple notification channels with different APIs
- User-selectable notification preferences
- Need to add new channels without breaking existing code

**Trade-offs:**
- ✅ Easy to add new notification channels
- ✅ Testable — mock providers for unit tests
- ✅ Channels are isolated (email failure doesn't break Telegram)
- ❌ Additional abstraction layer
- ❌ Requires careful error handling per channel

**Example:**
```csharp
// Application/Interfaces/INotificationProvider.cs
public interface INotificationProvider
{
    NotificationChannel Channel { get; }
    bool SupportsChannel(NotificationChannel channel);
    Task SendAsync(NotificationEvent notification, CancellationToken ct);
}

// Infrastructure/Notifications/Providers/EmailProvider.cs
public class EmailProvider : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Email;
    private readonly SmtpClient _smtpClient;
    private readonly ITemplateEngine _templateEngine;

    public bool SupportsChannel(NotificationChannel channel)
        => channel == NotificationChannel.Email;

    public async Task SendAsync(
        NotificationEvent notification,
        CancellationToken ct)
    {
        var template = await _templateEngine.GetTemplateAsync(notification.Type);
        var body = template.Render(notification.Data);

        var mailMessage = new MailMessage
        {
            Subject = notification.Subject,
            Body = body,
            IsBodyHtml = true
        };

        foreach (var recipient in notification.Recipients)
        {
            mailMessage.To.Add(recipient.Email);
        }

        await _smtpClient.SendMailAsync(mailMessage, ct);
    }
}

// Infrastructure/Notifications/Providers/TelegramProvider.cs
public class TelegramProvider : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Telegram;
    private readonly ITelegramBotClient _botClient;
    private readonly IUserRepository _userRepository;

    public bool SupportsChannel(NotificationChannel channel)
        => channel == NotificationChannel.Telegram;

    public async Task SendAsync(
        NotificationEvent notification,
        CancellationToken ct)
    {
        foreach (var recipient in notification.Recipients)
        {
            // Get user's Telegram chat ID from preferences
            var user = await _userRepository.GetAsync(recipient.UserId);
            if (string.IsNullOrEmpty(user.TelegramChatId)) continue;

            var message = FormatTelegramMessage(notification);
            await _botClient.SendTextMessageAsync(
                chatId: user.TelegramChatId,
                text: message,
                cancellationToken: ct
            );
        }
    }
}

// Infrastructure/Notifications/Providers/InAppProvider.cs
public class InAppProvider : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.InApp;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly INotificationRepository _notificationRepository;

    public bool SupportsChannel(NotificationChannel channel)
        => channel == NotificationChannel.InApp;

    public async Task SendAsync(
        NotificationEvent notification,
        CancellationToken ct)
    {
        // Save to database
        var entity = new NotificationEntity
        {
            Id = Guid.NewGuid(),
            Type = notification.Type,
            Recipients = notification.Recipients.Select(r => r.UserId).ToList(),
            Data = JsonSerializer.Serialize(notification.Data),
            CreatedAt = DateTime.UtcNow
        };

        await _notificationRepository.AddAsync(entity);

        // Push via SignalR
        foreach (var recipient in notification.Recipients)
        {
            await _hubContext.Clients.User(recipient.UserId)
                .SendAsync("ReceiveNotification", new
                {
                    id = entity.Id,
                    type = notification.Type,
                    message = notification.Message,
                    createdAt = entity.CreatedAt
                }, ct);
        }
    }
}

// Infrastructure/Notifications/NotificationService.cs
public class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationProvider> _providers;
    private readonly INotificationPreferencesRepository _preferencesRepository;

    public async Task SendNotificationAsync(
        NotificationEvent notification,
        CancellationToken ct = default)
    {
        // Get user preferences for each recipient
        var recipientsWithPreferences = new List<(NotificationRecipient, NotificationPreferences)>();

        foreach (var recipient in notification.Recipients)
        {
            var prefs = await _preferencesRepository.GetAsync(recipient.UserId);
            recipientsWithPreferences.Add((recipient, prefs));
        }

        // Determine which channels to use
        var channelsToUse = notification.Channels
            .Intersect(
                recipientsWithPreferences
                    .SelectMany(r => r.Item2.EnabledChannels)
                    .Distinct()
            )
            .ToList();

        // Send via each enabled channel
        var sendTasks = channelsToUse
            .Select(channel => _providers.First(p => p.SupportsChannel(channel)))
            .Select(provider => provider.SendAsync(notification, ct));

        await Task.WhenAll(sendTasks);
    }
}
```

### Pattern 4: External Workflow Integration with Adapter Pattern

**What:** Adapter pattern wraps external workflow API, mapping between domain entities and external DTOs. Isolates the system from external API changes.

**When to use:**
- External service with different data model
- Need to swap external providers without breaking domain
- Complex integration logic with retries, error handling

**Trade-offs:**
- ✅ External API changes don't propagate to domain
- ✅ Easy to mock for testing
- ✅ Can add caching, retry, fallback logic
- ❌ Additional mapping layer
- ❌ Requires keeping mapping in sync with external API

**Example:**
```csharp
// Application/Interfaces/IWorkflowClient.cs
public interface IWorkflowClient
{
    Task<Guid> CreateApprovalFlowAsync(
        PurchaseOrder order,
        CancellationToken ct = default);

    Task<ApprovalStatus> GetApprovalStatusAsync(
        Guid workflowId,
        CancellationToken ct = default);

    Task<bool> ApproveStepAsync(
        Guid workflowId,
        Guid stepId,
        string approverId,
        CancellationToken ct = default);
}

// Infrastructure/Workflow/Clients/WorkflowApiClient.cs
public class WorkflowApiClient : IWorkflowClient
{
    private readonly HttpClient _httpClient;
    private readonly IWorkflowAdapter _adapter;
    private readonly ILogger<WorkflowApiClient> _logger;

    public WorkflowApiClient(
        HttpClient httpClient,
        IWorkflowAdapter adapter,
        ILogger<WorkflowApiClient> logger)
    {
        _httpClient = httpClient;
        _adapter = adapter;
        _logger = logger;
    }

    public async Task<Guid> CreateApprovalFlowAsync(
        PurchaseOrder order,
        CancellationToken ct = default)
    {
        // Map domain entity to external DTO
        var request = _adapter.ToWorkflowRequest(order);

        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                "/api/v1/workflows",
                request,
                ct);

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<WorkflowResponse>(ct);
            return result.WorkflowId;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to create workflow for order {OrderId}", order.Id);
            throw;
        }
    }

    public async Task<ApprovalStatus> GetApprovalStatusAsync(
        Guid workflowId,
        CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync($"/api/v1/workflows/{workflowId}", ct);
        response.EnsureSuccessStatusCode();

        var externalStatus = await response.Content.ReadFromJsonAsync<WorkflowStatusResponse>(ct);

        // Map external status to domain enum
        return _adapter.ToApprovalStatus(externalStatus.Status);
    }
}

// Infrastructure/Workflow/Adapters/WorkflowAdapter.cs
public class WorkflowAdapter : IWorkflowAdapter
{
    public WorkflowRequest ToWorkflowRequest(PurchaseOrder order)
    {
        return new WorkflowRequest
        {
            Title = $"Orden de Compra {order.OrderNumber}",
            Description = order.Description,
            Steps = order.Approvers.Select(approver => new WorkflowStep
            {
                StepOrder = approver.Level,
                ApproverEmail = approver.Email,
                ApproverName = approver.Name,
                Timeout = TimeSpan.FromHours(48),
                OnTimeout = WorkflowTimeoutAction.Escalate
            }).ToList(),
            Metadata = new Dictionary<string, string>
            {
                ["orderId"] = order.Id.ToString(),
                ["companyId"] = order.CompanyId,
                ["amount"] = order.TotalAmount.ToString("C")
            }
        };
    }

    public ApprovalStatus ToApprovalStatus(string externalStatus)
    {
        return externalStatus switch
        {
            "pending" => ApprovalStatus.Pending,
            "approved" => ApprovalStatus.Approved,
            "rejected" => ApprovalStatus.Rejected,
            "escalated" => ApprovalStatus.Escalated,
            _ => throw new ArgumentException($"Unknown status: {externalStatus}")
        };
    }
}
```

## Data Flow

### Request Flow

```
User Action (React Frontend)
    ↓
HTTP Request (POST /api/orders)
    ↓
[Tenant Middleware] → Extract tenant from subdomain/header
    ↓
[Authentication] → Validate JWT token
    ↓
[Authorization Filter] → Check user permissions for tenant
    ↓
OrdersController.CreateOrder()
    ↓
OrderValidator → FluentValidation rules
    ↓
OrderService.CreateOrderAsync()
    ↓
├─→ Repository.SaveOrder() → EF Core → SQL Server
├─→ WorkflowClient.CreateApprovalFlowAsync() → External Workflow API
└─→ NotificationService.SendNotificationAsync() → Background Queue
    ↓
HTTP Response (201 Created + OrderResponse)
    ↓
Frontend updates UI + In-App notification via SignalR
```

### Notification Flow (Multi-Channel)

```
Domain Event (e.g., OrderCreated)
    ↓
Application Service publishes event
    ↓
NotificationService.SendNotificationAsync()
    ↓
Load User Notification Preferences
    ↓
Determine enabled channels (Email, Telegram, In-App)
    ↓
┌─────────────────────────────────────────┐
│  Notification Queue (Background)        │
│  ┌────────────────────────────────────┐ │
│  │  Message: {                         │ │
│  │    eventId: "order-123",            │ │
│  │    type: "OrderCreated",            │ │
│  │    recipients: ["user-1", "user-2"],│ │
│  │    channels: [Email, Telegram, InApp]│ │
│  │  }                                  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
    ↓
Background Worker (Hosted Service) processes queue
    ↓
┌────────────────┬────────────────┬────────────────┐
│   Email Worker │ Telegram Worker │  InApp Worker  │
│       ↓        │       ↓        │       ↓        │
│  EmailProvider │TelegramProvider │ InAppProvider  │
│       ↓        │       ↓        │       ↓        │
│  SMTP Send     │Telegram API    │SignalR Push    │
│       ↓        │       ↓        │       ↓        │
│  ✅ Sent       │  ✅ Sent       │  ✅ Pushed     │
└────────────────┴────────────────┴────────────────┘
    ↓
Notification Delivery Logged to Database
    ↓
User receives notifications via all enabled channels
```

### Authorization Flow (Multi-Tenant)

```
HTTP Request (GET /api/companies/{companyId}/orders)
    ↓
JWT Token contains: { userId: "user-1", roles: ["Accountant"] }
    ↓
[Tenant Middleware] → TenantId = "ASK" (from subdomain ask.lefarma.com)
    ↓
[Authorization Policy: "Orders.View"]
    ↓
CompanyAccessHandler invoked
    ↓
├─→ Load user permissions from DB
├─→ Check: user has "Orders.View" permission for tenant "ASK"
├─→ Check: user has access to requested companyId
└─→ Check: user has access to requested branchId (if specified)
    ↓
If ALL checks pass → context.Succeed(requirement)
    ↓
Request proceeds to controller
    ↓
[Global Query Filter] → WHERE TenantId = "ASK" (EF Core applies automatically)
    ↓
Results returned (only data from tenant "ASK")
```

### Key Data Flows

1. **Purchase Order Creation with Approval:**
   - User creates order → Domain validation → Repository saves → External workflow API called → Notifications sent to approvers → WebSocket pushes to UI
   - **Isolation:** Domain doesn't know about external API, Application orchestrates

2. **Multi-Channel Notification Dispatch:**
   - Business event occurs → Notification queue enqueues → Background workers process → Each provider sends via its channel → Delivery logged
   - **Isolation:** Providers are independent, failure in one doesn't affect others

3. **Multi-Tenant Data Access:**
   - Request arrives → Tenant middleware extracts TenantId → Authorization checks tenant access → EF Core applies global filter → Query executes with tenant isolation
   - **Isolation:** Tenant context flows through request, all data access is scoped

4. **Payment Approval via Workflow:**
   - Approver clicks "Approve" → Controller validates → Workflow client approves step → External API updates status → Webhook callback received → Domain updates order status → Notifications sent
   - **Isolation:** Workflow status eventually consistent via webhooks

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users** (MVP) | Monolith is fine. In-memory notification queue. SQL Server on single instance. SignalR for in-app notifications. |
| **100-1,000 users** | Add Redis for caching notification templates. Consider background workers (Hangfire) for notification queue. Database indexing on tenant queries. |
| **1,000-10,000 users** | **Notification queue:** Replace in-memory with RabbitMQ/Azure Service Bus. **Database:** Read replicas for reporting. **SignalR:** Redis backplane for multiple server instances. **Workflow:** Add caching layer for external API responses. |
| **10,000+ users** | **Microservices:** Extract notification service as standalone service. **Event sourcing:** Consider event store for audit trail. **CQRS:** Separate read model for reporting. **Database:** Sharding by tenant if needed. |

### Scaling Priorities

1. **First bottleneck: Notification delivery**
   - **Problem:** SMTP/Telegram API limits, synchronous sending blocks requests
   - **Fix:** Background queue (Hangfire → RabbitMQ), retry with exponential backoff, rate limiting per provider

2. **Second bottleneck: Database query performance**
   - **Problem:** Multi-tenant queries slow without proper indexing, large result sets for reports
   - **Fix:** Global query filters for tenant isolation, indexes on (TenantId, Status, CreatedAt), read replicas for reporting queries

3. **Third bottleneck: In-app notification delivery**
   - **Problem:** SignalR connections don't scale across multiple servers
   - **Fix:** Redis backplane for SignalR, consider push notifications (Firebase) for mobile

## Anti-Patterns

### Anti-Pattern 1: Direct Domain Layer Dependencies on Infrastructure

**What people do:** Domain entities reference EF Core attributes, inherit from infrastructure base classes, or directly call external APIs.

```csharp
// BAD: Domain knows about EF Core
using Microsoft.EntityFrameworkCore;

public class PurchaseOrder
{
    public int Id { get; set; }

    // Navigation properties tie domain to EF Core
    public ICollection<Invoice> Invoices { get; set; }

    // Direct external API call
    public async Task SubmitForApproval()
    {
        await _workflowClient.CreateAsync(this);
    }
}
```

**Why it's wrong:**
- Violates **Persistence Ignorance** — domain should be testable without database
- Violates **Dependency Inversion** — domain depends on infrastructure
- Can't unit test domain logic without mocking EF Core
- Can't switch ORMs without rewriting domain

**Do this instead:**
```csharp
// GOOD: Domain is pure, infrastructure concerns are external
public class PurchaseOrder
{
    public Guid Id { get; set; }

    // Domain logic only
    public void SubmitForApproval()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be submitted");

        Status = OrderStatus.PendingApproval;

        // Raise domain event
        AddDomainEvent(new OrderSubmittedEvent(Id));
    }
}

// Infrastructure handles external concerns
public class OrderService
{
    public async Task SubmitOrderAsync(Guid orderId)
    {
        var order = await _repository.GetAsync(orderId);

        order.SubmitForApproval();

        await _repository.SaveAsync(order);

        // Handle domain event in application layer
        await _workflowClient.CreateApprovalFlowAsync(order);
    }
}
```

### Anti-Pattern 2: Role-Based Authorization in Controllers

**What people do:** Use simple `[Authorize(Roles = "Admin")]` attributes and check roles in controllers.

```csharp
// BAD: Role checks in controller, no tenant awareness
[HttpGet("{companyId}/orders")]
[Authorize(Roles = "Accountant")]
public async Task<ActionResult> GetOrders(string companyId)
{
    // How do we know this user has access to this company?
    // What if they're Accountant for Company A but not Company B?

    var orders = await _orderRepository.GetAllByCompany(companyId);
    return Ok(orders);
}
```

**Why it's wrong:**
- Doesn't handle multi-tenant scenarios (user role ≠ tenant access)
- Can't express complex permissions (e.g., "Accountant" for specific branch)
- Authorization logic scattered across controllers
- Can't unit test authorization separately

**Do this instead:**
```csharp
// GOOD: Policy-based authorization with tenant awareness
[HttpGet("{companyId}/orders")]
[Authorize(Policy = "Orders.View")]  // Policy, not role
public async Task<ActionResult> GetOrders(string companyId)
{
    // Controller assumes authorization passed
    // Just get the resource, handler verified access

    var orders = await _orderRepository.GetAllByCompany(companyId);
    return Ok(orders);
}

// Authorization handler encapsulates logic
public class CompanyAccessHandler : AuthorizationHandler<CompanyAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CompanyAccessRequirement requirement)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var user = await _userRepository.GetAsync(userId);

        // Check: Does this user have access to this specific company?
        var hasAccess = user.Companies
            .Any(c => c.CompanyId == companyId &&
                     c.Permissions.Contains(requirement.Permission));

        if (hasAccess)
            context.Succeed(requirement);
    }
}
```

### Anti-Pattern 3: Tight Coupling to External Workflow API

**What people do:** Domain entities or services directly call external workflow API, use external DTOs throughout the codebase.

```csharp
// BAD: Domain uses external DTOs
public class PurchaseOrder
{
    public async Task CreateWorkflow()
    {
        var request = new WorkflowApiRequest  // External DTO
        {
            workflow_name = $"Order-{this.Id}",
            approval_steps = this.Approvers
                .Select(a => new ApprovalStepDto  // External DTO
                {
                    approver_email = a.Email
                })
                .ToList()
        };

        await _httpClient.PostAsync("/workflows", request);
    }
}
```

**Why it's wrong:**
- External API changes break domain layer
- Can't unit test without mocking HTTP calls
- External naming conventions leak into domain
- Can't swap workflow providers easily

**Do this instead:**
```csharp
// GOOD: Adapter pattern isolates external API
// Domain knows nothing about external workflow
public class PurchaseOrder
{
    public void SubmitForApproval()
    {
        Status = OrderStatus.PendingApproval;
        AddDomainEvent(new OrderSubmittedEvent(Id));
    }
}

// Application layer orchestrates
public class OrderService
{
    private readonly IWorkflowClient _workflowClient;

    public async Task SubmitOrderAsync(Guid orderId)
    {
        var order = await _repository.GetAsync(orderId);
        order.SubmitForApproval();
        await _repository.SaveAsync(order);

        // Call external API via interface
        await _workflowClient.CreateApprovalFlowAsync(order);
    }
}

// Infrastructure maps domain to external
public class WorkflowAdapter
{
    public WorkflowRequest ToWorkflowRequest(PurchaseOrder order)
    {
        return new WorkflowRequest  // Internal DTO
        {
            Title = $"Order {order.OrderNumber}",
            Steps = order.Approvers.Select(a => new Step
            {
                ApproverEmail = a.Email
            }).ToList()
        };
    }
}
```

### Anti-Pattern 4: Synchronous Notification Sending

**What people do:** Send notifications directly in HTTP request handlers, blocking responses until email/Telegram sends.

```csharp
// BAD: Notification blocks HTTP response
[HttpPost("{id}/approve")]
public async Task<ActionResult> ApproveOrder(Guid id)
{
    var order = await _orderRepository.GetAsync(id);
    order.Approve();
    await _orderRepository.SaveAsync(order);

    // This blocks! SMTP can take 1-5 seconds
    await _emailService.SendApprovalEmailAsync(order);

    // Telegram API can be slow or timeout
    await _telegramService.SendNotificationAsync(order);

    return Ok();
}
```

**Why it's wrong:**
- HTTP requests timeout waiting for external APIs
- Slow response times for users
- Email/Telegram failure breaks approval flow
- Can't retry failed notifications easily

**Do this instead:**
```csharp
// GOOD: Async notification queue
[HttpPost("{id}/approve")]
public async Task<ActionResult> ApproveOrder(Guid id)
{
    var order = await _orderRepository.GetAsync(id);
    order.Approve();
    await _orderRepository.SaveAsync(order);

    // Enqueue notification (non-blocking)
    await _notificationQueue.EnqueueAsync(new NotificationEvent
    {
        Type = "OrderApproved",
        Recipients = order.Approvers,
        Channels = [NotificationChannel.Email, NotificationChannel.Telegram]
    });

    return Ok();  // Immediate response
}

// Background worker processes queue
public class NotificationWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var notification = await _queue.DequeueAsync(ct);

            try
            {
                await _notificationService.SendAsync(notification, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send notification");
                await _queue.EnqueueAsync(notification, ct);  // Retry
            }
        }
    }
}
```

### Anti-Pattern 5: Global State for Tenant Context

**What people do:** Use static variables or singleton-scoped services to store tenant information per request.

```csharp
// BAD: Static current tenant
public static class CurrentTenant
{
    public static string TenantId { get; set; }
}

// Middleware sets it
public class TenantMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        var tenant = context.Request.Headers["X-Tenant"];
        CurrentTenant.TenantId = tenant;  // THREAD UNSAFE!

        await _next(context);
    }
}

// Domain uses it
public class OrderRepository
{
    public Task<List<Order>> GetAll()
    {
        return _context.Orders
            .Where(o => o.TenantId == CurrentTenant.TenantId)  // RISKY!
            .ToListAsync();
    }
}
```

**Why it's wrong:**
- Thread-unsafe in async scenarios (tenant context bleeds between requests)
- Can't unit test (can't inject mock tenant)
- Violates dependency injection principles
- Race conditions under load

**Do this instead:**
```csharp
// GOOD: Scoped tenant service via DI
public interface ITenantProvider
{
    Guid GetTenantId();
    string GetTenantIdentifier();
}

public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _accessor;

    public Guid GetTenantId()
    {
        var tenantId = _accessor.HttpContext?
            .Items["__TenantId"] as Guid?;

        if (!tenantId.HasValue)
            throw new InvalidOperationException("Tenant not resolved");

        return tenantId.Value;
    }
}

// Middleware sets it in HttpContext.Items (request-scoped)
public class TenantMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var tenantId = ResolveTenant(context);
        context.Items["__TenantId"] = tenantId;  // Safe! Per-request

        await next(context);
    }
}

// Repository depends on ITenantProvider (injectable, testable)
public class OrderRepository
{
    private readonly ITenantProvider _tenantProvider;

    public OrderRepository(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public Task<List<Order>> GetAll()
    {
        var tenantId = _tenantProvider.GetTenantId();

        return _context.Orders
            .Where(o => o.TenantId == tenantId)
            .ToListAsync();
    }
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Workflow Engine API** | Adapter Pattern + HttpClient | Use `IWorkflowClient` interface, map domain ↔ external DTOs, implement retry with Polly, handle webhooks for status updates |
| **SMTP Server** | Provider Strategy + Background Queue | Implement `INotificationProvider`, use MailKit or System.Net.Mail, send via background worker, implement exponential backoff for retries |
| **Telegram Bot API** | Provider Strategy + HttpClient | Store `chat_id` per user, handle rate limits (30 msgs/sec), use long polling for updates, implement fallback to email if Telegram fails |
| **SQL Server** | Repository Pattern + EF Core | Use `DbContext` with global query filters for tenant isolation, separate schemas per company optional, use migrations for schema evolution |
| **SignalR (In-App)** | Hub + Redis Backplane | Scale out with Redis backplane, consider Firebase Cloud Messaging for mobile push notifications as fallback |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend → Backend API** | HTTP/HTTPS (REST) | JWT authentication, tenant in subdomain or header, version API (`/api/v1/...`) |
| **API → Application Services** | Direct method calls (DI) | Controllers are thin, delegate to services, use C# types (no HTTP concerns) |
| **Application → Domain** | Direct method calls | Services orchestrate domain logic, domain entities enforce invariants |
| **Application → Infrastructure** | Interface-based (DI) | Application depends on interfaces (`IRepository`, `INotificationService`), Infrastructure implements them |
| **Background Workers → Notification Providers** | Queue (in-memory → RabbitMQ) | Decouple notification generation from sending, enable retries and prioritization |
| **Domain → External Workflow** | Domain Events → Application → HTTP Client | Domain raises event, Application handles by calling external API, eventual consistency |

## Sources

- [Microsoft Learn - Architectural principles in .NET](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles) — HIGH confidence (official documentation, accessed 2026-03-20)
- [Microsoft Learn - Policy-based authorization in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies) — HIGH confidence (official documentation, accessed 2026-03-20)
- [Project context - .planning/PROJECT.md](/home/zurybr/workspaces/01-lefarma-project/lefarma.backend/src/Lefarma.API/.planning/PROJECT.md) — HIGH confidence (project requirements)

**MEDIUM confidence findings** (Based on general software architecture knowledge, not verified with current official sources due to web search limitations):
- Notification service architecture patterns (message queues, provider strategy)
- Multi-tenant data isolation patterns (database per tenant, separate schema, shared schema with discriminator)
- Background processing patterns (Hangfire, RabbitMQ, Azure Service Bus)

**LOW confidence findings** (Web search was unavailable, these are based on general knowledge):
- Specific .NET 10 features (verification needed when official docs available)
- Current best practices for Telegram Bot API integration in 2026
- Specific workflow engine integration patterns for external services

**Verification needed:**
- .NET 10 release date and new features (may still be in preview)
- Current Telegram Bot API rate limits and best practices
- Specific workflow engine API the companion is building (contract not yet defined)

---
*Architecture research for: Sistema de Cuentas por Pagar + Notificaciones Multi-Canal*
*Researched: 2026-03-20*
