# External Integrations

**Analysis Date:** 2026-03-30

## APIs & External Services

**Telegram Bot API:**
- Purpose: Send notifications to users via Telegram
- SDK/Client: `HttpClient` via `IHttpClientFactory` (no SDK package)
- Auth: Bot token via `TelegramSettings.BotToken` in `appsettings.json`
- Config: `appsettings.json` → `TelegramSettings` section
- Implementation: `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/Channels/TelegramNotificationChannel.cs`
- API URL: `https://api.telegram.org/bot{token}/sendMessage`
- Supports: Markdown/HTML parsing, multiple chat IDs, message tracking

**Active Directory / LDAP:**
- Purpose: Corporate user authentication against multiple AD domains
- SDK/Client: `System.DirectoryServices.Protocols` 9.0.0 (cross-platform LDAP)
- Auth: LDAP bind with username/password (Basic auth, protocol v3)
- Config: `appsettings.json` → `EmailSettings.Ldap` section
- Implementation: `lefarma.backend/src/Lefarma.API/Services/Identity/ActiveDirectoryService.cs`
- Domains configured:
  - **Asokam**: `192.168.4.2:389`, BaseDN `com.mx`
  - **Artricenter**: `192.168.1.7:389`, BaseDN `com.mx`
- Registration: `lefarma.backend/src/Lefarma.API/Services/Identity/ServiceCollectionExtensions.cs`
- UPN format: `{username}@{domain}.{baseDn}` (e.g., `usuario@asokam.com.mx`)
- User data source: `vwDirectorioActivo` SQL view in Lefarma database

## Data Storage

**Databases:**
- **Lefarma** (SQL Server) — Primary application database
  - Connection: `DefaultConnection` in `appsettings.json`
  - DbContext: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`
  - Contains: Catalogos, Auth, Workflows, OrdenesCompra, Notifications, Help, Archivos, Logging entities
  - ORM: EF Core 10 with SQL Server provider
  - Schema: Tables organized by feature, some in `app` schema, some default `dbo`

- **Asokam** (SQL Server) — Secondary/legacy auth database
  - Connection: `AsokamConnection` in `appsettings.json`
  - DbContext: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/AsokamDbContext.cs`
  - Contains: Auth entities only (Usuario, Rol, Permiso, Sesion, RefreshToken, etc.)
  - All tables in `app` schema
  - Used for: Cross-database auth/identity sharing

**File Storage:**
- Local filesystem under `wwwroot/media/`
  - Config: `ArchivosSettings` in `appsettings.json`
  - Base path: `wwwroot/media/archivos`
  - Max size: 10MB per file
  - Allowed extensions: `.pdf`, `.xlsx`, `.docx`, `.pptx`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
  - Served via: `UseStaticFiles()` at `/api/media` path
  - Cache headers: `public,max-age=31536000` (1 year)
  - Kestrel limit: 10MB `MaxRequestBodySize`
  - Form limit: 10MB `MultipartBodyLengthLimit`
  - Implementation: `lefarma.backend/src/Lefarma.API/Features/Archivos/`

**Caching:**
- None detected (no Redis, MemoryCache, or similar)

## Authentication & Identity

**Auth Provider:**
- Multi-step custom authentication:
  1. **Step 1** (loginStepOne): Username submitted → LDAP domains discovered
  2. **Step 2** (loginStepTwo): Password + domain → LDAP bind validation → JWT tokens issued
  3. **Step 3** (loginStepThree): Empresa + Sucursal selection → full auth state

- JWT Bearer tokens:
  - Config: `JwtSettings` in `appsettings.json`
  - Access token expiration: 60 minutes
  - Refresh token expiration: 7 days
  - Implementation: `lefarma.backend/src/Lefarma.API/Features/Auth/AuthService.cs`
  - Controller: `lefarma.backend/src/Lefarma.API/Features/Auth/AuthController.cs`

- Dev token middleware (Development only):
  - Config: `DevToken` section in `appsettings.json`
  - Bypasses LDAP for local development
  - Middleware: `lefarma.backend/src/Lefarma.API/Infrastructure/Middleware/` (UseDevToken)

- Authorization policies (role + permission based):
  - Defined in `Program.cs` (lines 275-324)
  - Policies: `RequireAdministrator`, `RequireManager`, `RequireFinance`, `RequirePaymentProcessing`
  - Permission-based: `CanViewCatalogos`, `CanManageCatalogos`, `CanViewOrdenes`, `CanCreateOrdenes`, `CanApproveOrdenes`, `CanManageUsers`
  - Custom handler: `PermissionHandler` in `Shared/Authorization/`
  - Constants: `AuthorizationPolicies`, `AuthorizationConstants.Roles`, `Permissions` in `Shared/`

**Frontend Token Management:**
- Storage: `localStorage` (keys: `accessToken`, `user`)
- Login flow state: `sessionStorage` (key: `loginFlow`)
- Auto-attach via Axios request interceptor
- Silent refresh via Axios response interceptor (401 → refresh token flow)
- Store: `lefarma.frontend/src/store/authStore.ts`
- API client: `lefarma.frontend/src/services/api.ts`

## Email

**SMTP (MailKit):**
- Purpose: Notification emails, authorization workflows
- Package: `MailKit` 4.15.1
- Config: `EmailSettings` in `appsettings.json`
  - Host: `mail.grupolefarma.com.mx`, Port: 587, SSL: STARTTLS
  - From: `autorizaciones@grupolefarma.com.mx`
- Implementation: `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/Channels/EmailNotificationChannel.cs`
- Features: HTML templates (Handlebars), CC/BCC, multiple recipients, SSL certificate handling
- Template engine: `Handlebars.Net` 2.1.6 via `ITemplateService`
- Template path: `Views/Notifications/` (configured in `NotificationSettings.TemplatePath`)

## Notifications (Multi-Channel)

**Architecture:**
- Central service: `NotificationService` implements `INotificationService`
  - `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/NotificationService.cs`
- Channels registered as **keyed services** (DI):
  - `"email"` → `EmailNotificationChannel`
  - `"telegram"` → `TelegramNotificationChannel`
  - `"in-app"` → `InAppNotificationChannel`
- Interface: `INotificationChannel` with `SendAsync()` and `ValidateRecipientsAsync()`
- Controller: `NotificationsController` and `NotificationStreamController`

**In-App / SSE (Server-Sent Events):**
- Purpose: Real-time in-browser notifications
- Implementation: `SseService` (singleton) + `InAppNotificationChannel`
  - `lefarma.backend/src/Lefarma.API/Features/Auth/SseService.cs`
  - `lefarma.backend/src/Lefarma.API/Features/Auth/ISseService.cs`
  - `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/Channels/InAppNotificationChannel.cs`
- Tracks connected users, delivers events to online users
- Stores notifications in `UserNotification` table for offline users

**Notification Settings:**
- `appsettings.json` → `NotificationSettings`
  - Max retry count: 3
  - Retry delay: 60 seconds
  - Template path: `Views/Notifications`

## Monitoring & Observability

**Structured Logging (Serilog):**
- Package: `Serilog.AspNetCore` 10.0.0 + `Serilog.Expressions` 5.0.0
- Console output: Information (dev), Warning (prod)
- File output: `logs/wide-events-.json` (daily rolling, 30 day retention)
- Format: JSON structured logs
- Enrichment: `FromLogContext`, `Service` property, `Version` property
- Microsoft logs suppressed (Warning/Fatal only)
- Custom `WideEvent` system: Rich per-request event logging
  - `lefarma.backend/src/Lefarma.API/Shared/Logging/WideEvent.cs`
  - `lefarma.backend/src/Lefarma.API/Shared/Logging/WideEventLogger.cs`
  - `lefarma.backend/src/Lefarma.API/Shared/Logging/IWideEventAccessor.cs`
  - Accessible via `IWideEventAccessor` in services (injected through `BaseService`)

**Error Tracking:**
- Custom `ErrorLog` entity persisted to database
- Service: `IErrorLogService` → `ErrorLogService`
- `lefarma.backend/src/Lefarma.API/Features/Logging/`

## API Communication (Frontend → Backend)

**Vite Dev Proxy:**
- Config: `lefarma.frontend/vite.config.ts`
- Proxy: `/api` → `http://localhost:5134` with `changeOrigin: true`
- Frontend dev server: port 5173

**Axios Client:**
- Config: `lefarma.frontend/src/services/api.ts`
- Base URL: `VITE_API_URL` env var, falls back to `/api`
- Timeout: 30 seconds
- Request interceptor: Attaches `Bearer {token}` from localStorage
- Response interceptor: Handles 401 with silent token refresh, 403 with console error
- Token refresh: Queue-based (prevents multiple concurrent refreshes)
- On refresh failure: Clears auth state, redirects to `/`

**CORS:**
- Policy: `"CorsPolicy"` in `Program.cs`
- Development: Allows any origin, header, method
- Configured origins in `appsettings.json` → `Cors.AllowedOrigins`: `localhost:5173`, `localhost:3000`, `192.168.4.2:8081`

**Swagger/OpenAPI:**
- Package: `Swashbuckle.AspNetCore` 10.1.0 + `Annotations` 10.1.1
- Available at: `/swagger` endpoint (all environments)
- Swagger UI: `/swagger/v1/swagger.json`
- OpenAPI: `MapOpenApi()` enabled
- Tag grouping: By controller `GroupName` attribute

## CI/CD & Deployment

**Hosting:**
- Not detected (no Docker, Kubernetes, or cloud config files found)

**CI Pipeline:**
- Not detected (no `.github/workflows/`, `azure-pipelines.yml`, or similar)

## Environment Configuration

**Backend required env vars (appsettings.json):**
- `ConnectionStrings:DefaultConnection` — Lefarma SQL Server
- `ConnectionStrings:AsokamConnection` — Asokam SQL Server
- `JwtSettings:SecretKey` — JWT signing key
- `JwtSettings:Issuer` / `JwtSettings:Audience`
- `EmailSettings:Smtp:*` — SMTP server credentials
- `EmailSettings:Ldap:Domains:*` — LDAP server configs
- `TelegramSettings:BotToken` — Telegram bot API token
- `TelegramSettings:ApiUrl` — Telegram API base URL
- `ArchivosSettings:BasePath` — File upload directory
- `DevToken:Value` / `DevToken:ImpersonateUserId` — Dev bypass token

**Frontend required env vars:**
- `VITE_API_URL` — Backend API base URL (defaults to `/api`)

**Secrets location:**
- `appsettings.json` contains production credentials (connection strings, SMTP passwords, JWT secret)
- `.env`, `.env.development`, `.env.production` files present in frontend (contents not read per security policy)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Telegram Bot API (sendMessage)
- SMTP email (MailKit)

## SSE Endpoints

**Server-Sent Events:**
- Controller: `NotificationStreamController`
  - `lefarma.backend/src/Lefarma.API/Features/Notifications/Controllers/NotificationStreamController.cs`
- Real-time event stream for authenticated users
- Events: `notification.received`, user info updates
- Used by frontend for live notification delivery

---

*Integration audit: 2026-03-30*
