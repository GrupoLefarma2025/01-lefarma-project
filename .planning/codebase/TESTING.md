# Testing Patterns

**Analysis Date:** 2026-03-30

## Test Framework

### Backend (.NET 10)

**Runner:**
- xUnit 2.9.3 (`Lefarma.UnitTests`, `Lefarma.IntegrationTests`)
- xUnit 2.9.2 (`Lefarma.Tests`)
- Microsoft.NET.Test.Sdk 18.0.1 / 17.12.0

**Assertion Libraries:**
- FluentAssertions 8.8.0 (`Lefarma.UnitTests`, `Lefarma.IntegrationTests`)
- FluentAssertions 7.0.0 (`Lefarma.Tests`) — **version mismatch, see concerns below**
- xUnit `Assert.*` (used directly in `Lefarma.Tests`)

**Mocking:**
- Moq 4.20.72 (`Lefarma.UnitTests`, `Lefarma.Tests`)

**Integration Testing:**
- Microsoft.AspNetCore.Mvc.Testing 10.0.2 (`Lefarma.IntegrationTests`)
- Microsoft.EntityFrameworkCore.InMemory 10.0.2 (`Lefarma.IntegrationTests`)

**Coverage:**
- coverlet.collector 6.0.4 (`Lefarma.UnitTests`, `Lefarma.IntegrationTests`)
- coverlet.collector 6.0.2 (`Lefarma.Tests`)

### Frontend (React + Vite)

**E2E:**
- Playwright `@playwright/test` 1.58.2
- Config: `lefarma.frontend/playwright.config.ts`

**Unit/Integration:**
- **None configured.** No vitest, jest, @testing-library/react, or any unit test framework present.

**Run Commands:**

```bash
# Backend — run all test projects
dotnet test lefarma.backend/tests/Lefarma.Tests/
dotnet test lefarma.backend/tests/Lefarma.UnitTests/
dotnet test lefarma.backend/tests/Lefarma.IntegrationTests/

# Backend — run all tests from solution root
dotnet test lefarma.backend/

# Frontend E2E (Playwright)
cd lefarma.frontend && npx playwright test

# Frontend — NO unit test command exists
```

## Test Projects

### `lefarma.backend/tests/Lefarma.Tests/` (Active)

**Status:** Active — contains real test code.

**References:** `Lefarma.API.csproj`

**What it tests:** Notifications feature only.
- `Notifications/SimpleNotificationTests.cs` — DTO validation tests (property assignment, collection counts)
- `Notifications/NotificationServiceTests.cs` — Unit tests for `NotificationService` with Moq mocks
- `Notifications/NotificationsApiTests.cs` — Integration tests using `WebApplicationFactory<Program>`

**Folder structure:**
```
Lefarma.Tests/
├── Lefarma.Tests.csproj
├── Notifications/
│   ├── SimpleNotificationTests.cs
│   ├── NotificationServiceTests.cs
│   └── NotificationsApiTests.cs
├── bin/
└── obj/
```

### `lefarma.backend/tests/Lefarma.UnitTests/` (Placeholder)

**Status:** **BROKEN** — references non-existent projects.

**References:**
- `Lefarma.Application.csproj` — **DOES NOT EXIST** in `src/`
- `Lefarma.Domain.csproj` — **DOES NOT EXIST** in `src/`

**Content:** Single placeholder `UnitTest1.cs` with an empty `[Fact]` test.

**Will not build** until project references are fixed or the projects are created.

### `lefarma.backend/tests/Lefarma.IntegrationTests/` (Placeholder)

**Status:** Scaffolded but **empty**.

**References:** `Lefarma.API.csproj` (valid reference).

**Content:** Single placeholder `UnitTest1.cs` with an empty `[Fact]` test.

**Dependencies include** `WebApplicationFactory` and EF Core InMemory — ready for integration tests but none written yet.

### `lefarma.backend/tests/NotificationsManualTest.sh`

A shell script for manual notification testing — not an automated test.

## Test File Organization

### Backend

**Location:** Separate test projects under `lefarma.backend/tests/`.

**Naming conventions:**
- Test files: `{Subject}Tests.cs` (e.g., `NotificationServiceTests.cs`, `NotificationsApiTests.cs`)
- Test classes: `public class {Subject}Tests`
- Namespace matches folder structure: `namespace Lefarma.Tests.Notifications;`

**Test categorization within project:**
- Tests organized by feature in subfolders (`Notifications/`)
- Unit tests and integration tests **mixed** in same project (`Lefarma.Tests`)

### Frontend

**E2E tests location:** `lefarma.frontend/tests/` (project root, separate from `src/`)

**Naming:** `login.spec.ts` (Playwright convention: `*.spec.ts`)

**No unit/component test files exist anywhere in the frontend.**

## Test Structure

### Backend Test Suite Pattern

```csharp
namespace Lefarma.Tests.Notifications;

/// <summary>
/// XML doc comment describing the test class purpose
/// </summary>
public class NotificationServiceTests
{
    // Fields for mocked dependencies
    private readonly Mock<INotificationRepository> _mockRepository;
    private readonly Mock<ILogger<NotificationService>> _mockLogger;
    private readonly NotificationService _service;

    // Constructor sets up mocks and creates system-under-test
    public NotificationServiceTests()
    {
        _mockRepository = new Mock<INotificationRepository>();
        _mockLogger = new Mock<ILogger<NotificationService>>();
        _service = new NotificationService(_mockRepository.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task SendAsync_ValidRequest_ReturnsSuccessResponse()
    {
        // Arrange
        var request = new SendNotificationRequest { ... };
        _mockRepository
            .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        // Act
        var result = await _service.SendAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.NotificationId);
    }
}
```

**Key patterns observed:**
- **Arrange-Act-Assert** pattern used consistently
- **Constructor-based test setup** — mocks initialized once, shared across tests
- **xUnit `[Fact]`** for single test cases, **`[Theory]` + `[InlineData]`** for parameterized tests
- **No `[Collection]` or `[ClassFixture]` usage** except `NotificationsApiTests` which uses `IClassFixture<WebApplicationFactory<Program>>`

### Integration Test Pattern (WebApplicationFactory)

```csharp
public class NotificationsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public NotificationsApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SendNotification_ValidRequest_ReturnsSuccess()
    {
        var request = new SendNotificationRequest { ... };
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_testToken}");
        var response = await _client.PostAsync("/api/notifications/send", content);

        Assert.True(response.IsSuccessStatusCode);
    }
}
```

### Frontend E2E Test Pattern (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('debería hacer login con usuario 54 y capturar logs', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await page.fill('input[type="text"]', '54');
    await page.click('button[type="submit"]');
    // ...
  });
});
```

**Note:** The single Playwright test is primarily a **debugging/diagnostic script** for SSE connection issues, not a proper acceptance test. It captures console logs and checks for connection loops rather than asserting user-visible behavior.

## Mocking

### Backend Mocking (Moq)

**Pattern:**
```csharp
// Create mock
var mockRepository = new Mock<INotificationRepository>();

// Setup return values
mockRepository
    .Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(notification);

// Verify calls
mockRepository.Verify(
    r => r.MarkAsReadAsync(notificationId, userId, It.IsAny<CancellationToken>()),
    Times.Once);

// Use mocked object
var service = new NotificationService(mockRepository.Object, logger.Object);
```

**What gets mocked:**
- Repository interfaces (`INotificationRepository`)
- Logger abstractions (`ILogger<T>`)
- No custom wrapper abstractions for HttpClient, etc.

**What NOT to mock:**
- Domain entities — instantiated directly in tests
- DTOs — used as-is

### Frontend Mocking

No mocking libraries or patterns established — no unit tests exist.

## Fixtures and Factories

### Backend

**Test data creation:** Inline object initialization in each test.

```csharp
var request = new SendNotificationRequest
{
    Title = "Test Notification",
    Message = "Test message",
    Type = "info",
    Priority = "normal",
    Category = "system",
    Channels = new List<NotificationChannelRequest>
    {
        new() { ChannelType = "in-app", Recipients = "21" }
    }
};
```

**No shared fixtures or factories.** Each test creates its own data inline.

**No test data builders or mother patterns.**

**Shared context:** `IClassFixture<WebApplicationFactory<Program>>` for integration tests.

### Frontend

No fixtures, factories, or test data patterns.

## Coverage

### Backend

**Requirements:** No coverage thresholds enforced. Coverlet collector is configured but no minimums set.

**Current coverage:** Extremely low — only the Notifications feature has tests. All other features (11 feature modules) have zero coverage.

**What has coverage:**
| Feature | Unit Tests | Integration Tests | Notes |
|---------|-----------|-------------------|-------|
| Notifications | ✅ Yes | ✅ Yes | Only tested feature |
| Catalogos (Areas, Empresas, Sucursales, etc.) | ❌ None | ❌ None | ~15 sub-modules, zero tests |
| Auth | ❌ None | ❌ None | |
| Admin | ❌ None | ❌ None | |
| Archivos | ❌ None | ❌ None | |
| Help | ❌ None | ❌ None | |
| OrdenesCompra | ❌ None | ❌ None | |
| Profile | ❌ None | ❌ None | |
| Config/Workflows | ❌ None | ❌ None | |
| Logging | ❌ None | ❌ None | |
| SystemConfig | ❌ None | ❌ None | |

### Frontend

**Requirements:** No coverage tooling configured.

**Current coverage:** Zero unit/component test coverage. One E2E test for login flow (diagnostic in nature).

**Uncovered frontend areas:**
- All page components (`src/pages/`)
- All custom hooks (`src/hooks/`)
- Store logic (`src/store/`)
- API service layer (`src/services/`)
- UI components (`src/components/`)
- Type definitions (`src/types/`)

## Test Types

### Unit Tests

**Scope:** Service layer business logic with mocked dependencies.

**Approach:**
- Instantiate service with mocked repository and logger
- Call service methods directly
- Assert return values and mock verification

**Location:** `Lefarma.Tests/Notifications/NotificationServiceTests.cs`

**Only `NotificationService` has unit tests.**

### Integration Tests

**Scope:** Full HTTP pipeline via `WebApplicationFactory<Program>`.

**Approach:**
- Use `WebApplicationFactory` to boot the API in-memory
- Create `HttpClient` from factory
- Send real HTTP requests to endpoints
- Assert response status codes and content

**Location:** `Lefarma.Tests/Notifications/NotificationsApiTests.cs`

**Auth in integration tests:** Hardcoded test token `"test-token-for-integration-tests"` — likely bypasses real auth middleware.

### E2E Tests

**Framework:** Playwright 1.58.2

**Scope:** Login flow only.

**Config:** `lefarma.frontend/playwright.config.ts`
- Single browser: Chromium only
- Single worker (sequential execution)
- Auto-starts dev server via `webServer` config
- HTML reporter

**Location:** `lefarma.frontend/tests/login.spec.ts`

**Note:** The E2E test is a diagnostic script capturing SSE connection logs, not a standard acceptance test.

## Common Patterns

### Async Testing

```csharp
// All service tests are async
[Fact]
public async Task SendAsync_ValidRequest_ReturnsSuccessResponse()
{
    // Arrange
    _mockRepository.Setup(r => r.CreateAsync(...)).ReturnsAsync(notification);

    // Act
    var result = await _service.SendAsync(request);

    // Assert
    Assert.NotNull(result);
}
```

### Error/Exception Testing

```csharp
[Fact]
public async Task SendAsync_EmptyTitle_ThrowsArgumentException()
{
    // Arrange
    var request = new SendNotificationRequest { Title = "", ... };

    // Act & Assert
    await Assert.ThrowsAsync<ArgumentException>(() => _service.SendAsync(request));
}
```

### Parameterized Testing

```csharp
[Theory]
[InlineData("info")]
[InlineData("warning")]
[InlineData("error")]
[InlineData("success")]
[InlineData("alert")]
public void Test_NotificationType_ValidTypes(string type)
{
    Assert.NotNull(type);
    Assert.Contains(type, new[] { "info", "warning", "error", "success", "alert" });
}
```

**Note:** The `[Theory]` tests in `SimpleNotificationTests.cs` don't actually validate business rules — they only assert that hardcoded strings are in hardcoded arrays. These are effectively placeholder tests with minimal value.

## Quality Tools

### Frontend Linting (ESLint 9)

**Config:** `lefarma.frontend/eslint.config.js`

**Presets applied:**
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` flat recommended
- `eslint-plugin-react-refresh` vite preset

**Global ignores:** `dist`, `node_modules`, `build`, `.vite`

**Target:** `**/*.{ts,tsx}` files

**Run:**
```bash
cd lefarma.frontend && npm run lint
# => eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

**Key rule:** `--max-warnings 0` — treats all warnings as errors.

### Frontend Formatting (Prettier 3)

**Config:** `lefarma.frontend/.prettierrc`

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

**Run:**
```bash
cd lefarma.frontend && npm run format
# => prettier --write "src/**/*.{ts,tsx,json,css,md}"
```

### TypeScript Strict Mode

**Config:** `lefarma.frontend/tsconfig.json`

```json
{
  "strict": true,
  "noUnusedLocals": false,
  "noUnusedParameters": false,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true
}
```

**Note:** `noUnusedLocals` and `noUnusedParameters` are **disabled** — allows dead code to accumulate without compiler errors.

### Backend Quality

**.editorconfig:** Not present.

**Analyzers:** No Roslyn analyzers configured in any `.csproj`.

**Warning level:** Default (no `<TreatWarningsAsErrors>` or `<AnalysisLevel>` set).

## CI/CD

**GitHub Actions:** Not present (no `.github/workflows/` directory).

**Azure Pipelines:** Not present (no `azure-pipelines.yml`).

**CI status:** **No CI/CD pipeline configured.** All test execution is manual/local only.

## Known Issues

### `Lefarma.UnitTests` — Broken References

The project references `Lefarma.Application.csproj` and `Lefarma.Domain.csproj`, which **do not exist** in `src/`. This project will fail to build.

**Fix:** Either:
- Remove project references and point to `Lefarma.API.csproj`
- Create the referenced layer projects (Application, Domain)
- Delete this placeholder project if not planned

### `Lefarma.IntegrationTests` — Empty Placeholder

Has valid project reference to `Lefarma.API.csproj` and correct dependencies (`WebApplicationFactory`, EF Core InMemory), but contains only an empty `UnitTest1.cs`.

### `Lefarma.Tests` — Mixed Concerns

Contains both unit tests (with Moq) and integration tests (with `WebApplicationFactory`) in the same project. These should be separated into distinct projects for clarity and build performance.

### FluentAssertions Version Mismatch

- `Lefarma.Tests` uses FluentAssertions 7.0.0
- `Lefarma.UnitTests` and `Lefarma.IntegrationTests` use FluentAssertions 8.8.0

This inconsistency may cause confusion when sharing test utilities.

### Integration Test Auth

`NotificationsApiTests` uses a hardcoded `"test-token-for-integration-tests"` string. There is also a typo in one test (`_test_token` vs `_testToken`). This approach requires the API to accept this token, which may not work without custom test middleware configuration.

### Playwright E2E Test — Not a Real Test

`login.spec.ts` is a debugging script that:
- Captures console logs to detect SSE connection loops
- Has minimal assertions (only `toBeVisible`)
- Uses `waitForTimeout(3000)` for timing
- Outputs diagnostic info via `console.log`

This test will pass regardless of whether the login actually succeeds — it doesn't assert successful navigation to dashboard.

---

*Testing analysis: 2026-03-30*
