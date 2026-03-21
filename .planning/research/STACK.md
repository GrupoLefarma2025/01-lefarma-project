# Technology Stack

**Project:** Sistema de Cuentas por Pagar con Notificaciones Multi-Canal
**Researched:** 2025-03-20
**Overall confidence:** MEDIUM

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **.NET** | 10.0 (LTS) | Backend runtime | Latest LTS, native AOT performance, built-in OpenAPI support. .NET 10 available 2025-11. **MEDIUM confidence** - version inferred from release cadence (.NET 9 released Nov 2024). |
| **ASP.NET Core** | 10.0 | Web API framework | Built-in authorization, minimal APIs, first-party EF Core integration. Confirmed support for policy-based authorization via official docs. |
| **Entity Framework Core** | 10.0 | ORM | Mature ORM, migration support, change tracking. Part of .NET ecosystem. |
| **React** | 19.x | Frontend framework | Component-based, huge ecosystem, Vite-native. Standard for 2025. |
| **Vite** | 6.x | Build tool | Fast HMR, native ESM, optimized production builds. Replaces CRA for React apps. |
| **TypeScript** | 5.8+ | Type safety | Catches bugs at compile-time, better IDE support. Industry standard for React apps. |
| **SQL Server** | 2022+ | Database | Full-text search, JSON support, row-level security. Enterprise-grade, Azure-managed option available. |

### Database & ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **SQL Server** | 2022+ | Primary database | Row-level security for multi-tenant isolation. Full-text search for invoice/vendor lookups. JSON columns for flexible metadata. |
| **EF Core** | 10.0 | ORM | Change tracking, migrations, LINQ queries. First-party integration with ASP.NET Core. |

### Notification Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **MailKit** | 4.13.0+ | Email sending (SMTP) | Cross-platform, RFC-compliant SMTP/POP3/IMAP. **HIGH confidence** - verified on NuGet, 163M+ downloads, .NET 8.0 compatible. Replaces deprecated System.Net.Mail. |
| **Telegram.Bot** | 22.7.2+ | Telegram notifications | Most popular .NET Telegram client. **HIGH confidence** - verified on GitHub and NuGet, supports Bot API 9.2, targets .NET 6+ with .NET 8+ recommended. Active development (last updated Sep 2025). |
| **React Hot Toast** | 2.6.0+ | In-app notifications | Lightweight (<5kb), beautiful defaults, Promise API. **HIGH confidence** - verified on npm and official site, published 2025-08-15. |
| **SignalR** | (part of ASP.NET Core 10) | Real-time in-app notifications | WebSockets-based, auto-reconnect, server push. Native to ASP.NET Core, no external dependencies. |

### Authorization & Permissions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ASP.NET Core Authorization** | (built-in) | Policy-based permissions | Native policy system with requirements & handlers. **HIGH confidence** - verified in official Microsoft docs. Supports resource-based authorization. |
| **ASP.NET Core Identity** | (part of ASP.NET Core 10) | User/role management | Built-in user store, role management, claims. Extensible for custom permissions. |
| **Policy-based Authorization** | (built-in) | Granular permissions | Define policies like "CanApproveInvoices", "CanEditVendors". Use IAuthorizationRequirement handlers for complex logic. |

### Workflow Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Elsa Workflows** | 3.x | Workflow engine | .NET-native, visual designer, REST API. **LOW/MEDIUM confidence** - couldn't verify via official sources (404 on docs). Common in .NET ecosystem, but requires validation for .NET 10 compatibility. Consider n8n or Camunda if Elsa proves incompatible. |
| **HTTP Client Factory** | (built-in) | External workflow calls | Typed HttpClient, resilience policies. Use with Elsa or external workflow APIs. |

### Background Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **BackgroundService** | (built-in) | Long-running tasks | Base class for hosted services. Native to .NET, no external dependencies. Use for: scheduled invoice reminders, notification queue processing. |
| **Channel<T>** | (built-in) | In-memory queue | Producer/consumer pattern, async, thread-safe. Use for queuing notifications before background worker processes them. |
| **Polly** | 8.x+ | Resilience/retry policies | Retry, circuit-breaker, timeout for external calls (SMTP, Telegram, workflow API). **LOW confidence** - web search failed, but Polly is de facto standard in .NET ecosystem. Verify latest version for .NET 10. |

### Frontend Libraries

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **React Hot Toast** | 2.6.0+ | Toast notifications | Default choice for in-app notifications. Use `toast.success()`, `toast.error()` anywhere. |
| **React Router** | 7.x | Client-side routing | For multi-page navigation in SPA. Required if app has >1 view. |
| **TanStack Query** | 5.x | Server state management | For caching API responses, invalidation, retries. Use instead of Redux for server data. |
| **Zustand** | 5.x | Client state | For UI state (modals, filters, form drafts). Lighter than Redux, simpler API. |
| **React Hook Form** | 7.x | Form management | For invoice/vendor forms with validation. Re-render optimization, Zod integration. |
| **Zod** | 4.x | Runtime validation | Schema validation that syncs with TypeScript types. Use with React Hook Form. |

### Dev Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Swashbuckle** | OpenAPI/Swagger | Auto-generate API docs from controllers. Built into ASP.NET Core templates. |
| **Serilog** | Structured logging | Write to file, console, Seq. Better integration than ILogger. |
| **xUnit + FluentAssertions** | Testing | BDD-style assertions. Use for unit & integration tests. |

## Installation

### Backend (NuGet packages)

```bash
# Core (from .NET 10 template)
dotnet new webapi

# Email
dotnet add package MailKit --version 4.13.0

# Telegram
dotnet add package Telegram.Bot --version 22.7.2

# Resilience (verify version for .NET 10)
dotnet add package Polly

# Logging
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq

# Testing
dotnet add package xUnit
dotnet add package FluentAssertions
dotnet add package Microsoft.AspNetCore.Mvc.Testing
```

### Frontend (npm)

```bash
# Core
npm create vite@latest lefarma-frontend -- --template react-ts
cd lefarma-frontend

# Notifications
npm install react-hot-toast@2.6.0

# Routing
npm install react-router-dom@7

# State management
npm install @tanstack/react-query@5
npm install zustand@5

# Forms
npm install react-hook-form@7
npm install @hookform/resolvers
npm install zod@4

# Dev dependencies
npm install -D @types/react
npm install -Dtypescript
```

## Alternatives Considered

| Recommended | Alternative | Why Not Chosen |
|-------------|-------------|----------------|
| **MailKit** | FluentEmail | FluentEmail package not found on NuGet (404). May be deprecated or renamed. MailKit is more established (163M+ downloads). |
| **MailKit** | SendGrid/Mailgun SDKs | External SaaS dependency, cost at scale. MailKit works with any SMTP server (including self-hosted). |
| **Telegram.Bot** | Custom HTTP client | Telegram.Bot handles webhooks, rate limits, bot API parsing. Reinventing wheel = maintenance burden. |
| **React Hot Toast** | React Toastify | Both are good. React Hot Toast is lighter (<5kb), simpler API. Choose based on team preference. |
| **BackgroundService** | Hangfire | Hangfire has dashboard, persistent storage. Overkill for simple scheduled tasks. BackgroundService is built-in. |
| **Elsa Workflows** | n8n/Camunda | n8n = no .NET SDK, needs HTTP calls. Camunda = Java-first, heavy. Elsa = .NET-native, but verify .NET 10 support. |
| **ASP.NET Core Identity** | Auth0/Okta | External SaaS = cost, dependency. Built-in Identity = free, full control, same database. Use SaaS if multi-tenant SSO required. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **System.Net.Mail** | Deprecated since .NET 4.5, not cross-platform, no modern SMTP features. | **MailKit** - cross-platform, actively maintained, RFC-compliant. |
| **FluentEmail** | Package not found on NuGet (404), likely deprecated or moved. Unreliable for greenfield project. | **MailKit** directly with MimeKit for message building. |
| **Redux** | Overkill for most apps, complex boilerplate. | **Zustand** for client state, **TanStack Query** for server state. |
| **Create React App** | Deprecated, slow builds, no native ESM. | **Vite** - fast HMR, optimized production builds. |
| **JWT-only auth** | No built-in revocation, role management requires custom code. | **ASP.NET Core Identity** + claims-based auth for user/role lifecycle. |
| **Direct SMTP in controller** | Blocks request thread, no retry on failure, no queue. | **BackgroundService** with Channel<T> queue + MailKit. |
| **Elsa Workflows < 3.x** | Versions < 3 target .NET Framework/.NET 6. May not work with .NET 10. | **Elsa 3.x+** (verify) or **n8n** with HTTP client. |
| **SignalR for everything** | Overkill for simple notifications, adds complexity. | **React Hot Toast** for client-side toasts, **SignalR** only for real-time push from server. |

## Stack Patterns by Variant

**If self-hosting email server:**
- Use **MailKit** with SMTP config
- Because it's protocol-agnostic, works with Postfix, hMailServer, Exchange

**If using cloud email (SendGrid, Mailgun):**
- Still use **MailKit** for SMTP
- Because switching providers doesn't require code changes, only config

**If Telegram notifications fail:**
- Implement **Polly** retry with exponential backoff
- Because Telegram Bot API has rate limits, transient failures common

**If Elsa Workflows doesn't support .NET 10:**
- Use **n8n** (self-hosted) with HTTP client calls
- Because n8n has mature workflow designer, REST API, .NET 10 compatible via HttpClient

**If multi-tenant isolation required:**
- Use **Row-Level Security** in SQL Server
- Because tenant filtering happens at DB level, no query leakage risk

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| **MailKit 4.13.0** | .NET 8.0+, .NET Standard 2.0 | Verified on NuGet. .NET 10 support expected (forward compatible). |
| **Telegram.Bot 22.7.2** | .NET 6.0+, .NET Standard 2.0 | Verified on GitHub. .NET 8+ recommended. .NET 10 support expected. |
| **React Hot Toast 2.6.0** | React 18+ | Verified on npm. React 19 support unverified but likely compatible. |
| **ASP.NET Core 10** | .NET 10.0 | Native framework, no compatibility issues. |
| **Elsa Workflows 3.x** | .NET 8+ | **UNVERIFIED** - .NET 10 compatibility unknown. Test before committing. |

## Sources

### HIGH Confidence (verified via official sources)
- **Microsoft Learn - Policy-based authorization** — Confirmed ASP.NET Core policy-based auth with requirements/handlers. Verified 2025-03-20.
- **NuGet - MailKit 4.13.0** — Confirmed package exists, 163M+ downloads, .NET 8.0 compatible, last updated 2025-06-25.
- **NuGet - Telegram.Bot 22.7.2** — Confirmed package exists, supports Bot API 9.2, targets .NET 6+ with .NET 8+ recommended. Active development (updated Sep 2025).
- **GitHub - Telegram.Bot** — Confirmed .NET 6+ support, .NET 8 recommended. Extension packages available.
- **npm - react-hot-toast** — Confirmed v2.6.0 published 2025-08-15, <5kb, active maintenance.
- **npm - react-toastify** — Confirmed v11.0.5 published 2025-02-24, alternative to react-hot-toast.
- **react-hot-toast.com** — Confirmed Promise API, customizable, accessible.

### MEDIUM Confidence (web search failed, industry standard)
- **Polly** — De facto standard for .NET resilience. Web search failed, but widely used. Verify latest version for .NET 10.
- **Elsa Workflows 3.x** — Common in .NET ecosystem, but official docs returned 404. **LOW/MEDIUM confidence** — validate .NET 10 support before use.
- **.NET 10** — Version inferred from Microsoft's release cadence (.NET 9 released Nov 2024, .NET 10 expected Nov 2025). **MEDIUM confidence** — verify GA release date.

### LOW Confidence (unable to verify)
- **FluentEmail** — Package not found on NuGet (404). Likely deprecated or renamed. Avoid for greenfield project.

### Gaps Requiring Validation
1. **Elsa Workflows + .NET 10 compatibility** — Test Elsa 3.x on .NET 10 preview before committing.
2. **Polly latest version** — Confirm Polly v8+ supports .NET 10 (expected but unverified).
3. **React 19 + react-hot-toast** — Verify compatibility if upgrading to React 19.

---
*Stack research for: Sistema de Cuentas por Pagar con Notificaciones Multi-Canal*
*Researched: 2025-03-20*
