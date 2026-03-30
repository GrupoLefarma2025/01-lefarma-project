# Codebase Structure

**Analysis Date:** 2026-03-30

## Directory Layout

```
01-lefarma-project/
├── lefarma.backend/              # .NET 10 backend API
│   ├── Lefarma.slnx              # Backend solution file
│   ├── src/Lefarma.API/          # Main API project (modular monolith)
│   └── tests/                    # 3 test projects
├── lefarma.frontend/             # React 19 + TypeScript + Vite frontend
│   └── src/                      # Frontend source
├── lefarma.database/             # Database DDL + seed scripts
├── lefarma.docs/                 # Living documentation (synced with code)
├── scripts/                      # DB seeding utilities (PS1 + Bash)
├── skills/                       # AI agent skills
├── AGENTS.md                     # AI agent instructions (synced with CLAUDE.md)
├── CLAUDE.md                     # Claude-specific agent instructions
├── 01-lefarma-project.sln        # Root Visual Studio solution file
├── package.json                  # Root npm config
├── init.ps1 / init.sh            # Project initialization scripts
├── install.ps1 / install.sh      # Dependency installation scripts
└── test-ldap.ps1                 # LDAP connectivity test script
```

---

## Backend: `lefarma.backend/src/Lefarma.API/`

The API follows a **feature-based layered architecture** — each business module is a vertical slice under `Features/` backed by entities in `Domain/` and data access in `Infrastructure/`.

```
Lefarma.API/
├── Program.cs                    # ⭐ Entry point: DI registration, middleware pipeline
├── Lefarma.API.csproj            # .NET 10 project file with NuGet references
├── Lefarma.API.http              # HTTP request file for manual endpoint testing
├── appsettings.json              # Base configuration
├── appsettings.Development.json  # Dev environment overrides
│
├── Domain/                       # Pure domain: entities + interfaces
│   ├── Entities/                 # EF Core entity classes organized by module
│   │   ├── Catalogos/            # Area, Empresa, Sucursal, FormaPago, Medida,
│   │   │                         # UnidadMedida, Banco, CentroCosto, CuentaContable,
│   │   │                         # EstatusOrden, Gasto, GastoUnidadMedida, MedioPago,
│   │   │                         # Proveedor, RegimenFiscal, UsuarioDetalle
│   │   ├── Auth/                 # Usuario, Rol, Permiso, UsuarioRol, RolPermiso,
│   │   │                         # UsuarioPermiso, Sesion, RefreshToken, DominioConfig,
│   │   │                         # VwDirectorioActivo, AuditLog
│   │   ├── Archivos/             # Archivo
│   │   ├── Config/               # Workflow, WorkflowPaso, WorkflowCondicion,
│   │   │                         # WorkflowAccion, WorkflowParticipante,
│   │   │                         # WorkflowNotificacion, WorkflowBitacora
│   │   ├── Help/                 # HelpArticle, HelpModule, HelpImage
│   │   ├── Notifications/        # Notification, NotificationChannel, UserNotification
│   │   ├── Operaciones/          # OrdenCompra, OrdenCompraPartida, EstadoOC
│   │   └── Logging/              # ErrorLog
│   └── Interfaces/               # Repository and service contracts
│       ├── IBaseRepository.cs    # Generic CRUD repository interface
│       ├── IArchivoRepository.cs
│       ├── IHelpArticleRepository.cs
│       ├── IHelpModuleRepository.cs
│       ├── IHelpImageRepository.cs
│       ├── INotificationRepository.cs
│       ├── INotificationService.cs
│       ├── INotificationChannel.cs
│       ├── ITemplateService.cs
│       ├── TemplateType.cs
│       ├── Catalogos/            # Per-entity interfaces (IAreaRepository, etc.)
│       ├── Admin/                # IAdminRepository
│       ├── Config/               # IWorkflowEngine, IWorkflowRepository
│       ├── Operaciones/          # IOrdenCompraRepository
│       └── Logging/              # IErrorLogService
│
├── Features/                     # Feature modules (vertical slices)
│   ├── Catalogos/                # 14 catalog sub-modules
│   │   ├── Areas/
│   │   ├── Bancos/
│   │   ├── CentrosCosto/
│   │   ├── CuentasContables/
│   │   ├── Empresas/
│   │   ├── EstatusOrden/
│   │   ├── FormasPago/
│   │   ├── Gastos/
│   │   ├── Medidas/
│   │   ├── MediosPago/
│   │   ├── Proveedores/
│   │   ├── RegimenesFiscales/
│   │   ├── Sucursales/
│   │   └── UnidadesMedida/
│   ├── Auth/                     # Authentication, SSE, user/role catalogs
│   │   ├── AuthController.cs     # Login (2-step), refresh, logout, SSE
│   │   ├── AuthService.cs        # LDAP auth, session management
│   │   ├── IAuthService.cs
│   │   ├── AuthValidator.cs
│   │   ├── DTOs/AuthDTOs.cs
│   │   ├── SseService.cs         # SSE connection manager (singleton)
│   │   ├── ISseService.cs
│   │   ├── Roles/                # Role catalog CRUD
│   │   │   ├── RolesController.cs
│   │   │   ├── RolCatalogService.cs
│   │   │   ├── IRolCatalogService.cs
│   │   │   └── DTOs/
│   │   └── Usuarios/             # User catalog CRUD
│   │       ├── UsuariosController.cs
│   │       ├── UsuarioCatalogService.cs
│   │       ├── IUsuarioCatalogService.cs
│   │       └── DTOs/
│   ├── Admin/                    # User/role/permission administration
│   │   ├── AdminController.cs
│   │   ├── AdminService.cs
│   │   ├── IAdminService.cs
│   │   ├── AdminValidator.cs
│   │   └── DTOs/
│   ├── OrdenesCompra/            # Purchase orders
│   │   ├── Captura/              # Order entry (CRUD)
│   │   │   ├── OrdenCompraController.cs
│   │   │   ├── OrdenCompraService.cs
│   │   │   ├── IOrdenCompraService.cs
│   │   │   ├── OrdenCompraValidator.cs
│   │   │   └── DTOs/
│   │   └── Firmas/               # Multi-level approval workflow
│   │       ├── FirmasController.cs
│   │       ├── FirmasService.cs
│   │       ├── IFirmasService.cs
│   │       ├── DTOs/
│   │       └── Handlers/         # Step handler pattern (IStepHandler, Firma3/Firma4)
│   ├── Config/                   # Workflow configuration & engine
│   │   ├── Workflows/
│   │   │   ├── WorkflowsController.cs
│   │   │   ├── WorkflowService.cs
│   │   │   ├── IWorkflowService.cs
│   │   │   ├── WorkflowValidator.cs
│   │   │   └── DTOs/
│   │   └── Engine/
│   │       └── WorkflowEngine.cs
│   ├── Notifications/            # Multi-channel notification system
│   │   ├── Controllers/          # NotificationsController + NotificationStreamController
│   │   ├── Services/             # NotificationService + TemplateService + Channels/
│   │   └── DTOs/
│   ├── Help/                     # Help articles system
│   │   ├── Controllers/          # HelpArticles, HelpImages, HelpModules
│   │   ├── Services/             # HelpArticleService, HelpImageService, HelpModuleService
│   │   └── DTOs/                 # Individual DTO files per entity
│   ├── Archivos/                 # File upload/management system
│   │   ├── Controllers/ArchivosController.cs
│   │   ├── Services/             # ArchivoService + IArchivoService
│   │   ├── DTOs/                 # SubirArchivoRequest, ArchivoResponse, etc.
│   │   └── Settings/ArchivosSettings.cs
│   ├── Profile/                  # User profile management
│   │   ├── ProfileController.cs
│   │   ├── ProfileService.cs
│   │   ├── IProfileService.cs
│   │   ├── ProfileValidator.cs
│   │   └── DTOs/
│   ├── Logging/
│   │   └── ErrorLogService.cs
│   └── SystemConfig/
│       └── SystemConfigController.cs
│
├── Infrastructure/
│   ├── Data/
│   │   ├── ApplicationDbContext.cs    # ⭐ Main DB context (70+ DbSets)
│   │   ├── AsokamDbContext.cs         # Secondary DB context (auth tables, `app` schema)
│   │   ├── Configurations/            # EF Core fluent API (by module)
│   │   │   ├── Auth/
│   │   │   ├── Catalogos/
│   │   │   ├── Config/
│   │   │   ├── Help/
│   │   │   ├── Archivos/
│   │   │   ├── Logging/
│   │   │   ├── Notifications/
│   │   │   └── Operaciones/
│   │   ├── Repositories/              # Repository implementations
│   │   │   ├── BaseRepository.cs      # ⭐ Generic repository
│   │   │   ├── Catalogos/             # 14 entity repositories
│   │   │   ├── Admin/AdminRepository.cs
│   │   │   ├── Config/WorkflowRepository.cs
│   │   │   ├── Notifications/NotificationRepository.cs
│   │   │   ├── Operaciones/OrdenCompraRepository.cs
│   │   │   ├── ArchivoRepository.cs
│   │   │   ├── HelpArticleRepository.cs
│   │   │   ├── HelpModuleRepository.cs
│   │   │   └── HelpImageRepository.cs
│   │   └── Seeding/
│   │       ├── DatabaseSeeder.cs
│   │       └── IDatabaseSeeder.cs
│   ├── Filters/
│   │   └── ValidationFilter.cs        # Global FluentValidation filter
│   ├── Middleware/
│   │   ├── DevTokenMiddleware.cs       # Dev-only token injection
│   │   └── WideEventLoggingMiddleware.cs  # Structured request logging
│   └── Templates/
│       └── Views/Notifications/        # Razor CSHTML notification templates
│           ├── Email/
│           ├── InApp/
│           └── Telegram/
│
├── Services/                    # Cross-feature infrastructure services
│   └── Identity/
│       ├── ActiveDirectoryService.cs   # LDAP user lookup + credential validation
│       ├── IActiveDirectoryService.cs
│       ├── TokenService.cs             # JWT + refresh token generation
│       ├── ITokenService.cs
│       ├── JwtSettings.cs              # JWT config POCO
│       ├── LdapOptions.cs              # LDAP connection options
│       ├── ServiceCollectionExtensions.cs  # DI registration helpers
│       └── Models/
│
├── Shared/                      # Cross-cutting concerns
│   ├── BaseService.cs                  # Base service with EnrichWideEvent()
│   ├── Models/
│   │   ├── ApiResponse.cs             # ⭐ Standard response wrapper ApiResponse<T>
│   │   ├── ErrorDetail.cs
│   │   └── Configuracion/BackendConfigResponse.cs
│   ├── Errors/
│   │   ├── CommonErrors.cs            # Predefined error factories
│   │   ├── HelpArticleErrors.cs
│   │   └── ArchivoErrors.cs
│   ├── Extensions/
│   │   ├── ResultExtensions.cs        # ErrorOr → ActionResult mapping
│   │   ├── EntityMappings.cs          # Entity → Response DTO mapping
│   │   ├── StringExtensions.cs        # Diacritics removal for search
│   │   └── ExceptionExtensions.cs     # Exception detail extraction
│   ├── Authorization/
│   │   ├── PermissionHandler.cs       # JWT permission claim checker
│   │   └── PermissionRequirement.cs
│   ├── Constants/
│   │   └── AuthorizationConstants.cs  # Role names, permission codes, policy names
│   └── Logging/
│       ├── WideEvent.cs               # Structured event model
│       ├── IWideEventAccessor.cs      # HttpContext-based accessor
│       └── WideEventLogger.cs         # Serilog integration
│
├── Database/                    # Feature-specific SQL scripts
│   ├── HelpSystem.sql
│   └── README_HELPSYSTEM.md
├── Properties/
│   ├── launchSettings.json
│   └── PublishProfiles/FolderProfile.pubxml
├── logs/                        # Runtime wide-event JSON logs (daily rotation, gitignored)
└── wwwroot/
    └── media/                   # Uploaded files (help images, archivos)
```

### Standard Feature Module Structure

Every feature under `Features/` follows this pattern:

```
[FeatureName]/
├── [FeatureName]sController.cs  # API endpoint definitions
├── I[FeatureName]Service.cs     # Service interface
├── [FeatureName]Service.cs      # Service implementation (extends BaseService)
├── [FeatureName]Validator.cs    # FluentValidation rules
├── DTOs/                        # Request/response DTOs
│   └── [FeatureName]DTOs.cs     # Contains [Name]Response, Create[Name]Request,
│                                 # Update[Name]Request, [Name]Request (query)
└── Extensions/ (optional)       # Entity-to-DTO mapping extensions
    └── [FeatureName]Extensions.cs
```

### Backend Tests: `lefarma.backend/tests/`

```
tests/
├── Lefarma.Tests/               # Feature tests (Notification tests exist)
│   ├── Lefarma.Tests.csproj
│   └── Notifications/
│       ├── SimpleNotificationTests.cs
│       ├── NotificationServiceTests.cs
│       └── NotificationsApiTests.cs
├── Lefarma.UnitTests/           # Unit tests (placeholder — only UnitTest1.cs)
│   └── Lefarma.UnitTests.csproj
├── Lefarma.IntegrationTests/    # Integration tests (placeholder — only UnitTest1.cs)
│   └── Lefarma.IntegrationTests.csproj
└── NotificationsManualTest.sh   # Manual test script
```

---

## Frontend: `lefarma.frontend/src/`

React 19 SPA with TypeScript, Vite, TailwindCSS, and shadcn/ui.

```
src/
├── main.tsx                     # ⭐ Entry point: renders <App /> in StrictMode
├── App.tsx                      # Root component: auth init, token refresh, routing
├── index.css                    # Global styles (Tailwind directives)
│
├── routes/                      # React Router v7 configuration
│   ├── AppRoutes.tsx            # ⭐ All route definitions (35+ routes with permission guards)
│   ├── routePermissions.ts     # Route-to-permission mapping
│   ├── LandingRoute.tsx         # Landing + ProtectedRoute + PublicOnlyRoute
│   ├── PrivateRoute.tsx         # Authenticated route guard
│   └── PublicRoute.tsx          # Unauthenticated-only route guard
│
├── pages/                       # Route-level page components
│   ├── Dashboard.tsx            # Main dashboard
│   ├── Perfil.tsx               # User profile
│   ├── Notifications.tsx        # Notifications list page
│   ├── Roadmap.tsx              # Development roadmap
│   ├── DemoComponents.tsx       # Component showcase
│   ├── Hero.tsx                 # Landing page (unauthenticated)
│   ├── NotFound.tsx             # 404 page
│   ├── auth/
│   │   ├── Login.tsx            # Login form (2-step)
│   │   ├── SelectEmpresaSucursal.tsx  # Empresa/sucursal selector (step 3)
│   │   └── BlockedPage.tsx      # Permission denied page
│   ├── admin/
│   │   ├── Permisos/PermisosList.tsx
│   │   ├── Roles/RolesList.tsx
│   │   └── Usuarios/UsuariosList.tsx
│   ├── catalogos/
│   │   ├── Areas/               # AreasList.tsx
│   │   ├── Empresas/            # EmpresasList.tsx
│   │   ├── Sucursales/          # SucursalesList.tsx
│   │   ├── FormasPago/          # FormasPagoList.tsx
│   │   ├── Gastos/              # GastosList.tsx
│   │   ├── Medidas/             # MedidasList.tsx
│   │   └── generales/
│   │       ├── CentrosCosto/    # CentrosCostoList.tsx
│   │       ├── CuentasContables/ # CuentasContablesList.tsx
│   │       ├── EstatusOrden/    # EstatusOrdenList.tsx
│   │       ├── Proveedores/     # ProveedoresList.tsx
│   │       └── RegimenesFiscales/ # RegimenesFiscalesList.tsx
│   ├── configuracion/
│   │   ├── ConfiguracionGeneral.tsx  # Settings tabs container
│   │   ├── PerfilConfig.tsx         # Profile settings
│   │   ├── UIConfig.tsx             # UI preferences
│   │   └── SistemaConfig.tsx        # System settings
│   ├── help/
│   │   ├── HelpList.tsx             # Help articles list
│   │   ├── HelpView.tsx             # Article viewer
│   │   └── HelpEditor.tsx           # TinyMCE article editor
│   ├── ordenes/
│   │   ├── AutorizacionesOC.tsx     # Purchase order approvals
│   │   └── index.ts
│   └── workflows/
│       ├── WorkflowsList.tsx
│       ├── WorkflowDiagram.tsx
│       └── index.ts
│
├── components/
│   ├── layout/                  # App shell
│   │   ├── MainLayout.tsx       # SidebarProvider + AppSidebar + Header + Outlet
│   │   ├── AppSidebar.tsx       # Navigation sidebar (permission-filtered menu)
│   │   ├── Header.tsx           # Top bar (page title, notification bell, user menu)
│   │   ├── Sidebar.tsx          # Legacy sidebar wrapper
│   │   └── CambiarUbicacionModal.tsx  # Change empresa/sucursal modal
│   ├── ui/                      # 51 shadcn/ui primitive components
│   │   ├── accordion, alert, alert-dialog, aspect-ratio, avatar
│   │   ├── badge, breadcrumb, button
│   │   ├── calendar, card, carousel, chart, checkbox, collapsible, command
│   │   ├── context-menu, data-table, dialog, drawer, dropdown-menu
│   │   ├── form, hover-card, input, input-otp, label
│   │   ├── menubar, modal, multi-select, navigation-menu
│   │   ├── pagination, popover, progress, radio-group, resizable
│   │   ├── scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner
│   │   ├── switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip
│   │   └── (generated via: npx shadcn@latest add [component])
│   ├── table/                   # Data table filter enhancements
│   │   ├── ActiveFiltersBar.tsx
│   │   ├── ColumnFilterPopover.tsx
│   │   └── FilterConfig.tsx
│   ├── archivos/                # File management
│   │   ├── FileUploader.tsx     # Drag-and-drop upload
│   │   ├── FileViewer.tsx       # Preview (PDF, images, Excel)
│   │   ├── ExcelTable.tsx       # Excel viewer
│   │   └── index.ts
│   ├── help/                    # Help system UI
│   │   ├── TinyMceEditor.tsx    # Rich text editor
│   │   ├── TinyMceViewer.tsx    # Read-only HTML viewer
│   │   ├── HtmlViewer.tsx       # Raw HTML viewer
│   │   ├── HelpSidebar.tsx
│   │   └── ModuleDialog.tsx
│   ├── notifications/           # Notification UI
│   │   ├── NotificationBell.tsx
│   │   ├── NotificationList.tsx
│   │   └── RecipientSelector.tsx
│   ├── config/                  # UI configuration
│   │   ├── PresetSelector.tsx
│   │   └── AdvancedConfigUI.tsx
│   ├── permissions/
│   │   └── PermissionGuard.tsx  # Declarative permission check
│   ├── auth/
│   │   └── PermissionGuard.tsx  # Auth-related permission guard
│   ├── kibo-ui/                 # Third-party advanced UI components
│   │   ├── calendar/
│   │   ├── code-block/
│   │   ├── combobox/
│   │   ├── gantt/
│   │   ├── kanban/
│   │   └── list/
│   └── AutoVerify.tsx           # Auto-test verification component
│
├── services/                    # API communication layer
│   ├── api.ts                   # ⭐ Axios instance + JWT interceptors + token refresh
│   ├── authService.ts           # Login, refresh, logout API calls
│   ├── archivoService.ts        # File upload/download/delete
│   ├── helpService.ts           # Help articles/modules CRUD
│   ├── notificationService.ts   # Notification CRUD + mark-as-read
│   ├── sseService.ts            # Server-Sent Events connection manager (singleton)
│   └── systemConfigService.ts   # System configuration API
│
├── store/                       # Zustand state management
│   ├── authStore.ts             # Auth state: 3-step login, user, tokens, empresa, sucursal
│   ├── configStore.ts           # UI/system config (persisted to localStorage)
│   ├── pageStore.ts             # Page title/subtitle for Header
│   ├── notificationStore.ts     # Notifications (with devtools)
│   └── helpStore.ts             # Help articles/modules
│
├── hooks/                       # Custom React hooks
│   ├── usePageTitle.ts          # Set page title in Header
│   ├── usePermission.ts         # Check current user permissions
│   ├── useNotifications.ts      # SSE connection + notification management
│   ├── useTokenRefresh.ts       # Proactive JWT token refresh
│   ├── useUserSync.ts           # Sync user data via SSE
│   ├── useTableFilters.ts       # Table filter state management
│   ├── use-toast.ts             # Toast notification hook
│   └── use-mobile.tsx           # Mobile detection hook
│
├── types/                       # TypeScript type definitions
│   ├── api.types.ts             # ApiResponse<T>, ApiError
│   ├── auth.types.ts            # UserInfo, LoginSteps, Empresa, Sucursal, PermissionInfo
│   ├── catalogo.types.ts        # Catalog entity types
│   ├── permiso.types.ts         # Permission types
│   ├── rol.types.ts             # Role types
│   ├── usuario.types.ts         # User types
│   ├── archivo.types.ts         # File/upload types
│   ├── notification.types.ts    # Notification types
│   ├── help.types.ts            # Help article/module types
│   ├── config.types.ts          # UI config, presets
│   ├── workflow.types.ts        # Workflow types
│   ├── sse.types.ts             # SSE event types, connection state
│   └── table.types.ts           # Table/filter types
│
├── utils/
│   └── permissions.ts           # checkPermission(), getUserPermissions()
│
├── constants/
│   └── uiPresets.ts             # UI preset definitions
│
├── lib/
│   ├── utils.ts                 # cn() helper (Tailwind merge + clsx)
│   └── tableConfigStorage.ts    # Persist table column/filter config to localStorage
│
└── assets/
    ├── logo.png
    ├── favicon.ico
    ├── react.svg
    └── noise-texture.jpg
```

### Frontend Root Files: `lefarma.frontend/`

```
lefarma.frontend/
├── package.json                 # Dependencies and scripts
├── vite.config.ts               # Vite config with API proxy to backend
├── tsconfig.json                # TypeScript configuration
├── tsconfig.node.json           # Node-specific TS config
├── tailwind.config.js           # TailwindCSS configuration
├── postcss.config.js            # PostCSS configuration
├── eslint.config.js             # ESLint configuration
├── playwright.config.ts         # Playwright E2E test configuration
├── components.json              # shadcn/ui component registry
├── index.html                   # HTML entry point
├── .env                         # Base environment vars (VITE_API_URL)
├── .env.development             # Dev environment vars
├── .env.production              # Production environment vars
├── .env.example                 # Example env template
├── public/                      # Static public assets
├── tests/                       # Playwright E2E tests
│   └── login.spec.ts
└── docs/                        # Frontend-specific documentation
```

---

## Other Directories

### `lefarma.database/` — Database Scripts

```
lefarma.database/
├── 000_create_tables.sql              # Table creation DDL
├── 001_seed_data.sql                  # Seed data
├── db_diagrama_propuesta_v1.png       # DB diagram v1
├── db_diagrama_propuesta_v2.png       # DB diagram v2
└── NOTIFICATION_DB_SCRIPTS.md         # Notification schema documentation
```

### `lefarma.docs/` — Living Documentation

Must stay in sync with code. Update when changing entities, endpoints, pages, or components.

```
lefarma.docs/
├── README.md                          # Documentation index
├── PROJECT.md                         # Project overview
├── SPECS.md                           # Specifications
├── backend/                           # Backend docs
│   ├── api-routes.md                  # All API endpoints
│   ├── entities.md                    # Database entities
│   ├── services.md                    # Business services
│   └── dtos.md                        # Data transfer objects
├── frontend/                          # Frontend docs
│   ├── routes.md                      # Route definitions
│   ├── pages.md                       # Page components
│   ├── components.md                  # Reusable components
│   ├── services.md                    # API client and auth
│   └── types.md                       # TypeScript types
├── task/                              # Task/PRD tracking
│   ├── 001-sincronizacion-usuario-sse.md
│   └── 021-sistema-gestion-archivos.md
├── workflow/                          # Workflow system docs
├── notificaciones/                    # Notification system docs
├── plans/                             # Development plans
├── reports/                           # Reports
├── research/                          # Research notes
├── specs/                             # Feature specs
└── Documentacion/                     # General documentation
```

### `scripts/` — Database Seeding Utilities

Both PowerShell (`.ps1`) and Bash (`.sh`) versions available:
- `seed-empresas-sucursales.sh` / `.ps1`
- `seed-areas.sh`
- `seed-formas-pago.sh`
- `create-formas-pago-table.ps1`

---

## Entry Points

| Entry Point | File | Description |
|---|---|---|
| Backend API | `lefarma.backend/src/Lefarma.API/Program.cs` | DI registration, middleware pipeline, CORS, Swagger |
| Frontend mount | `lefarma.frontend/src/main.tsx` | React 19 StrictMode render |
| Frontend app | `lefarma.frontend/src/App.tsx` | Auth initialization, token refresh, route tree |

## Key Configuration Files

| Config | File | Purpose |
|---|---|---|
| Backend settings | `lefarma.backend/src/Lefarma.API/appsettings.json` | Production config |
| Backend dev | `lefarma.backend/src/Lefarma.API/appsettings.Development.json` | Dev overrides |
| Backend project | `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` | NuGet dependencies |
| Frontend deps | `lefarma.frontend/package.json` | npm dependencies |
| Frontend build | `lefarma.frontend/vite.config.ts` | Vite config + API proxy |
| Frontend env | `lefarma.frontend/.env` | VITE_API_URL |
| Root solution | `01-lefarma-project.sln` | Visual Studio solution |

---

## Naming Conventions

### Backend Files
- **Entities**: Singular PascalCase — `Area.cs`, `OrdenCompra.cs`
- **Controllers**: Plural PascalCase — `AreasController.cs`, `SucursalesController.cs`
- **Services**: PascalCase with `I` prefix for interface — `ISucursalService.cs` / `SucursalService.cs`
- **Repositories**: PascalCase with `I` prefix — `IAreaRepository.cs` / `AreaRepository.cs`
- **DTOs**: Grouped in single file per module — `[Module]DTOs.cs`
- **Validators**: `[Module]Validator.cs`
- **EF Configurations**: `[Entity]Configuration.cs`

### Frontend Files
- **Pages**: PascalCase with `List` suffix — `AreasList.tsx`, `EmpresasList.tsx`
- **Components**: PascalCase — `NotificationBell.tsx`, `FileUploader.tsx`
- **Services**: camelCase — `authService.ts`, `archivoService.ts`
- **Stores**: camelCase with `Store` suffix — `authStore.ts`, `pageStore.ts`
- **Hooks**: camelCase with `use` prefix — `usePageTitle.ts`, `usePermission.ts`
- **Types**: camelCase with `.types.ts` suffix — `catalogo.types.ts`, `auth.types.ts`
- **UI components (shadcn)**: kebab-case — `data-table.tsx`, `alert-dialog.tsx`

### Directory Names
- **Backend Features**: Plural — `Areas/`, `Empresas/`, `Bancos/`
- **Frontend Pages**: Plural with `List` file — `Areas/AreasList.tsx`
- **Frontend Components**: Flat under `ui/` for shadcn, grouped by concern for domain

---

## Where to Add New Code

### New Catalog Module (Backend)
1. Entity → `Domain/Entities/Catalogos/[Entity].cs`
2. Repository interface → `Domain/Interfaces/Catalogos/I[Entity]Repository.cs` (extends `IBaseRepository<T>`)
3. EF configuration → `Infrastructure/Data/Configurations/Catalogos/[Entity]Configuration.cs`
4. Repository → `Infrastructure/Data/Repositories/Catalogos/[Entity]Repository.cs`
5. DTOs → `Features/Catalogos/[Entities]/DTOs/[Entity]DTOs.cs`
6. Service interface → `Features/Catalogos/[Entities]/I[Entity]Service.cs`
7. Service → `Features/Catalogos/[Entities]/[Entity]Service.cs` (extends `BaseService`)
8. Validator → `Features/Catalogos/[Entities]/[Entity]Validator.cs`
9. Controller → `Features/Catalogos/[Entities]/[Entities]Controller.cs`
10. Extensions → `Features/Catalogos/[Entities]/Extensions/[Entity]Extensions.cs` (ToResponse mapping)
11. Add DbSet → `Infrastructure/Data/ApplicationDbContext.cs`
12. Register DI → `Program.cs` (repository + service)

### New Catalog Module (Frontend)
1. Types → `types/catalogo.types.ts` (add to existing file)
2. Page → `pages/catalogos/[FeatureName]/[FeatureName]List.tsx`
3. Route → `routes/AppRoutes.tsx`
4. Route permission → `routes/routePermissions.ts`
5. Sidebar entry → `components/layout/AppSidebar.tsx`

### New Non-Catalog Feature (Backend)
Same pattern under `Features/[ModuleName]/`:
```
[ModuleName]/
├── DTOs/
├── I[Module]Service.cs
├── [Module]Service.cs
├── [Module]Validator.cs   (optional)
└── [Module]Controller.cs
```

### New Frontend Component
- **UI primitive**: `components/ui/[name].tsx` — use `npx shadcn@latest add [component]`
- **Domain component**: `components/[domain]/[ComponentName].tsx`

### New Hook
- `hooks/use[Name].ts` (or `.tsx` if returning JSX)

### New Store
- `store/[name]Store.ts` (Zustand `create` pattern)

### New Tests
- **Unit**: `lefarma.backend/tests/Lefarma.Tests/[Feature]/[TestName].cs`
- **Integration**: `lefarma.backend/tests/Lefarma.IntegrationTests/[TestName].cs`
- **E2E**: `lefarma.frontend/tests/[name].spec.ts`

---

## Special Directories

| Directory | Purpose | Generated | Committed | Notes |
|---|---|---|---|---|
| `wwwroot/media/` | Uploaded files at runtime | Yes | Demo files only | ⚠️ Production files not versioned |
| `logs/` | Wide-event structured JSON logs | Yes (daily) | No | Gitignored |
| `components/ui/` | shadcn/ui primitives | Yes (CLI) | Yes | ⚠️ Don't manually edit — use shadcn CLI |
| `components/kibo-ui/` | Advanced third-party UI components | No | Yes | Calendar, Gantt, Kanban, etc. |
| `lefarma.docs/` | Living documentation | No | Yes | Must stay in sync with code |
| `bin/`, `obj/` | .NET build artifacts | Yes | No | Gitignored |
| `.planning/` | GSD planning documents | No | Yes | Codebase analysis, phase plans |

---

*Structure analysis: 2026-03-30*
