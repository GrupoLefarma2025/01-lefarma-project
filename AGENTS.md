# AGENTS.md

This file provides guidance to AI agents (including code-focused assistants) when working with code in this repository.

## Project Overview

Lefarma is a pharmaceutical company management system with a .NET 10 backend API and React/TypeScript frontend. The project follows a modular monolith architecture organized around feature-based modules (currently focused on "Catalogos" - business catalogs).

## Common Commands

### Backend (.NET 10)

```bash
# Run the API
cd lefarma.backend/src/Lefarma.API && dotnet run

# Build
dotnet build

# Run tests
dotnet test

# Run specific test project
dotnet test lefarma.backend/tests/Lefarma.UnitTests

# Create migrations (from Lefarma.API directory)
dotnet ef migrations add <Name>

# Apply migrations
dotnet ef database update
```

### Frontend (React + Vite)

```bash
# Install dependencies
cd lefarma.frontend && npm install

# Run development server (port 5173)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Format code
npm run format
```

## Architecture

### Backend Structure (lefarma.backend/src/Lefarma.API)

The API follows a feature-based layered architecture:

```
Lefarma.API/
├── Domain/           # Business entities and interfaces
│   ├── Entities/     # EF Core entities (Area, Empresa, Sucursal, TipoGasto)
│   └── Interfaces/   # Repository interfaces (ICatalogos repositories)
├── Features/         # Feature modules (Controllers, Services, DTOs, Validators)
│   └── Catalogos/     # Catalogs feature (Areas, Empresas, Sucursales, TipoGastos)
│       └── [Feature]/
│           ├── [Feature]Controller.cs
│           ├── [Feature]Service.cs
│           ├── I[Feature]Service.cs
│           ├── [Feature]Validator.cs
│           └── DTOs/
│               ├── [Feature]Response.cs
│               ├── Create[Feature]Request.cs
│               └── Update[Feature]Request.cs
├── Infrastructure/   # Data access and infrastructure
│   └── Data/
│       ├── ApplicationDbContext.cs
│       ├── Configurations/  # EF Core fluent API configurations
│       └── Repositories/     # Repository implementations
├── Shared/           # Cross-cutting concerns
│   ├── Exceptions/   # BusinessException
│   ├── Models/      # ApiResponse<T>
│   └── Extensions/  # Extension methods (StringExtensions)
├── Filters/          # Global filters (ExceptionFilter)
└── Validators/       # Shared validators
```

### Frontend Structure (lefarma.frontend/src)

```
src/
├── components/
│   ├── layout/       # Header, Sidebar, MainLayout
│   └── ui/           # shadcn/ui style components (Button, Dialog, Table, etc.)
├── pages/
│   ├── auth/         # Login
│   ├── catalogos/    # Catalog pages
│   └── configuracion/
├── routes/           # AppRoutes, PrivateRoute, PublicRoute
├── services/         # API client (api.ts, authService.ts)
├── store/            # Zustand stores (authStore.ts)
├── hooks/            # Custom hooks (use-toast.ts, usePageTitle.ts)
├── types/            # TypeScript types
├── lib/              # Utilities (utils.ts)
└── App.tsx
```

## Key Patterns

### API Response Format

All endpoints return `ApiResponse<T>`:
```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }
}
```

### Adding a New Feature (Backend)

1. Create entity in `Domain/Entities/[Module]/`
2. Create interface in `Domain/Interfaces/[Module]/`
3. Create repository implementation in `Infrastructure/Data/Repositories/[Module]/`
4. Create EF Core configuration in `Infrastructure/Data/Configurations/[Module]/`
5. Create DTOs in `Features/[Module]/DTOs/`
6. Create service (interface + implementation) in `Features/[Module]/`
7. Create validator in `Features/[Module]/`
8. Create controller in `Features/[Module]/`
9. Register in `Program.cs`

### Adding a New Catalog Module

Follow the existing Catalogos pattern:
- Feature folder: `Features/Catalogos/[ModuleName]/`
- Route prefix: `api/catalogos/[controller]`
- Group name for Swagger: "Catalogos"

### API Configuration

- Base URL: `http://localhost:5000` (configurable in vite.config.ts proxy)
- Swagger: `http://localhost:5000` (in Development)
- CORS: Allows `http://localhost:5173` (Vite frontend)

### Frontend State Management

- **Auth**: Zustand store (`authStore.ts`)
- **API Client**: Axios with interceptors for JWT and error handling (`api.ts`)
- **Forms**: React Hook Form + Zod resolvers
- **UI Components**: Radix UI primitives with TailwindCSS

### Frontend API Integration

```typescript
// API base URL from environment
VITE_API_URL=http://localhost:5000/api

// Token stored in localStorage, auto-attached via axios interceptor
```

### Frontend Custom Hooks

- **usePageTitle(title, subtitle?)**: Hook estándar para mostrar el título de la página en el nav/header. Debe llamarse al inicio de cada página.
  ```typescript
  // En cualquier page component
  usePageTitle('Empresas', 'Gestión de empresas');  // subtítulo opcional
  ```
  El título aparece en el componente `Header`, no en `document.title`. Usa el store global `pageStore`.

## Tech Stack

**Backend:**
- .NET 10 with C# 10 features (nullable reference types, implicit usings)
- Entity Framework Core 10 with SQL Server
- FluentValidation for request validation
- JWT authentication configured
- Serilog for logging
- Swashbuckle for Swagger/OpenAPI

**Frontend:**
- React 19 with TypeScript
- Vite 7
- TailwindCSS with tailwind-merge and clsx
- Radix UI primitives (@radix-ui/react-*)
- Zustand for state
- React Hook Form + Zod
- Axios for HTTP
- React Router v7
- date-fns for dates
- Lucide React for icons
- react-hot-toast for notifications

## Development Workflow

1. Start backend: `dotnet run` from `lefarma.backend/src/Lefarma.API`
2. Start frontend: `npm run dev` from `lefarma.frontend`
3. Frontend proxies API calls to backend via Vite config
4. Swagger UI available at root in Development

## IMPORTANT: Documentation Maintenance

**Whenever making changes to the codebase, always update the documentation in `lefarma.docs/` to reflect the actual and current state of the project.**

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

## Task System (lefarma.docs/task/)

When working on new modules or features:

### Finding the Next Task

1. Check the `lefarma.docs/task/` directory for existing tasks
2. Look for the highest consecutive number (001, 002, 003...)
3. Read the task file to understand requirements

### Creating New Tasks

```powershell
# Find the last task number
Get-ChildItem lefarma.docs/task/*.md | Sort-Object Name -Descending | Select-Object -First 1

# Create new task with next consecutive number
# Format: XXX-nombre-del-modulo.md
```

### Task Status Workflow

- `pending` → Not started
- `in_progress` → Currently being worked on
- `completed` → Finished and tested
- `cancelled` → Discarded

### Working on Tasks

1. **Before starting**: Update task status to `in_progress` and add assignee
2. **During work**: Follow the requirements and acceptance criteria in the task
3. **After completion**:
   - Update task status to `completed`
   - Update all relevant documentation in `lefarma.docs/`
   - Sync changes to CLAUDE.md and AGENTS.md

### Task Template

New tasks should follow this structure:

```markdown
---
status: pending
created: YYYY-MM-DD
updated: YYYY-MM-DD
assignee: null
---

# Task-XXX: Module Name

## Description
Brief description of the module.

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
- Task-YYY: Dependency name
```

Keep documentation in sync with code to ensure it always reflects the real state of the project.

### Synchronization Between CLAUDE.md and AGENTS.md

**Both `CLAUDE.md` and `AGENTS.md` must always be synchronized.** When modifying either file:

1. Check if the change affects both files
2. Apply the same update to both files when relevant
3. Keep architecture decisions, patterns, and guidelines consistent across both
4. If adding new sections to one, consider if the other needs a corresponding update

These two files serve the same purpose but for different AI contexts - they must remain aligned.
