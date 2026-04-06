# Backend

API REST en .NET 10 con arquitectura Modular Monolith — vertical slices por feature.

## Overview

Descripción general del backend. Arquitectura Modular Monolith con feature-based organization.

### Arquitectura

Capas concéntricas: Domain → Features → Infrastructure → Shared.

Ver [[backend-architecture#Architecture]] para detalles completos del patrón.

### Patrones

Patrones clave implementados en el backend.

### ErrorOr Pattern

Servicios retornan `ErrorOr<T>` — nunca tiran excepciones por lógica de negocio.

### ApiResponse Wrapper

Wrapper consistente: `{ Success: bool, Message: string, Data?: T, Errors?: ErrorDetail[] }`

---

## Domain

Entidades de negocio y contratos. Sin dependencias externas.

- `Domain/Entities/` — POCOs de negocio
- `Domain/Interfaces/` — Contratos de repositorio y servicio

## Features

Módulos autocontenidos — cada feature tiene su propio controller, service, DTOs, validator.

- `Features/Auth/` — Authentication
- `Features/Catalogos/` — Catálogos (Empresas, Sucursales, Proveedores, etc.)
- `Features/Config/` — Workflow engine
- `Features/Notifications/` — Sistema de notificaciones multi-canal
- `Features/OrdenesCompra/` — Órdenes de compra
- `Features/Profile/` — Perfil de usuario
- `Features/Help/` — Centro de ayuda
- `Features/Admin/` — Administración
- `Features/Logging/` — Error logging
- `Features/Archivos/` — File uploads

## Infrastructure

Acceso a datos y concerns externos.

- `Infrastructure/Data/` — DbContext, repositorios, configuraciones EF
- `Infrastructure/Filters/` — Filtros HTTP
- `Infrastructure/Middleware/` — Middleware (SSE, logging)
- `Infrastructure/Templates/` — Templates de email

## Services

Servicios de infraestructura.

- `Services/Identity/` — LDAP, JWT, token service

## Shared

Utilities cross-cutting.

- `Shared/Authorization/` — Políticas RBAC, permission handlers
- `Shared/Constants/` — Constantes de autorización
- `Shared/Errors/` — Errores comunes (CommonErrors, ArchivoErrors, etc.)
- `Shared/Extensions/` — Extensiones (ResultExtensions, EntityMappings, etc.)
- `Shared/Logging/` — WideEvent logging
- `Shared/Models/` — ApiResponse, ErrorDetail

## Entry Point

`Program.cs` — configuración de DI, middleware pipeline, Swagger, auth.
