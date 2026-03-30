# Architecture

**Analysis Date:** 2026-03-30

## Pattern Overview

**Overall:** Modular Monolith — Feature-Based Organization

**Key Characteristics:**
- Single deployable API project (`Lefarma.API`) with feature folders grouping related code
- Layered architecture within each feature: Controller → Service → Repository → Entity
- ErrorOr functional error handling (no exceptions for business logic)
- Wide Event structured logging pattern for observability
- Dual-database strategy: Lefarma (operational) + Asokam (identity/auth)
- Multi-channel notification system using keyed DI services

## Layers

### Domain Layer
- Purpose: Business entities, repository interfaces, domain contracts
- Location: `lefarma.backend/src/Lefarma.API/Domain/`
- Contains: EF Core entities (`Entities/`), repository interfaces (`Interfaces/`), service interfaces
- Depends on: Nothing (pure domain)
- Used by: Features layer, Infrastructure layer
- Key subdirectories:
  - `Domain/Entities/Auth/` — `Usuario.cs`, `Rol.cs`, `Permiso.cs`, `Sesion.cs`, `RefreshToken.cs`, `DominioConfig.cs`, `AuditLog.cs`, `VwDirectorioActivo.cs`
  - `Domain/Entities/Catalogos/` — `Empresa.cs`, `Sucursal.cs`, `Area.cs`, `Gasto.cs`, `Medida.cs`, `Proveedor.cs`, `Banco.cs`, `FormaPago.cs`, `MedioPago.cs`, `UnidadMedida.cs`, `CentroCosto.cs`, `CuentaContable.cs`, `EstatusOrden.cs`, `RegimenFiscal.cs`, `GastoUnidadMedida.cs`, `UsuarioDetalle.cs`
  - `Domain/Entities/Config/` — `Workflow.cs`, `WorkflowPaso.cs`, `WorkflowAccion.cs`, `WorkflowCondicion.cs`, `WorkflowParticipante.cs`, `WorkflowNotificacion.cs`, `WorkflowBitacora.cs`
  - `Domain/Entities/Notifications/` — `Notification.cs`, `NotificationChannel.cs`, `UserNotification.cs`
  - `Domain/Entities/Operaciones/` — `OrdenCompra.cs`, `OrdenCompraPartida.cs`, `EstadoOC.cs`
  - `Domain/Entities/Help/` — `HelpModule.cs`, `HelpArticle.cs`, `HelpImage.cs`
  - `Domain/Entities/Archivos/` — `Archivo.cs`
  - `Domain/Entities/Logging/` — `ErrorLog.cs`
  - `Domain/Interfaces/IBaseRepository.cs` — Generic CRUD contract
  - `Domain/Interfaces/Catalogos/` — One repository interface per catalog entity
  - `Domain/Interfaces/Config/` — `IWorkflowEngine.cs`, `IWorkflowRepository.cs`
  - `Domain/Interfaces/Operaciones/` — `IOrdenCompraRepository.cs`
  - `Domain/Interfaces/Admin/` — `IAdminRepository.cs`
  - `Domain/Interfaces/Logging/` — `IErrorLogService.cs`
  - `Domain/Interfaces/` — `INotificationChannel.cs`, `INotificationService.cs`, `INotificationRepository.cs`, `ITemplateService.cs`, `IHelpArticleRepository.cs`, `IHelpModuleRepository.cs`, `IHelpImageRepository.cs`, `IArchivoRepository.cs`

### Features Layer
- Purpose: Feature-specific business logic, API controllers, DTOs, validation
- Location: `lefarma.backend/src/Lefarma.API/Features/`
- Contains: Controllers, Services (interface + implementation), DTOs, Validators, Extensions
- Depends on: Domain interfaces, Infrastructure Data, Shared
- Used by: Consumed by DI registration in `Program.cs`
- Feature groups (each follows the same Controller/Service/DTOs/Validator structure):
  - `Features/Catalogos/Areas/` — Areas CRUD
  - `Features/Catalogos/Empresas/` — Empresas CRUD
  - `Features/Catalogos/Sucursales/` — Sucursales CRUD
  - `Features/Catalogos/Gastos/` — Gastos (expense types) CRUD
  - `Features/Catalogos/Medidas/` — Measurement units CRUD
  - `Features/Catalogos/Bancos/` — Banks CRUD
  - `Features/Catalogos/FormasPago/` — Payment forms CRUD
  - `Features/Catalogos/MediosPago/` — Payment methods CRUD
  - `Features/Catalogos/UnidadesMedida/` — Unit of measure CRUD
  - `Features/Catalogos/CentrosCosto/` — Cost centers CRUD
  - `Features/Catalogos/CuentasContables/` — Accounting accounts CRUD
  - `Features/Catalogos/EstatusOrden/` — Order status CRUD
  - `Features/Catalogos/RegimenesFiscales/` — Tax regimes CRUD
  - `Features/Catalogos/Proveedores/` — Suppliers CRUD
  - `Features/Auth/` — 2-step login, JWT tokens, SSE user sync
  - `Features/Auth/Usuarios/` — User catalog management
  - `Features/Auth/Roles/` — Role catalog management
  - `Features/OrdenesCompra/Captura/` — Purchase order capture
  - `Features/OrdenesCompra/Firmas/` — Multi-level approval (Firmas) with step handlers
  - `Features/Config/Workflows/` — Workflow CRUD definitions
  - `Features/Config/Engine/` — `WorkflowEngine.cs` (dynamic workflow execution)
  - `Features/Notifications/` — Multi-channel notification orchestration
  - `Features/Notifications/Services/` — `NotificationService.cs`, `TemplateService.cs`
  - `Features/Notifications/Services/Channels/` — `EmailNotificationChannel.cs`, `TelegramNotificationChannel.cs`, `InAppNotificationChannel.cs`
  - `Features/Notifications/Controllers/` — `NotificationsController.cs`, `NotificationStreamController.cs`
  - `Features/Help/` — Help articles, modules, image management with TinyMCE
  - `Features/Archivos/` — File upload/view/management
  - `Features/Admin/` — Administrative operations
  - `Features/Profile/` — User profile management
  - `Features/Logging/` — Error log service
  - `Features/SystemConfig/` — System configuration endpoint

### Infrastructure Layer
- Purpose: Data access, persistence, middleware, templates
- Location: `lefarma.backend/src/Lefarma.API/Infrastructure/`
- Contains: DbContexts, Repository implementations, EF Core configurations, Middleware, Razor templates
- Depends on: Domain entities, EF Core, SQL Server
- Used by: Features layer (via DI)
- Key files:
  - `Infrastructure/Data/ApplicationDbContext.cs` — Lefarma operational DB (70+ DbSets, auto-applies all `IEntityTypeConfiguration<T>` via reflection)
  - `Infrastructure/Data/AsokamDbContext.cs` — Asokam identity DB (auth tables in `app` schema)
  - `Infrastructure/Data/Repositories/BaseRepository.cs` — Generic repository implementation
  - `Infrastructure/Data/Repositories/Catalogos/` — One repository per catalog entity (e.g., `AreaRepository.cs`)
  - `Infrastructure/Data/Repositories/Config/WorkflowRepository.cs`
  - `Infrastructure/Data/Repositories/Notifications/NotificationRepository.cs`
  - `Infrastructure/Data/Repositories/Operaciones/OrdenCompraRepository.cs`
  - `Infrastructure/Data/Repositories/Admin/AdminRepository.cs`
  - `Infrastructure/Data/Repositories/HelpArticleRepository.cs`, `HelpModuleRepository.cs`, `HelpImageRepository.cs`
  - `Infrastructure/Data/Repositories/ArchivoRepository.cs`
  - `Infrastructure/Data/Configurations/` — EF Core fluent API (one file per entity, organized by module)
  - `Infrastructure/Data/Seeding/` — `IDatabaseSeeder.cs` interface and `DatabaseSeeder.cs` implementation
  - `Infrastructure/Middleware/DevTokenMiddleware.cs` — Dev-only token injection
  - `Infrastructure/Middleware/WideEventLoggingMiddleware.cs` — Structured request logging
  - `Infrastructure/Filters/ValidationFilter.cs` — Global FluentValidation filter
  - `Infrastructure/Templates/Views/Notifications/` — Razor CSHTML templates per channel

### Shared Layer
- Purpose: Cross-cutting concerns used across all features
- Location: `lefarma.backend/src/Lefarma.API/Shared/`
- Contains: `ApiResponse<T>`, `BaseService`, Error definitions, Authorization, Extensions, WideEvent logging
- Depends on: ErrorOr library, ASP.NET Core
- Used by: All layers
- Key files:
  - `Shared/Models/ApiResponse.cs` — Standard API response wrapper
  - `Shared/Models/ErrorDetail.cs` — Error detail with Code, Description, Field
  - `Shared/Models/Configuracion/BackendConfigResponse.cs` — Backend config response DTO
  - `Shared/BaseService.cs` — Base class for services with `EnrichWideEvent()` method
  - `Shared/Extensions/ResultExtensions.cs` — `ErrorOr<T>` → `ApiResponse<T>` → `IActionResult` mapping
  - `Shared/Extensions/EntityMappings.cs` — Entity → Response DTO mapping extensions
  - `Shared/Extensions/StringExtensions.cs` — Diacritics removal for normalized search
  - `Shared/Extensions/ExceptionExtensions.cs` — Exception detail extraction
  - `Shared/Errors/CommonErrors.cs` — Predefined error factory methods
  - `Shared/Errors/HelpArticleErrors.cs`, `ArchivoErrors.cs` — Entity-specific errors
  - `Shared/Authorization/PermissionHandler.cs` — JWT permission claim checker
  - `Shared/Authorization/PermissionRequirement.cs` — Authorization requirement for permissions
  - `Shared/Constants/AuthorizationConstants.cs` — Role names, permission codes, policy names
  - `Shared/Logging/WideEvent.cs` — Structured event model
  - `Shared/Logging/IWideEventAccessor.cs` — HttpContext-based accessor + Null accessor
  - `Shared/Logging/WideEventLogger.cs` — Serilog integration for wide events

### Services Layer (Identity)
- Purpose: External service integrations (Active Directory/LDAP, JWT)
- Location: `lefarma.backend/src/Lefarma.API/Services/Identity/`
- Key files:
  - `ActiveDirectoryService.cs` — LDAP user lookup and credential validation
  - `IActiveDirectoryService.cs` — LDAP service interface
  - `TokenService.cs` — JWT + refresh token generation
  - `ITokenService.cs` — Token service interface
  - `JwtSettings.cs` — JWT configuration POCO
  - `LdapOptions.cs` — LDAP connection options
  - `ServiceCollectionExtensions.cs` — DI registration helpers (`AddActiveDirectoryServices`, `AddJwtTokenServices`)
  - `Models/ActiveDirectoryUser.cs` — LDAP user model

## Data Flow

### Standard CRUD Request (e.g., GET /api/catalogos/areas):

1. HTTP request hits `AreasController.GetAllAreas()` at `Features/Catalogos/Areas/AreaController.cs`
2. Controller calls `IAreaService.GetAllAsync(query)` returning `ErrorOr<IEnumerable<AreaResponse>>`
3. `AreaService` (extends `BaseService`) queries `IAreaRepository.GetQueryable()`, applies filters, maps entities → DTOs via `.ToResponse()` extension method
4. Service enriches `WideEvent` via `EnrichWideEvent(action: "GetAll", count: n, ...)` for structured logging
5. Controller calls `.ToActionResult(this, data => Ok(...))` extension method
6. `ResultExtensions.ToActionResult()` converts `ErrorOr<T>` → appropriate `ApiResponse<T>` with HTTP status
7. JSON response returned to client

**Controller Pattern (every endpoint follows this):**
```csharp
[HttpGet]
public async Task<IActionResult> GetAllAreas([FromQuery] AreaRequest query)
{
    var result = await _areaService.GetAllAsync(query);
    return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<AreaResponse>>
    {
        Success = true,
        Message = "Áreas obtenidas exitosamente.",
        Data = data
    }));
}
```

**Error Flow:**
- Services return `ErrorOr<T>` — never throw for business errors
- `CommonErrors` provides predefined error factories: `NotFound()`, `Validation()`, `AlreadyExists()`, `HasDependencies()`, `ConcurrencyError()`, `DatabaseError()`, `DeleteFailed()`
- `ResultExtensions.ToActionResult()` maps `ErrorType` → HTTP status:
  - `ErrorType.NotFound` → 404
  - `ErrorType.Validation` → 400
  - `ErrorType.Conflict` → 409
  - `ErrorType.Unexpected` → 500

### Authentication Flow (Two-Step Login):

1. Frontend calls `POST /api/auth/login-step-one` with `{ username }`
2. `AuthService.LoginStepOneAsync()` searches LDAP/Active Directory for user via `ActiveDirectoryService`
3. Returns available domains; frontend shows domain selector
4. Frontend calls `POST /api/auth/login-step-two` with `{ username, password, domain }`
5. `AuthService.LoginStepTwoAsync()` validates LDAP credentials, creates session, generates JWT + refresh token via `TokenService`
6. Frontend stores tokens in localStorage, loads empresas/sucursales from API
7. User selects empresa/sucursal (Step 3 in `authStore.loginStepThree`) → `isAuthenticated = true`
8. Subsequent requests include `Authorization: Bearer {token}` header via Axios request interceptor
9. Axios response interceptor handles 401 → transparent token refresh → retry, or logout on failure

### Purchase Order Approval Workflow:

1. `WorkflowEngine.EjecutarAccionAsync()` receives `WorkflowContext` (process code, action ID, order ID, user)
2. Engine loads workflow from `IWorkflowRepository.GetByCodigoProcesoAsync()`
3. Evaluates dynamic conditions (`WorkflowCondicion`) on order data (e.g., total > threshold → route to Firma 5)
4. Determines destination step based on conditions or default action routing
5. Creates immutable `WorkflowBitacora` entry for audit trail (JSON snapshot of transition)
6. Returns `WorkflowEjecucionResult` with new step and status code

**Step Handlers:**
- `IStepHandler` interface at `Features/OrdenesCompra/Firmas/Handlers/IStepHandler.cs`: `HandlerKey`, `ValidarAsync()`, `AplicarAsync()`
- Registered as keyed services: `AddKeyedScoped<IStepHandler, Firma3Handler>("Firma3Handler")`
- Implementations: `Firma3Handler.cs`, `Firma4Handler.cs` at `Features/OrdenesCompra/Firmas/Handlers/`

### Notification Flow:

1. `NotificationService.SendAsync()` receives `SendNotificationRequest` (title, message, channels, recipients)
2. Creates `Notification` + `NotificationChannel` records in database
3. Looks up recipients in both `ApplicationDbContext` and `AsokamDbContext`
4. For each requested channel type:
   - Resolves `INotificationChannel` via `IServiceProvider.GetRequiredKeyedService()` using channel key
   - Renders template via `ITemplateService` (Razor CSHTML views per channel)
   - Calls `channel.SendAsync()` to deliver
5. For in-app channel: pushes via `ISseService` (singleton managing per-user SSE connections)
6. Frontend `useNotifications` hook receives SSE events, updates `notificationStore` with optimistic updates

**Notification Templates:**
- `Infrastructure/Templates/Views/Notifications/Email/DefaultEmail.cshtml`
- `Infrastructure/Templates/Views/Notifications/Telegram/DefaultTelegram.cshtml`
- `Infrastructure/Templates/Views/Notifications/InApp/DefaultInApp.cshtml`

### State Management (Frontend)

- **authStore** (`store/authStore.ts`, Zustand): 3-step login flow (username → credentials → empresa/sucursal), user state, token management
- **configStore** (`store/configStore.ts`, Zustand + persist middleware): UI theme/presets, visual preferences (density, font, animations), notification preferences, global config defaults
- **pageStore** (`store/pageStore.ts`, Zustand): Page title/subtitle displayed in Header via `usePageTitle()` hook
- **notificationStore** (`store/notificationStore.ts`, Zustand + devtools): Notifications list, unread count, SSE connection state, optimistic updates with rollback on error
- **helpStore** (`store/helpStore.ts`, Zustand): Help articles/modules state

## Key Abstractions

### Repository Pattern
- Purpose: Abstract data access from business logic
- Interface: `IBaseRepository<T>` at `Domain/Interfaces/IBaseRepository.cs`
- Implementation: `BaseRepository<T>` at `Infrastructure/Data/Repositories/BaseRepository.cs`
- Pattern: Generic CRUD with `GetQueryable()` for custom LINQ queries
- Feature repos extend the base (often empty, just inheriting): `IAreaRepository : IBaseRepository<Area>`

```csharp
// Domain/Interfaces/IBaseRepository.cs
public interface IBaseRepository<T> where T : class
{
    Task<ICollection<T>> GetAllAsync();
    Task<T?> GetByIdAsync(int id);
    Task<T> AddAsync(T entity);
    Task<T> UpdateAsync(T entity);
    Task<bool> DeleteAsync(T entity);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);
    IQueryable<T> GetQueryable();
}
```

### Service Pattern (ErrorOr-based)
- Purpose: Business logic with functional error handling and structured logging
- Interface: `IAreaService` at `Features/Catalogos/Areas/IAreaService.cs`
- Implementation: `AreaService : BaseService` at `Features/Catalogos/Areas/AreaService.cs`
- All methods return `ErrorOr<T>`, extend `BaseService` for WideEvent enrichment

```csharp
public interface IAreaService
{
    Task<ErrorOr<IEnumerable<AreaResponse>>> GetAllAsync(AreaRequest query);
    Task<ErrorOr<AreaResponse>> GetByIdAsync(int id);
    Task<ErrorOr<AreaResponse>> CreateAsync(CreateAreaRequest request);
    Task<ErrorOr<AreaResponse>> UpdateAsync(int id, UpdateAreaRequest request);
    Task<ErrorOr<bool>> DeleteAsync(int id);
}
```

### ApiResponse Wrapper
- Purpose: Consistent API response format across all endpoints
- Definition: `Shared/Models/ApiResponse.cs`

```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<ErrorDetail>? Errors { get; set; }
}
```

### Notification Channel (Keyed Services)
- Purpose: Multi-channel notification delivery (Email, Telegram, In-App/SSE)
- Interface: `INotificationChannel` at `Domain/Interfaces/INotificationChannel.cs`
- Implementations at `Features/Notifications/Services/Channels/`:
  - `EmailNotificationChannel` (key: `"email"`)
  - `TelegramNotificationChannel` (key: `"telegram"`)
  - `InAppNotificationChannel` (key: `"in-app"`)
- Registered in `Program.cs` as keyed DI services via `AddKeyedScoped<INotificationChannel, TChannel>(key)`

### Workflow Engine
- Purpose: Dynamic approval workflow for purchase orders
- Interface: `IWorkflowEngine` at `Domain/Interfaces/Config/IWorkflowEngine.cs`
- Implementation: `WorkflowEngine` at `Features/Config/Engine/WorkflowEngine.cs`
- Data-driven workflow: steps, actions, conditions, participants defined in DB
- Immutable audit trail via `WorkflowBitacora` (JSON snapshots of transitions)
- Dynamic routing: `WorkflowCondicion` evaluates order data against thresholds (>, >=, <, <=, =) to determine next step

### Permission-Based Authorization
- Purpose: Fine-grained permission checks on API endpoints and UI elements
- Backend: `PermissionHandler` at `Shared/Authorization/PermissionHandler.cs` checks JWT `permission` claims against `PermissionRequirement`
- Policies defined in `Program.cs` via `AuthorizationPolicies` constants:
  - `CanViewCatalogos` → `Permissions.Catalogos.View`
  - `CanManageCatalogos` → `Permissions.Catalogos.Manage`
  - `CanViewOrdenes` → `Permissions.OrdenesCompra.View`
  - `CanCreateOrdenes` → `Permissions.OrdenesCompra.Create`
  - `CanApproveOrdenes` → `Permissions.OrdenesCompra.Approve`
  - `CanManageUsers` → `Permissions.Usuarios.Manage`
- Role-based policies: `RequireAdministrator`, `RequireManager`, `RequireFinance`, `RequirePaymentProcessing`
- Roles: Administrador, GerenteArea, GerenteAdmon, DireccionCorp, CxP, Tesoreria, AuxiliarPagos
- Frontend: `PermissionGuard` component at `components/permissions/PermissionGuard.tsx`, `usePermission` hook at `hooks/usePermission.ts`, `checkPermission({ require, requireAny, exclude })` utility at `utils/permissions.ts`
- Permissions stored in JWT as multiple `permission` claims

## Entry Points

### Backend Entry Point
- Location: `lefarma.backend/src/Lefarma.API/Program.cs` (460 lines)
- Triggers: `dotnet run` from `lefarma.backend/src/Lefarma.API/`
- Responsibilities: Serilog config, DI registration (all repos, services, auth), middleware pipeline, dual DB contexts, CORS, Swagger

**DI Registration Pattern in Program.cs:**
```csharp
// Repositories
builder.Services.AddScoped<IAreaRepository, AreaRepository>();
// Services
builder.Services.AddScoped<IAreaService, AreaService>();
// Keyed services (notifications)
builder.Services.AddKeyedScoped<INotificationChannel, EmailNotificationChannel>("email");
// Singletons (SSE)
builder.Services.AddSingleton<ISseService, SseService>();
// Authorization policies
builder.Services.AddAuthorization(options => {
    options.AddPolicy("CanManageCatalogos", policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.Catalogos.Manage)));
});
```

**Middleware Pipeline Order:**
1. `app.UseCors("CorsPolicy")` — CORS (allow all origins)
2. `app.UseSwagger()` / `app.UseSwaggerUI()` — API docs (always enabled)
3. `app.UseHttpsRedirection()`
4. `app.UseSerilogRequestLogging()` — HTTP request logging (disabled level, overridden by WideEvent)
5. `app.UseWideEventLogging()` — Custom structured wide event logging
6. `app.UseStaticFiles()` — Serve help images from `wwwroot/media` at `/api/media`
7. `app.UseDevToken()` — Dev-only token injection middleware (Development only)
8. `app.UseAuthentication()` — JWT Bearer
9. `app.UseAuthorization()` — Role + Permission policies
10. `app.MapControllers()` — Route to controllers

### Frontend Entry Point
- Location: `lefarma.frontend/src/main.tsx`
- Triggers: Vite dev server (`npm run dev`) or production build
- Responsibilities: Mounts `<App />` in `<StrictMode>`

**App Bootstrap Sequence:**
1. `main.tsx` → renders `<App />` in `<StrictMode>`
2. `App.tsx` → calls `useAuthStore.initialize()` on mount, starts `useTokenRefresh()`, wraps in `<BrowserRouter>`, shows `<AutoVerify />` if `?autotest=true`
3. `AppRoutes.tsx` → defines all routes with `LandingRoute`, `ProtectedRoute`, `PublicOnlyRoute` guards
4. `LandingRoute.tsx` → unauthenticated → `<Hero />`, authenticated → `/dashboard`
5. `ProtectedRoute` → checks `isAuthenticated` + route handle permissions → `<Outlet />` or `/bloqueado`
6. Authenticated users see `MainLayout` (`<AppSidebar />` + `<Header />` + `<Outlet />`)

## Error Handling

**Strategy:** ErrorOr functional error handling — no exceptions for business logic

**Backend Patterns:**
- Services return `ErrorOr<T>` — never throw for business errors
- `CommonErrors` static class at `Shared/Errors/CommonErrors.cs`: `NotFound()`, `Validation()`, `AlreadyExists()`, `DeleteFailed()`, `HasDependencies()`, `ConcurrencyError()`, `DatabaseError()`
- `ResultExtensions.ToActionResult()` at `Shared/Extensions/ResultExtensions.cs` maps ErrorOr → HTTP response with user-friendly messages
- `BaseService.EnrichWideEvent()` at `Shared/BaseService.cs` logs error context for observability
- `ValidationFilter` at `Infrastructure/Filters/ValidationFilter.cs` handles FluentValidation errors before controller action
- Entity-specific error classes: `HelpArticleErrors`, `ArchivoErrors`

**Frontend Patterns:**
- Axios interceptor handles 401 → transparent token refresh → retry; logout on failure
- 403 → console error "No tienes permisos"
- All errors wrapped in `ApiError` type at `types/api.types.ts`: `{ message, errors, statusCode }`
- `notificationStore` uses optimistic updates with rollback on error

## Cross-Cutting Concerns

**Logging:** Wide Event pattern via `WideEventLogger` + `IWideEventAccessor`
- Each request generates one structured "wide event" with full context (entity, action, filters, results, errors)
- `BaseService` provides `EnrichWideEvent()` for service-level enrichment
- Logged as JSON to `logs/wide-events-.json` with daily rotation (30-day retention)
- Serilog configured with Microsoft noise suppression (Warning/Fatal level overrides)
- `WideEventLoggingMiddleware` creates the event per request, services enrich it during processing

**Validation:** FluentValidation
- Each feature has a `[Feature]Validator.cs` (e.g., `AreaValidator.cs`)
- Registered globally: `builder.Services.AddValidatorsFromAssemblyContaining<Program>()`
- `ValidationFilter` runs before controller action, returns 400 with error details
- Frontend uses Zod + React Hook Form for client-side validation

**Authentication:** JWT + LDAP dual strategy
- `ActiveDirectoryService` at `Services/Identity/ActiveDirectoryService.cs` validates against LDAP
- `TokenService` at `Services/Identity/TokenService.cs` generates JWT + refresh tokens
- Tokens stored in `RefreshTokens` DB table, sessions tracked in `Sesiones`
- Frontend: Axios interceptor auto-attaches JWT, handles refresh on 401

**Authorization:** Role-based + Permission-based
- `PermissionHandler` checks `permission` claims in JWT
- Frontend: `checkPermission({ require, requireAny, exclude })` reads from localStorage

**Real-Time:** Server-Sent Events (SSE)
- Backend: `SseService` (singleton) manages connections per user via `ConcurrentDictionary`
- Frontend `sseService.ts` — User sync SSE at `/api/auth/sse`
- Frontend `useNotifications.ts` — Notification SSE at `/api/notifications/stream?token=...`
- Auto-reconnect with exponential backoff, max 3 retries before auto-logout

**API Client:** Axios with interceptors at `lefarma.frontend/src/services/api.ts`
- Request interceptor: attaches Bearer token from `authService.getAccessToken()`
- Response interceptor: 401 → token refresh → retry queue → logout on failure
- Token refresh subscribers pattern: queued requests replayed after refresh

---

*Architecture analysis: 2026-03-30*
