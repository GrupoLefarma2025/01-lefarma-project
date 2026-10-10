# Informe Conjunto de Análisis del Proyecto Lefarma

| Campo | Valor |
|---|---|
| **Proyecto** | Lefarma (Monorepo Backend .NET 10 + Frontend React 19 + SQL Server + Docs) |
| **Fecha de emisión** | 2026-10-09 |
| **Equipo emisor** | **Agent Team — DeepSeek Harness** (Lead, Arquitecto, Reviewer, Developer) |
| **Modalidad** | Auditoría estática de solo lectura, análisis estructural, de seguridad y propuestas |
| **Versión evaluada** | `VERSION 1.3.0` (Producción) / `VERSION-STAGING 1.1.2-rc.3` |
| **Entregables base** | [01-arquitectura.md](01-arquitectura.md) · [02-mejoras-propuestas.md](02-mejoras-propuestas.md) · [03-riesgos-seguridad.md](03-riesgos-seguridad.md) |

---

## 1. Resumen Ejecutivo Conjunto

El Agent Team llevó a cabo un análisis integral y multidimensional del proyecto **Lefarma**, combinando las perspectivas de arquitectura de sistemas (Arquitecto), seguridad e integridad (Reviewer), y desarrollo con propuestas de implementación (Developer).

### El Estado General del Proyecto
Lefarma es un monorepo activo, moderno en su núcleo tecnológico (.NET 10, C# 14, EF Core 10, React 19, TypeScript 5.9, Vite 7, Tailwind, Radix UI, TanStack Table) y con un diseño de negocio ambicioso y bien delimitado en 17 dominios bajo `Features/` (Admin, Archivos, Auth, Catálogos, Config, Dashboard, Educación Médica, Facturas, Firmas, Help, Logging, Notificaciones, Órdenes de Compra, Perfil, RH, SystemConfig, Viáticos).

El proyecto posee **virtudes técnicas notables**:
1. **Autorización dinámica por permisos en runtime**: `DynamicPermissionPolicyProvider` consulta permisos directamente desde base de datos sin requerir recompilación ni reinicio de servicios.
2. **Observabilidad intencional**: implementación de *wide events* estructurados en formato JSON por petición HTTP vía Serilog, complementado con auditorías de negocio en BD.
3. **Manejo defensivo en archivos sensibles**: cifrado AES-256 GCM en documentos privados y bloqueo preventivo de rutas estáticas para capturas de viáticos.
4. **Resiliencia en cliente HTTP**: cliente Axios centralizado con cola de reintentos ante 401 durante refresco de token, normalización de errores y detección de pérdida de conectividad.
5. **Cero inyección SQL identificada**: las consultas crudas y los cruces con bases legacy utilizan parametrización estricta (`FormattableStringFactory` y `SqlParameter`).

### Los Problemas Críticos y Riesgos Estructurales
A pesar de sus bases modernas, el proyecto presenta **dos vulnerabilidades críticas de autorización inmediata**, una **superficie masiva de secretos commiteados en el repositorio** y **tres deudas técnicas estructurales** que comprometen la estabilidad y el crecimiento:

1. **Puerta trasera crítica (`Auth:MasterPassword`)**: una contraseña maestra de 6 caracteres commiteada en `appsettings.json` permite iniciar sesión como **cualquier usuario** sin validar credenciales en Active Directory/LDAP, e incluso auto-crea la cuenta en base de datos si no existe.
2. **16 controladores anónimos por omisión (Falta de FallbackPolicy)**: al no registrarse una política de respaldo deny-by-default, los endpoints sin anotación explícita son públicos por defecto en ASP.NET Core. Esto expone listados administrativos de usuarios, configuraciones del sistema y subidas de archivos de 50 MB sin autenticación.
3. **Secretos expuestos en Git**: contraseñas de las tres bases de datos SQL Server, la clave simétrica para firmar JWTs (lo que permitiría forjar tokens válidos para cualquier usuario si producción comparte la clave), credenciales SMTP, clave de cifrado AES de firmas/INE y accesos SISCO están en texto claro en el código fuente.
4. **Acoplamiento invasivo con el sistema legacy Asokam**: `AsokamDbContext` cuenta con **89 puntos de invocación directa** dispersos en controladores, servicios y middleware; toda la identidad y autorización depende de la base legacy sin una capa anticorrupción que la aísle.
5. **Inconsistencias en base de datos y migraciones**: la base se administra con scripts SQL manuales donde existen números duplicados (tres scripts `027_`, dos `029_`, scripts destructivos sueltos como `9999_drop-schema-reset`) y un runner con journal (`Lefarma.Migrations`) que existe pero no es de uso obligatorio.

---

## 2. Top-10 Consolidado de Prioridades (Matriz Riesgo / Impacto / Esfuerzo)

El equipo unificó los hallazgos de arquitectura, seguridad y desarrollo en una matriz de acción directa clasificada por severidad y retorno de inversión técnico:

| # | Iniciativa / Hallazgo | Riesgo / Severidad | Impacto | Esfuerzo | Ref. Informes | Acción Inmediata |
|---|---|---|---|---|---|---|
| **1** | **Eliminar la contraseña maestra (`MasterPassword`)** | **Crítico** (F-01) | Alto | **S** (<1d) | F-01, P-03, H6 | Auditar wide events para descartar usos legítimos; remover el bypass en `AuthService.cs` y el header en `ComprobanteController.cs`. |
| **2** | **Autorización Deny-by-Default con `FallbackPolicy`** | **Crítico** (F-02) | Alto | **M** (1-3d) | F-02, P-01, H10 | Registrar `FallbackPolicy = RequireAuthenticatedUser()` en `Program.cs`; proteger los 16 controllers anónimos y añadir `.AllowAnonymous()` a `MapFallbackToFile("/index.html")`. |
| **3** | **Corregir expiración de roles en caché de permisos [DP-1]** | **Alto** (Bug) | Alto | **S** (<1d) | DP-1, P-02 | Filtrar `UsuariosRoles.FechaExpiracion` en `UserPermissionService.cs:54-57` para revocar permisos de roles vencidos en runtime. |
| **4** | **Rotación y externalización total de secretos** | **Alto** (F-03, F-05, H18) | Alto | **M** (2-4d) | F-03, F-04, F-05, P-04 | Asumir secretos comprometidos; migrar a User Secrets en dev y variables de entorno/vault en prod; rotar JWT SecretKey, SQL, SMTP, AES y API keys. |
| **5** | **Esquema de autenticación para integraciones externas** | **Alto** (F-04, F-20) | Alto | **M** (2-4d) | F-04, P-09 | Reemplazar validaciones manuales de `X-API-Key` por un `ApiKeyAuthenticationHandler` centralizado con claves por cliente y sin suplantación arbitraria de `X-User-Id`. |
| **6** | **Endurecimiento perimetral: CORS, Swagger, TLS, Hosts** | **Medio** (F-06, F-07, F-13, H19) | Alto | **S-M** (1-2d) | F-06, F-07, F-13, P-05, H19 | Conectar `Cors:AllowedOrigins` (hoy código muerto); condicionar Swagger a `IsDevelopment()`; restringir AllowedHosts; activar `Encrypt=true` en SQL. |
| **7** | **Rate Limiting y protección de fuerza bruta** | **Medio** (F-11) | Alto | **M** (2-3d) | F-11, P-07 | Implementar ASP.NET Core RateLimiter con límites estrictos en `login-step-two` (bind LDAP), recordatorios de workflow y endpoints externos. |
| **8** | **Pipeline CI/CD con gates de calidad y tests** | **Medio** (F-17) | Alto | **M** (2-3d) | F-17, P-13, P-14 | Agregar workflow GitHub Actions para PR/Release que ejecute `dotnet test`, `npm run lint`, suite de autorización y escaneo de secretos (gitleaks). |
| **9** | **Normalización de BD y obligatoriedad del runner DbUp** | **Medio** (F-16, H17) | Alto | **M** (2-4d) | F-16, H17, P-15 | Estandarizar nombres con timestamp; mover `9999_drop-schema-reset` fuera del path; hacer obligatorio el runner `Lefarma.Migrations` con journal `app.SchemaVersions`. |
| **10** | **Capa anticorrupción sobre Asokam y modularización DI** | **Deuda Técnica** (H3, H5) | Alto | **L** (>1sem) | H3, H5, P-21, P-22 | Desacoplar identidad de `AsokamDbContext` (89 usos directos) mediante interfaces en `Domain/`; dividir `Program.cs` (624 líneas) en módulos por feature. |

*Leyenda de esfuerzo: S (<1 día), M (1–5 días), L (>1 semana).* 

---

## 3. Síntesis Detallada por Áreas

### 3.1 Backend (.NET 10 Web API — `Lefarma.API`)
- **Arquitectura y Composición**: Proyecto único monolítico estructurado por carpetas (`Features/`, `Infrastructure/`, `Domain/`, `Shared/`). Carece de barreras impuestas por el compilador entre capas. `Program.cs` (624 líneas) actúa como un composition root congestionado con más de 150 registros manuales en DI, bloques de código comentado y configuraciones inline.
- **Acceso a Datos**: Conviven tres `DbContext` registrados en SQL Server:
  - `ApplicationDbContext`: Datos propios de Lefarma (~130 DbSets, 44 repositorios, 106 configuraciones EF).
  - `AsokamDbContext`: Base legacy con 89 llamadas directas en código, que almacena usuarios, roles, permisos y sesiones.
  - `AsistenciasDbContext`: Conexión a `192.168.1.5` con 3 vistas `HasNoKey().ToView()`.
- **Autenticación y Ciclo de Vida**:
  - Emisión de JWT simétrico con `ClockSkew = TimeSpan.Zero` (genera errores 401 inmediatos ante desfases mínimos de reloj).
  - Tokens de acceso configurados con 1,200 minutos (20 h) en base y 12,000 minutos en Development, sin mecanismo de revocación activo en servidor.
  - `DevTokenMiddleware`: doblemente protegido por verificación de entorno pero con el valor secreto commiteado en el archivo base.
  - Bug [DP-1]: `UserPermissionService.cs` ignora `FechaExpiracion` al construir la caché en memoria de permisos.

### 3.2 Frontend (React 19 + Vite 7 SPA)
- **Estructura y Shell**: Configuración multi-app gobernada por un shell central (`BaseAppRoutes`) y 4 subárboles montados por la factoría `createAppRoutes.tsx` (`cxp`, `rh`, `educacion-medica`, `viaticos`).
- **Asimetría Modular**: Mientras RH, Viáticos y Educación Médica tienen carpetas independientes, Cuentas por Pagar (CxP) sigue distribuido en `src/pages/` y `src/services/` globales.
- **Rendimiento y Empaquetado [DP-4]**: Cero utilización de `React.lazy` en rutas. El bundle inicial carga simultáneamente componentes masivos como `AutorizacionesOC.tsx` (3,238 líneas), `CrearOrdenCompra.tsx` (2,539 líneas) y la página de prueba `DemoComponents.tsx` (1,194 líneas) dentro de producción.
- **Estado y Librerías**: Dominio absoluto de Zustand. Jotai tiene presencia meramente testimonial (2 componentes en kibo-ui). Existen dependencias redundantes: dos librerías de toasts (`sonner` y `react-hot-toast`), dos de iconos (`lucide-react` y `react-icons`), y tres motores para PDF (`jspdf`, `pdfmake`, `html2pdf.js`).
- **Problema de Conectividad SSE [DP-3]**: `SseService.cs` almacena una sola conexión por `userId` en un `ConcurrentDictionary`. Al reconectar desde una segunda pestaña, la conexión anterior elimina la entrada activa durante su bloque `finally`, dejando al usuario sin notificaciones.

### 3.3 Base de Datos (SQL Server & Migraciones)
- **Esquema Manual**: Se gestiona estrictamente mediante scripts SQL en `lefarma.database/`. No se utilizan ni deben utilizarse migraciones de EF Core (`Microsoft.EntityFrameworkCore.Tools` en el backend es código muerto que induce al error).
- **Caos en Nomenclatura**: Coexisten 66 scripts con serias irregularidades:
  - Tres scripts `027_*` distintos en la raíz (`027_agregar_ajuste_redondeo_partidas.sql`, `027_agregar_campos_entrega_ordenes_compra.sql`, `027_alter_usuario_detalle_firma_control.sql`).
  - Dos scripts `029_*`, dos `0013_*` en educación médica, dos `0003_*` con igual timestamp en viáticos.
  - Presencia del script destructivo `9999_20260904-1600_educacion-medica_drop-schema-reset.sql` en el árbol principal.
  - Script suelto `sync_lefarmadev_a_lefarma.sql` en la raíz del repositorio.
- **Herramienta Existente**: Existe la utilidad `Lefarma.Migrations` basada en DbUp con registro en `app.SchemaVersions`, pero su uso no está estandarizado en los flujos de despliegue ni en `AGENTS.md`.

### 3.4 Seguridad, Criptografía y Superficie de Ataque
- **Vulnerabilidades Explotables**:
  - `F-01` (Master Password): suplantación total de cuentas administrativas y creación arbitraria de usuarios activos.
  - `F-02` (Endpoints Anónimos): 16 controladores sin `[Authorize]` ni `[HasPermission]`, permitiendo acceso público a `AdminController` (lectura de usuarios), `ArchivosController` (subida de 50 MB) y `ComprobanteController`.
  - `F-04` (API Keys e Impersonación): cuatro controladores externos validan una API key global commiteada y confían ciegamente en el header `X-User-Id` enviado por el cliente.
  - `F-05` (Passphrase SQL): stored procedure `033_sp_enviar_correo_python.sql` incluye passphrase en claro y devuelve contraseñas SMTP desencriptadas en los conjuntos de resultados.
- **Exposición en Red**:
  - CORS con `AllowAnyOrigin()` y `AllowAnyHeader()` activo globalmente; la sección `Cors:AllowedOrigins` no se lee en ningún punto.
  - Swagger UI activo sin validación de entorno en `Program.cs`.
  - Servido de archivos privados (`wwwroot/media/archivos`) de forma anónima vía `UseStaticFiles`.

### 3.5 Operaciones, Documentación y CI/CD
- **Deriva Documental en `AGENTS.md`**:
  - Hace referencia a `src/routes/AppRoutes.tsx`, el cual no existe (sustituido por `BaseAppRoutes` y subrutas).
  - Menciona el script `init.ps1` que fue eliminado (reemplazado por `multiappcli.ps1`).
  - Afirma que Playwright no tiene scripts asociados, cuando `package.json` sí define `test:e2e` y `test:e2e:login`.
- **Desincronización de Versiones**: `VERSION` (producción) se ubica en `1.3.0`, mientras que `VERSION-STAGING` marca `1.1.2-rc.3` (dos versiones menores por detrás de la base establecida por la convención).
- **Ausencia de Quality Gates**: Los flujos de GitHub Actions (`release.yml` y `staging-prerelease.yml`) empaquetan y distribuyen sin ejecutar pruebas unitarias, linting ni escaneos de dependencias vulnerables.

---

## 4. Roadmap Unificado de Implementación (5 Fases)

- **Fase 1: Emergencia de Autorización y Secretos (Inmediata: 1 a 3 días)**
  - P-01: FallbackPolicy RequireAuthenticatedUser en toda la API y protección de los 16 controllers anónimos.
  - P-02: Filtro de FechaExpiracion en UserPermissionService para roles vencidos [DP-1].
  - P-03: Remoción de MasterPassword en AuthService y ComprobanteController.
  - P-04: Rotación completa de secretos (BD, JWT, SMTP, AES, API keys) y migración a variables de entorno / User Secrets.

- **Fase 2: Endurecimiento Perimetral y Contratos (1 a 2 semanas)**
  - P-05: Restricción de CORS a orígenes configurados, Swagger solo en dev, TLS forzado a BD.
  - P-06: Manejador global IExceptionHandler con ApiResponse y CorrelationId.
  - P-07: Rate Limiting en login LDAP, recordatorios anónimos y controladores externos.
  - P-08: Acortar access tokens JWT (15-30 min) y fijar ClockSkew a 30-60 s tolerante.
  - P-09: AuthenticationHandler centralizado para API keys con claves por cliente.
  - P-10: Sincronizar límites de carga multipart de FormOptions (10 MB) con RequestSizeLimit (50 MB) [DP-2].
  - P-11: Servir media privada bajo endpoints con autorización y eliminar static files públicos.
  - P-12: Hasheo y caducidad temporal (72 h) para tokens de workflow enviados por correo.

- **Fase 3: Blindaje Anti-Regresión y Calidad (1 a 2 semanas, paralelizable)**
  - P-13: Gates de CI en GitHub Actions: dotnet test, npm test, lint, gitleaks y audit de dependencias.
  - P-14: Suite automatizada de tests de autorización (matriz endpoint x rol/permiso) y tests de auth.
  - P-15: Normalización de scripts SQL, aislamiento del script destructivo y runner DbUp obligatorio.
  - P-16: Endpoints de health checks reales (/api/health/live y /api/health/ready) con ping a SQL.

- **Fase 4: Rendimiento Frontend y DX (2 a 4 semanas)**
  - P-17: Code splitting con React.lazy en rutas del frontend (ahorro >50% bundle inicial) [DP-4].
  - P-18: Poda de dependencias npm redundantes (toasts, iconos, 3 stacks PDF, faker en dev).
  - P-19: Corrección de condición de carrera en SSE por multi-sesión [DP-3].
  - P-20: Actualización de AGENTS.md, limpieza de archivos huérfanos en raíz y reconciliación de staging.

- **Fase 5: Deuda Estructural Gradual (1 a 3 meses, incremental)**
  - P-21: Modularización de Program.cs en ServiceCollectionExtensions por feature.
  - P-22: Capa anticorrupción e interfaces de dominio sobre AsokamDbContext.
  - P-23: Partición de god classes (>1,500 líneas en backend y frontend).
  - P-24: Adopción incremental de TanStack Query para catálogos y server-state.
  - P-25: Observabilidad con OpenTelemetry (trazas cliente-API-SQL).
  - P-26: Migración de refresh tokens de localStorage a cookies httpOnly anti-XSS.
  - P-27: Simetría modular migrando Cuentas por Pagar (CxP) a apps/cxp/.

---

## 5. Consensos, Desacuerdos y Decisiones Abiertas

### Consensos Plenos del Equipo
- **Gravedad Inmediata**: La erradicación de `Auth:MasterPassword` y el cierre de los 16 controllers anónimos mediante `FallbackPolicy` son no-negociables e inaplazables.
- **Regla Estricta en BD**: No migrar a EF Migrations bajo ninguna circunstancia; estandarizar y blindar el flujo existente con `Lefarma.Migrations` y DbUp.
- **Aislamiento de Asokam**: Es la principal debilidad arquitectónica de mantenibilidad y pruebas; debe abordarse de forma modular iniciando por la identidad.

### Decisiones Abiertas que Requieren Validación Humana
1. **Destino de `MasterPassword`**:
   - *Postura Reviewer/Lead*: Eliminación absoluta del código fuente. Si se requiere desarrollo local offline, utilizar exclusivamente `DevTokenMiddleware` con `ASPNETCORE_ENVIRONMENT=Development`.
   - *Validación con el usuario*: Confirmar si existen procesos operativos o integraciones externas legadas que dependan del header `X-Master-Password`.
2. **Reconciliación de Versionado en Staging**:
   - `VERSION-STAGING` (`1.1.2-rc.3`) versus `VERSION` (`1.3.0`).
   - *Decisión requerida*: Autorizar el bump formal de staging a la base `1.3.0-rc.1` siguiendo el protocolo estricto de `AGENTS.md`.
3. **Manejo de Enlaces Históricos de Aprobación por Correo**:
   - Al introducir caducidad (72 horas) y almacenamiento hasheado en los tokens de envío de `Rh` y `ÓrdenesCompra` (P-12), las solicitudes emitidas en el pasado que sigan pendientes en correos de usuarios quedarán invalidadas.
4. **Política de Transición para Archivos Subidos**:
   - Al privatizar `/api/media/archivos` (P-11), enlaces directos guardados en marcadores o correos responderán 401/404, obligando a acceder siempre autenticado a través de la interfaz web.

---

## 6. Inventario de Documentos del Análisis

Los informes individuales elaborados por los roles especializados del Agent Team se encuentran disponibles en la carpeta `lefarma.docs/analisis-proyecto-2026-10-09/`:

1. [01-arquitectura.md](01-arquitectura.md): Mapa exhaustivo de arquitectura, dependencias NuGet y npm con criticidad, flujos y diagrama de bloques Mermaid (Elaborado por: **Arquitecto**).
2. [02-mejoras-propuestas.md](02-mejoras-propuestas.md): Catálogo de 27 propuestas técnicas accionables, análisis de esfuerzo/riesgo y hallazgos propios de implementación [DP-1..DP-4] (Elaborado por: **Developer**).
3. [03-riesgos-seguridad.md](03-riesgos-seguridad.md): Auditoría de seguridad con 20 vulnerabilidades y riesgos clasificados por severidad y probabilidad con evidencia archivo:línea (Elaborado por: **Reviewer**).
4. [informe-conjunto.md](informe-conjunto.md): Síntesis ejecutiva y roadmap estratégico integrado (Elaborado por: **Lead**).