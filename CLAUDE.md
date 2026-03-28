# CLAUDE.md - Lefarma Development Guide

## Quick Reference

**Project**: Pharmaceutical management system (.NET 10 backend + React 19 frontend)
**Architecture**: Modular monolith with feature-based organization
**Branches**: `main` (production), `dev` (development)

## Quick Start

```bash
# First time setup
./install.ps1    # Install dependencies
./init.ps1       # Start both services

# Backend (Terminal 1)
cd lefarma.backend/src/Lefarma.API
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run    # Port 5134

# Frontend (Terminal 2)
cd lefarma.frontend
npm run dev      # Port 5173
```

## Backend Architecture

**Structure**:
```
Lefarma.API/
├── Domain/                    # Entities + Interfaces
├── Features/                  # Self-contained feature modules
│   ├── Auth/                  # LDAP + JWT
│   ├── Catalogos/             # Catalog CRUD
│   ├── Notifications/         # Multi-channel (Email, Telegram, SSE)
│   ├── Profile/, Admin/, Logging/, SystemConfig/
├── Infrastructure/            # Data, Repositories, Filters, Middleware
├── Services/Identity/         # AD, JWT services
├── Shared/                    # Auth, Errors, Extensions, Logging
└── Program.cs
```

**Key Patterns**:
- **Service Pattern**: Controllers delegate to services (business logic)
- **Repository Pattern**: Interfaces in `Domain/Interfaces/`, implementations in `Infrastructure/Data/Repositories/`
- **Unified Response**: `ApiResponse<T>` with Success, Message, Data, Errors
- **Validation**: FluentValidation via ValidationFilter
- **Result Pattern**: Services return `Result<T>` → `.ToActionResult()` for HTTP responses
- **Authorization**: Role-based (Administrator, Manager, etc.) + permission-based policies
- **WideEvent Logging**: One rich event per HTTP request to JSON files (30-day retention)

**Backend Modules**:
- **Auth**: Multi-domain LDAP (Asokam, Artricenter), JWT, master password bypass (tt01tt)
- **Catalogos**: Core (Empresas, Sucursales, Areas, etc.), Financieros, Proveedores, Costos, Fiscales, Operaciones
- **Notifications**: Email (MailKit), Telegram, In-App (SSE), Handlebars.Net templates, Keyed Services
- **HttpClientFactory**: External API integrations

**Commands**:
```bash
dotnet run                    # May fail if port in use
dotnet build                  # Build
dotnet test                   # Run all tests
dotnet ef migrations add <Name>    # Create migration
dotnet ef database update          # Apply migrations
dotnet ef database update 0        # Rollback all
dotnet ef migrations remove        # Remove last
```

## Frontend Architecture

**Structure**:
```
src/
├── components/
│   ├── layout/                # Header, Sidebar, MainLayout
│   └── ui/                    # shadcn/ui components
├── pages/
│   ├── auth/                  # Login
│   ├── catalogos/             # Catalog CRUD pages
│   └── configuracion/         # Config pages
├── routes/                    # AppRoutes, ProtectedRoute, etc.
├── services/                  # api.ts (Axios), authService.ts
├── store/                     # Zustand (authStore, pageStore, etc.)
├── types/                     # TypeScript definitions
├── hooks/                     # Custom hooks (usePageTitle, use-toast)
└── App.tsx
```

**Key Patterns**:
- **Route Guards**: `ProtectedRoute` (auth check), `PublicOnlyRoute` (redirect if authenticated)
- **Axios Interceptors**: Auto-add JWT, refresh on 401, redirect to login on failure
- **State**: Zustand with persist middleware (authStore persists to localStorage)
- **UI**: shadcn/ui components → composed into page components
- **Forms**: React Hook Form + Zod validation
- **SSE**: Real-time notifications via EventSource (auto-reconnect, auth headers)
- **Tables**: TanStack Table v8 with advanced filters
- **Page Titles**: `usePageTitle(title, subtitle?)` muestra título en el Header (no en document.title)
  ```typescript
  // En cualquier page component
  usePageTitle('Empresas', 'Gestión de empresas');  // subtítulo opcional
  ```

**Commands**:
```bash
npm run dev           # http://localhost:5173
npm run build         # Production build
npm run lint          # ESLint
npm run format        # Prettier
```

## Development Workflow

### 1. Adding Catalog Features

**Backend** (8 steps):
1. Entity in `Domain/Entities/`
2. EF config in `Infrastructure/Data/Configurations/`
3. Repository interface in `Domain/Interfaces/Catalogos/`
4. Repository implementation in `Infrastructure/Data/Repositories/Catalogos/`
5. Service interface + implementation in `Features/Catalogos/[Feature]/`
6. FluentValidation validator
7. Controller in `Features/Catalogos/[Feature]/`
8. Register in `Program.cs` + `dotnet ef migrations add`

**Frontend** (4 steps):
1. Types in `types/`
2. Page component in `pages/catalogos/`
3. Route in `routes/AppRoutes.tsx`
4. Sidebar item in `components/layout/Sidebar.tsx` (optional)

### 2. Validation Protocol (MANDATORY)

**Todo cambio DEBE validarse antes de commit**

Use **chrome-devtools MCP** or **agent-browser CLI**:

```bash
# agent-browser examples
agent-browser open http://localhost:5173/catalogos/empresas
agent-browser fill "#username" "54"
agent-browser fill "#password" "tt01tt"
agent-browser click "button[type='submit']"
agent-browser wait --url "**/dashboard"
agent-browser screenshot dashboard.png
```

**Checklist**:
- ✅ **Visual**: UI renders correctly
- ✅ **Functional**: CRUD works, validations fire
- ✅ **Network**: Correct API calls, payloads, auth headers
- ✅ **Console**: No JS errors or React warnings
- ✅ **Persistence**: F5 doesn't lose state (localStorage, filters)

**Special Cases**:
- **Auth/Notif**: Verify login/logout, SSE connection
- **Forms**: Test all validators, error messages in Spanish
- **Responsive**: Check mobile viewport

### 3. Git Workflow

**CRITICAL RULES**:
- **NO hagas commits hasta que el usuario te lo indique**
- **NO hagas push hasta que el usuario te lo indique**
- **NO hagas merge hasta que el usuario te lo indique**
- **NO te metas con git hasta que el usuario te lo indique**

**Branch Strategy**:
- `main`: Production (stable)
- `dev`: Development (merge to main when stable)
- `feature/*`: Temporary branches for large features

**Process**:
```bash
# 1. Create branch (optional)
git checkout -b feature/nueva-funcionalidad

# 2. Make changes + validate (browser automation)

# 3. Atomic commits (one change per commit)
git add .
git commit -m "feat: add user authentication"

# 4. Push + PR to dev
git push origin feature/nueva-funcionalidad
# Create PR: feature → dev

# 5. Merge to dev
git checkout dev && git pull && git merge feature && git push
```

**Commit Conventions**:
```
feat: new feature
fix: bug fix
docs: documentation
style: formatting (no logic change)
refactor: code refactor (no behavior change)
test: tests
chore: build/config/dependencies
perf: performance improvement
ci: CI/CD
```

**NO "Co-Authored-By" tags** - solo conventional commits format.

## Configuration

**Backend** (`appsettings.json`):
- **Connection Strings**: DefaultConnection (primary), AsokamConnection (secondary)
- **Auth**: LDAP (Asokam, Artricenter), JWT with configurable expiry, master password `tt01tt`
- **Authorization**: 7 roles + permission-based policies
- **Notifications**: EmailSettings (SMTP), TelegramSettings (BotToken, ApiUrl)

**Frontend**:
- **VITE_API_URL**: Backend base URL (default: `http://localhost:5134/api`)
- **api.ts**: Auto-appends `/api`, 30s timeout, auto-refresh on 401

## Troubleshooting

**Backend**:
- **Port 5134 in use**: `fuser -k 5134/tcp 2>/dev/null; dotnet run`
- **Module not found**: `dotnet restore`
- **LDAP fails**: Check AD server, appsettings.json credentials, test with `54`/`tt01tt`
- **JWT expires**: Check `JwtSettings:ExpiryMinutes`

**Frontend**:
- **Module not found**: `rm -rf node_modules package-lock.json && npm install`
- **TypeScript errors**: Check `types/`, verify imports, run `npx tsc --noEmit`
- **Blank page**: Check console, verify `VITE_API_URL`, check backend on 5134
- **State not updating**: Check Zustand `set` method, look for useEffect stale closures

**Database**:
- **Migration fails**: `dotnet ef migrations list`, `dotnet ef database update 0`, `dotnet ef migrations remove`
- **Connection errors**: Verify SQL Server running, check appsettings.json, ensure `TrustServerCertificate=true`

## Debugging

**Backend**:
```csharp
_logger.LogInformation("Processing {Id}", id);

var result = await _service.GetAsync(id);
if (result.IsError) return BadRequest(result.Errors);
```

**Frontend**:
```typescript
console.log('🔍 Filtering:', { searchColumns, search });

// React DevTools Profiler → Components tab (re-render checks)
console.log('Auth state:', useAuthStore());

useDebugValue(visibleColumnIds);  // Shows in DevTools
```

**Network**:
```bash
curl http://localhost:5134/api/health
curl -H "Authorization: Bearer TOKEN" http://localhost:5134/api/catalogos/empresas
```

## Code Quality

**Backend (C#)**:
- Use `Result<T>` pattern instead of exceptions
- FluentValidation for all DTOs
- Constructor injection (no `new` in services)
- Async/await for I/O
- XML docs on public methods
- PascalCase (methods/properties), camelCase (locals)

**Frontend (TypeScript/React)**:
- Strict TypeScript (no `any` unless necessary)
- Functional components + hooks
- shadcn/ui when available
- Error boundaries around Suspense
- Zod schemas for forms
- **Vercel best practices**:
  - `rerender-dependencies`: Primitives only in useEffect
  - `async-parallel`: Promise.all() for independent async
  - `rerender-move-effect-to-event`: Event logic in handlers

**Performance**:
- **Backend**: `AsNoTracking` for reads, explicit `Include()`, pagination, caching
- **Frontend**: `useMemo` for expensive computations, `useCallback` for child callbacks, `React.lazy()` for routes, virtual scrolling (TanStack Table)

**Security**:
- **Backend**: No committed secrets, env vars for sensitive data, FluentValidation on all input, role+permission checks, parameterized SQL, audit logging
- **Frontend**: httpOnly cookies for tokens, `ProtectedRoute`, sanitize input (XSS prevention), validate API responses, no stack traces in errors, CSP headers

## When to Ask for Help

**Before asking**:
1. ✅ Read relevant docs
2. ✅ Search codebase for patterns
3. ✅ Check console/network errors
4. ✅ Try to debug yourself

**When asking**:
1. Context: What are you trying to do?
2. Errors: Screenshot or copy-paste
3. Attempts: What have you tried?
4. Hypothesis: What do you think is wrong?

## Notifications System

**Multi-channel, real-time**:
- **Channels**: Email (MailKit), Telegram, In-App (SSE)
- **SSE Endpoint**: `GET /api/notifications/sse` (JWT in Authorization header, auto-reconnect)
- **Backend**: `NotificationService.SendAsync()` with priority (Low/Normal/High/Critical) + type (Info/Success/Warning/Error)
- **Frontend**: `useNotifications()` hook manages SSE connection, updates in real-time

**Example**:
```csharp
await _notificationService.SendAsync(new SendNotificationRequest {
    Title = "Title",
    Message = "Message",
    Type = NotificationType.Info,
    Priority = NotificationPriority.Normal,
    Channels = new List<string> { "email", "in-app" },
    Recipients = new List<NotificationRecipient> { new() { UserId = 123 } }
});
```

## IMPORTANT: Documentation Maintenance

**Whenever making changes to the codebase, always update the documentation in `lefarma.docs/` to reflect the actual and current state of the project. Seguir el estándar definido en `lefarma.docs/STANDARD_DOCUMENTATION_PLAN.md` (Técnico) y `lefarma.docs/USER_DOCUMENTATION_PLAN.md` (Usuarios).**

### When to Update Docs

- **Adding new entities**: Update `backend/entities.md` and `backend/dtos.md`
- **Adding new endpoints**: Update `backend/api-routes.md`
- **Adding new services**: Update `backend/services.md`
- **Adding new pages**: Update `frontend/pages.md` and `frontend/routes.md`
- **Adding new components**: Update `frontend/components.md`
- **Adding new types**: Update `frontend/types.md`
- **Modifying API contracts**: Update all affected documentation files

### Documentation Structure

```text
lefarma.docs/
├── README.md                 # Index and overview
├── backend/
│   ├── api-routes.md         # API endpoints
│   ├── entities.md           # Database entities
│   ├── services.md           # Business services
│   └── dtos.md               # Data transfer objects
├── frontend/
│   ├── routes.md             # Route definitions
│   ├── pages.md              # Page components
│   ├── components.md         # Reusable components
│   ├── services.md           # API client and auth
│   └── types.md              # TypeScript types
└── task/                     # PRDs and development tasks
    ├── README.md             # Task system documentation
    ├── 001-modulo-ejemplo.md # Task files with consecutive numbering
    └── 002-otro-modulo.md
```

## URLs

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:5134 |
| Swagger UI | http://localhost:5134 (dev only) |

## Tech Stack

**Backend**: .NET 10, C# 10, EF Core 10, SQL Server, FluentValidation, JWT, Serilog, Swashbuckle, SSE, ErrorOr, MailKit, Handlebars.Net, LDAP

**Frontend**: React 19, TypeScript 5.9, Vite 7, React Router v7, Zustand, Axios, EventSource, Radix UI, TailwindCSS, React Hook Form + Zod, TanStack Table v8, Sonner
