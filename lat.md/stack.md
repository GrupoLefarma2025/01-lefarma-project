# Stack

Stack tecnológico completo del proyecto Lefarma.

## Stack

Technology stack and dependencies overview.

## Backend (.NET 10)

Stack del backend .NET.

### Core

Frameworks y runtime principales.

- C# 10
- ASP.NET Core 10.0.2
- Entity Framework Core 10.0.2 (SqlServer)

### Key Dependencies

Dependencias críticas del backend.

- **ErrorOr 2.0.1** — Result pattern
- **FluentValidation 12.1.1** — DTO validation
- **Serilog.AspNetCore 10.0.0** — Structured logging
- **MailKit 4.15.1** — Email (SMTP)
- **Handlebars.Net 2.1.6** — Template engine
- **System.DirectoryServices.Protocols 9.0.0** — LDAP

### Testing

Herramientas de testing.

- xUnit 2.9.2
- Moq 4.20.72
- FluentAssertions 7.0.0

## Frontend (React 19)

Stack del frontend React.

### Core

Frameworks principales.

- TypeScript 5.9.3
- React 19.2.0
- Vite 7.3.1

### Key Dependencies

Dependencias críticas del frontend.

- **@tanstack/react-table 8.21.3** — Data tables
- **react-hook-form 7.71.1** — Forms
- **zod 4.3.6** — Schema validation
- **zustand 5.0.10** — Global state
- **jotai 2.18.0** — Atomic state
- **axios 1.13.4** — HTTP client
- **react-router-dom 7.13.0** — Routing
- **tailwindcss 3.4.19** — CSS
- **sonner 2.0.7** — Toasts
- **@dnd-kit/** — Drag and drop
- **reactflow 11.11.4** — Flow visualization
- **recharts 2.15.4** — Charts

### Testing

Herramientas de testing E2E.

- Playwright 1.58.2 (E2E)

## Build Tools

Herramientas de build y linting.

- ESLint 9.39.1
- Prettier 3.8.1
- TypeScript-ESLint 8.46.4

## Infrastructure

Infraestructura y servicios externos.

- **Database:** SQL Server
- **LDAP:** Active Directory (Asokam, Artricenter)
- **SMTP:** mail.grupolefarma.com.mx
- **File Storage:** Local filesystem (`wwwroot/media/`)

