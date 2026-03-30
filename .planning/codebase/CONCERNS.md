# Codebase Concerns

**Analysis Date:** 2026-03-30

---

## HIGH Severity

### 1. Secrets Hardcoded in appsettings.json (Committed to Git)

- **Issue:** `appsettings.json` contains production database credentials, SMTP passwords, JWT secret key, LDAP server IPs, a dev token value, and a master password — ALL committed to the repository.
- **Files:** `lefarma.backend/src/Lefarma.API/appsettings.json`, `lefarma.backend/src/Lefarma.API/appsettings.Development.json`
- **Specific exposures:**
  - DB connection strings with IP `192.168.4.2`, user `coreapi`, and plaintext password `L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!`
  - JWT `SecretKey`: `"tu-clave-secreta-super-segura-de-al-menos-32-caracteres-aqui"` (placeholder but committed)
  - SMTP `Password`: `"Aut0r1z5c10n3s$$001"` — plaintext email credential
  - `DevToken:Value`: `"lefarma-dev-token-2024"` — allows impersonation bypass
  - `Auth:MasterPassword`: `"tt01tt"` — hardcoded master password
  - LDAP server IPs (`192.168.4.2`, `192.168.1.7`) and BaseDNs exposed
- **Impact:** Anyone with repo access has full production database credentials and can forge JWT tokens, impersonate users via DevToken, and access SMTP. Credentials are in git history permanently.
- **Current mitigation:** None — `.gitignore` does NOT exclude `appsettings.json` or `appsettings.Development.json`.
- **Fix approach:**
  1. Immediately rotate ALL exposed credentials (DB password, SMTP password, JWT key, DevToken value, master password).
  2. Move secrets to environment variables, Azure Key Vault, or `dotnet user-secrets`.
  3. Create `appsettings.Production.json` with production overrides (add to `.gitignore`).
  4. Replace `appsettings.json` values with placeholders.
  5. Audit git history for leaked credentials using `trufflehog` or `gitleaks`.

### 2. Broken Test Project: Lefarma.UnitTests References Non-Existent Projects

- **Issue:** `Lefarma.UnitTests.csproj` references two projects that DO NOT EXIST: `Lefarma.Application.csproj` and `Lefarma.Domain.csproj`. The only backend project is `Lefarma.API.csproj`.
- **Files:** `lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj` (lines 27-28)
- **Evidence:**
  - Line 27: `<ProjectReference Include="..\..\src\Lefarma.Application\Lefarma.Application.csproj" />`
  - Line 28: `<ProjectReference Include="..\..\src\Lefarma.Domain\Lefarma.Domain.csproj" />`
  - Confirmed: Only `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` exists. No `Lefarma.Application` or `Lefarma.Domain` directories.
- **Impact:** `dotnet test` fails at build time. CI/CD pipeline would break. The project is dead code with a placeholder `UnitTest1.cs`.
- **Fix approach:** Update `<ProjectReference>` elements to point to `..\..\src\Lefarma.API\Lefarma.API.csproj` (matching `Lefarma.Tests` pattern), or delete the project entirely if redundant with `Lefarma.Tests`.

### 3. CORS Allows Any Origin — Config Ignored

- **Issue:** CORS policy in `Program.cs` uses `AllowAnyOrigin()`, `AllowAnyHeader()`, `AllowAnyMethod()`. The `appsettings.json` defines `Cors:AllowedOrigins` with specific origins (`["http://localhost:5173", "http://localhost:3000", "http://192.168.4.2:8081"]`) but this config is NEVER read by the code.
- **Files:** `lefarma.backend/src/Lefarma.API/Program.cs` (lines 362-369)
- **Impact:** Any website can make authenticated API calls to the backend if a user's JWT token is obtained via XSS. Defeats CSRF protection entirely.
- **Current mitigation:** None.
- **Fix approach:** Replace open CORS policy with:
  ```csharp
  policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
  ```

### 4. DevToken Authentication Bypass — Fragile Guard

- **Issue:** `DevTokenMiddleware` gates access with `IsDevelopment()` (checked redundantly twice, lines 29 and 36), but the DevToken value `"lefarma-dev-token-2024"` and `ImpersonateUserId: 1` are in the base `appsettings.json` (not environment-specific). If `ASPNETCORE_ENVIRONMENT=Development` is accidentally set in production, full user impersonation is available via `X-Dev-Token` header.
- **Files:** `lefarma.backend/src/Lefarma.API/Infrastructure/Middleware/DevTokenMiddleware.cs`, `lefarma.backend/src/Lefarma.API/appsettings.json` (lines 2-5)
- **Impact:** Complete authentication bypass — attacker sets `X-Dev-Token: lefarma-dev-token-2024` header and becomes user ID 1 (likely admin).
- **Current mitigation:** Double `IsDevelopment()` check. Reasonable but fragile — relies solely on an environment variable.
- **Fix approach:**
  1. Move DevToken config to `appsettings.Development.json` ONLY (remove from base).
  2. Add `#if DEBUG` compile-time guard in `Program.cs`.
  3. Ensure production builds never include this middleware.

### 5. Inconsistent Error Handling — Notifications Controllers Bypass ApiResponse Pattern

- **Issue:** Two completely different error handling patterns coexist:
  1. **Catalogos controllers** (Areas, Empresas, Sucursales, etc.): Use `ErrorOr<T>` result type + `ToActionResult()` extension from `lefarma.backend/src/Lefarma.API/Shared/Extensions/ResultExtensions.cs`. No try/catch in controllers. Returns `ApiResponse<T>` consistently.
  2. **Notifications controllers** (`NotificationsController.cs`, `NotificationStreamController.cs`): Use manual try/catch with `catch (ArgumentException)`, `catch (NotImplementedException)`, `catch (Exception)` in EVERY action. Return raw anonymous objects like `new { error = ex.Message }` instead of `ApiResponse<T>`.
- **Files:**
  - Consistent pattern: `lefarma.backend/src/Lefarma.API/Features/Catalogos/*/Controller.cs` (all 14 catalogs)
  - Inconsistent: `lefarma.backend/src/Lefarma.API/Features/Notifications/Controllers/NotificationsController.cs` (13 try/catch blocks across 428 lines)
- **Impact:** Notifications API returns `{ error: "..." }` while all other APIs return `{ success: false, message: "...", errors: [...] }`. Frontend cannot handle errors uniformly. Notifications bypasses the `WideEventLoggingMiddleware` error enrichment by catching exceptions before they propagate.
- **Fix approach:** Refactor Notifications controllers to use `ErrorOr<T>` + `ToActionResult()` pattern. Remove manual try/catch from controllers. Let `WideEventLoggingMiddleware` handle unhandled exceptions.

---

## MEDIUM Severity

### 6. Identical appsettings.json and appsettings.Development.json

- **Issue:** Both files are byte-for-byte identical (79 lines each). No environment-specific layering — same connection strings, secrets, and settings.
- **Files:** `lefarma.backend/src/Lefarma.API/appsettings.json`, `lefarma.backend/src/Lefarma.API/appsettings.Development.json`
- **Impact:** No separation between environments. Defeats ASP.NET Core's configuration layering.
- **Fix approach:** Base `appsettings.json` should contain only non-sensitive defaults (structure without values). `appsettings.Development.json` should override with dev connection strings. Create gitignored `appsettings.Production.json`.

### 7. Swagger Enabled in All Environments

- **Issue:** Swagger/SwaggerUI is registered outside the `IsDevelopment()` check. The environment guard is commented out (`Program.cs` lines 403-412). Swagger UI is accessible in production at root URL.
- **Files:** `lefarma.backend/src/Lefarma.API/Program.cs` (lines 403-412)
- **Impact:** Production API surface publicly documented at `/swagger`. Exposes all endpoint schemas and DTOs.
- **Fix approach:** Uncomment the `IsDevelopment()` guard around Swagger registration.

### 8. Empty/Placeholder Test Files

- **Issue:** `Lefarma.UnitTests/UnitTest1.cs` and `Lefarma.IntegrationTests/UnitTest1.cs` contain a single empty `Test1()` method with no assertions. Scaffold files never replaced.
- **Files:**
  - `lefarma.backend/tests/Lefarma.UnitTests/UnitTest1.cs`
  - `lefarma.backend/tests/Lefarma.IntegrationTests/UnitTest1.cs`
- **Impact:** False impression of test coverage. `dotnet test` reports passing tests with zero real assertions.
- **Fix approach:** Remove placeholder files. Write actual tests or delete empty projects.

### 9. Nearly Zero Backend Test Coverage

- **Issue:** Out of 29 controllers and 15+ feature modules, only Notifications has real tests (3 files in `Lefarma.Tests/Notifications/`). No tests exist for:
  - Any Catalogos feature (Areas, Empresas, Sucursales, Gastos, Medidas, etc.)
  - Auth (login, JWT, LDAP authentication)
  - Workflows / OrdenesCompra / Firmas
  - Help system
  - Profile
  - Admin
  - Archivos
- **Files:** `lefarma.backend/tests/Lefarma.Tests/Notifications/` (only real tests)
- **Impact:** Any regression in business logic goes undetected. Refactoring is risky. Services have heavy try/catch blocks (225+ catch blocks in Features/) that could be simplified with proper test coverage.
- **Fix approach:** Prioritize tests for: Auth flow, CRUD per catalog, workflow engine.

### 10. Version Conflicts Between Test Projects

- **Issue:** Three test projects use incompatible versions of the same packages:
  - `xunit`: 2.9.2 (`Lefarma.Tests`) vs 2.9.3 (others)
  - `xunit.runner.visualstudio`: 2.8.2 (`Lefarma.Tests`) vs 3.1.5 (others) — **major version difference**
  - `FluentAssertions`: 7.0.0 (`Lefarma.Tests`) vs 8.8.0 (others) — **breaking API changes**
  - `Microsoft.NET.Test.Sdk`: 17.12.0 (`Lefarma.Tests`) vs 18.0.1 (others)
  - `coverlet.collector`: 6.0.2 (`Lefarma.Tests`) vs 6.0.4 (others)
- **Files:**
  - `lefarma.backend/tests/Lefarma.Tests/Lefarma.Tests.csproj`
  - `lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj`
  - `lefarma.backend/tests/Lefarma.IntegrationTests/Lefarma.IntegrationTests.csproj`
- **Impact:** `FluentAssertions` 7→8 has breaking API changes. `xunit.runner.visualstudio` 2→3 has different test discovery. Tests may behave differently across projects.
- **Fix approach:** Standardize all versions to latest. Consider `Directory.Build.props` for shared package versions.

### 11. Duplicate State Management Libraries (Zustand + Jotai)

- **Issue:** Both `zustand` (^5.0.10) and `jotai` (^2.18.0) are installed as dependencies. Zustand is used for 5 application stores. Jotai is used only inside two `kibo-ui` components.
- **Files:**
  - Zustand stores: `lefarma.frontend/src/store/authStore.ts`, `pageStore.ts`, `notificationStore.ts`, `configStore.ts`, `helpStore.ts`
  - Jotai atoms: `lefarma.frontend/src/components/kibo-ui/gantt/index.tsx`, `lefarma.frontend/src/components/kibo-ui/calendar/index.tsx`
- **Impact:** Increased bundle size. Two state paradigms to learn. Potential confusion for new developers.
- **Current assessment:** Jotai is only in the `kibo-ui` component library (likely bundled third-party code). Zustand is the app standard. Acceptable but should be documented.
- **Fix approach:** Document convention: "Use Zustand for all app state. Jotai is internal to kibo-ui only."

### 12. Rich Text Editor Inconsistency (TinyMCE vs Lexical)

- **Issue:** TinyMCE is actively used via `@tinymce/tinymce-react` (in `TinyMceEditor.tsx`, used by `HelpList.tsx` and `HelpView.tsx`). But `HelpEditor.tsx` labels the field "Contenido (Lexical JSON)" with comment "Temporalmente editor de JSON. En próxima versión: editor visual con Lexical." Help articles apparently store content in Lexical JSON format.
- **Files:**
  - TinyMCE: `lefarma.frontend/src/components/help/TinyMceEditor.tsx`
  - HelpEditor: `lefarma.frontend/src/pages/help/HelpEditor.tsx` (lines 236, 246)
  - Dependencies in `lefarma.frontend/package.json`: `tinymce` ^8.3.2 (production), `@tinymce/tinymce-react` ^6.3.0 (production)
- **Impact:** Content format mismatch — TinyMCE produces HTML but labels suggest Lexical JSON. Two heavy editor libraries may be loaded.
- **Fix approach:** Decide on ONE editor. If TinyMCE is the choice, update labels/docs. If Lexical is the goal, plan migration with content conversion and remove TinyMCE.

### 13. Notification System Incomplete (Multiple TODOs)

- **Issue:** Notifications feature has several unfinished pieces:
  - `TemplateService.cs` line 11: TODO to migrate from Handlebars to Razor templates
  - `NotificationService.cs` line 70: `CreatedBy = "system"` hardcoded (TODO: get from user context)
  - `NotificationService.cs` line 296: TODO for role-based user lookup
  - `INotificationService.cs` line 68: TODO to re-implement with UserIds/RoleNames
  - `ITemplateService.cs` line 12: TODO to migrate to Razor templates
  - `Program.cs` lines 259-272: Commented-out notification settings validation
- **Files:**
  - `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/TemplateService.cs`
  - `lefarma.backend/src/Lefarma.API/Features/Notifications/Services/NotificationService.cs`
  - `lefarma.backend/src/Lefarma.API/Domain/Interfaces/INotificationService.cs`
  - `lefarma.backend/src/Lefarma.API/Domain/Interfaces/ITemplateService.cs`
  - `lefarma.backend/src/Lefarma.API/Program.cs`
- **Impact:** Notifications work with limitations — no user attribution, no role targeting, temporary template engine (Handlebars).
- **Fix approach:** Track as feature completion task. Prioritize user context injection and role-based lookup.

### 14. Database Migrations Not Version Controlled

- **Issue:** `.gitignore` contains `**/Migrations/` excluding all EF Core migrations. No `Migrations/` directory exists in the codebase. The `.csproj` has an empty folder include for `Infrastructure\Data\Migrations\`.
- **Files:** `.gitignore` (line 55), `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` (line 32)
- **Impact:** Schema is not version controlled. Cannot recreate database from code alone. No migration history. Team members cannot sync schema changes.
- **Fix approach:** Remove `**/Migrations/` from `.gitignore`. Generate and commit initial migration from current database.

---

## LOW Severity

### 15. Database Seeding Disabled

- **Issue:** Seeding is commented out in `Program.cs` (lines 451-457). `IDatabaseSeeder` is registered (line 191) but never executed.
- **Files:** `lefarma.backend/src/Lefarma.API/Program.cs` (lines 191, 451-457)
- **Impact:** No automatic seed data on fresh deployments.
- **Fix approach:** Re-enable with environment check or expose as CLI command/endpoint.

### 16. Two Databases on Same Server — No Transactional Consistency

- **Issue:** App connects to `Lefarma` (app DB via `ApplicationDbContext`) and `Asokam` (identity DB via `AsokamDbContext`), both on `192.168.4.2`.
- **Files:** `lefarma.backend/src/Lefarma.API/Program.cs` (lines 108-112)
- **Impact:** Cross-database queries require explicit handling. No distributed transactions. Double migration management.
- **Fix approach:** Document the relationship. Consider long-term consolidation.

### 17. Empty Shared Exceptions and Validators Folders

- **Issue:** `.csproj` includes empty folders `Shared\Exceptions\` and `Validators\`. No files exist in either. The project uses `ErrorOr` for error handling and FluentValidation validators live co-located in feature folders.
- **Files:** `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` (lines 33-34)
- **Impact:** Misleading project structure. Suggests planned but unimplemented infrastructure.
- **Fix approach:** Remove empty folder includes from `.csproj`, or implement planned shared exceptions.

### 18. Unused `using Azure;` Import

- **Issue:** `AreaController.cs` has `using Azure;` at line 1. Azure SDK is not referenced in the project.
- **Files:** `lefarma.backend/src/Lefarma.API/Features/Catalogos/Areas/AreaController.cs` (line 1)
- **Impact:** Compiler warning only. No runtime impact.
- **Fix approach:** Remove the unused import.

### 19. Demo/Prototype Pages in Production Routes

- **Issue:** Three demo pages are routed in production via `AppRoutes.tsx`:
  - `/roadmap` → `Roadmap.tsx` (607 lines, uses `@faker-js/faker` for fake data)
  - `/demo-components` → `DemoComponents.tsx` (1265 lines, component showcase)
  - `/` → `Hero.tsx` (216 lines, landing page)
- **Files:**
  - `lefarma.frontend/src/pages/DemoComponents.tsx`
  - `lefarma.frontend/src/pages/Roadmap.tsx`
  - `lefarma.frontend/src/pages/Hero.tsx`
  - Routes: `lefarma.frontend/src/routes/AppRoutes.tsx` (lines 38, 73-74)
- **Impact:** `@faker-js/faker` (~700KB) is a **production dependency** but only used in `Roadmap.tsx`. These pages increase bundle size and may confuse end users.
- **Fix approach:** Move `@faker-js/faker` to `devDependencies`. Gate demo routes behind development-only guard or lazy-load them.

### 20. Documentation Significantly Behind Codebase

- **Issue:** `lefarma.docs/backend/api-routes.md` documents only 7 controllers (Areas, Empresas, Sucursales, Tipos de Gasto, Tipos de Medida, Unidades de Medida, Help). The codebase has **29 controllers** — over 20 are undocumented including Auth, Profile, Admin, Workflows, OrdenesCompra, Notifications, Archivos, Config, Bancos, Proveedores, CentrosCosto, FormasPago, MediosPago, EstatusOrden, RegimenesFiscales, CuentasContables, Roles, Usuarios, SystemConfig.
- **Files:** `lefarma.docs/backend/api-routes.md` (324 lines, ~7 of 29 controllers documented)
- **Impact:** Developers cannot rely on docs to understand available endpoints. AGENTS.md instructs "always update documentation" but this hasn't been followed.
- **Fix approach:** Audit all controllers and add missing documentation. Add PR template reminder.

### 21. WideEvent Logging Serilog Override Set to Fatal (Dead Code)

- **Issue:** `Program.cs` line 420 sets `options.GetLevel = (...) => LogEventLevel.Fatal` with comment "Nunca se ejecuta". The `UseSerilogRequestLogging()` call is dead code since `WideEventLoggingMiddleware` handles all logging.
- **Files:** `lefarma.backend/src/Lefarma.API/Program.cs` (lines 416-421)
- **Impact:** No functional issue but misleading dead code.
- **Fix approach:** Remove the `UseSerilogRequestLogging()` call entirely.

---

## TODO/FIXME Inventory (Source Code Only)

Excludes skill/tooling/documentation files. Only application source code.

| Location | TODO Description | Severity Context |
|----------|------------------|------------------|
| `Program.cs:259` | Uncomment when Notifications feature is implemented | MEDIUM — feature incomplete |
| `TemplateService.cs:11` | Migrate to Razor template rendering | MEDIUM — using temporary Handlebars |
| `NotificationService.cs:70` | Get CreatedBy from current user context | MEDIUM — hardcoded `"system"` |
| `NotificationService.cs:296` | Implement role-based user lookup | MEDIUM — feature incomplete |
| `ITemplateService.cs:12` | Migrate to Razor (.cshtml) templates | MEDIUM — duplicates above |
| `INotificationService.cs:68` | Re-implement with UserIds/RoleNames | MEDIUM — API design incomplete |
| `WorkflowDiagram.tsx:481` | Vista de configuración (TODO) | LOW — UI placeholder text |
| `WorkflowDiagram.tsx:1603` | Implement API call | MEDIUM — functionality missing |
| `HelpEditor.tsx:246` | Editor visual con Lexical (próxima versión) | LOW — planned future work |

---

## Test Coverage Gap Analysis

### Backend Features with NO Tests

| Feature | Controller | Service | Tests |
|---------|------------|---------|-------|
| Catalogos/Areas | `AreasController.cs` | `AreaService.cs` | ❌ |
| Catalogos/Empresas | `EmpresasController.cs` | `EmpresaService.cs` | ❌ |
| Catalogos/Sucursales | `SucursalesController.cs` | `SucursalService.cs` | ❌ |
| Catalogos/Gastos | `GastosController.cs` | `GastoService.cs` | ❌ |
| Catalogos/Medidas | `MedidasController.cs` | `MedidaService.cs` | ❌ |
| Catalogos/UnidadesMedida | `UnidadesMedidaController.cs` | `UnidadMedidaService.cs` | ❌ |
| Catalogos/Proveedores | `ProveedoresController.cs` | `ProveedorService.cs` | ❌ |
| Catalogos/Bancos | `BancosController.cs` | `BancoService.cs` | ❌ |
| Catalogos/FormasPago | `FormasPagoController.cs` | `FormaPagoService.cs` | ❌ |
| Catalogos/MediosPago | `MediosPagoController.cs` | `MedioPagoService.cs` | ❌ |
| Catalogos/CentrosCosto | `CentrosCostoController.cs` | `CentroCostoService.cs` | ❌ |
| Catalogos/EstatusOrden | `EstatusOrdenController.cs` | `EstatusOrdenService.cs` | ❌ |
| Catalogos/RegimenesFiscales | `RegimenesFiscalesController.cs` | `RegimenFiscalService.cs` | ❌ |
| Catalogos/CuentasContables | `CuentasContablesController.cs` | `CuentaContableService.cs` | ❌ |
| Auth (Login/JWT/LDAP) | `AuthController.cs` | `AuthService.cs` | ❌ |
| Auth/Roles | `RolesController.cs` | `RolCatalogService.cs` | ❌ |
| Auth/Usuarios | `UsuariosController.cs` | `UsuarioCatalogService.cs` | ❌ |
| Profile | `ProfileController.cs` | `ProfileService.cs` | ❌ |
| Admin | `AdminController.cs` | `AdminService.cs` | ❌ |
| Workflows | `WorkflowsController.cs` | `WorkflowService.cs` | ❌ |
| OrdenesCompra | `OrdenCompraController.cs` | `OrdenCompraService.cs` | ❌ |
| Firmas | `FirmasController.cs` | `FirmasService.cs` | ❌ |
| Help | 3 controllers | 3 services | ❌ |
| Archivos | `ArchivosController.cs` | `ArchivoService.cs` | ❌ |
| SystemConfig | `SystemConfigController.cs` | — | ❌ |
| **Notifications** | 2 controllers | `NotificationService.cs` | ✅ 3 test files |

### Frontend: Zero Test Coverage

No test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`) exist in `lefarma.frontend/src/`. `@playwright/test` is listed as a devDependency in `package.json` but no test scripts or test files exist.

---

*Concerns audit: 2026-03-30*
