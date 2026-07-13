# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merged with project-specific instructions for Lefarma.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

# Lefarma Project — Agent Reference

Only facts that change how you work. If a line is obvious from file names, it doesn't belong here.

## Repo Layout

```
01-lefarma-project/
├── lefarma.backend/          # .NET 10 Web API (single project: Lefarma.API)
│   ├── src/Lefarma.API/      # API, Features/, Infrastructure/, Shared/
│   └── tests/                # Lefarma.UnitTests, Lefarma.Tests, Lefarma.IntegrationTests
├── lefarma.frontend/         # React 19 + Vite + TypeScript SPA
├── lefarma.database/         # Manual SQL Server migration scripts (no EF migrations)
└── lefarma.docs/             # Project docs, specs, plans, reports
```

## Developer Commands

### Frontend (`lefarma.frontend/`)
```bash
npm run dev          # Vite dev server, port 5173
npm run build        # tsc + vite build
npm run lint         # eslint . --ext ts,tsx --max-warnings 0
npm run format       # prettier write src/**/*.{ts,tsx,json,css,md}
```

### Backend (`lefarma.backend/`)
```bash
cd src/Lefarma.API
dotnet build         # build the API
dotnet test          # run all test projects from solution
dotnet test --filter "Category=Unit"    # unit tests only
dotnet test tests/Lefarma.UnitTests/      # single project
```

### Run both (PowerShell)
```powershell
./init.ps1           # launches backend + frontend concurrently
```
> ⚠️ `init.ps1` prints port 5134 for the backend, but the real backend URL is `http://localhost:5174` (Vite proxy and env files agree on this). Use 5174 as the source of truth.

## Architecture & Conventions

### Backend
- Single ASP.NET Core project: `Lefarma.API`. Clean-ish structure under `Features/`, `Infrastructure/`, `Domain/`, `Shared/`.
- Controllers live in `Features/` by domain.
- DbContext: `Infrastructure/Data/ApplicationDbContext.cs`.
- EF Core is used for querying/mapping, but **schema changes are managed by manual SQL scripts in `lefarma.database/`**, not EF migrations.
- Authorization: role-based policies (`RequireAdministrator`, `RequireManager`, `RequireFinance`) plus permission-based `[HasPermission("x")]`. Permissions are auto-registered from `Permissions` constants.
- JWT uses a symmetric key and `ClockSkew = TimeSpan.Zero` — tokens are intolerant of clock drift.
- Serilog writes JSON logs to `logs/wide-events-*.json`; read them with a JSON viewer, not a text tail.
- Development-only `DevToken` middleware (`appsettings.Development.json`) bypasses auth when the `DevToken` header is present. Never enable in production.
- Database seeder is registered in DI but **commented out** in `Program.cs`. Uncomment only if you intend to seed.
- Static uploads are served under `/api/media/archivos` (and legacy `/media/archivos`). Base path: `wwwroot/media/archivos` by default.

### Frontend
- React 19 + Vite 7 + TypeScript 5.9. Path alias `@/` maps to `src/`.
- `tsconfig.json` uses `strict: true` and `noUnusedLocals: false` / `noUnusedParameters: false`.
- Routing: React Router 7, defined in `src/routes/AppRoutes.tsx`.
- State: Zustand + Jotai (mixed usage). Forms: React Hook Form + Zod.
- Tables: TanStack Table. Charts: Recharts. Rich text: TinyMCE.
- UI components: shadcn/ui built on Radix primitives in `src/components/ui/`.
- Vite dev proxy: `/api` → `http://localhost:5174`. The backend must run separately.
- API base URL is set in `.env` / `.env.development` as `http://localhost:5174/api`.
- `BASE_URL_PATH` controls the Vite base path (default `/`).

### Database
- **Do NOT run `dotnet ef migrations`**. Manual SQL scripts in `lefarma.database/` are the source of truth.
- Scripts are numbered (`000_`, `001_`, `002_`, ..., `024_`, `06_`, `06B_`). There are gaps and inconsistent prefixes; apply in chronological order, not alphabetical.
- Three connection strings: `DefaultConnection` (Lefarma main), `AsokamConnection` (legacy Asokam), `AsistenciasConnection` (attendance system on `192.168.1.5`).

## Testing

- Backend: xUnit + Moq + FluentAssertions. Integration tests use `Microsoft.AspNetCore.Mvc.Testing` and EF Core InMemory.
- Test projects:
  - `Lefarma.UnitTests`
  - `Lefarma.Tests`
  - `Lefarma.IntegrationTests`
- Frontend: Playwright is installed (`@playwright/test`) but no standard test scripts are wired in `package.json`.

## Important File Locations

- Backend entry point: `lefarma.backend/src/Lefarma.API/Program.cs`
- Frontend entry point: `lefarma.frontend/src/main.tsx`
- Frontend routes: `lefarma.frontend/src/routes/AppRoutes.tsx`
- Backend features/controllers: `lefarma.backend/src/Lefarma.API/Features/`
- EF configurations: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/`
- DbContext: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`
- Swagger: `http://localhost:5174/swagger/v1/swagger.json`

## Common Pitfalls

1. **Backend port mismatch:** `init.ps1` claims 5134, but Vite proxy, env files, and the real backend URL all use **5174**. Trust 5174.
2. **JWT is strict:** `ClockSkew = TimeSpan.Zero` means any clock drift causes immediate 401s.
3. **CORS:** `Program.cs` currently allows `AllowAnyOrigin()` in the `CorsPolicy` policy. If that changes, verify your dev URL is in the allowed origins list in `appsettings.json`.
4. **No EF migrations:** Schema changes must be added as new numbered SQL scripts in `lefarma.database/`. Running `dotnet ef migrations` will break schema consistency.
5. **Serilog logs are JSON:** `logs/wide-events-*.json` is not plain text.
6. **DevToken is hardcoded in development only:** Never commit production credentials or enable the dev token bypass outside local dev.
7. **SPA fallback:** `Program.cs` calls `MapFallbackToFile("/index.html")` and serves static files. API routes should not collide with frontend route names.

## Development Secrets (local only)

These are committed for convenience in local development. Never use them for production or commit new production secrets.

- DB password: `L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!`
- JWT secret: `tu-clave-secreta-super-segura-de-al-menos-32-caracteres-aqui`
- SMTP password: `Aut0r1z5c10n3s$$001`
