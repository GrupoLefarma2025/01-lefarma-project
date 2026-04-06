# Auth

Sistema de autenticación y autorización — LDAP (Active Directory) + JWT.

## Auth

Authentication (LDAP/JWT) and authorization (RBAC) overview.

## Active Directory

Descripción general del sistema de autenticación.

### Authentication Flow

Three-step login:
1. Username → validar existe en AD
2. Domain/password → autenticar via LDAP
3. Empresa/sucursal → seleccionar contexto

### Frontend

Componentes y servicios de autenticación en el frontend.

- `authStore.ts` — estado de auth (token, user, empresa, sucursal)
- `authService.ts` — login/logout API calls
- `PermissionGuard` — route-level permission checks

### Development

Master password `tt01tt` para bypass en desarrollo.

### Key Files

Servicios clave de autenticación.

- `ActiveDirectoryService.cs` — LDAP integration
- `TokenService.cs` — JWT generation
- `authStore.ts` — Frontend auth state

## Active Directory

Integración via `System.DirectoryServices.Protocols` (cross-platform LDAP).

**Domains configurados:**
- Asokam: `192.168.4.2:389`
- Artricenter: `192.168.1.7:389`

Base DN: `com.mx`. Timeout: 10s.

## JWT Tokens

**Access token:** 60 minutos de expiración.
**Refresh token:** 7 días de expiración.

Issuer/Audience configurados via `JwtSettings` en appsettings.json.

## Authorization

**RBAC** con roles y permissions.

**Políticas configuradas:**
- `RequireAdministrator`
- `RequireManager`
- `RequireFinance`
- `RequirePaymentProcessing`

Permission-based policies para acceso granular.

