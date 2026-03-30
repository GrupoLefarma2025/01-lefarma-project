# Technology Stack

**Analysis Date:** 2026-03-30

## Languages

**Primary:**
- C# (.NET 10) — Backend API, domain logic, data access
- TypeScript 5.9 (target: ES2020) — Frontend SPA, React components, services

**Secondary:**
- T-SQL — SQL Server stored procedures, views (consumed via EF Core)
- HTML/CSS — Email templates in `Views/Notifications/`
- Handlebars (.hbs) — Template rendering for notification emails

## Runtime

**Environment:**
- .NET 10 (ASP.NET Core) — Backend
- Node.js — Frontend build tooling
- Kestrel — .NET web server (configured with 10MB upload limit)

**Package Manager:**
- NuGet — Backend dependencies
- npm — Frontend dependencies
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- ASP.NET Core 10 — Backend Web API
- React 19.2 — Frontend UI library
- Vite 7.3 — Frontend build tool and dev server

**Testing (Backend):**
- xUnit 2.9 — Test runner
- FluentAssertions 7.0/8.8 — Assertion library
- Moq 4.20 — Mocking framework
- Microsoft.AspNetCore.Mvc.Testing 10.0 — Integration test host (WebApplicationFactory)
- Microsoft.EntityFrameworkCore.InMemory 10.0 — In-memory DB for tests
- coverlet.collector 6.0 — Code coverage

**Testing (Frontend):**
- Playwright 1.58 — E2E browser testing
- No unit test framework detected (no Jest/Vitest in package.json)

**Build/Dev:**
- MSBuild — .NET build system
- Vite 7.3 with `@vitejs/plugin-react` — Frontend bundling
- ESLint 9 + typescript-eslint 8.46 — JS/TS linting
- Prettier 3.8 — Code formatting (with `prettier-plugin-tailwindcss`)
- PostCSS 8.5 + Autoprefixer 10.4 — CSS processing

## Key Dependencies

**Backend — Critical:**
- `Microsoft.EntityFrameworkCore` 10.0.2 — ORM
- `Microsoft.EntityFrameworkCore.SqlServer` 10.0.2 — SQL Server provider
- `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.2 — JWT auth
- `FluentValidation` 12.1.1 — Request validation
- `ErrorOr` 2.0.1 — Error handling without exceptions
- `Serilog.AspNetCore` 10.0.0 — Structured logging
- `Swashbuckle.AspNetCore` 10.1.0 — Swagger/OpenAPI generation

**Backend — Infrastructure:**
- `System.DirectoryServices.Protocols` 9.0.0 — LDAP/Active Directory auth
- `MailKit` 4.15.1 — SMTP email sending
- `Handlebars.Net` 2.1.6 — Template engine for notifications

**Frontend — Critical:**
- `react` 19.2, `react-dom` 19.2 — UI framework
- `react-router-dom` 7.13 — Client-side routing
- `zustand` 5.0 — Primary state management
- `jotai` 2.18 — Secondary state management (atomic state)
- `axios` 1.13 — HTTP client
- `zod` 4.3 — Schema validation (forms, API types)
- `react-hook-form` 7.71 — Form state management
- `@hookform/resolvers` 5.2 — Zod integration for RHF

**Frontend — UI:**
- `tailwindcss` 3.4 + `tailwind-merge` 3.4 + `clsx` 2.1 — Styling
- `tailwindcss-animate` 1.0 — Animation utilities
- `@radix-ui/react-*` (20+ packages) — Headless UI primitives
- `class-variance-authority` 0.7 — Component variant system (shadcn/ui pattern)
- `cmdk` 1.1 — Command palette
- `sonner` 2.0 — Toast notifications
- `vaul` 1.1 — Drawer component
- `embla-carousel-react` 8.6 — Carousel component
- `react-resizable-panels` 4.6 — Resizable panel layout
- `input-otp` 1.4 — OTP input component

**Frontend — Data & Charts:**
- `@tanstack/react-table` 8.21 — Table component logic
- `recharts` 2.15 — Chart library
- `xlsx` 0.18 — Excel file parsing/generation
- `reactflow` 11.11 — Workflow/node graph visualization

**Frontend — Rich Text & Content:**
- `tinymce` 8.3 + `@tinymce/tinymce-react` 6.3 — Rich text editor
- `shiki` 4.0 + `@shikijs/transformers` 4.0 — Code syntax highlighting

**Frontend — Utilities:**
- `date-fns` 4.1 — Date formatting/manipulation
- `lucide-react` 0.563 — Icon library
- `react-icons` 5.5 — Additional icon library
- `lodash.groupby` 4.6, `lodash.throttle` 4.1 — Utility functions
- `@uidotdev/usehooks` 2.4 — Custom React hooks collection
- `@dnd-kit/core` 6.3 + `@dnd-kit/sortable` 10.0 — Drag-and-drop
- `@faker-js/faker` 10.3 — Test data generation
- `react-day-picker` 9.14 — Date picker
- `next-themes` 0.4 — Dark/light theme switching
- `tunnel-rat` 0.1 — Portal management

**Frontend — Fonts:**
- `@fontsource-variable/geist` 5.2 — Geist variable font
- `@fontsource-variable/geist-mono` 5.2 — Geist Mono variable font

## Configuration

**Backend Environment:**
- `appsettings.json` — Primary config (connection strings, JWT, email, LDAP, Telegram)
- `appsettings.Development.json` — Dev overrides (not committed if secrets present)
- Configuration bound to strongly-typed settings classes via `IOptions<T>`:
  - `JwtSettings` — JWT authentication
  - `EmailSettings` — SMTP and LDAP domain configs
  - `TelegramSettings` — Telegram bot integration
  - `ArchivosSettings` — File upload settings
  - `NotificationSettings` — Notification retry/delivery settings
  - `LdapOptions` — Active Directory domain configuration

**Frontend Environment:**
- `.env` — Base environment variables
- `.env.development` — Dev-specific variables
- `.env.production` — Production-specific variables
- `.env.example` — Template for required env vars
- Key variable: `VITE_API_URL` (defaults to `/api`)

**Build:**
- `tsconfig.json` — TypeScript config (strict mode, path alias `@/*` → `./src/*`)
- `tailwind.config.js` — TailwindCSS with shadcn/ui CSS variable theming
- `vite.config.ts` — Vite config with `@` path alias and `/api` proxy to `localhost:5134`
- `eslint.config.*` — ESLint flat config
- `.prettierrc` — Prettier formatting rules

## Platform Requirements

**Development:**
- .NET 10 SDK
- Node.js (version compatible with Vite 7.3)
- SQL Server (accessible at configured connection string)
- LDAP/Active Directory servers (for auth)
- SMTP server (for email notifications)

**Production:**
- .NET 10 runtime
- SQL Server database
- Reverse proxy or Kestrel direct
- Static file hosting for frontend build output

---

*Stack analysis: 2026-03-30*
