# 02 — Mejoras Propuestas e Implementaciones Concretas

| Campo | Valor |
|---|---|
| **Autor** | developer (Agent Team — análisis de solo lectura) |
| **Fecha** | 2026-10-09 |
| **Fuentes** | `01-arquitectura.md` (hallazgos H1–H22, arquitecto), `03-riesgos-seguridad.md` (hallazgos F-01–F-20, reviewer), y verificación directa del código por este rol (los hallazgos propios se marcan como **[DP]**). |
| **Alcance** | lefarma.backend (.NET 10, Lefarma.API), lefarma.frontend (React 19 + Vite 7), lefarma.database, configuración y CI. |
| **Naturaleza** | SOLO PROPUESTAS. No se modificó código fuente; este informe es el único archivo escrito. No se transcriben secretos literales (se referencia su ubicación). |

## Resumen ejecutivo

El análisis combinado de arquitectura (H1–H22) y riesgos (F-01–F-20) muestra un producto funcional y moderno en su stack, con fortalezas reales (autorización dinámica por permisos, wide events, cliente HTTP único con refresh en cola, refresh tokens hasheados, SQL parametrizado), pero con **dos fallas críticas de autorización** —contraseña maestra commiteada (F-01) y 16 controladores sin ningún atributo de autorización ni política de respaldo (F-02)— y una **superficie amplia de secretos en git** (F-03/F-04/F-05).

Este informe propone **27 mejoras accionables sobre el stack actual** (no reescrituras), organizadas en tres bloques y cinco fases:

- **12 quick wins de seguridad** (fases 1–2): la mayoría son cambios de configuración o de pocas líneas en archivos ya identificados, con verificación inmediata.
- **8 quick wins de calidad, pruebas y rendimiento** (fases 3–4): gates de CI, tests de autorización, normalización de migraciones, health checks, code splitting del frontend y limpieza de dependencias.
- **7 mejoras estructurales** (fase 5): modularización del composition root, capa anticorrupción sobre el legacy Asokam, partición de god classes, adopción incremental de TanStack Query, observabilidad con OpenTelemetry, cookies httpOnly y simetría del frontend CxP.

Aportaciones propias de este rol, verificadas en código y no cubiertas por los otros informes: (1) **expiración de roles no aplicada en la caché de permisos** [DP-1], (2) **límites de upload contradictorios** entre FormOptions/Kestrel (10 MB) y los endpoints externos (50 MB) [DP-2], (3) **condición de carrera del SSE en reconexión** [DP-3], (4) **ausencia total de code splitting por ruta** en el frontend [DP-4].

El costo total estimado de las fases 1–4 es de 3 a 6 semanas-persona; la fase 5 es gradual y se paga con cada feature nueva.

**Convención de campos por propuesta:** Qué · Dónde (archivos) · Cómo (enfoque técnico y pasos verificables) · Impacto (Alto/Medio/Bajo) · Esfuerzo (S < 1 día, M 1–5 días, L > 1 semana) · Riesgo de implementarla · Orden sugerido (fase y posición).

## Propuestas

### Bloque A — Quick wins de seguridad

#### P-01 · Autorización deny-by-default con FallbackPolicy (resuelve F-02)
- **Qué:** exigir usuario autenticado en TODA la API por defecto; lo anónimo pasa a ser explícito.
- **Dónde:** `lefarma.backend/src/Lefarma.API/Program.cs` (AddAuthorization, líneas 386–391); los 16 controladores sin autorización listados en F-02 (`Features/Admin/AdminController.cs`, `Features/Archivos/Controllers/ArchivosController.cs`, `Features/Facturas/ComprobanteController.cs`, `Features/SystemConfig/SystemConfigController.cs`, `Features/Rh/SolicitudesPersonal/SolicitudPersonalController.cs`, etc.); permisos comentados en `Features/Auth/Usuarios/UsuariosController.cs:17`, `Features/Auth/Roles/RolesController.cs:15`, `Features/Config/Workflows/WorkflowsController.cs:17`.
- **Cómo:** (1) inventariar los 16 controladores y decidir por endpoint: `[Authorize]`, `[HasPermission("x")]` o `[AllowAnonymous]` intencional; (2) registrar `options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build()` en `AddAuthorization`; (3) **crítico:** añadir `.AllowAnonymous()` a `MapFallbackToFile("/index.html")` (Program.cs:618), porque la FallbackPolicy aplica a cualquier endpoint sin metadata y rompería la entrega de la SPA anónima (login); `/api/health` y `/api/version` ya lo tienen; (4) reactivar los `[HasPermission]` comentados; (5) los controladores "externos" ya llevan `[AllowAnonymous]` + API key (ver P-09) y siguen funcionando.
- **Verificación:** integration test que recorra todos los endpoints del catálogo Swagger y afirme que sin token responden 401/403 salvo la whitelist anónima explícita; smoke manual: `GET /api/admin/usuarios` sin token → 401; la SPA sigue cargando en `/login`.
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Medio (romper flujos anónimos legítimos; se mitiga con el inventario previo y la whitelist explícita). · **Orden:** Fase 1, posición 1.

#### P-02 · Aplicar expiración de roles en la caché de permisos [DP-1] (bug propio, complementa F-02)
- **Qué:** `UserPermissionService.LoadFromDbAsync` no filtra `UsuariosRoles.FechaExpiracion`: una asignación de rol expirada **sigue concediendo permisos** indefinidamente vía `PermissionHandler`. El login (`AuthService.GetUserRolesAndPermissionsAsync`, AuthService.cs:535) y el DevToken (DevTokenMiddleware.cs:62–67) SÍ la filtran — la autorización en runtime es más laxa que el token.
- **Dónde:** `lefarma.backend/src/Lefarma.API/Services/Identity/UserPermissionService.cs` (líneas 54–57).
- **Cómo:** añadir a la consulta de `UsuariosRoles` el mismo predicado que usa AuthService: `.Where(ur => ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow)`; opcionalmente unificar las 3 consultas en un solo round-trip. Extraer el predicado compartido a un helper para que login, DevToken y caché no vuelvan a divergir.
- **Verificación:** unit test: rol con `FechaExpiracion` pasada → `GetPermissionsAsync` no incluye sus permisos; test de consistencia login-vs-handler con el mismo fixture.
- **Impacto:** Alto · **Esfuerzo:** S · **Riesgo:** Bajo (solo quita permisos que ya deberían estar vencidos; invalidar caché tras el deploy). · **Orden:** Fase 1, posición 2.

#### P-03 · Eliminar la contraseña maestra (resuelve F-01)
- **Qué:** quitar el bypass de Active Directory (AD) que permite loguearse como cualquier usuario —creándolo si no existe— con un valor débil commiteado.
- **Dónde:** `Features/Auth/AuthService.cs` (líneas 140–173: comparación y bypass; 183–197: auto-creación del usuario); `Features/Facturas/ComprobanteController.cs:28-47` (header `X-Master-Password`); `appsettings.json:13` y `appsettings.Development.json:12` (valor).
- **Cómo:** (1) auditar primero los wide events `LoginStepTwo` y `AuditLog` para detectar usos reales en producción; (2) eliminar la rama `isMasterPassword` de `LoginStepTwoAsync` y el check de `ComprobanteController`; (3) si se necesita para pruebas locales, reencarnarlo como `DevToken` (solo Development, fuera de git, ver P-04) y nunca como contraseña aceptada en el flujo de login productivo; (4) si la auditoría revela uso productivo (p. ej. una integración), migrar esa integración al esquema API key por cliente (P-09) antes de eliminar.
- **Verificación:** test: login con la ex-master password y usuario válido → falla credenciales; grep del repo sin referencias a `MasterPassword`; revisar que la integración de ComprobanteController use API key.
- **Impacto:** Alto · **Esfuerzo:** S · **Riesgo:** Medio (si hay consumidores ocultos del header; se mitiga con la auditoría previa del paso 1). · **Orden:** Fase 1, posición 3.

#### P-04 · Externalizar y rotar TODOS los secretos (resuelve F-03, F-05, F-10, F-15, H18)
- **Qué:** sacar del repo las credenciales de las 3 bases de datos, la clave simétrica del JSON Web Token (JWT), Simple Mail Transfer Protocol (SMTP), la clave Advanced Encryption Standard (AES) de archivos, la API key de integraciones, el valor del DevToken, las credenciales SISCO, la passphrase del script SQL 033 y la API key de TinyMCE; rotarlas todas (darlas por comprometidas).
- **Dónde:** `lefarma.backend/src/Lefarma.API/appsettings.json` (líneas 2–5, 7–10, 12–16, 18, 28, 39–44, 75), `appsettings.Development.json` (equivalentes), `lefarma.frontend/.env*` (TinyMCE), `lefarma.database/033_sp_enviar_correo_python.sql` (líneas 20–21, 85, 115, 137), `AGENTS.md` (sección "Development Secrets").
- **Cómo:** (1) desarrollo: `dotnet user-secrets` (User Secrets) por desarrollador; (2) producción: variables de entorno o secret store del hospedaje (IIS/Windows → Azure Key Vault si aplica), y crear `appsettings.Production.json` SIN secretos (hoy no existe); (3) dejar en git solo `appsettings.example.json` con placeholders; (4) rotar: contraseñas SQL, `JwtSettings.SecretKey` (asumir que producción puede estar firmando con la clave del repo → cualquier lector del repo puede forjar tokens), SMTP, `ArchivosSettings.EncryptionKey` (plan de re-cifrado de archivos existentes), `Auth.ApiKey`, passphrase de 033 y contraseñas de `app.correo_cuentas`; (5) mover `DevToken` exclusivamente a `appsettings.Development.json`/user-secrets; (6) añadir escaneo de secretos al CI (gitleaks, ver P-13); (7) evaluar purga de historial git si el repo se comparte fuera del equipo; (8) el Stored Procedure (SP) de correo no debe devolver contraseñas en el resultset: que el runner Python reciba el secreto por configuración del servicio, no por consulta.
- **Verificación:** `git grep` de los valores rotados → 0 coincidencias; la app arranca en cada entorno leyendo secretos de su fuente nueva; gitleaks en CI pasa; smoke de login y de envío de correo tras la rotación.
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Medio (rotación descoordinada tumba integraciones; hacerlo por secreto con ventana de cambio y rollback). · **Orden:** Fase 1, posición 4.

#### P-05 · Endurecer configuración de red y transporte: CORS, Swagger, hosts, TLS (resuelve F-06, F-07, F-13)
- **Qué:** (a) CORS restringido a orígenes reales usando la lista `Cors:AllowedOrigins` que hoy existe pero nadie lee; (b) Swagger solo en desarrollo (o protegido); (c) `AllowedHosts` explícito; (d) cifrado de transporte a BD y SMTP.
- **Dónde:** `Program.cs` (CORS 439–447 y 481; Swagger 483–493), `appsettings.json` (98–104), `appsettings.Development.json`; connection strings (`Encrypt=false;TrustServerCertificate=true`) y `EmailSettings.AcceptInvalidCertificates=true` (appsettings.json:32).
- **Cómo:** (a) `policy.WithOrigins(Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()).AllowAnyHeader().AllowAnyMethod()` — la lista debe incluir los orígenes reales: en desarrollo `http://localhost:5173` (el proxy de Vite es redundante porque `VITE_API_URL` es absoluta, H13, así que las llamadas dev son cross-origin de verdad), en staging/prod los hosts del `FrontendBaseUrl`; (b) restaurar `if (app.Environment.IsDevelopment())` alrededor de UseSwagger/UseSwaggerUI; (c) fijar `AllowedHosts` a los hosts conocidos; (d) `Encrypt=true` con certificados válidos en los 3 SQL Server y `AcceptInvalidCertificates=false` fuera de desarrollo (coordinar con infraestructura la emisión de certificados).
- **Verificación:** preflight OPTIONS desde un origen no listado → rechazado; la SPA dev (5173→5174) sigue funcionando; `/swagger` en staging → 404; conexión SQL con Encrypt=true estable 24 h; envío de correo OK sin aceptar certificados inválidos.
- **Impacto:** Alto (CORS+Swagger) / Medio (TLS) · **Esfuerzo:** S (CORS/Swagger) + M (TLS, depende de certificados) · **Riesgo:** Medio (TLS puede romper conexiones si los servidores SQL no tienen certificado válido; CORS rompe orígenes no inventariados — enumerarlos antes desde los wide events, campo Origin/Referer). · **Orden:** Fase 2, posición 1.

#### P-06 · Manejador global de excepciones con contrato consistente (resuelve F-08)
- **Qué:** hoy no existe `UseExceptionHandler` ni `IExceptionHandler`: un 500 no controlado sale sin contrato (y en desarrollo con stack trace). El middleware de wide events registra y re-lanza la excepción.
- **Dónde:** `Program.cs` (pipeline 472–620), `Infrastructure/Middleware/WideEventLoggingMiddleware.cs` (catch que re-lanza), `Shared/Models/ApiResponse.cs`, `Infrastructure/Filters/ValidationFilter.cs`.
- **Cómo:** registrar un `IExceptionHandler` global (patrón estándar de .NET 8+) que: devuelva el mismo `ApiResponse<T>` que usa el resto de la API (`Success=false`, mensaje genérico, sin detalles internos), incluya el `TraceIdentifier` como correlation id en la respuesta, y deje el logging al wide event ya existente. Añadir `builder.Services.AddExceptionHandler<T>()` + `app.UseExceptionHandler()` al inicio del pipeline.
- **Verificación:** endpoint de prueba que lanza excepción → respuesta JSON con el contrato y correlation id; el wide event conserva el stack; Playwright/vitest del frontend sigue parseando errores sin cambios.
- **Impacto:** Medio · **Esfuerzo:** S · **Riesgo:** Bajo. · **Orden:** Fase 2, posición 2.

#### P-07 · Rate limiting en login y endpoints anónimos (resuelve F-11)
- **Qué:** limitar fuerza bruta contra `POST /api/auth/login-step-two` (cada intento hace un bind LDAP), el endpoint anónimo de recordatorios de workflow (reenvía notificaciones en cada llamada), la geocodificación y los endpoints externos con API key.
- **Dónde:** `Program.cs` (AddRateLimiter/UseRateLimiter, hoy inexistentes), `Features/Auth/AuthController.cs:64-88`, `Features/Config/Workflows/Notification/WorkflowReminderController.cs:22-39`, `Features/Viaticos/GeocodificarController.cs`, controladores externos.
- **Cómo:** usar el RateLimiter integrado de ASP.NET Core: política `fixed-window` por IP para anónimos (p. ej. login: 5 intentos/min por IP + contador por usuario con bloqueo progresivo tras N fallas LDAP), política `sliding-window` más holgada para autenticados, y `[EnableRateLimiting("externos")]` en los 4+2 controladores externos. Responder 429 con el contrato `ApiResponse`. El bloqueo progresivo de cuenta puede apoyarse en la tabla `app.Sesiones`/`AuditLog` ya existente.
- **Verificación:** test de carga simple (20 logins fallidos seguidos → 429/bloqueo); recordatorios: segunda llamada inmediata → 429; el flujo normal de login no se afecta.
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Bajo-Medio (usuarios detrás de Network Address Translation (NAT) comparten IP; empezar con límites holgados y afinar con los wide events). · **Orden:** Fase 2, posición 3.

#### P-08 · Endurecimiento JWT: vigencia corta, skew tolerante, fail-fast (resuelve F-09)
- **Qué:** access token de 20 h (1200 min) sin revocación server-side es una ventana de abuso enorme; `ClockSkew=Zero` provoca 401 por deriva de reloj; si `JwtSettings` falta, la app arranca sin esquema de autenticación y los `[Authorize]` fallan en runtime.
- **Dónde:** `Program.cs:330-368` (registro condicional y ClockSkew:346), `Services/Identity/TokenService.cs:197`, `appsettings.json:21` (1200 min), `appsettings.Development.json:20` (12000 min).
- **Cómo:** (1) `AccessTokenExpirationMinutes` → 15–30 en todos los entornos; el frontend YA tiene refresh rotativo con cola de peticiones 401 (`apiClient.ts:79-118`), así que el cambio es transparente para el usuario; (2) `ClockSkew = TimeSpan.FromSeconds(30–60)`; (3) fail-fast: si `JwtSettings.SecretKey` falta o es débil, lanzar en el arranque (`ValidateOnStart` / `builder.Services.AddOptions<JwtSettings>().Validate(...).ValidateOnStart()`) en vez de loguear un warning; (4) opcional: revocación por `jti`/`sesion_id` para cierre de sesión inmediato (ya se guardan en el token).
- **Verificación:** token de 20 h → 401 tras 15–30 min y refresh automático en la SPA sin parpadeo; app sin SecretKey no arranca; desviar el reloj del servidor 30 s no provoca 401.
- **Impacto:** Medio-Alto · **Esfuerzo:** S · **Riesgo:** Bajo (más tráfico de refresh; el interceptor ya lo maneja). · **Orden:** Fase 2, posición 4.

#### P-09 · Esquema ApiKey centralizado para integraciones externas (resuelve F-04, F-20)
- **Qué:** reemplazar la validación manual de `X-API-Key` duplicada en 4 controladores (clave estática commiteada, comparación no constante en tiempo, identidad tomada del header `X-User-Id` que envía el cliente) por un esquema de autenticación real.
- **Dónde:** `Features/Facturas/ComprobanteExternoController.cs:24-49`, `Features/Archivos/Controllers/ArchivoExternoController.cs:30-55`, `Features/OrdenesCompra/Firmas/OrdenCompraFirmaExternoController.cs:24+`, `Features/OrdenesCompra/Captura/OrdenCompraExternoController.cs:24+` (los `ValidateApiKey` copiados); `Program.cs` (AddAuthentication); nuevo `Infrastructure/Authentication/ApiKeyAuthenticationHandler.cs`.
- **Cómo:** (1) crear `AuthenticationHandler<ApiKeyOptions>` con esquema "ApiKey" que lea el header y compare con `CryptographicOperations.FixedTimeEquals`; registrarlo junto a JwtBearer (`AddAuthentication` multi-esquema + `[Authorize(AuthenticationSchemes="ApiKey")]` en los externos, eliminando `[AllowAnonymous]`); (2) claves POR CLIENTE (tabla `app.IntegracionesClientes` con hash de la clave, cliente, permisos/alcances y vigencia) en lugar de una clave global; (3) identidad de servicio explícita: claims `client_id` + un `IdUsuario` de servicio por integración, y aceptar `X-User-Id` solo como "on-behalf-of" auditado y limitado a usuarios válidos (nunca atribuir a ciegas al usuario 1, F-20a); (4) rate limiting del esquema (P-07).
- **Verificación:** test de contrato por endpoint externo: sin clave → 401, clave de otro cliente → 403, `X-User-Id` inexistente → rechazado; la auditoría registra `client_id` real; grep: 0 `ValidateApiKey` manuales.
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Medio (los sistemas externos consumidores deben recibir sus claves nuevas — coordinar ventana de migración con doble aceptación breve). · **Orden:** Fase 2, posición 5.

#### P-10 · Alinear límites de upload: FormOptions 10 MB vs endpoints externos 50 MB [DP-2]
- **Qué:** `Program.cs` fija `FormOptions.MultipartBodyLengthLimit = 10 MB` y Kestrel `MaxRequestBodySize = 10 MB` globales, pero `ComprobanteExternoController` (y el upload de Archivos, F-02) declaran `[RequestSizeLimit(50_000_000)]`. `RequestSizeLimit` solo sobrescribe el límite del servidor, NO el del lector multipart: un upload externo de >10 MB probablemente revienta con `InvalidDataException` → 500 sin contrato (sin P-06). Es un bug latente además de inconsistencia.
- **Dónde:** `Program.cs:461-470`, `Features/Facturas/ComprobanteExternoController.cs:53`, `Features/Archivos/Controllers/ArchivosController.cs` y `ArchivoExternoController.cs` (límites declarados).
- **Cómo:** (1) verificar el comportamiento real subiendo un archivo de 15 MB al endpoint externo en desarrollo; (2) añadir `[RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]` en las acciones que declaran 50 MB, o centralizar límites por política; (3) alinear `ArchivosSettings.TamanoMaximoMB` (10) con lo que cada endpoint promete; (4) tests de límite (10 MB ± 1, 50 MB ± 1).
- **Verificación:** upload externo de 20 MB → 200; upload interno de 20 MB → 400 con mensaje de negocio (no 500).
- **Impacto:** Medio · **Esfuerzo:** S · **Riesgo:** Bajo. · **Orden:** Fase 2, posición 6.

#### P-11 · Servir uploads privados por endpoints autorizados (resuelve F-14)
- **Qué:** `wwwroot/media/archivos` se sirve anónimo por static files en `/api/media/archivos` y `/media/archivos` (carátulas bancarias, adjuntos de órdenes, INE/firmas). El proyecto YA tiene el patrón correcto implementado para capturas de viáticos (guarda 404 + endpoint `[Authorize]`).
- **Dónde:** `Program.cs:542-565` (los dos UseStaticFiles de archivos), `Features/Archivos/` (controller y `ArchivoService`), `Infrastructure/Files/AesFileCipher.cs`, frontend: componentes que consumen esas URLs (p. ej. modal "Ver carátulas", `apiClient.ts:156-167`).
- **Cómo:** (1) nuevo endpoint `GET /api/archivos/media/{ruta}` con `[Authorize]` + `[HasPermission]` por dominio que transmita el archivo (File(...)) desde `BasePath`/`PrivatePath`; (2) reemplazar en el frontend las URLs estáticas por el endpoint autorizado (con el token del interceptor; para `<img>` usar blob URL o el ticket de un solo uso estilo `SseTicketService` que ya existe como patrón); (3) eliminar los UseStaticFiles de archivos (o dejarlos 404 como capturas durante la transición); (4) mantener `/api/media/help` público (es intencional).
- **Verificación:** `GET /api/media/archivos/<archivo conocido>` sin token → 404/401; la SPA muestra carátulas/adjuntos igual que antes; test Playwright del flujo de carátulas.
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Medio (todas las URLs legacy en correos/plantillas dejan de funcionar — inventariar consumidores antes, p. ej. notificaciones que enlacen archivos). · **Orden:** Fase 2, posición 7.

#### P-12 · Tokens de workflow externo: expiración, hash y un solo uso (resuelve F-12)
- **Qué:** los enlaces de aprobación externa (`/api/solicitudes-personal/externo/respuesta`, `/api/ordenes/envio-concentrado/respuesta`) usan un GUID no adivinable pero **sin expiración**, almacenado y comparado en claro, y la acción se atribuye al `IdUsuario` que diga el body.
- **Dónde:** `Features/Rh/SolicitudesPersonal/SolicitudPersonalController.cs:175-183`, `Features/Rh/SolicitudesPersonal/Firmas/SolicitudPersonalFirmasService.cs:468,575-640`, `Features/OrdenesCompra/Integraciones/EnvioConcentradoExternoController.cs:38-49`, `Features/OrdenesCompra/Firmas/OrdenCompraFirmasService.cs:301-306`; columna `TokenSeguridad` en las tablas de envíos.
- **Cómo:** (1) guardar el token hasheado (SHA-256, mismo helper `HashToken` de AuthService.cs:585-590); (2) añadir `FechaExpiracion` al envío (p. ej. 72 h, configurable) y rechazar respuestas fuera de ventana; (3) invalidar tras primer uso (el check de estado PENDIENTE ya existe — hacerlo transaccional); (4) el `IdUsuario` del body debe validarse contra los destinatarios del envío. Script SQL nuevo en `lefarma.database/` para las columnas (ver P-15).
- **Verificación:** test: token correcto fuera de ventana → rechazado; segundo uso → rechazado; destinatario incorrecto → rechazado; el flujo de aprobación por correo sigue funcionando dentro de la ventana.
- **Impacto:** Medio · **Esfuerzo:** M · **Riesgo:** Bajo (los enlaces viejos sin expiración caducan al migrar — comunicarlo). · **Orden:** Fase 2, posición 8.

### Bloque B — Quick wins de calidad, pruebas y rendimiento

#### P-13 · Gates de calidad y seguridad en CI (resuelve F-17 parcialmente)
- **Qué:** los workflows actuales solo buildean y publican; no corre ningún test, lint ni auditoría antes de un release. No existe workflow de Pull Request (PR).
- **Dónde:** `.github/workflows/release.yml`, `.github/workflows/staging-prerelease.yml`; nuevo `.github/workflows/ci.yml`.
- **Cómo:** (1) nuevo `ci.yml` en `pull_request` y `push` a main/staging: `dotnet build` + `dotnet test` (solución `lefarma.backend/01-lefarma-project.sln`), `npm run lint` + `npm run test` (vitest) en `lefarma.frontend`; (2) en los dos workflows de release, añadir antes del build: los mismos tests + `npm audit --audit-level=high` + `dotnet list package --vulnerable` + gitleaks (soporta la P-04); (3) fallar el release si algún gate falla.
- **Verificación:** PR con test roto → CI rojo; tag con secreto nuevo → gitleaks bloquea; release verde incluye los jobs nuevos.
- **Impacto:** Alto · **Esfuerzo:** S-M · **Riesgo:** Bajo. · **Orden:** Fase 3, posición 1 (puede iniciarse en paralelo a la Fase 2).

#### P-14 · Tests de autorización (matriz endpoint×permiso) y de los flujos de auth (resuelve F-17)
- **Qué:** las zonas de mayor riesgo (Auth, Admin, externos, Facturas) casi no tienen pruebas; los placeholders `UnitTest1.cs` no assertan nada.
- **Dónde:** `lefarma.backend/tests/Lefarma.IntegrationTests/` (nueva suite de autorización), `Lefarma.UnitTests/` (AuthService, TokenService, UserPermissionService — cubre P-02/P-03/P-08); `lefarma.frontend/tests/` (Playwright: login + una ruta protegida por app).
- **Cómo:** (1) test parametrizado que enumera endpoints vía `IActionDescriptorCollectionProvider` y afirma: todo endpoint exige autenticación salvo whitelist, y los `[HasPermission]` responden 403 con un usuario sin el permiso (WebApplicationFactory + EF InMemory hoy; idealmente Testcontainers SQL Server, ver P-23 nota); (2) unit tests de `AuthService` (login AD, refresh rotativo, logout, master-password-removida) y `TokenService`; (3) eliminar los `UnitTest1.cs` vacíos; (4) cablear `npm run test:e2e` en CI (P-13).
- **Verificación:** la suite corre en CI y falla si alguien quita un `[Authorize]` (regresión de F-02 imposible de reintroducir).
- **Impacto:** Alto · **Esfuerzo:** M · **Riesgo:** Bajo. · **Orden:** Fase 3, posición 2.

#### P-15 · Normalizar migraciones SQL y hacer obligatorio el runner DbUp (resuelve F-16, H17)
- **Qué:** 66 scripts con números duplicados (tres `027_`, dos `029_`, `031` duplicado raíz/legacy, dos `0013_` en educacion-medica, dos `0003_` con el mismo timestamp en viaticos), huecos, un `9999_drop-schema-reset` destructivo conviviendo con los normales y un `sync_lefarmadev_a_lefarma.sql` suelto en la raíz del repo. Ya existe runner con journal (`Lefarma.Migrations`, DbUp, `app.SchemaVersions`) pero su uso no es obligatorio ni está documentado en AGENTS.md.
- **Dónde:** `lefarma.database/**`, `sync_lefarmadev_a_lefarma.sql` (raíz), `lefarma.backend/src/Lefarma.Migrations/Program.cs`, `AGENTS.md` (sección Database), `deploy/` y `multiappcli.ps1` (integración del runner en el despliegue).
- **Cómo:** (1) documentar en AGENTS.md que TODA aplicación de esquema pasa por `lefarma-migrations status/apply` (el journal impide dobles aplicaciones y desorden); (2) convención única para scripts nuevos: `<NNNN>_<yyyymmdd-hhmm>_<app>_<descripcion>.sql` con prefijo monotónico por carpeta de app, y validación automática (script de CI que detecte prefijos duplicados); (3) mover `9999_drop-schema-reset` a una carpeta `tools/` fuera del ruteo del runner (fail-closed) y `sync_*.sql` a `lefarma.database/tools/`; (4) no renumerar los ya aplicados (el journal los fija); (5) añadir al runner un comando `verify` que compare el journal contra los scripts en disco por entorno.
- **Verificación:** `lefarma-migrations status all` sin pendientes inesperados; CI rechaza un script nuevo con prefijo duplicado; el drop destructivo ya no aparece en `GetScriptsToExecute`.
- **Impacto:** Medio-Alto · **Esfuerzo:** M · **Riesgo:** Medio (tocar convenciones con 66 scripts vivos; NO renumerar historia, solo normalizar lo nuevo). · **Orden:** Fase 3, posición 3.

#### P-16 · Health checks reales con dependencias
- **Qué:** `/api/health` solo devuelve `{status:"ok"}` sin comprobar nada: no sirve para monitoreo ni para detectar BD caída.
- **Dónde:** `Program.cs:603-604`; nuevo registro con `AddHealthChecks`.
- **Cómo:** `builder.Services.AddHealthChecks()` + checks de las 3 bases (paquete `AspNetCore.HealthChecks.SqlServer` o un `IHealthCheck` propio con `SELECT 1` por DbContext, evitando la dependencia externa si se prefiere); mapear `/api/health/live` (proceso vivo, anónimo) y `/api/health/ready` (BD + SMTP configurable) con `[AllowAnonymous]` explícito (compatible con P-01); conservar `/api/health` como alias de live. Respuesta con el detalle por check (útil para el deploy en IIS/monitoring).
- **Verificación:** tumbar el servicio SQL de Asistencias → `ready` degrada a Unhealthy sin tumbar la API; `live` sigue ok.
- **Impacto:** Medio · **Esfuerzo:** S · **Riesgo:** Bajo (cuidado: ready con la BD de Asistencias —que es un servidor distinto, 192.168.1.5— puede marcar unhealthy por red; hacerlo configurable por dependencia). · **Orden:** Fase 3, posición 4.

#### P-17 · Code splitting por ruta en el frontend [DP-4]
- **Qué:** no hay `React.lazy` en ninguna ruta (solo 3 usos puntuales para mapas): cada app carga TODAS sus páginas en el bundle inicial, incluidas `AutorizacionesOC.tsx` (3238 líneas), `CrearOrdenCompra.tsx` (2539) y `DemoComponents.tsx` (1194, página de demo incluida en el bundle productivo de CxP).
- **Dónde:** `lefarma.frontend/src/apps/cxp/CxpRoutes.tsx` (imports eager líneas 10–43), `apps/rh/RhRoutes.tsx`, `apps/educacion-medica/EducacionMedicaRoutes.tsx`, `apps/viaticos/ViaticosRoutes.tsx`, `apps/baseapp/BaseAppRoutes.tsx`, `shared/router/createAppRoutes.tsx`.
- **Cómo:** (1) convertir los imports de página a `const X = lazy(() => import('@/pages/...'))` con `<Suspense fallback={<PageLoader/>}>` — la fábrica `createAppRoutes` es el lugar ideal para envolver una vez y aplicar a las 4 apps; (2) excluir `DemoComponents` y `Roadmap` del build productivo (ruta solo en desarrollo o eliminar); (3) el `manualChunks` de `vite.config.ts` ya separa shiki/radix/react-vendor: verificar con `npx vite-bundle-visualizer` antes/después; (4) preloading suave (`<link rel="modulepreload">` o prefetch al hover del menú) para no degradar la percepción.
- **Verificación:** `npm run build` → reporte de chunks: el chunk inicial de cada app baja drásticamente (objetivo: >50% menos KB iniciales en CxP); navegación entre páginas sin flicker; smoke tests de rutas (`src/test/*routes*.test.tsx`) siguen pasando.
- **Impacto:** Alto (experiencia en red interna/VPN y equipos modestos) · **Esfuerzo:** M · **Riesgo:** Bajo-Medio (Suspense mal colocado puede romper guards de auth — cubrir con los tests de rutas existentes). · **Orden:** Fase 4, posición 1.

#### P-18 · Limpieza de dependencias y del composition root (resuelve H14, H15 parcialmente)
- **Qué:** (a) npm: `@faker-js/faker` en dependencies de producción, `@types/react-router-dom@5` obsoleto para react-router 7, dos librerías de toasts (sonner + react-hot-toast), dos de iconos (lucide-react + react-icons), TRES stacks de exportación PDF (jspdf+autotable, pdfmake, html2pdf+html-to-pdfmake+html2canvas), `reactflow@11` deprecado, `jotai` usado solo por 2 componentes kibo-ui; (b) backend: `Microsoft.EntityFrameworkCore.Tools` referenciado sin usar migrations (habilita `dotnet ef` accidentalmente, pitfall #4 de AGENTS.md); (c) `Program.cs`: bloques comentados (370–383), indentación inconsistente (242–244, 293–295) y guarda inline de capturas (502–513) que debería ser middleware nombrado testeable.
- **Dónde:** `lefarma.frontend/package.json`, `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj`, `Program.cs`.
- **Cómo:** (1) mover faker a devDependencies y quitar @types obsoletos; (2) estandarizar toasts en sonner (ya lo usa authStore) e iconos en lucide-react, migrando los pocos usos restantes (grep por import); (3) elegir UN stack PDF (sugerido: jspdf+autotable, el más mantenido) y migrar los 2 restantes gradualmente — no bloqueante; (4) planear migración reactflow → @xyflow/react (editor de workflows, tocar con tests); (5) quitar Jotai si se reemplazan los 2 componentes kibo-ui, o documentar su uso acotado; (6) backend: remover EFCore.Tools, borrar código comentado muerto, extraer la guarda de capturas a `Infrastructure/Middleware/CapturasGuardMiddleware.cs`.
- **Verificación:** `npm run build` y `npm run lint` verdes; `dotnet build` sin Tools; bundle final menor; grep 0 `react-hot-toast`/`react-icons` (si se completa la migración).
- **Impacto:** Medio · **Esfuerzo:** S (items 1,2,6) a M (3,4,5) · **Riesgo:** Bajo (los PDF/reactflow son M con riesgo Medio — hacerlos por separado). · **Orden:** Fase 4, posición 2.

#### P-19 · Corregir carrera de reconexión en SSE [DP-3]
- **Qué:** `SseService` (Singleton) guarda UNA `HttpResponse` por userId en un `ConcurrentDictionary`. Al reconectar (segunda pestaña o corte de red), la entrada se sobrescribe; cuando la conexión VIEJA termina, su `finally` llama `UnregisterConnection(userId)` y **elimina del diccionario la conexión NUEVA**: el usuario deja de recibir notificaciones en tiempo real hasta que vuelva a reconectar.
- **Dónde:** `Features/Auth/SseService.cs` (RegisterConnectionAsync/UnregisterConnection, líneas ~22–56), `Features/Auth/SseTicketService.cs`, cliente `lefarma.frontend/src/services/sseService.ts`.
- **Cómo:** (1) clavear por id de conexión ( GUID por conexión o ticket del `SseTicketService`) y guardar `{userId, connectionId, response}`; (2) en el `finally`, compare-and-remove: solo quitar si la entrada sigue siendo LA MISMA conexión; (3) al registrar una conexión nueva para el mismo usuario, cerrar deliberadamente la anterior (completar la respuesta) o mantener múltiples suscriptores por usuario (lista), según el producto; (4) documentar la restricción single-instance (diccionario en memoria): si se escala a varias instancias, backplane con Redis pub/sub — vincular con P-25.
- **Verificación:** test de integración: conectar, reconectar con el mismo userId, cerrar la primera → la segunda sigue recibiendo eventos; manual: dos pestañas del mismo usuario reciben notificaciones.
- **Impacto:** Medio · **Esfuerzo:** S-M · **Riesgo:** Bajo. · **Orden:** Fase 4, posición 3.

#### P-20 · Actualizar AGENTS.md, limpiar la raíz del repo y reconciliar versionado (resuelve H16, H20, H1)
- **Qué:** AGENTS.md apunta a archivos que no existen (`src/routes/AppRoutes.tsx`, `init.ps1`, seeder comentado), afirma que Playwright no tiene scripts (sí los tiene: `test:e2e`, `test:e2e:login`), no menciona el runner `Lefarma.Migrations` ni `multiappcli.ps1`; la raíz acumula artefactos (`nul`, `d.txt`, `_test_output.txt`, `odd/`, `pruebas de gastos/`, `sync_lefarmadev_a_lefarma.sql`); `VERSION=1.3.0` vs `VERSION-STAGING=1.1.2-rc.3` viola la regla de publicación vigente (staging debe llevar la base nueva con `-rc.N`).
- **Dónde:** `AGENTS.md`, raíz del repo, `VERSION-STAGING`.
- **Cómo:** (1) reescribir las secciones derivadas: rutas reales (`BaseAppRoutes.tsx` + `apps/*/[X]Routes.tsx` + `shared/router/createAppRoutes.tsx`), arranque con `multiappcli.ps1`, tests frontend cableados, runner DbUp como única vía de esquema (P-15); (2) borrar/mover los artefactos sueltos a `lefarma.docs/` o `.gitignore` (el archivo `nul` en Windows requiere \\.\ prefix para borrarse); (3) el bump de `VERSION-STAGING` a la base 1.3.0 **requiere decisión del usuario** (la regla de AGENTS.md prohíbe tocar VERSION sin petición explícita de publicar) — dejarlo señalado, no ejecutarlo.
- **Verificación:** un agente nuevo siguiendo AGENTS.md no encuentra rutas muertas (revisión cruzada con glob); `git status` de la raíz limpio.
- **Impacto:** Medio (velocidad y seguridad de agentes/devs) · **Esfuerzo:** S · **Riesgo:** Bajo. · **Orden:** Fase 4, posición 4.

### Bloque C — Mejoras estructurales

#### P-21 · Modularizar el composition root (resuelve H3)
- **Qué:** `Program.cs` registra ~150 servicios manualmente en 624 líneas; cada feature nueva lo edita (colisiones y deriva aseguradas).
- **Dónde:** `Program.cs`; nuevos `Features/<Dominio>/DependencyInjection.cs` por cada uno de los 17 dominios; opción: paquete Scrutor para scanning.
- **Cómo:** (1) patrón ya existente en el repo: `AddActiveDirectoryServices`/`AddJwtTokenServices` (`Services/Identity/ServiceCollectionExtensions.cs`) — extenderlo: un `public static IServiceCollection AddXxx(this IServiceCollection, IConfiguration)` por feature (AddCatalogos, AddWorkflows, AddRh, AddEducacionMedica, AddViaticos, AddNotifications, AddAuth...); (2) Program.cs queda en <150 líneas: builder + lista de AddXxx + pipeline; (3) alternativao complemento: Scrutor `Scan(s => s.FromAssemblyOf<Program>().AddClasses().AsImplementedInterfaces())` para los 44 repositorios — decisión: scanning total (menos código, más "magia") vs extensiones explícitas (más trazable); sugerido: extensiones explícitas primero, evaluar scanning después; (4) mover también el pipeline de middleware a `Infrastructure/PipelineExtensions.cs`.
- **Verificación:** `dotnet build` + la app arranca con exactamente los mismos servicios (test que compara el registro antes/después vía `IServiceCollection` snapshot); CI verde.
- **Impacto:** Medio · **Esfuerzo:** M · **Riesgo:** Bajo-Medio (refactor mecánico pero grande; hacerlo por dominio en PRs pequeños, sin cambiar lifetimes). · **Orden:** Fase 5, posición 1.

#### P-22 · Capa anticorrupción sobre el legacy Asokam (resuelve H5)
- **Qué:** 89 sitios usan `AsokamDbContext` directamente, incluido TODO el flujo de identidad/permisos; el legacy no es reemplazable ni testeable sin tocar 34+ archivos.
- **Dónde:** nuevo `Domain/Interfaces/Identity/` (`IUsuarioDirectory`, `IPermissionStore`, `ISessionStore`), `Infrastructure/Data/Asokam/` (adaptadores); consumidores iniciales: `Features/Auth/AuthService.cs`, `Services/Identity/UserPermissionService.cs`, `TokenService.cs`, `DevTokenMiddleware.cs`, `Features/Auth/Usuarios/`, `Features/Auth/Roles/`.
- **Cómo:** por capas y sin big-bang: (1) definir interfaces propias del dominio con modelos nuestros (no entidades legacy); (2) implementar adaptadores Asokam de las interfaces de identidad (login, permisos, sesiones, refresh tokens, catálogo de usuarios/roles); (3) migrar los consumidores de identidad primero (los 6 archivos de arriba), luego catálogos, dejando `EnviosController` y compañía para el final; (4) regla de equipo: código nuevo NO referencia `AsokamDbContext` (enforcerable con un test de arquitectura que escanee referencias — NetArchTest o grep en CI); (5) esto además habilita tests de auth sin la BD legacy (P-14 mejora).
- **Verificación:** test de arquitectura: 0 referencias nuevas a AsokamDbContext fuera de `Infrastructure/Data/Asokam/`; los tests de auth corren contra adaptadores mockeados.
- **Impacto:** Alto (deuda estructural principal del backend) · **Esfuerzo:** L · **Riesgo:** Medio (migración incremental con cobertura de tests ANTES de mover cada consumidor). · **Orden:** Fase 5, posición 2 (después de P-14).

#### P-23 · Particionar god classes (backend y frontend)
- **Qué:** archivos que concentran demasiado: backend `WorkflowService.cs` (2290 líneas), `SolicitudPersonalService.cs` (1357), `ProveedorService.cs` (1286, ya tiene el patrón partial con `ProveedorService.BulkUpload.cs`); frontend `AutorizacionesOC.tsx` (3238), `CrearOrdenCompra.tsx` (2539), `WorkflowDiagram.tsx` (1875), `ProveedoresList.tsx` (1819).
- **Dónde:** los archivos listados (backend `Features/Config/Workflows/`, `Features/Rh/SolicitudesPersonal/`, `Features/Catalogos/Proveedores/`; frontend `src/pages/ordenes/`, `src/pages/workflows/`, `src/pages/catalogos/generales/Proveedores/`).
- **Cómo:** (1) backend: extender el patrón partial ya usado en ProveedorService, o mejor, extraer servicios por operación/use-case (WorkflowQueryService ya existe como ejemplo de segregación lectura/escritura) — empezar por WorkflowService: separar ejecución de acciones, condiciones, bitácora y notificaciones; (2) frontend: extraer de AutorizacionesOC/CrearOrdenCompra los bloques repetidos (tablas de partidas, diálogos de firma, selectores de catálogo) a `components/ordenes/` y la lógica de datos a hooks (`useAutorizacionesOC`, etc.) — el patrón ya existe en viáticos (componentes + hooks por página, con tests); (3) regla práctica: ningún archivo nuevo >600 líneas sin justificación; (4) tocar UN archivo por PR con tests verdes antes/después.
- **Verificación:** tests existentes verdes; métrica de líneas máximas baja; diff reviewable por PR.
- **Impacto:** Medio (mantenibilidad, velocidad de feature nuevo, menos colisiones de merge) · **Esfuerzo:** L (acumulativo) · **Riesgo:** Medio (regresiones en flujos críticos de aprobación — hacerlo después de P-14/P-17 que aportan red de tests). · **Orden:** Fase 5, posición 3.

#### P-24 · TanStack Query incremental + estándar de estado (resuelve H12 parcialmente)
- **Qué:** no hay capa de estado de servidor: cada hook/componente llama axios a mano (useSolicitudes, useWorkflowCatalogs, etc.) sin caché, dedupe ni revalidación; el estado global mezcla Zustand (dominante) y Jotai (marginal, 2 componentes kibo-ui).
- **Dónde:** `lefarma.frontend/package.json` (añadir `@tanstack/react-query`), `src/shared/api/` (query client + defaults), hooks de datos existentes como primeros migrantes; `src/components/kibo-ui/` (decidir Jotai).
- **Cómo:** (1) instalar React Query con un `QueryClient` en el shell (`BaseAppRoutes`/`App.tsx`) y staleTime sensible para catálogos (5–15 min) — los catálogos son el caso perfecto: datos casi estáticos que hoy se re-descargan por pantalla; (2) migrar gradualmente: primero hooks de catálogos (`useWorkflowCatalogs`, catálogos generales), luego listas con filtros/paginación (TanStack Table + query params en la key); (3) NO migrar auth (el authStore Zustand funciona y tiene tests); (4) documentar la regla en AGENTS.md: "estado de servidor → React Query; estado de UI/sesión → Zustand; Jotai no se usa para código nuevo"; (5) invalidación tras mutaciones reemplaza refrescos manuales.
- **Verificación:** pantallas de catálogo con navegación ida/vuelta no re-descargan (pestaña Network); bundle añade ~13 KB gzip (aceptable); tests de hooks existentes pasan.
- **Impacto:** Medio-Alto (rendimiento percibido y menos código de fetch) · **Esfuerzo:** L (incremental; el setup inicial es S) · **Riesgo:** Bajo (adopción por isla, convive con el código actual). · **Orden:** Fase 5, posición 4.

#### P-25 · Observabilidad: OpenTelemetry + correlación (extiende H8)
- **Qué:** los wide events de Serilog dan buen logging por request, pero no hay métricas ni trazas distribuidas: imposible ver p95 de latencia por endpoint, uso de pool de conexiones, o seguir un flujo frontend→API→SQL→SISCO.
- **Dónde:** `Program.cs` (registro), `Lefarma.API.csproj` (paquetes `OpenTelemetry.Extensions.Hosting`, `.AspNetCore`, `.HttpClient`, `.Instrumentation.SqlClient`), exportador: consola/OTLP según infraestructura disponible.
- **Cómo:** (1) `AddOpenTelemetry().WithTraces(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddSqlServerInstrumentation()).WithMetrics(m => ...)`; (2) propagar `traceparent` desde el frontend (axios interceptor que inyecta el header si existe `window.__traceId` por navegación) para correlacionar usuario→request→SQL; (3) enriquecer el wide event con el TraceId de OpenTelemetry (ya hay campo TraceId en WideEvent); (4) si no hay colector, empezar con export a archivo OTLP o consola en staging — el valor inmediato es el trace SQL por request.
- **Verificación:** una petición a `/api/ordenes-compra` produce un span tree ASP.NET→SQL con la misma id en el wide event; dashboard básico de p95 por endpoint.
- **Impacto:** Medio · **Esfuerzo:** M · **Riesgo:** Bajo (overhead medible pero pequeño; cardinalidad de métricas controlada). · **Orden:** Fase 5, posición 5.

#### P-26 · Refresh token en cookie httpOnly (evaluación estructural anti-XSS, extiende F-15)
- **Qué:** access + refresh tokens viven en `localStorage`: cualquier Cross-Site Scripting (XSS) los exfiltra y el refresh (7 días) da acceso persistente. DOMPurify mitiga parcialmente, y el access token se acortará con P-08, pero el refresh sigue expuesto.
- **Dónde:** `Features/Auth/AuthController.cs` (set-cookie en login/refresh), `Program.cs` (CORS con credenciales para el origen dev), `lefarma.frontend/src/shared/auth/authService.ts:40-57` (dejar de persistir refresh), `apiClient.ts` (withCredentials), nueva protección Cross-Site Request Forgery (CSRF).
- **Cómo:** migración en dos pasos: (1) refresh token en cookie httpOnly+Secure+SameSite=Lax con ruta `/api/auth/refresh` (el navegador solo la envía ahí); el access token queda en memoria (no en localStorage) con re-hidratación silenciosa al cargar la SPA vía refresh; (2) protección CSRF para el endpoint de refresh (double-submit cookie o token de sincronización) ya que la cookie viaja sola; (3) el logout revoca server-side (ya lo hace). Coste: CORS dev con credenciales (origen explícito, ya forzado por P-05) y cambios en los tests de auth.
- **Verificación:** XSS simulado (console.log(document.cookie + localStorage)) no alcanza el refresh; login/refresh/logout fluyen en Playwright;SameSite no rompe el embedding si existe (verificar PathBase /CxP y proxies).
- **Impacto:** Medio-Alto · **Esfuerzo:** L · **Riesgo:** Alto para su tamaño (toca auth de punta a punta; hacerlo SOLO después de P-01..P-08 con suite de auth del P-14 verde). · **Orden:** Fase 5, posición 6.

#### P-27 · Simetría del frontend: migrar CxP a apps/cxp (resuelve H11)
- **Qué:** rh/viaticos/educacion-medica son autocontenidas (components/pages/services/types bajo `apps/`), pero CxP vive en el árbol compartido `src/pages/` + `src/services/`: no se puede extraer, lazy-loadear por app ni razonar como módulo; además arrastra DemoComponents/Roadmap al bundle.
- **Dónde:** `src/pages/{admin,auth,catalogos,configuracion,help,ordenes,workflows}` y `src/services/*` → `src/apps/cxp/`; `src/apps/cxp/CxpRoutes.tsx` (imports).
- **Cómo:** (1) mover por dominio en PRs mecánicos (git mv conserva historial): primero `ordenes` y `workflows` (los más grandes), luego catálogos/admin; (2) lo genuinamente compartido (auth, baseapp, ui/) se queda en `src/shared`/`src/components/ui`; (3) al terminar, el code splitting por subárbol (P-17) puede llegar a "cada app es un chunk" con `manualChunks` por carpeta; (4) alinear con la decisión de negocio: si CxP sigue siendo la app principal, la migración es cosmética — validar prioridad con el usuario antes de invertir.
- **Verificación:** `npm run build` verde tras cada movimiento; tests de rutas pasan; grep 0 imports `@/pages/` desde apps/cxp al terminar.
- **Impacto:** Medio (mantenibilidad; habilita bundles por app) · **Esfuerzo:** L (mecánico pero extenso) · **Riesgo:** Bajo-Medio (muchos imports; hacerlo con el alias `@/` y PRs pequeños por dominio). · **Orden:** Fase 5, posición 7 (opcional, tras P-17).

## Prioridades

Roadmap sugerido (top 5). Las fases 2 y 3 pueden solaparse; cada fase termina con su verificación en CI antes de pasar a la siguiente.

| # | Iniciativa | Propuestas | Ventana | Resultado esperado |
|---|---|---|---|---|
| **1** | **Emergencia de autorización y secretos** | P-01, P-02, P-03, P-04 | Inmediata (1–3 días) | Desaparecen las dos vías críticas de toma de control (master password y endpoints anónimos), se corrige la expiración de roles y ningún secreto vivo está en git. Es lo único que NO debería esperar. |
| **2** | **Endurecimiento de la superficie expuesta** | P-05 → P-12 | 1–2 semanas | CORS/Swagger/hosts cerrados, 500 con contrato, rate limiting en login y anónimos, JWT corto y tolerante a reloj, integraciones externas con API key por cliente, uploads con límites coherentes y servidos bajo autorización, tokens de workflow con caducidad. |
| **3** | **Blindaje anti-regresión (CI, tests, datos)** | P-13, P-14, P-15, P-16 | 1–2 semanas (paralelizable con 2) | Imposible volver a introducir F-02/F-17: matriz de autorización testeada, gates de tests/lint/secretos/dependencias en cada PR y release, migraciones SQL normalizadas vía runner obligatorio, health checks útiles para monitoreo. |
| **4** | **Rendimiento frontend y DX** | P-17, P-18, P-19, P-20 | 2–4 semanas | Carga inicial por app reducida (>50% KB), bundle sin demos ni duplicados, SSE sin pérdida de notificaciones al reconectar, documentación (AGENTS.md) que refleja la realidad del repo. |
| **5** | **Deuda estructural (gradual)** | P-21 → P-27 | 1–3 meses, incremental | Program.cs mantenible, identidad desacoplada del legacy Asokam con tests, god classes partidas con red de tests previa, estado de servidor con React Query, trazas/métricas OpenTelemetry, refresh token a prueba de XSS y CxP simétrica. |

Criterio de ordenación aplicado: (1) primero lo explotable remotamente sin credenciales (F-01/F-02/[DP-1]); (2) después lo que reduce superficie y mejora el contrato de la API; (3) luego lo que evita que todo lo anterior regrese (CI/tests); (4) rendimiento y experiencia de desarrollo; (5) deuda estructural, que solo es segura de tocar cuando las fases 1–3 dieron red de cobertura. Los esfuerzos S de la fase 1–2 (P-02, P-03, P-05, P-06, P-08, P-10) pueden agruparse en un único sprint de "hardening" de una semana.

## Glosario

- **AD / LDAP:** Active Directory / Lightweight Directory Access Protocol — autenticación corporativa multi-dominio.
- **AES:** Advanced Encryption Standard — cifrado simétrico de archivos privados (`AesFileCipher`).
- **API key:** clave estática de integración enviada por header (`X-API-Key`).
- **CI:** Continuous Integration — pipelines de GitHub Actions.
- **CORS:** Cross-Origin Resource Sharing — política de orígenes del navegador.
- **CSRF:** Cross-Site Request Forgery.
- **CxP:** Cuentas por Pagar (subárbol frontend y dominio de negocio).
- **DbUp:** librería que aplica scripts SQL con journal (`Lefarma.Migrations`, tabla `app.SchemaVersions`).
- **Deny-by-default:** política de respaldo que exige autenticación a todo endpoint sin metadata.
- **DI:** Dependency Injection — registro de servicios en el contenedor.
- **FallbackPolicy:** política de autorización por defecto de ASP.NET Core para endpoints sin atributos.
- **JWT:** JSON Web Token — access token firmado (HMAC simétrico en este proyecto).
- **OpenTelemetry:** estándar de trazas/métricas distribuidas.
- **PR:** Pull Request.
- **SSE:** Server-Sent Events — notificaciones en tiempo real (`SseService`).
- **SMTP:** protocolo de envío de correo (MailKit).
- **SPA:** Single Page Application — el frontend React servido con fallback a `index.html`.
- **SP:** Stored Procedure (procedimiento almacenado SQL).
- **TLS:** Transport Layer Security — cifrado de transporte (BD, SMTP).
- **Wide event:** evento de log enriquecido, uno por request (Serilog JSON, `logs/wide-events-*.json`).
- **XSS:** Cross-Site Scripting.
- **[DP-n]:** hallazgo propio del rol developer, verificado directamente en código durante este análisis.
