# Análisis de Riesgos y Seguridad — Proyecto Lefarma

- **Fecha:** 2026-10-09
- **Autor:** Reviewer (Agent Team, análisis de solo lectura)
- **Alcance:** `lefarma.backend` (.NET 10, Lefarma.API), `lefarma.frontend` (React 19 + Vite), `lefarma.database` (scripts SQL manuales), configuración y archivos commiteados.
- **Metodología:** revisión estática de código y configuración (codegraph/grep/read). No se ejecutó la aplicación, no se hizo pentest, ni auditoría automatizada de dependencias (`npm audit` / `dotnet list package --vulnerable` quedan recomendados). Las rutas de evidencia son relativas a la raíz del repo.
- **Nota:** por política, este informe NO transcribe secretos literales; solo referencia su ubicación (archivo:línea). Todos los valores mencionados deben considerarse comprometidos por estar en git.

## Resumen ejecutivo

El proyecto tiene una base técnica moderna (EF Core con LINQ, refresh tokens hasheados, SQL crudo parametrizado, cifrado AES-GCM de archivos sensibles), pero presenta **dos problemas críticos de autorización** explotables de forma directa y remota:

1. Una **contraseña maestra** (`Auth:MasterPassword`, valor débil de 6 caracteres commiteado) que permite **iniciar sesión como cualquier usuario** sin pasar por Active Directory; si el usuario no existe, el login lo crea.
2. **16 de ~68 controllers no tienen ningún atributo de autorización** (`[Authorize]`/`[HasPermission]`) y no existe una política de respaldo (fallback) global, por lo que sus endpoints son **anónimos por defecto** — incluido `AdminController` (listado de usuarios) y subida de archivos de hasta 50 MB.

A esto se suma una **superficie amplia de secretos commiteados** (BD, JWT, SMTP, clave AES de archivos, API key de integraciones, passphrase de cifrado en un script SQL) en archivos rastreados por git (`appsettings*.json`, `.env*`, `AGENTS.md`). No se pudo confirmar desde el repo que producción use valores distintos: no existe `appsettings.Production.json` y los CI (`release.yml`, `staging-prerelease.yml`) no ejecutan tests ni auditorías. Si producción reutiliza la clave JWT del repo, cualquier persona con acceso al repositorio puede **forjar tokens de cualquier usuario**.

Riesgos medios: CORS totalmente abierto (`AllowAnyOrigin`) con configuración de orígenes permitidos que existe pero **nunca se lee**, Swagger habilitado sin guarda de entorno, sin manejador global de excepciones, sin rate limiting (brute force posible contra login/LDAP y contra endpoints anónimos), conexiones de BD con `Encrypt=false`, tokens JWT de acceso con vigencia de 20 horas sin revocación, y scripts de migración con prefijos duplicados/huecos que hacen posible aplicar cambios en orden incorrecto.

**No se encontró evidencia de inyección SQL**: el SQL crudo (repositorio de Regiones y herramienta de migraciones) está parametrizado, y las integraciones legacy (Asokam, Asistencias) usan EF Core con DbContext dedicados.

Cobertura de pruebas: ~35 archivos de test reales en backend, concentrados en EducacionMedica/Viaticos/Rh/Workflows; los flujos de autenticación y los endpoints externos (los más sensibles) casi no tienen pruebas. En frontend, Playwright **sí** tiene scripts cableados (`test:e2e`) y 3 specs — la nota de AGENTS.md que dice lo contrario está desactualizada.

## Hallazgos

### F-01 — Contraseña maestra permite suplantar a cualquier usuario (CRÍTICO)
- **Severidad:** Crítica · **Probabilidad:** Alta (explotación remota trivial; valor en git)
- **Descripción:** `LoginStepTwoAsync` compara la contraseña enviada contra `Auth:MasterPassword` (insensible a mayúsculas). Si coincide, **omite por completo la autenticación LDAP/AD** y emite tokens para el usuario indicado; si el usuario no existe en `Usuarios`, lo crea en el acto (`EsActivo = true`). El mismo secreto se acepta por header `X-Master-Password` en `ComprobanteController`. No hay gating por entorno: el valor está en el `appsettings.json` base y en el de Development.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Features/Auth/AuthService.cs:140-143` (bypass), `:183-197` (auto-creación de usuario); `lefarma.backend/src/Lefarma.API/Features/Facturas/ComprobanteController.cs:28-47`; valor commiteado en `lefarma.backend/src/Lefarma.API/appsettings.json:13` y `appsettings.Development.json:12`.
- **Impacto:** toma de control de cualquier cuenta (incluidas administrativas) por cualquier persona que conozca el valor — que está en el repositorio y además repetido en la documentación.
- **Recomendación:** eliminar el mecanismo o limitarlo a un entorno no productivo con secreto rotado y fuera de git; auditar sesiones creadas con este método (wide events `LoginStepTwo`).

### F-02 — 16 controllers sin autorización y sin política de respaldo: endpoints anónimos (CRÍTICO)
- **Severidad:** Crítica · **Probabilidad:** Alta (explotación directa, sin credenciales)
- **Descripción:** `AddAuthorization` se registra sin `FallbackPolicy` (comentario explícito: "No static permission policies"), por lo que en ASP.NET Core **todo endpoint sin atributo es anónimo**. Un barrido de los 68 controllers mostró 16 archivos sin ninguna aparición de `[Authorize]` ni `[HasPermission]`. Entre ellos: `AdminController` (p. ej. `GET /api/admin/usuarios` devuelve todos los usuarios), `ArchivosController` (upload de 50 MB; `GetUserId()` devuelve 0 si no hay claims), `ComprobanteController` (varios endpoints solo protegidos por la master password de F-01), `SystemConfigController`, `EnviosController`, `CalendarioController`, `TiposSolicitudController`, `SolicitudPersonalController`, `TiposImpuestoController`, `TiposGastoController`. (Los 6 restantes del grupo son "externos" con API key — ver F-04 — y 2 son anónimos intencionales: geocodificar y recordatorios, ver F-12.)
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:386-391` (sin fallback); `Features/Admin/AdminController.cs:9-45`; `Features/Archivos/Controllers/ArchivosController.cs:15-30`; `Features/Facturas/ComprobanteController.cs:11-26`; `Features/SystemConfig/SystemConfigController.cs:10-35`. Además hay permisos **comentados** en controllers catalogados: `Features/Auth/Usuarios/UsuariosController.cs:17` y `Features/Auth/Roles/RolesController.cs:15` (`//[HasPermission(...)]`), `Features/Config/Workflows/WorkflowsController.cs:17`.
- **Impacto:** lectura/escritura no autenticada de datos administrativos, de catálogo y de negocio (órdenes, comprobantes, archivos, envíos).
- **Recomendación:** deny-by-default (FallbackPolicy `RequireAuthenticatedUser`) y `[AllowAnonymous]` explícito solo donde se necesite; reactivar los `[HasPermission]` comentados.

### F-03 — Secretos de producción potenciales commiteados en git (ALTO)
- **Severidad:** Alta · **Probabilidad:** Media-Alta (la exposición en git es un hecho; el impacto en producción depende de que se reutilicen los valores)
- **Descripción:** `appsettings.json` y `appsettings.Development.json` (ambos rastreados por git, verificado con `git ls-files`) contienen en claro: contraseñas de las 3 conexiones SQL (`DefaultConnection`, `AsokamConnection`, `AsistenciasConnection`), la **clave simétrica de firma JWT**, credenciales SMTP, la **clave AES-256** usada por `AesFileCipher` para cifrar firmas/INE, y usuario/contraseña del servicio externo SISCO/Asokam sobre **HTTP sin TLS hacia una IP pública**. `AGENTS.md` repite los secretos de BD/JWT/SMTP en su sección "Development Secrets". En frontend, los 4 archivos `.env*` (rastreados) contienen una API key de TinyMCE. No existe `appsettings.Production.json` en el repo: si el despliegue usa el archivo base, **la clave JWT comprometida permite forjar tokens válidos de cualquier usuario** y la `EncryptionKey` comprometida anula el cifrado de archivos sensibles.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/appsettings.json:7-10` (BD), `:18` (JWT), `:28` (SMTP), `:40-43` (SISCO, HTTP a IP pública), `:75` (EncryptionKey); `appsettings.Development.json:7-9,17,27`; `lefarma.frontend/.env:5`, `.env.development:5`, `.env.production:5`, `.env.example:4`; `AGENTS.md` (sección "Development Secrets"); `lefarma.backend/src/Lefarma.API/Infrastructure/Files/AesFileCipher.cs:9-40`.
- **Impacto:** compromiso total de autenticación (forja de JWT), de datos (credenciales BD), de correo y del cifrado de documentos, si los valores se comparten con producción.
- **Recomendación:** rotar **todos** los secretos listados (darlos por comprometidos), moverlos a variables de entorno/secret store, y purgar el historial de git si el repo se comparte fuera del equipo.

### F-04 — Integraciones "externas" con API key estática commiteada e impersonación por header (ALTO)
- **Severidad:** Alta · **Probabilidad:** Alta (la clave está en git; endpoints `[AllowAnonymous]`)
- **Descripción:** Cuatro controllers externos (`ArchivoExterno`, `ComprobanteExterno`, `OrdenCompraFirmaExterno`, `OrdenCompraExterno`) son anónimos y validan un header `X-API-Key` contra `Auth:ApiKey`, cuyo valor está commiteado. La comparación no es de tiempo constante. Además, la identidad del usuario que realiza la operación se toma del header `X-User-Id` que **envía el propio cliente** (y si falta, se atribuye a `Auth:AnonymousUserId` = 1), por lo que la auditoría es falsificable. Permiten subir archivos/comprobantes de 50 MB, asignar partidas y consultar datos.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/appsettings.json:14` (clave) y `:15` (AnonymousUserId); `Features/Facturas/ComprobanteExternoController.cs:24-49,51-67,116-130`; `Features/Archivos/Controllers/ArchivoExternoController.cs:30-55,60-70`; `Features/OrdenesCompra/Firmas/OrdenCompraFirmaExternoController.cs:27,52-103`; `Features/OrdenesCompra/Captura/OrdenCompraExternoController.cs:27,52-90`.
- **Impacto:** escritura/lectura no autorizada en nombre de cualquier usuario en los módulos de facturas, archivos y órdenes de compra.
- **Recomendación:** credenciales por cliente (JWT client-credentials o API keys por integración, fuera de git), comparación constante en tiempo, eliminar la confianza ciega en `X-User-Id`, y rate limiting.

### F-05 — Passphrase de cifrado de contraseñas de correo commiteada en script SQL; SP las devuelve en claro (ALTO)
- **Severidad:** Alta · **Probabilidad:** Media (requiere acceso a la BD o al repo — ambos ya expuestos)
- **Descripción:** El script del job de correo usa `ENCRYPTBYPASSPHRASE`/`DECRYPTBYPASSPHRASE` con una passphrase literal que quedó commiteada; el stored procedure expone la contraseña SMTP **descifrada** como columna de resultado (`@pass AS password`) para que la consuma un runner Python embebido. Cualquiera con acceso de lectura al repositorio y `EXECUTE` en la BD obtiene credenciales de correo en claro.
- **Evidencia:** `lefarma.database/033_sp_enviar_correo_python.sql:20-21,85,115` (passphrase), `:137` (contraseña en claro en el resultado), `:190` (uso en Python embebido).
- **Recomendación:** rotar las contraseñas de las cuentas en `app.correo_cuentas`, mover la passphrase fuera del script (configuración del servicio de correo), y no devolver secretos en resultsets.

### F-06 — CORS totalmente permisivo; la lista de orígenes configurada es código muerto (MEDIO)
- **Severidad:** Media · **Probabilidad:** Alta (configuración activa en todos los entornos)
- **Descripción:** La política `CorsPolicy` usa `AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()` y se aplica globalmente. Existe `Cors:AllowedOrigins` en appsettings, pero **nunca se lee** en `Program.cs`. Al no usar cookies (auth Bearer), el riesgo inmediato es menor que un CORS con credenciales, pero cualquier sitio web puede consultar desde el navegador todos los endpoints anónimos (F-02) y la configuración relaja la defensa en profundidad; un futuro `AllowCredentials` lo convertiría en crítico.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:438-447,481`; `appsettings.json:99-104` (config no consumida).
- **Recomendación:** construir la política con `WithOrigins(configuration["Cors:AllowedOrigins"])`.

### F-07 — Swagger habilitado en todos los entornos (guarda comentada) (MEDIO)
- **Severidad:** Media · **Probabilidad:** Alta
- **Descripción:** El bloque `if (app.Environment.IsDevelopment())` alrededor de `UseSwagger/UseSwaggerUI` está comentado, por lo que el catálogo completo de la API (incluidos los endpoints externos y anónimos, con sus descripciones de headers requeridos) es público en producción. Facilita el reconocimiento para F-01/F-02/F-04.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:483-493`.
- **Recomendación:** restaurar la guarda de entorno o proteger Swagger con autenticación.

### F-08 — Sin manejador global de excepciones (MEDIO)
- **Severidad:** Media · **Probabilidad:** Media
- **Descripción:** No existe `UseExceptionHandler`, middleware propio ni `IExceptionHandler` (búsqueda en todo `src`: sin coincidencias). En Development, una excepción no controlada se sirve con stack trace por la página de desarrollador implícita de `WebApplication`; en producción el 500 llega sin contrato consistente. Los errores de negocio (`ErrorOr`) sí se serializan con descripciones de negocio hacia el cliente — en general mensajes propios, sin detalles técnicos — y los 400 de validación pasan por `ValidationFilter` con formato consistente. La fuga de información técnica es limitada pero el manejo es inconsistente y no hay correlación de errores no-ErrorOr.
- **Evidencia:** ausencia en `Program.cs:472-620`; `Shared/Extensions/ResultExtensions.cs:21-29,115-120`; `Infrastructure/Filters/ValidationFilter.cs:71-96`.
- **Recomendación:** registrar un `IExceptionHandler` global que devuelva el mismo `ApiResponse` y registre el wide event, sin filtrar detalles internos.

### F-09 — JWT estricto con vigencia larga y sin revocación; ClockSkew=Zero (MEDIO)
- **Severidad:** Media · **Probabilidad:** Alta (el drift de reloj ocurre en operación real)
- **Descripción:** `ClockSkew = TimeSpan.Zero` hace que cualquier desviación de reloj entre emisor y validador provoque 401 inmediatos (documentado como pitfall en AGENTS.md). El access token vive 1200 min (20 h) en el archivo base y 12000 min (~8.3 días) en Development, sin mecanismo de revocación server-side (solo jti informativo); un token robado es usable toda su vigencia. Aspecto positivo: los refresh tokens sí se almacenan hasheados y con expiración. Si `JwtSettings` no está configurado, la app **arranca igualmente** con solo un Warning y sin esquema de autenticación (los endpoints `[Authorize]` fallarán en runtime con 500 en vez de fallar al arranque).
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:332-368` (registro condicional + `ClockSkew` en `:346`); `appsettings.json:21` y `appsettings.Development.json:20` (vigencias); `Services/Identity/TokenService.cs:101-118,141-159`.
- **Recomendación:** access tokens cortos (15-30 min) + refresh rotativo; skew pequeño (30-60 s); `ValidateOnStart`/fail-fast si no hay `SecretKey`.

### F-10 — Middleware DevToken: gating correcto, pero token commiteado en el archivo base (MEDIO)
- **Severidad:** Media · **Probabilidad:** Baja (requiere que un host productivo corra como Development)
- **Descripción:** El bypass de autenticación por header `X-Dev-Token` está doblemente protegido por entorno (registro condicional en `Program.cs` y re-chqueo `_isDevelopment` en el middleware), lo que está bien. Sin embargo, el valor del token y el usuario a suplantar están en el `appsettings.json` **base** (no solo en Development) y commiteados; la comparación del header no es de tiempo constante. Si algún despliegue productivo queda con `ASPNETCORE_ENVIRONMENT=Development` (error operativo común), cualquiera con el valor del repo suplanta al usuario configurado con todos sus roles y permisos.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:595-599`; `Infrastructure/Middleware/DevTokenMiddleware.cs:26-35` (gating), `:44-49` (comparación), `:106-145` (suplantación completa); `appsettings.json:2-5`; `appsettings.Development.json:2-5`.
- **Recomendación:** mover `DevToken` exclusivamente a `appsettings.Development.json`/secretos locales y usar comparación `CryptographicOperations.FixedTimeEquals`.

### F-11 — Sin rate limiting: brute force contra login/LDAP y abuso de endpoints anónimos (MEDIO)
- **Severidad:** Media · **Probabilidad:** Alta
- **Descripción:** No hay `AddRateLimiter`/`UseRateLimiter` en toda la API. `POST /api/auth/login-step-two` (anónimo) intenta un bind LDAP por petición: permite fuerza bruta contra cuentas de AD sin límite ni bloqueo. `POST /api/workflow/recordatorios/ejecutar` (`[AllowAnonymous]`) procesa y **envía notificaciones** en cada llamada — vector de spam/agotamiento. `GET /api/viaticos/geocodificar` (anónimo) delega en Nominatim con límite propio de 1 req/s y caché de 6 h (mitigación parcial documentada). Los endpoints externos de F-04 tampoco tienen throttle.
- **Evidencia:** búsqueda sin coincidencias de rate limiter en `lefarma.backend/src`; `Features/Auth/AuthController.cs:64-88`; `Features/Config/Workflows/Notification/WorkflowReminderController.cs:22-39`; `Features/Viaticos/GeocodificarController.cs:23-44`.
- **Recomendación:** rate limiting por IP+usuario en auth y en todo lo anónimo; bloqueo progresivo ante fallas LDAP.

### F-12 — Respuestas de workflow desde el exterior: token bearer sin expiración (MEDIO)
- **Severidad:** Media · **Probabilidad:** Baja-Media (el token es GUID v4 no adivinable; el riesgo es fuga del enlace)
- **Descripción:** `POST /api/solicitudes-personal/externo/respuesta` y `POST /api/ordenes/envio-concentrado/respuesta` son anónimos y autorizan/devuelven solicitudes del workflow validando `IdEnvio + TokenSeguridad` contra BD. El token es `Guid.NewGuid().ToString("N")` (aleatorio, no adivinable — correcto), pero **no expira** y se compara en claro contra lo almacenado: si el enlace/token se filtra (correo, logs, historial), un tercero puede aprobar la solicitud pendiente en cualquier momento, y la acción se atribuye al `IdUsuario` que diga el body.
- **Evidencia:** `Features/Rh/SolicitudesPersonal/SolicitudPersonalController.cs:175-183`; `Features/Rh/SolicitudesPersonal/Firmas/SolicitudPersonalFirmasService.cs:468,575-640`; `Features/OrdenesCompra/Integraciones/EnvioConcentradoExternoController.cs:38-49`; `Features/OrdenesCompra/Firmas/OrdenCompraFirmasService.cs:301-306`.
- **Recomendación:** expiración del envío, invalidación tras primer uso (ya hay check de estado PENDIENTE, falta caducidad temporal), y almacenar el token hasheado.

### F-13 — Tráfico de BD sin cifrar y certificados SMTP inválidos aceptados (MEDIO)
- **Severidad:** Media · **Probabilidad:** Media (red interna; relevante ante segmentación comprometida)
- **Descripción:** Las 3 connection strings usan `Encrypt=false;TrustServerCertificate=true`: credenciales y datos viajan en claro por la red hacia `192.168.4.2`/`192.168.1.5`. `EmailSettings.AcceptInvalidCertificates=true` acepta cualquier certificado SMTP (MITM de credenciales de correo). `AllowedHosts: "*"` no restringe el header Host.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/appsettings.json:7-10,32,98`; `appsettings.Development.json:7-9`.
- **Recomendación:** `Encrypt=true` con certificados válidos; desactivar `AcceptInvalidCertificates` fuera de desarrollo.

### F-14 — Archivos subidos servidos de forma anónima por static files (MEDIO)
- **Severidad:** Media · **Probabilidad:** Media (depende de que la ruta/nombre no sea adivinable)
- **Descripción:** `UseStaticFiles` sirve `wwwroot/media/archivos` bajo `/api/media/archivos` y `/media/archivos` **sin autenticación** (el propio código reconoce que static files no ejecuta autenticación). El equipo ya mitigó un caso (capturas de viáticos bloqueadas con middleware dedicado y servidas solo por endpoint `[Authorize]`), pero el resto de uploads (carátulas, adjuntos de órdenes, etc.) queda expuesto a quien conozca la URL. Combinado con F-02 (upload anónimo), un atacante puede almacenar y luego leer contenido arbitrario.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Program.cs:497-513` (mitigación capturas), `:542-565` (archivos anónimos), `:570-579` (help, intencionalmente público); `Features/Archivos/Controllers/ArchivosController.cs:38-47`.
- **Recomendación:** servir uploads privados solo por endpoints autorizados (mismo patrón que capturas-viáticos).

### F-15 — Frontend: tokens en localStorage y API key de TinyMCE commiteada (MEDIO)
- **Severidad:** Media · **Probabilidad:** Media
- **Descripción:** Access token, refresh token y usuario se guardan en `localStorage`, accesibles para cualquier XSS (el proyecto usa `dompurify`, lo que mitiga parcialmente). La API key de TinyMCE está en los 4 `.env*` rastreados por git: aunque es una clave de cliente (normalmente expuesta en el bundle), al estar commiteada sin verificación de restricciones de dominio permite abuso de cuota desde cualquier origen.
- **Evidencia:** `lefarma.frontend/src/shared/auth/authService.ts:40-42,55-56`; `lefarma.frontend/src/shared/auth/authStore.ts:397-402,427,488`; `lefarma.frontend/.env:5` y equivalentes.
- **Recomendación:** evaluar cookies httpOnly para el refresh token; restringir la clave TinyMCE por dominio y rotarla.

### F-16 — Scripts de migración con prefijos duplicados, huecos y convenciones mezcladas (MEDIO)
- **Severidad:** Media · **Probabilidad:** Media (error humano al aplicar en orden)
- **Descripción:** En la raíz conviven **tres** scripts `027_*` distintos, **dos** `029_*`, faltan números (p. ej. 037/038), y en `legacy/` hay duplicados (`005_*` x3, `009_*` x2, `010_*` x2, `025_*` x2) con huecos (015, 024) y prefijos fuera de secuencia (`06_`, `06B_`). En `educacion-medica/` hay dos `0013_*` con fechas distintas y un `9999_*drop-schema-reset` **destructivo**; en `viaticos/` dos `0003_20261007-0000_*` con el mismo timestamp. Aplicar en orden alfabético o saltarse un duplicado rompe el esquema. Existe un runner (`Lefarma.Migrations`, journal `app.SchemaVersions` estilo DbUp) que mitiga el riesgo si se usa de forma obligatoria.
- **Evidencia:** listado de `lefarma.database/` (raíz: `027_agregar_ajuste_redondeo_partidas.sql`, `027_agregar_campos_entrega_ordenes_compra.sql`, `027_alter_usuario_detalle_firma_control.sql`, `029_sp_cancelar_orden.sql`, `029_sincronizar_esquema_lefarma_a_lefarmadev.sql`; `educacion-medica/0013_20260910-1200_*` vs `0013_20260904-1500_*`; `viaticos/0003_20261007-0000_*` x2); `lefarma.backend/src/Lefarma.Migrations/Program.cs:355-395`.
- **Recomendación:** convención única (prefijo monotónico + timestamp), prohibir duplicados, y aplicar siempre vía runner con journal.

### F-17 — Cobertura de tests insuficiente en las zonas de mayor riesgo; CI sin gates de calidad (MEDIO)
- **Severidad:** Media · **Probabilidad:** Alta
- **Descripción:** Backend: ~35 archivos de test reales en 3 proyectos, con placeholders vacíos (`UnitTest1.cs` con un `[Fact]` sin aserciones en dos proyectos). Hay cobertura decente de EducacionMedica, Viaticos (incluye tests de seguridad de endpoints), Rh y Workflows, pero **Auth (AuthService/TokenService), Admin, los controllers externos y Facturas prácticamente no tienen pruebas**. Frontend: vitest + Playwright con 3 specs y scripts cableados (`test:e2e`, `test:e2e:login`) — AGENTS.md afirma incorrectamente que Playwright no tiene scripts. Los workflows de CI (`release.yml`, `staging-prerelease.yml`) **no ejecutan tests, lint ni auditoría de dependencias**: solo automatizan releases.
- **Evidencia:** `lefarma.backend/tests/**` (56 .cs, ~35 reales); `lefarma.backend/tests/Lefarma.UnitTests/UnitTest1.cs:5-9`; `lefarma.frontend/package.json:15-19`; `lefarma.frontend/tests/` (login.spec.ts, multi-app-login.spec.ts, viaticos-flujo.spec.ts); `.github/workflows/release.yml`, `staging-prerelease.yml` (sin coincidencias de test/lint).
- **Recomendación:** tests de autorización (matriz endpoint×rol/permiso) y de los flujos de auth; agregar `dotnet test`, `npm run lint`, `npm audit` y `dotnet list package --vulnerable` al CI.

### F-18 — Dependencias: sin vulnerabilidades conocidas confirmadas, pero con puntos obsoletos y de cadena de suministro (BAJO)
- **Severidad:** Baja · **Probabilidad:** Media
- **Descripción:** Revisión visual (no se ejecutó auditoría automática). NuGet en general reciente (net10.0, paquetes Microsoft 10.0.2, MailKit 4.16); `System.DirectoryServices.Protocols 9.0.0` queda una major por debajo del target. npm: `xlsx` se instala desde una **URL de CDN** (sheetjs) en vez del registro — decisión razonable (el `xlsx` del registro npm está estancado en versión vulnerable) pero introduce dependencia de un tercero sin lockfile de integridad del registro; `reactflow@11` está deprecado (sucesor `@xyflow/react`); `@types/react-router-dom@5.3.3` es obsoleto para react-router-dom 7; `@faker-js/faker` está en `dependencies` de producción; hay `overrides` de `@modelcontextprotocol/sdk`/`@hono/node-server` inusuales para un frontend.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Lefarma.API.csproj:19-39`; `lefarma.frontend/package.json:98,107,125,26,144-147`.
- **Recomendación:** integrar `npm audit`/`dotnet list package --vulnerable` en CI y planear la migración de reactflow.

### F-19 — Inyección SQL: no se encontró evidencia (positivo) (BAJO)
- **Severidad:** Baja (riesgo residual) · **Probabilidad:** Baja
- **Descripción:** Las consultas usan EF Core LINQ en los repositorios; el único SQL crudo de la API (`RegionRepository`, incluido el que cruza con el legacy `Asokam.dbo.genContactosCat`) se construye con `FormattableStringFactory.Create` sobre plantillas con placeholders `{0}`/`{1}`, es decir **parametrizado** (la concatenación de `CteCandidatosGps` solo arma índices de placeholder, no valores). La herramienta `Lefarma.Migrations` usa `SqlParameter`. No se detectaron comandos con interpolación de entradas de usuario.
- **Evidencia:** `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/EducacionMedica/RegionRepository.cs:208-232,239-255,291-311,330-332`; `lefarma.backend/src/Lefarma.Migrations/Program.cs:360-388`.
- **Recomendación:** mantener el patrón parametrizado; agregar una regla de análisis (p. ej. ban de `FromSqlRaw` con concatenación) en CI.

### F-20 — Detalles menores de endurecimiento (BAJO)
- **Severidad:** Baja · **Probabilidad:** Baja
- **Descripción:** (a) `Auth:AnonymousUserId = 1` atribuye operaciones externas al usuario 1 cuando falta `X-User-Id`, contaminando la auditoría (el usuario 1 es además el suplante por defecto del DevToken). (b) Comparaciones de secretos no constantes en tiempo (API key, DevToken, master password). (c) `SystemConfigController` anónimo expone configuración no sensible (issuer SMTP/host) — bajo, pero forma parte de F-02. (d) `appsettings.Development.json:80` contiene una URL del SAT visiblemente mal escrita (`...ConsultaCFDIServiceeeeeeeeee.svc`), señal de configuración de desarrollo descuidada que puede ocultar errores de integración. (e) Los logs JSON (`logs/`) están ignorados en `.gitignore` — correcto.
- **Evidencia:** `appsettings.json:15`; `ComprobanteExternoController.cs:66-67`; `DevTokenMiddleware.cs:45`; `SystemConfigController.cs:29-60`; `appsettings.Development.json:78-82`.
- **Recomendación:** identidad de servicio explícita para integraciones, `FixedTimeEquals` en toda comparación de secretos, corregir la URL de desarrollo.

## Prioridades

Top 5 de acciones inmediatas, en orden:

1. **Eliminar/rotar la contraseña maestra (F-01)** y auditar los wide events `LoginStepTwo` en busca de logins que la hayan usado. Es el camino más corto a la toma de control total y su valor está en git y en AGENTS.md.
2. **Autorización deny-by-default (F-02):** registrar una `FallbackPolicy` que exija usuario autenticado y añadir `[AllowAnonymous]` explícito solo donde sea intencional; proteger primero `AdminController`, `ArchivosController` y `ComprobanteController`; reactivar los `[HasPermission]` comentados.
3. **Rotar y externalizar todos los secretos commiteados (F-03, F-04, F-05, F-15):** BD, JWT (asumir que producción puede estar firmando con la clave del repo → forja de tokens), SMTP, EncryptionKey de archivos, ApiKey de integraciones, passphrase del script 033 y TinyMCE. Mover a variables de entorno/secret store y verificar que producción no consume los valores del repo.
4. **Endurecer la superficie expuesta (F-06, F-07, F-11, F-14):** CORS con la lista de orígenes ya configurada, Swagger solo en desarrollo, rate limiting en login y endpoints anónimos, y uploads privados fuera de static files anónimo.
5. **Crear un gate de seguridad en CI (F-17, F-18) y estabilizar migraciones (F-16):** ejecutar tests + lint + `npm audit` + `dotnet list package --vulnerable` en cada release; añadir tests de autorización (matriz endpoint×permiso) para los flujos de auth/externos; unificar la numeración de scripts SQL y hacer obligatorio el runner con journal.
