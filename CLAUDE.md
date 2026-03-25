# CLAUDE.md

For every complex problem:
1.DECOMPOSE: Break into sub-problems
2.SOLVE: Address each with explicit confidence (0.0-1.0)
3.VERIFY: Check logic, facts, completeness, bias
4.SYNTHESIZE: Combine using weighted confidence
5.REFLECT: If confidence <0.8, identify weakness and retry
For simple questions, skip to direct answer.

Always output:
∙Clear answer
∙Confidence level
∙Key caveats


## Project Overview

Lefarma is a pharmaceutical management system with a .NET 10 backend and React 19 + TypeScript frontend. The architecture follows a modular monolith pattern organized by features.

**Repository Structure:**
- `lefarma.backend/` - .NET 10 Web API
- `lefarma.frontend/` - React 19 + Vite frontend
- `lefarma.database/` - Database scripts
- `lefarma.docs/` - Detailed documentation

## Quick Start

### First Time Setup
```powershell
./install.ps1    # Install dependencies (Node.js, .NET, npm packages)
./init.ps1       # Start both backend and frontend
```

### Backend Commands
```bash
cd lefarma.backend/src/Lefarma.API

# Run API (recommended: clear port first to avoid "port already in use" error)
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run    # Run API on http://localhost:5134

dotnet run                    # Run API (may fail if port is in use)
dotnet build                  # Build project
dotnet test                   # Run all tests
dotnet test --filter "FullyQualifiedName~UnitTest1"  # Run specific test

# Entity Framework Migrations
dotnet ef migrations add <Name>              # Create migration
dotnet ef database update                    # Apply migrations
dotnet ef database update 0                  # Rollback all migrations
dotnet ef migrations remove                  # Remove last migration
```

**Note:** The `fuser -k 5134/tcp 2>/dev/null; clear; dotnet run` command does 3 things in one:
1. Kills any process using port 5134 (avoids "port already in use" error)
2. Clears the terminal
3. Runs the API

### Frontend Commands
```bash
cd lefarma.frontend

npm run dev           # Start dev server on http://localhost:5173
npm run build         # Production build
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm run preview       # Preview production build locally
```

## Architecture

### Backend - Feature-Based Layered Architecture

The backend follows a clean separation of concerns with feature-based organization:

```
Lefarma.API/
├── Domain/                    # Core business entities
│   ├── Entities/              # EF Core entity models
│   └── Interfaces/            # Repository and service interfaces
├── Features/                  # Feature modules (self-contained)
│   ├── Auth/                  # Authentication (LDAP + JWT)
│   │   ├── AuthController.cs
│   │   ├── AuthService.cs
│   │   ├── IAuthService.cs
│   │   ├── AuthValidator.cs   # FluentValidation validator
│   │   └── DTOs/              # Request/Response DTOs
│   └── Catalogos/             # Catalog features
│       ├── Empresas/
│       ├── Sucursales/
│       ├── Areas/
│       ├── Gastos/
│       ├── Medidas/
│       └── UnidadesMedida/
│           └── [Feature]Controller.cs
│           ├── [Feature]Service.cs
│           ├── I[Feature]Service.cs
│           ├── [Feature]Validator.cs
│           └── DTOs/
├── Infrastructure/            # External concerns
│   ├── Data/
│   │   ├── ApplicationDbContext.cs
│   │   ├── Configurations/    # EF Core entity configurations
│   │   └── Repositories/      # Repository implementations
│   ├── Filters/               # Global filters (ValidationFilter)
│   └── Middleware/            # Custom middleware (WideEvent logging)
├── Services/Identity/         # Identity services (AD, JWT)
├── Shared/                    # Cross-cutting concerns
│   ├── Authorization/         # Permission-based authorization
│   ├── Constants/             # Constants (Roles, Permissions)
│   ├── Errors/                # Custom exceptions
│   ├── Extensions/            # Extension methods (ToActionResult)
│   ├── Logging/               # WideEvent logging infrastructure
│   └── Models/                # ApiResponse<T>
└── Program.cs                 # Application entry point
```

**Key Patterns:**

1. **Service Pattern**: Each feature has a service interface and implementation that contains business logic. Controllers are thin and delegate to services.

2. **Repository Pattern**: Repositories abstract data access. Interfaces are in `Domain/Interfaces/`, implementations in `Infrastructure/Data/Repositories/`.

3. **Unified Response**: All endpoints return `ApiResponse<T>` with `Success`, `Message`, `Data`, and `Errors` properties.

4. **Validation**: FluentValidation is used. Validators are registered via `AddValidatorsFromAssemblyContaining<Program>()` and executed through `ValidationFilter`.

5. **Extension Methods**: Services return `Result<T>` types that convert to `IActionResult` via `.ToActionResult()` extension method.

6. **Authorization**: Role-based policies (RequireAdministrator, RequireManager, etc.) and permission-based policies (CanViewCatalogos, CanManageCatalogos) configured in `Program.cs`.

7. **WideEvent Logging**: Custom middleware logs one rich event per HTTP request to JSON files in `logs/` directory with 30-day retention.

**Backend Feature Modules:**

- **Auth/**: Authentication and authorization (LDAP + JWT)
  - Multi-domain LDAP support (Asokam, Artricenter)
  - JWT token generation and validation
  - Master password bypass for development (tt01tt)

- **Catalogos/**: Catalog management features
  - **Core**: Empresas, Sucursales, Areas, Gastos, Medidas, UnidadesMedida
  - **Financieros**: Bancos, MediosPago, FormasPago
  - **Proveedores**: Proveedores management
  - **Costos**: CentrosCosto, CuentasContables
  - **Fiscales**: RegimenesFiscales
  - **Operaciones**: EstatusOrden
  - CRUD operations with role/permission-based access control

- **Notifications/**: Multi-channel notification system
  - **Channels**: Email (MailKit), Telegram, In-App (real-time via SSE)
  - **SSE (Server-Sent Events)**: Real-time notification streaming at `/api/notifications/sse`
  - **Template Service**: Handlebars.Net para templates de email con datos dinámicos
  - **Priority System**: Low, Normal, High, Critical
  - **Categories**: Info, Success, Warning, Error
  - **Keyed Services**: Channels registrados como keyed services para delivery multi-channel
  - **Controllers**: `NotificationsController` (CRUD), `NotificationStreamController` (SSE endpoint)

- **Profile/**: User profile management
  - User profile data
  - Profile updates
  - User preferences

- **Admin/**: System administration
  - User management
  - Role and permission assignment
  - Database seeding and initialization

- **Logging/**: Error logging and monitoring
  - `ErrorLogService`: Centralized error logging
  - Database-persisted error logs
  - Integration with WideEvent middleware

- **SystemConfig/**: System configuration management
  - Application settings
  - Feature flags
  - Configuration validation

- **HttpClientFactory**: Configurado en `Program.cs` para llamadas a APIs externas
  - Usado para integraciones con servicios de terceros
  - Inyectado en servicios que necesitan hacer HTTP requests

### Frontend - Component-Based Architecture

```
src/
├── components/
│   ├── layout/                # Layout components (Header, Sidebar, MainLayout)
│   └── ui/                    # shadcn/ui components (Button, Card, Dialog, etc.)
├── pages/
│   ├── auth/                  # Authentication pages (Login)
│   ├── catalogos/             # Catalog CRUD pages
│   │   ├── generales/         # Empresas, Sucursales, Gastos, Medidas, Areas
│   │   └── seguridad/         # Roles, Permisos
│   ├── configuracion/         # Configuration pages
│   └── [OtherPages].tsx
├── routes/                    # Route components
│   ├── AppRoutes.tsx          # Main route configuration
│   ├── ProtectedRoute.tsx     # Auth wrapper
│   ├── PublicOnlyRoute.tsx    # Public routes (login)
│   └── LandingRoute.tsx       # Landing/home route
├── services/                  # API services
│   ├── api.ts                 # Axios instance with interceptors
│   └── authService.ts         # Authentication service
├── store/                     # Zustand state management
│   ├── authStore.ts           # Auth state (user, token, permissions)
│   └── pageStore.ts           # Page/UI state
├── types/                     # TypeScript type definitions
├── hooks/                     # Custom React hooks
├── lib/                       # Utilities (cn for classnames)
└── App.tsx                    # Root component
```

**Key Patterns:**

1. **Route Guards**: `ProtectedRoute` checks authentication via `authStore`, `PublicOnlyRoute` redirects authenticated users to dashboard.

2. **Axios Interceptors**: The `api.ts` client handles:
   - Adding JWT tokens to requests
   - Automatic token refresh on 401 responses
   - Redirecting to login on refresh failure

3. **State Management**: Zustand stores (`authStore`, `pageStore`, `notificationStore`) manage global state. Auth store persists to localStorage.

4. **UI Components**: shadcn/ui pattern - components in `components/ui/` are composed into page-specific components.

5. **Form Handling**: React Hook Form + Zod for validation patterns.

6. **SSE (Server-Sent Events)**: Real-time notifications via EventSource
   - `hooks/useNotifications.ts`: Custom hook for SSE connection management
   - Automatic reconnection with authentication headers
   - Connection lifecycle tied to authentication state
   - Real-time notification updates in UI

## Working with This Project

### Development Workflow

#### 1. Setup for Development
```bash
# Start backend (Terminal 1)
cd lefarma.backend/src/Lefarma.API
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run

# Start frontend (Terminal 2)
cd lefarma.frontend
npm run dev
```

Both services must be running for full functionality.

#### 2. Typical Feature Development

**Backend (Catalog Feature)**:
```bash
# 1. Create entity
Domain/Entities/MyEntity.cs

# 2. Create EF config
Infrastructure/Data/Configurations/MyEntityConfiguration.cs

# 3. Create repository interface
Domain/Interfaces/ICatalogos/IMyEntityRepository.cs

# 4. Create repository implementation
Infrastructure/Data/Repositories/Catalogos/MyEntityRepository.cs

# 5. Create service interface and implementation
Features/Catalogos/MyEntity/IMyEntityService.cs
Features/Catalogos/MyEntity/MyEntityService.cs

# 6. Create FluentValidation validator
Features/Catalogos/MyEntity/MyEntityValidator.cs

# 7. Create controller
Features/Catalogos/MyEntity/MyEntitiesController.cs

# 8. Register in Program.cs
builder.Services.AddScoped<IMyEntityRepository, MyEntityRepository>();
builder.Services.AddScoped<IMyEntityService, MyEntityService>();

# 9. Create migration
dotnet ef migrations add AddMyEntity
dotnet ef database update
```

**Frontend (Catalog Page)**:
```bash
# 1. Create types
types/catalogo.types.ts

# 2. Create page component
pages/catalogos/MyEntity/MyEntityList.tsx

# 3. Add route
routes/AppRoutes.tsx

# 4. Add sidebar item (if applicable)
components/layout/Sidebar.tsx
```

#### 3. Validation Protocol (MANDATORY)

**CRITICAL: Todo cambio debe validarse antes de considerarse completo**

Antes de hacer commit de cualquier cambio, ejecuta este protocolo:

**a) Visual Validation**
1. Navegar a la página afectada
2. Verificar renderizado correcto de UI
3. Tomar screenshot como evidencia

**b) Functional Testing**
1. Probar CRUD completo (Create, Read, Update, Delete)
2. Verificar validaciones (required, formatos, etc.)
3. Probar casos edge (valores vacíos, inválidos, etc.)

**c) Network Verification**
1. Abrir DevTools (F12) → Network tab
2. Verificar endpoints correctos (GET, POST, PUT, DELETE)
3. Validar payloads (request/response)
4. Verificar autenticación (Authorization header)

**d) Console Verification**
1. Revisar Console tab en DevTools
2. Verificar NO errores de JavaScript
3. Verificar NO warnings de React

**e) Persistence Testing**
1. Cambiar configuración (filtros, columnas visibles)
2. F5 para recargar
3. Verificar cambios persistieron

#### 4. Browser Automation Testing

Usa **agent-browser** o **chrome-devtools MCP** para testing automatizado:

```bash
# Example: Test catalog CRUD flow
agent-browser open http://localhost:5173/catalogos/empresas
agent-browser fill "#username" "54"
agent-browser fill "#password" "tt01tt"
agent-browser click "button[type='submit']"
agent-browser wait --url "**/dashboard"
agent-browser goto http://localhost:5173/catalogos/empresas
agent-browser screenshot initial-state.png

# Test create
agent-browser click "button:has-text('Nueva Empresa')"
agent-browser fill "#nombre" "Test Company"
agent-browser click "button[type='submit']"
agent-browser wait --text "Test Company"  # Esperar que aparezca en tabla
agent-browser screenshot after-create.png
```

### Git Workflow

#### Branch Strategy
- `main`: Producción, siempre estable
- `dev`: Desarrollo, fusiona a main cuando está estable
- `feature/*`: Ramas temporales para features específicos

#### Commit Process
```bash
# 1. Crear rama feature (opcional para features grandes)
git checkout -b feature/nueva-funcionalidad

# 2. Hacer cambios y validar
# ... código ...
# ... validar con browser automation ...

# 3. Commits atómicos (un cambio por commit)
git add .
git commit -m "feat: add user authentication with LDAP"

# 4. Push y crear PR
git push origin feature/nueva-funcionalidad
# Crear Pull Request en GitHub: feature → dev

# 5. Fusionar a dev
git checkout dev
git pull origin dev
git merge feature/nueva-funcionalidad
git push origin dev
```

#### Commit Message Convention
```
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: formato, semi-colons, etc. (no cambia lógica)
refactor: refactorización de código (no cambia comportamiento)
test: agregar o actualizar tests
chore: actualización de build, configs, dependencies
perf: mejora de rendimiento
ci: cambios en CI/CD
```

**NO agregues "Co-Authored-By" a commits** - Solo usa conventional commits format.

### Troubleshooting Common Issues

#### Backend Issues

**"Port 5134 already in use"**
```bash
# Solution: Kill process using port
fuser -k 5134/tcp 2>/dev/null; dotnet run
```

**"Cannot find module" or dependency errors**
```bash
cd lefarma.backend/src/Lefarma.API
dotnet restore
```

**LDAP connection fails**
- Verify AD server is reachable
- Check credentials in appsettings.json
- Test with master password: `54`/`tt01tt`

**JWT expires immediately**
- Check `JwtSettings:ExpiryMinutes` in appsettings.json
- Verify refresh token logic in authService

#### Frontend Issues

**"Module not found" errors**
```bash
cd lefarma.frontend
rm -rf node_modules package-lock.json
npm install
```

**TypeScript compilation errors**
- Check type definitions in `types/`
- Verify imports are correct
- Run `npx tsc --noEmit` to check

**Blank page or white screen**
- Check browser console for errors
- Verify VITE_API_URL is correct
- Check if backend is running on port 5134

**State not updating**
- Verify Zustand store is configured correctly
- Check if you're using `set` method properly
- Look for stale closures in useEffect dependencies

#### Database Issues

**Migration fails**
```bash
# Check current migration
dotnet ef migrations list

# Rollback if needed
dotnet ef database update 0

# Remove last migration
dotnet ef migrations remove
```

**Connection string errors**
- Verify SQL Server is running
- Check connection string in appsettings.json
- Ensure `TrustServerCertificate=true` for development

### Debugging Tips

#### Backend Debugging
```csharp
// Use logger in services
_logger.LogInformation("Processing request for {Id}", id);

// Use Result pattern explicitly
var result = await _service.GetAsync(id);
if (result.IsError) {
    return BadRequest(result.Errors);
}

// Check state in Program.cs
app.MapGet("/debug/state", () => {
    return Results.Ok(new {
        User = Thread.CurrentPrincipal?.Identity?.Name,
        Timestamp = DateTime.Now
    });
});
```

#### Frontend Debugging
```typescript
// Use console.log strategically
console.log('🔍 Filtering with:', { searchColumns, search });

// Use React DevTools Profiler
// Components tab → Check why component re-renders

// Check Zustand store state
const authState = useAuthStore();
console.log('Auth state:', authState);

// Use custom hooks for debugging
useDebugValue(visibleColumnIds); // Shows in DevTools
```

#### Network Debugging
```bash
# Check if backend is reachable
curl http://localhost:5134/api/health

# Check API with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5134/api/catalogos/empresas
```

### Code Quality Standards

#### Backend (C#)
- **Always use `Result<T>` pattern** instead of exceptions for business logic
- **Use FluentValidation** for all request DTOs
- **Inject dependencies** via constructor (no `new` in services)
- **Use async/await** for I/O operations
- **Add XML documentation comments** to public methods
- **Follow C# conventions** (PascalCase for methods/properties, camelCase for locals)

#### Frontend (TypeScript/React)
- **Use TypeScript strictly** - no `any` unless absolutely necessary
- **Use functional components** with hooks
- **Use shadcn/ui components** when available
- **Implement proper error boundaries** around Suspense
- **Use Zod schemas** for form validation
- **Follow React best practices** from Vercel:
  - `rerender-dependencies`: Only primitive dependencies in useEffect
  - `rerender-move-effect-to-event`: Put event logic in handlers not effects
  - `async-parallel`: Use Promise.all() for independent async operations

#### Performance Considerations

**Backend:**
- Use `AsNoTracking` for read-only queries
- Project navigation properties explicitly (`Include(x => x.Related)`)
- Use pagination for large datasets
- Cache frequently accessed data

**Frontend:**
- Use `useMemo` for expensive computations
- Use `useCallback` for callbacks passed to child components
- Lazy load routes with React.lazy()
- Implement virtual scrolling for large lists (TanStack Table handles this)

### Security Best Practices

#### Backend
- **Never commit secrets** (connection strings, API keys, JWT secrets)
- Use environment variables for sensitive data
- Validate all input (use FluentValidation)
- Implement proper authorization (check roles + permissions)
- Use parameterized SQL queries to prevent SQL injection
- Log all user actions for audit trail

#### Frontend
- **Never store tokens in plain text** - use httpOnly cookies
- Implement proper route guards (ProtectedRoute)
- Sanitize user input before rendering (prevent XSS)
- Validate API responses before using data
- Implement proper error handling (don't expose stack traces)
- Use CSP headers to prevent injection attacks

### When to Ask for Help

Before asking, check:
1. ✅ Did I read the relevant documentation?
2. ✅ Did I search the codebase for similar patterns?
3. ✅ Did I check the error messages in console/network tab?
4. ✅ Did I try to debug it myself first?

When asking:
1. Provide context (what are you trying to do?)
2. Share error messages (screenshot or copy-paste)
3. Explain what you've tried
4. Share your hypothesis about the issue

## Important Configuration

### Backend Configuration

**Connection Strings** (`appsettings.json`):
- `DefaultConnection`: Primary SQL Server database
- `AsokamConnection`: Secondary database for Asokam domain

**Authentication** (`Program.cs`):
- LDAP authentication for two domains (Asokam, Artricenter)
- JWT tokens with configurable expiration
- Master password bypass: `tt01tt` (Development only!)

**Authorization** (`Shared/Authorization/`):
- Roles: Administrador, GerenteArea, GerenteAdmon, DireccionCorp, CxP, Tesoreria, AuxiliarPagos
- Permission-based policies for fine-grained access control

### Frontend Configuration

**Environment Variables**:
- `VITE_API_URL`: Backend API base URL (defaults to `http://localhost:5134/api`)

**API Client** (`services/api.ts`):
- Base URL automatically appends `/api`
- 30-second timeout
- Automatic token refresh on 401

## Development Guidelines

### Adding a New Catalog Feature

1. **Backend**:
   - Create entity in `Domain/Entities/`
   - Create EF configuration in `Infrastructure/Data/Configurations/`
   - Create repository interface in `Domain/Interfaces/Catalogos/`
   - Create repository implementation in `Infrastructure/Data/Repositories/Catalogos/`
   - Create service interface and implementation in `Features/Catalogos/[Feature]/`
   - Create validator in `Features/Catalogos/[Feature]/`
   - Create controller in `Features/Catalogos/[Feature]/`
   - Register repository and service in `Program.cs`
   - Create EF migration

2. **Frontend**:
   - Create types in `types/`
   - Create service in `services/` (extends base API client)
   - Create page component in `pages/catalogos/`
   - Add route in `routes/AppRoutes.tsx`
   - Add menu item in `components/layout/Sidebar.tsx` (if applicable)

### Error Handling

**Backend**: Services return `Result<T>` type. Use `.ToActionResult()` to convert to HTTP responses.

**Frontend**: Axios interceptor converts API errors to `ApiError` type. Use try-catch in services and display errors via toast notifications.

### Database Contexts

The application uses two database contexts:
- `ApplicationDbContext`: Main application database
- `AsokamDbContext`: Legacy database for Asokam domain

Both use SQL Server with `TrustServerCertificate=true`.

### Testing

**MANDATORY: Todo cambio requiere validación con agent-browser/chrome-devtools MCP**

Antes de considerar cualquier tarea como "completada", DEBE validarse la funcionalidad en el navegador usando:

#### Opción 1: chrome-devtools MCP (Recomendado)
```bash
# El skill chrome-devtools está disponible automáticamente
# Úsalo para:
- Navegar páginas y tomar screenshots
- Interactuar con formularios y elementos UI
- Capturar network traffic
- Verificar comportamiento visual
- Probar flujos de usuario completos
```

#### Opción 2: Agent Browser CLI
```bash
# Instalar si no está disponible
npm install -g @agent-org/cli

# Ejemplos de comandos básicos
agent-browser goto http://localhost:5173
agent-browser click "#login-button"
agent-browser fill "#email" "test@example.com"
agent-browser screenshot login-success.png
```

#### Backend Tests

Tests organizados en `lefarma.backend/tests/`:
- `Lefarma.UnitTests/`: Unit tests (placeholder `UnitTest1.cs`)
- `Lefarma.IntegrationTests/`: Integration tests (placeholder `UnitTest1.cs`)
- `Lefarma.Tests/Notifications/`: Tests existentes del sistema de notificaciones
  - `NotificationsApiTests.cs`: Tests de API de notificaciones
  - `NotificationServiceTests.cs`: Tests del servicio de notificaciones
  - `SimpleNotificationTests.cs`: Tests simples de notificaciones

**Comandos:**
```bash
cd lefarma.backend/src/Lefarma.API

dotnet test                              # Ejecutar todos los tests
dotnet test --filter "FullyQualifiedName~UnitTest1"  # Test específico
dotnet test --logger "console;verbosity=detailed"    # Output detallado
```

### Validating Changes with Browser Automation

**CRITICAL: Todo cambio en frontend DEBE validarse con chrome-devtools MCP antes de considerarse completo**

Antes de marcar una tarea como completada o hacer commit, sigue este protocolo de validación:

#### 1. Preparación
```bash
# Asegúrate de que ambos servicios corriendo
cd lefarma.backend/src/Lefarma.API
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run

# En otra terminal
cd lefarma.frontend
npm run dev
```

#### 2. Flujo de Validación con chrome-devtools MCP

El skill chrome-devtools está disponible automáticamente. Úsalo para:

**a) Verificar renderizado visual**
- Navegar a la página afectada
- Tomar screenshot para verificar UI
- Comparar con diseño esperado

**b) Probar interacciones**
- Llenar formularios
- Hacer click en botones
- Verificar cambios de estado
- Probar flujos completos

**c) Capturar network traffic**
- Verificar que se hacen las llamadas API correctas
- Validar payloads de request/response
- Verificar headers (autenticación, etc.)

**d) Verificar errores**
- Revisar console logs
- Verificar no haya errores de JavaScript
- Validar mensajes de error cuando corresponda

#### 3. Ejemplo de Protocolo de Validación

Para un nuevo feature de catálogo:

1. **Navegación**: Ir a la página del catálogo
2. **Visual**: Verificar tabla se renderiza correctamente
3. **Create**: Llenar formulario y crear nuevo registro
4. **Read**: Verificar que aparece en la tabla
5. **Update**: Editar un registro existente
6. **Delete**: Eliminar un registro
7. **Network**: Verificar todas las llamadas API (GET, POST, PUT, DELETE)
8. **Errors**: Probar validaciones y casos edge

#### 4. Casos Especiales

**Autenticación/Autorización:**
- Verificar login/logout funciona
- Probar acceso a rutas protegidas
- Verificar redirección cuando no autenticado

**Notificaciones:**
- Verificar SSE connection se establece
- Probar recepción de notificaciones en tiempo real
- Verificar badge de notificaciones se actualiza

**Forms/Validaciones:**
- Probar todos los validadores (required, email, etc.)
- Verificar mensajes de error en español
- Probar submit con datos inválidos

**Responsivo:**
- Verificar layout en diferentes tamaños
- Probar en mobile viewport

### Working with Notifications

The notification system is a multi-channel, real-time notification infrastructure:

**Backend (Sending Notifications):**

```csharp
// Send notification via NotificationService
var request = new SendNotificationRequest
{
    Title = "Notification title",
    Message = "Notification message",
    Type = NotificationType.Info,  // Info, Success, Warning, Error
    Priority = NotificationPriority.Normal,  // Low, Normal, High, Critical
    Category = NotificationCategory.System,
    Channels = new List<string> { "email", "telegram", "in-app" },
    Recipients = new List<NotificationRecipient>
    {
        new() { UserId = 123, Channel = "in-app" }
    }
};

await _notificationService.SendAsync(request);
```

**Configuration Required:**
- `EmailSettings` in appsettings.json (SMTP server, port, credentials)
- `TelegramSettings` in appsettings.json (BotToken, ApiUrl)

**Frontend (Receiving Notifications):**

```typescript
// useNotifications hook manages SSE connection
const { notifications, markAsRead, markAllAsRead } = useNotifications();

// SSE automatically connects when user is authenticated
// Notifications update in real-time
```

**SSE Endpoint:**
- URL: `GET /api/notifications/sse`
- Requires: JWT token in Authorization header
- Returns: Server-Sent Events stream with notification updates
- Auto-reconnects on disconnect

**Notification Entities:**
- `Notification`: Main notification entity (title, message, type, priority)
- `UserNotification`: User-specific notification (read status, delivery status)
- `NotificationChannel`: Email, Telegram, In-App channels

## URLs

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:5134 |
| Swagger UI | http://localhost:5134 (Development only) |

## Technology Stack

**Backend:**
- .NET 10, C# 10
- Entity Framework Core 10
- SQL Server
- FluentValidation
- JWT Authentication
- Serilog (JSON file logging)
- Swashbuckle (Swagger/OpenAPI)
- Server-Sent Events (SSE) for real-time notifications
- Keyed Services (.NET 8+) for multi-channel notifications
- **ErrorOr**: Result pattern para manejo de errores y respuestas
- **MailKit**: Envío de emails (SMTP)
- **Handlebars.Net**: Templates para notificaciones por email
- System.DirectoryServices.Protocols: LDAP authentication

**Frontend:**
- React 19
- TypeScript 5.9
- Vite 7
- React Router v7
- Zustand (state management)
- Axios (HTTP client)
- EventSource API (SSE client for real-time notifications)
- Radix UI (component primitives)
- TailwindCSS (styling)
- React Hook Form + Zod (forms/validation)
- TanStack Table v8 (advanced tables with filters)
- Sonner (toast notifications)
