# Lefarma Project - Agent Instructions

## Project Structure

```
01-lefarma-project/
├── lefarma.backend/          # .NET 10 Web API
│   ├── src/Lefarma.API/      # Main API project
│   └── tests/                # Unit, Integration, E2E tests
├── lefarma.frontend/         # React 19 + Vite + TypeScript SPA
├── lefarma.database/         # SQL Server migration scripts (.sql files)
└── lefarma.docs/             # Documentation
```

## Developer Commands

### Frontend (`lefarma.frontend/`)
```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Backend (`lefarma.backend/`)
```bash
dotnet build         # Build solution
dotnet test          # Run all tests
dotnet test --filter "Category=Unit"    # Unit tests only
dotnet test Lefarma.Tests/              # Specific test project
```

### Database (`lefarma.database/`)
- Scripts are numbered sequentially (`000_`, `001_`, `002_`...)
- Two databases: **Lefarma** (main) and **Asokam** (legacy)

## Architecture Notes

### Backend
- **.NET 10** with Clean Architecture pattern
- **EF Core** with SQL Server (connection: `192.168.4.2`)
- **JWT Bearer auth** with LDAP/ActiveDirectory integration
- **Serilog** JSON logging to `logs/wide-events-*.json`
- **Swagger** enabled at `/swagger/v1/swagger.json`
- **Workflow engine** for business process automation
- **Notification dispatcher** (Email, Telegram, In-App)
- **Help system** with TinyMCE rich text editor

### Frontend
- **React 19** with Vite 7
- **shadcn/ui** components (Radix UI primitives)
- **React Router 7** (file-based routing via `AppRoutes.tsx`)
- **Zustand** for state management
- **React Hook Form + Zod** for forms
- **TanStack Table** for data tables
- **Recharts** for visualizations

## Key Conventions

### API Proxy (Vite Dev)
Vite proxies `/api` → `http://localhost:5174`. The backend must run separately.

### Backend Port
The API typically runs on port **5174** (configured in `appsettings.Development.json`).

### CORS
Configured to allow `localhost:5173`, `localhost:3000`, and `http://192.168.4.2:8081`.

### JWT Authentication
- Uses symmetric security key (`JwtSettings.SecretKey`)
- `ClockSkew = TimeSpan.Zero`
- Supports refresh tokens (7 days expiry)

### Authorization
Role-based + Permission-based policies:
- `AuthorizationPolicies.RequireAdministrator`, `RequireManager`, `RequireFinance`, etc.
- `[HasPermission("x")]` attribute for granular control
- Permissions auto-registered from `Permissions` constants

### DevToken Middleware
In Development, a `DevToken` middleware allows bypassing auth for testing:
```json
"DevToken": { "Value": "lefarma-dev-token-2024", "ImpersonateUserId": 1 }
```

### Database Seeding
Database seeder is **disabled** in Program.cs. Uncomment to seed:
```csharp
// if (app.Environment.IsDevelopment())
// {
//     using var scope = app.Services.CreateScope();
//     var seeder = scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>();
//     await seeder.SeedAsync();
// }
```

## Testing

### Backend Test Stack
- **xUnit** test framework
- **Moq** for mocking
- **FluentAssertions** for readable assertions
- **Microsoft.AspNetCore.Mvc.Testing** for integration tests
- **EF Core InMemory** for integration test databases

Test projects:
- `Lefarma.UnitTests` - Unit tests
- `Lefarma.Tests` - Integration tests
- `Lefarma.IntegrationTests` - E2E-style tests

## Important File Locations

### Backend Entry Point
`lefarma.backend/src/Lefarma.API/Program.cs`

### Frontend Entry Point
`lefarma.frontend/src/main.tsx`

### Frontend Routes
`lefarma.frontend/src/routes/AppRoutes.tsx`

### Backend Controllers
`lefarma.backend/src/Lefarma.API/Features/` (modular by domain)

### Database Configurations
`lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/`

### EF Core DbContext
`lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs`

## Common Pitfalls

1. **Don't assume backend starts on same port as frontend** - Backend runs on 5174, frontend on 5173 with proxy
2. **Don't forget to run migrations** - EF Core migrations not auto-applied
3. **JWT validation is strict** - `ClockSkew = TimeSpan.Zero` means no tolerance for clock drift
4. **CORS origins must include your dev URL** - Check `appsettings.json` if you get CORS errors
5. **Serilog logs to JSON file** - Not plain text; use a JSON viewer for logs
6. **DevToken is hardcoded** - Never enable in production

## Secrets (Development Only)
- DB Password: `L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!`
- JWT Secret: `tu-clave-secreta-super-segura-de-al-menos-32-caracteres-aqui`
- SMTP Password: `Aut0r1z5c10n3s$$001`

**WARNING**: These are development-only credentials. Never commit production secrets.
