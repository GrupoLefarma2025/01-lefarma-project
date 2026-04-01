# Architecture

Patrón: **Modular Monolith** con feature-based organization y vertical slices.

## Data Flow

Flujo de request a response a través de las capas.

```
Request → ValidationFilter → Controller → Service → Repository
                                                        ↓
                                              ApplicationDbContext (EF Core)
                                                        ↓
                                                   SQL Server
```

1. HTTP request hits controller action
2. `ValidationFilter` valida request DTOs con FluentValidation
3. Controller llama service (via interface)
4. Service valida lógica y llama repository (via interface)
5. Repository consulta `ApplicationDbContext`
6. Retorna `ErrorOr<T>` a través de las capas
7. `ResultExtensions.ToActionResult()` convierte ErrorOr a IActionResult
8. `ApiResponse<T>` envuelve respuesta JSON consistente
9. `WideEventLoggingMiddleware` loguea metadata rica por request

## Key Abstractions

Abstracciones clave del sistema.

### ErrorOr\<T>

Servicios retornan `ErrorOr<T>` — nunca tiran excepciones por lógica de negocio.

```csharp
return ErrorOr.Error(CommonErrors.NotFound("Usuario", userId.ToString()));
```

### ApiResponse\<T>

Wrapper consistente: `{ Success: bool, Message: string, Data?: T, Errors?: ErrorDetail[] }`

### Repository Pattern

`IRepository<T>` interface → scoped service → EF Core DbContext

## Entry Points

Puntos de entrada de la aplicación.

- `Program.cs` — API entry (DI, middleware, port 5134)
- `AppRoutes.tsx` — Frontend routing con auth guards

## Error Handling

Estrategia de manejo de errores.

- **Validation:** ValidationFilter + FluentValidation por request
- **Business logic:** ErrorOr<T> con errores tipados
- **API responses:** ResultExtensions.ToActionResult()
- **Frontend:** Axios interceptors (401 refresh, 403 permissions)
- **Logging:** WideEvents con contexto estructurado

## Cross-Cutting Concerns

Concerns transversales del sistema.

### Logging

Serilog + JSON file output (`logs/wide-events-.json`). WideEvent = un evento rico por request.

### Authentication

LDAP (Active Directory) via `System.DirectoryServices.Protocols`. JWT tokens (access + refresh).

Three-step login: username → domain/password → empresa/sucursal selection.

### Authorization

RBAC con permissions. Políticas: `RequireAdministrator`, `RequireManager`, `RequireFinance`.

`PermissionGuard` en frontend para route-level permissions.

// @lat: [[backend]]
// @lat: [[backend#Features]]
