# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

dotnet run                    # Run API on http://localhost:5000
dotnet build                  # Build project
dotnet test                   # Run all tests
dotnet test --filter "FullyQualifiedName~UnitTest1"  # Run specific test

# Entity Framework Migrations
dotnet ef migrations add <Name>              # Create migration
dotnet ef database update                    # Apply migrations
dotnet ef database update 0                  # Rollback all migrations
dotnet ef migrations remove                  # Remove last migration
```

### Frontend Commands
```bash
cd lefarma.frontend

npm run dev           # Start dev server on http://localhost:5173
npm run build         # Production build
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
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

3. **State Management**: Zustand stores (`authStore`, `pageStore`) manage global state. Auth store persists to localStorage.

4. **UI Components**: shadcn/ui pattern - components in `components/ui/` are composed into page-specific components.

5. **Form Handling**: React Hook Form + Zod for validation patterns.

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
- `VITE_API_URL`: Backend API base URL (defaults to `http://localhost:5000/api`)

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

Tests are organized in `lefarma.backend/tests/`:
- `Lefarma.UnitTests/`: Unit tests
- `Lefarma.IntegrationTests/`: Integration tests

Tests are currently minimal (placeholder `UnitTest1.cs` files).

## URLs

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| Swagger UI | http://localhost:5000 (Development only) |

## Technology Stack

**Backend:**
- .NET 10, C# 10
- Entity Framework Core 10
- SQL Server
- FluentValidation
- JWT Authentication
- Serilog (JSON file logging)
- Swashbuckle (Swagger/OpenAPI)

**Frontend:**
- React 19
- TypeScript 5.9
- Vite 7
- React Router v7
- Zustand (state management)
- Axios (HTTP client)
- Radix UI (component primitives)
- TailwindCSS (styling)
- React Hook Form + Zod (forms/validation)
