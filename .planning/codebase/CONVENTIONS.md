# Coding Conventions

**Analysis Date:** 2026-03-30

## Naming Patterns

### Backend (C#)

**Files:**
- PascalCase matching the primary class/interface name
- One primary type per file (controller, service, validator, DTO, entity, repository)
- DTOs grouped in a single file per feature: `[Feature]DTOs.cs` (e.g. `AreaDTOs.cs`)
- Examples: `AreaController.cs`, `AreaService.cs`, `IAreaService.cs`, `AreaValidator.cs`, `AreaDTOs.cs`

**Classes:**
- Controllers: `{Entities}Controller` (plural, e.g. `AreasController`)
- Services: `{Entity}Service` (singular, e.g. `AreaService`)
- Service interfaces: `I{Entity}Service` (e.g. `IAreaService`)
- Repositories: `{Entity}Repository` (singular, e.g. `AreaRepository`)
- Repository interfaces: `I{Entity}Repository` (e.g. `IAreaRepository`)
- Validators: `{Action}{Entity}RequestValidator` (e.g. `CreateAreaRequestValidator`, `UpdateAreaRequestValidator`)
- Entities: Singular noun (e.g. `Area`, `Empresa`, `Sucursal`)

**Methods:**
- PascalCase, async suffix `Async` (e.g. `GetAllAsync`, `CreateAsync`, `UpdateAsync`, `DeleteAsync`)
- Private fields: `_camelCase` with underscore prefix (e.g. `_areaRepository`, `_mockLogger`)
- Constants: `UPPER_CASE` or PascalCase for const locals

**Variables:**
- PascalCase for properties and public members
- `_camelCase` for private fields
- `camelCase` for local variables

**Types:**
- DTOs follow a strict naming convention per feature:
  - `{Entity}Response` — returned from API (e.g. `AreaResponse`)
  - `Create{Entity}Request` — POST body (e.g. `CreateAreaRequest`)
  - `Update{Entity}Request` — PUT body (e.g. `UpdateAreaRequest`)
  - `{Entity}Request` — query parameters for GET all (e.g. `AreaRequest`)

### Frontend (TypeScript/React)

**Files:**
- Components: PascalCase.tsx (e.g. `AreasList.tsx`, `Header.tsx`, `MainLayout.tsx`)
- UI primitives (shadcn): kebab-case.tsx (e.g. `button.tsx`, `data-table.tsx`, `alert-dialog.tsx`)
- Types: camelCase.types.ts (e.g. `catalogo.types.ts`, `auth.types.ts`, `api.types.ts`)
- Services: camelCaseService.ts (e.g. `authService.ts`, `notificationService.ts`, `sseService.ts`)
- Stores: camelCaseStore.ts (e.g. `authStore.ts`, `configStore.ts`, `pageStore.ts`)
- Hooks: useCamelCase.ts or use-kebab-case.tsx (e.g. `usePageTitle.ts`, `use-mobile.tsx`, `use-toast.ts`)
- Pages: PascalCase.tsx in feature folders (e.g. `Areas/AreasList.tsx`, `Empresas/EmpresasList.tsx`)
- Constants: camelCase.ts (e.g. `uiPresets.ts`)

**Functions:**
- camelCase for utilities and hooks (e.g. `usePageTitle`, `cn()`)
- Default exports for page components: `export default function AreasList()`
- Named exports for reusable components: `export const Button = ...`, `export const Header = () => {}`

**Variables:**
- camelCase for all variables and state
- UPPER_SNAKE_CASE for endpoint constants: `const ENDPOINT = '/catalogos/Areas'`

**Types:**
- Interfaces for object shapes (e.g. `interface Area`, `interface ApiResponse<T>`)
- `type` for unions and utility types (e.g. `type AreaFormValues = z.infer<typeof areaSchema>`)

## Code Style

### Backend

**Formatting:**
- Nullable reference types enabled (`Nullable=enable`)
- Implicit usings enabled (`ImplicitUsings=enable`)
- Target: .NET 10 (`net10.0`)
- Namespace uses folder structure with curly braces:
  ```csharp
  namespace Lefarma.API.Features.Catalogos.Areas
  {
      // ...
  }
  ```

**Key Language Features:**
- `required` keyword on DTO properties (e.g. `public required int IdEmpresa { get; set; }`)
- `init` accessor for DI-injected services (constructor injection)
- Pattern matching for sorting: `query.OrderBy?.ToLower() switch { ... }`
- `string.Empty` and `null!` for null markers
- Spanish-language error messages and Swagger descriptions throughout

### Frontend

**Formatting:**
- Tool: Prettier
- Config: `lefarma.frontend/.prettierrc`
- Key settings:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "printWidth": 100,
    "plugins": ["prettier-plugin-tailwindcss"]
  }
  ```

**Linting:**
- Tool: ESLint 9 with flat config
- Config: `lefarma.frontend/eslint.config.js`
- Key rules:
  - `@eslint/js` recommended config
  - `typescript-eslint` recommended config
  - `eslint-plugin-react-hooks` (hooks rules)
  - `eslint-plugin-react-refresh` (Vite mode)
  - Global ignores: `dist`, `node_modules`, `build`, `.vite`

**TypeScript:**
- `strict: true` enabled
- `noUnusedLocals: false` (relaxed)
- `noUnusedParameters: false` (relaxed)
- `noFallthroughCasesInSwitch: true`
- `jsx: "react-jsx"` (automatic JSX runtime)
- Target: ES2020, lib: ES2022 + DOM

## Import Organization

### Backend

**Order (observed):**
1. Framework/System usings (Azure, FluentValidation, Microsoft.*)
2. Internal feature usings (DTOs, Extensions, Models)
3. Example from `AreaController.cs`:
  ```csharp
  using Azure;
  using FluentValidation;
  using Lefarma.API.Features.Catalogos.Areas;
  using Lefarma.API.Features.Catalogos.Areas.DTOs;
  using Lefarma.API.Shared.Extensions;
  using Lefarma.API.Shared.Models;
  using Microsoft.AspNetCore.Mvc;
  using Swashbuckle.AspNetCore.Annotations;
  ```

**Path Aliases:**
- None (full namespace paths)

### Frontend

**Order:**
1. React imports (`useState`, `useEffect`, `useMemo`)
2. Third-party libraries (`react-hook-form`, `zod`, `lucide-react`, `sonner`)
3. Internal UI components (`@/components/ui/...`)
4. Internal services (`@/services/api`)
5. Internal types (`@/types/...`)
6. Internal hooks (`@/hooks/...`)
7. Internal stores (`@/store/...`)

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json` and `vite.config.ts`)

**Example from `AreasList.tsx`:**
```typescript
import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { LayoutGrid, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Empresa, Area } from '@/types/catalogo.types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
```

## Error Handling

### Backend

**Strategy:** ErrorOr functional error handling (no exceptions for business logic)

**Patterns:**
- All service methods return `ErrorOr<T>` or `ErrorOr<IEnumerable<T>>`
- Errors created via static `CommonErrors` class at `Shared/Errors/CommonErrors.cs`
- Standard error types:
  - `CommonErrors.NotFound(entity, id)` → `ErrorType.NotFound`
  - `CommonErrors.AlreadyExists(entity, field, value)` → `ErrorType.Conflict`
  - `CommonErrors.Validation(field, message)` → `ErrorType.Validation`
  - `CommonErrors.DatabaseError(operation)` → `ErrorType.Failure`
  - `CommonErrors.ConcurrencyError(entity)` → `ErrorType.Conflict`
  - `CommonErrors.DeleteFailed(entity)` → `ErrorType.Failure`
  - `CommonErrors.InternalServerError(message)` → `ErrorType.Unexpected`
  - `CommonErrors.HasDependencies(entity)` → `ErrorType.Conflict`

- Controllers convert via `result.ToActionResult(this, data => ...)` extension method at `Shared/Extensions/ResultExtensions.cs`
- Error responses wrapped in `ApiResponse<object>` with `Success = false`, `Errors` list of `ErrorDetail`
- Global `ValidationFilter` at `Infrastructure/Filters/ValidationFilter.cs` auto-validates all request DTOs using FluentValidation
- Wide Event logging enriches errors with structured context for observability

**Exception Handling in Services:**
- Try/catch around every service method
- `DbUpdateException` → `CommonErrors.DatabaseError()`
- `DbUpdateConcurrencyException` → `CommonErrors.ConcurrencyError()`
- Generic `Exception` → `CommonErrors.InternalServerError()`
- All exceptions enrich the WideEvent with exception details via `EnrichWideEvent()`

### Frontend

**Strategy:** Axios interceptors with global error normalization

**Patterns:**
- API client at `services/api.ts` uses Axios with response interceptors
- 401 responses trigger automatic token refresh with queue
- All API errors normalized to `ApiError` type:
  ```typescript
  interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
    statusCode: number;
  }
  ```
- Toast notifications for user-facing errors via `sonner`:
  ```typescript
  toast.success('Área creada correctamente.');
  toast.error(error?.message ?? 'Error al guardar el área');
  ```
- Error details from backend iterated as individual toasts:
  ```typescript
  errs.forEach((e) => toast.error(error.message, { description: e.description }));
  ```
- `confirm()` native dialog for destructive actions (delete confirmation)

## Logging

### Backend

**Framework:** Serilog with custom WideEvent structured logging

**Patterns:**
- One rich WideEvent per request via middleware at `Infrastructure/Middleware/WideEventLoggingMiddleware.cs`
- WideEvent model at `Shared/Logging/WideEvent.cs` captures: RequestId, TraceId, Method, Endpoint, UserId, StatusCode, DurationMs, EntityType, EntityId, Action, ErrorType, ErrorCode
- `BaseService` at `Shared/BaseService.cs` provides `EnrichWideEvent()` helper for services
- All services inherit `BaseService` and call `EnrichWideEvent()` at every code path (success, error, not found, duplicate)
- Logs written to `logs/wide-events-.json` as rolling daily JSON files (30 day retention)
- Microsoft namespace logs suppressed to Warning/Fatal level
- Serilog configured in `Program.cs` with console + file sinks

### Frontend

**Framework:** console (no structured logging library)

**Patterns:**
- `console.error()` for errors in API interceptors (403 handling)
- No structured logging — errors surfaced to user via `sonner` toast
- Token refresh failures redirect to login page

## Comments

### Backend

**When to Comment:**
- XML doc comments (`/// <summary>`) on all public classes, interfaces, and methods
- Swagger annotations provide API documentation inline: `[SwaggerOperation(Summary = "...", Description = "...")]`
- Inline comments in Spanish for code steps in services

**XML Doc Comments:**
- Present on test classes, service classes, and controller methods
- Example:
  ```csharp
  /// <summary>
  /// Unit tests for NotificationService
  /// Tests the core notification logic without external dependencies
  /// </summary>
  ```

### Frontend

**When to Comment:**
- Section separators with emojis in test files (e.g. `// PASO 1: Ingresar usuario`)
- Sparse inline comments — code is expected to be self-documenting
- Spanish comments throughout

## Function Design

### Backend

**Size:** Services are 200-400 lines. Controllers are ~100 lines. Each method is 20-60 lines.

**Parameters:** 
- Controllers inject service interfaces via constructor
- Services inject repositories + logger + wideEventAccessor via constructor
- All async methods accept `CancellationToken` in repositories (services pass it through)

**Return Values:**
- Services: `Task<ErrorOr<T>>` — always wraps in ErrorOr for error handling
- Controllers: `Task<IActionResult>` — converts ErrorOr via `ToActionResult()`
- All successful responses wrapped in `ApiResponse<T>` with `Success = true`

### Frontend

**Size:** Page components are 200-450 lines. No strict size limit observed.

**Parameters:**
- Hooks accept simple params: `usePageTitle(title: string, subtitle?: string)`
- Components accept typed props interfaces

**Return Values:**
- Custom hooks return objects with state + actions
- Components return JSX

## Module Design

### Backend

**Exports:** One primary class per file. No barrel files.

**Pattern per feature module:**
```
Features/Catalogos/{FeatureName}/
├── {FeatureName}Controller.cs    # HTTP endpoint routing
├── I{FeatureName}Service.cs      # Service interface
├── {FeatureName}Service.cs        # Business logic implementation
├── {FeatureName}Validator.cs     # FluentValidation rules
└── DTOs/
    └── {FeatureName}DTOs.cs       # Request/Response types
```

Supporting infrastructure per feature:
```
Domain/Entities/{Module}/{Entity}.cs                    # EF Core entity
Domain/Interfaces/{Module}/I{Entity}Repository.cs       # Repository interface
Infrastructure/Data/Repositories/{Module}/{Entity}Repository.cs  # Repository impl
Infrastructure/Data/Configurations/{Module}/{Entity}Configuration.cs  # EF fluent API
```

**Registration:** All DI registrations are manual in `Program.cs`:
```csharp
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<IAreaRepository, AreaRepository>();
```

### Frontend

**Exports:**
- Page components: default export (`export default function AreasList()`)
- Reusable components: named export (`export const Header = () => {}`)
- Stores: named export of hook (`export const useAuthStore = create<AuthState>(...)`)
- Services: named export of singleton object (`export const API = { get, post, ... }`)

**Barrel Files:** Not used. Direct imports from specific files.

## Validation

### Backend

**Tool:** FluentValidation

**Pattern:**
- Separate validator class per request type
- Validators live in the feature folder alongside controller/service
- Auto-validated via global `ValidationFilter` — no manual `ModelState.IsValid` checks
- Naming: `{Action}{Entity}RequestValidator`
  - `CreateAreaRequestValidator`
  - `UpdateAreaRequestValidator`
  - `AreaRequestValidator` (for query params)
- Error messages in Spanish
- Common rules: NotEmpty, MaximumLength, MinimumLength, GreaterThan
- Conditional validation with `.When()` for optional fields

**Example:**
```csharp
public class CreateAreaRequestValidator : AbstractValidator<CreateAreaRequest>
{
    public CreateAreaRequestValidator()
    {
        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre de la área es obligatorio")
            .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
            .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");
    }
}
```

### Frontend

**Tool:** Zod schemas + react-hook-form with zodResolver

**Pattern:**
- Zod schema defined in the page component (not in a separate file)
- Schema inferred for form type: `type AreaFormValues = z.infer<typeof areaSchema>`
- Form initialized with `useForm<AreaFormValues>({ resolver: zodResolver(areaSchema) })`
- Validation messages in Spanish

**Example:**
```typescript
const areaSchema = z.object({
  idEmpresa: z.number({ message: 'La empresa es obligatoria' }).min(1, 'Selecciona una empresa'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  activo: z.boolean(),
});
```

## API Conventions

### Backend

**Route Pattern:** `api/{module}/[controller]`
- Catalog module: `api/catalogos/Areas`, `api/catalogos/Empresas`
- Auth module: `api/auth/login-step-one`, `api/auth/login-step-two`, `api/auth/refresh`, `api/auth/logout`
- Notifications: `api/notifications/send`, `api/notifications/user/{userId}`

**HTTP Methods:**
- `GET` for retrieval (single and list)
- `POST` for create and auth operations
- `PUT api/{module}/{controller}/{id}` for update
- `DELETE api/{module}/{controller}/{id}` for delete
- `PATCH` for partial updates (mark as read)

**Response Format:** All endpoints return `ApiResponse<T>`:
```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<ErrorDetail>? Errors { get; set; }
}
```

**Error Response:**
```csharp
public class ErrorDetail
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Field { get; set; }
}
```

**Swagger:** Every endpoint has `[SwaggerOperation]` and `[SwaggerResponse]` attributes.

### Frontend

**API Client:** Axios instance at `services/api.ts` with interceptors

**Calling Pattern:**
```typescript
const response = await API.get<ApiResponse<Area[]>>(ENDPOINT);
if (response.data.success) {
  setAreas(response.data.data || []);
}
```

**Base URL:** `VITE_API_URL` env var or `/api` (proxied to `http://localhost:5134` in development)

**Auth:** JWT Bearer token auto-attached via request interceptor

## State Management

### Backend

**DI Container:** Microsoft.Extensions.DependencyInjection (manual registration)

**Service Lifetimes:**
- Scoped: All repositories and services (per-request)
- Singleton: `ISseService`, `IAuthorizationHandler`
- Keyed: Notification channels (`"email"`, `"telegram"`, `"in-app"`)

### Frontend

**State Library:** Zustand

**Stores:**
- `authStore.ts` — Authentication state, login flow (3-step), user/empresa/sucursal selection
- `pageStore.ts` — Page title/subtitle for header display
- `configStore.ts` — UI preferences, theme, presets (persisted to localStorage)
- `notificationStore.ts` — Notification state
- `helpStore.ts` — Help system state

**Pattern:**
```typescript
export const usePageStore = create<PageState>((set) => ({
  title: '',
  subtitle: '',
  setPage: (title, subtitle = '') => set({ title, subtitle }),
  clearPage: () => set({ title: '', subtitle: '' }),
}));
```

**Persistence:** `configStore` uses `zustand/middleware` persist middleware with `localStorage`

---

*Convention analysis: 2026-03-30*
