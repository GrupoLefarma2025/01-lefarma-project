# Plan de rendimiento: entrada a la aplicación

Fecha: 2026-11-27
Rama: `optimizar-deveop` (worktree `.agents/worktrees/optimizar-deveop`)
Base: `develop` en `ff813363`
Alcance: frontend, backend y base de datos. El objetivo es el tiempo hasta ver el hub utilizable y hasta abrir cada módulo.

## Objetivo

Que entrar a la aplicación deje de depender de descargar y ejecutar todos los módulos, y que el arranque de sesión no repita trabajo. Sin cambios de comportamiento visibles.

Criterios de aceptación:

1. El chunk inicial no contiene páginas de módulos que el usuario no visitó.
2. El hub se pinta sin esperar la carga completa del perfil ni la consulta a Asistencias.
3. Una segunda entrada con caché caliente no revalida los assets con hash.
4. `GET /api/profile` responde por debajo de 300 ms en caliente y se llama una sola vez al arrancar.
5. Las pantallas de detalle (orden, solicitud) dejan de escanear `config.workflow_bitacora`.
6. `npm run build`, `npm run lint`, `npm run test` y `dotnet build` en verde.

## Línea base medida

| Punto | Dato actual | Evidencia |
|---|---|---|
| Bundle inicial | 5.84 MB sin comprimir, 1.66 MB gzip en un solo archivo | `lefarma.frontend/dist/assets/index-Crwuj3ny.js` |
| Chunks totales | 314 archivos JS, 16 MB en `dist/assets` | `dist/assets` (muchos son lenguajes de Shiki, bajo demanda) |
| Code splitting de rutas | 0 `React.lazy` en los árboles de rutas | `apps/baseapp/BaseAppRoutes.tsx` y `apps/*/[X]Routes.tsx` |
| Imports estáticos | CxP 41, RH 19, Educación Médica 21, Viáticos 13, SIGMA 11 | cabeceras de los `*Routes.tsx` |
| Páginas de demo en producción | `DemoComponents` y `Roadmap` se importan en `CxpRoutes` | `apps/cxp/CxpRoutes.tsx:37-38` |
| Llamadas a `/profile` al arrancar con sesión | 3 en paralelo | `authStore.initialize`: `loadProfile`, `fetchProfileSignature`, `refreshPermissions` |
| Consulta remota en cada `/profile` | Vista `VwEmpleados` en `192.168.1.5`, con tope de 3 s | `ProfileService.ResolverAreaYPuestoEmpleadoAsync` |
| Conexiones SSE por pestaña | 2 (`/api/auth/sse` y `/api/notifications/stream`), más 2 tickets | `sseService.ts`, `useNotifications.ts` |
| Compresión de respuestas JSON | Sin middleware; IIS con compresión dinámica apagada | `Program.cs`, `web.config` |
| Caché de assets | Sin `Cache-Control` explícito para JS/CSS con hash | `Program.cs` (`UseStaticFiles` por defecto) |
| Consultas de la app | 688 llamadas async, 527 con `AsNoTracking` | conteo sobre `*.cs` |
| Índices faltantes en producción | `workflow_bitacora (id_entidad, tipo_entidad)`: 1 108 seeks; `(id_usuario, id_entidad, tipo_entidad)`: 1 168 seeks | DMV `sys.dm_db_missing_index_*`, base `Lefarma` |
| Índices faltantes en develop | Los mismos dos, más `error_logs (fecha_error)` | DMV, base `LefarmaDev` |

El análisis previo `lefarma.docs/analisis-proyecto-2026-10-09/02-mejoras-propuestas.md` ya había estimado una reducción mayor al 50 % del bundle inicial con code splitting (P-17). El código actual sigue igual en ese punto.

## Hallazgos priorizados

### H1. Todo el frontend entra en la primera descarga (alto impacto, bajo riesgo)

`BaseAppRoutes` importa de forma eager los cinco árboles de rutas y los layouts. Cada `*Routes.tsx` importa todas sus páginas de forma estática. Por eso el login y el hub descargan también CxP, RH, Educación Médica, Viáticos y SIGMA completos, con Recharts, Leaflet, jsPDF, xlsx, React Flow y Shiki.

Acción: convertir las páginas a `lazy(() => import(...))` con un `Suspense` único por app; sacar `DemoComponents` y `Roadmap` del build productivo; cargar bajo demanda las librerías pesadas que hoy entran por import estático (mapas, PDF, Excel, editor de ayuda, diagrama de workflow).

### H2. El arranque de sesión hace trabajo triplicado (alto impacto, bajo riesgo)

Con token guardado, `initialize()` dispara tres `GET /api/profile` simultáneos: uno para el perfil, otro para la firma y otro para permisos. El endpoint hace entre 4 y 6 consultas, incluida la vista de empleados en otro servidor (`192.168.1.5`), con timeout de 3 s. La UI pinta el hub, pero el header, el aviso de firma y los permisos esperan ese viaje.

Acción: una sola llamada de arranque que devuelva perfil, permisos y estado de firma; cachear el perfil unos minutos; resolver área y puesto de forma diferida o cacheada, sin consultar Asistencias en cada entrada.

### H3. Login con más viajes de los necesarios (medio impacto, bajo riesgo)

`login-step-one` consulta la vista de directorio tres veces. `login-step-two` autentica contra AD y hace tres `SaveChanges` secuenciales (usuario, número de empleado, sesión, auditoría). Después el frontend pide empresas, sucursales y áreas por separado, más perfil y firma.

Acción: reducir a una consulta el paso uno; agrupar las escrituras del paso dos; un endpoint de catálogos de contexto o cachear esos catálogos, que cambian poco.

### H4. Assets con hash sin caché larga (medio impacto, bajo esfuerzo)

Los nombres de archivo cambian en cada build, pero el servidor no envía `Cache-Control: immutable`. El navegador revalida en cada entrada. En LAN es un ida y vuelta por archivo; por VPN se nota.

Acción: `Cache-Control: public, max-age=31536000, immutable` para `/assets/*`, `no-cache` para `index.html`, y mantener `no-store` solo para media privada.

### H5. Respuestas JSON sin comprimir (medio impacto, bajo esfuerzo)

No hay `AddResponseCompression`/`UseResponseCompression` y la compresión dinámica de IIS está apagada. Las listas y el dashboard viajan en claro. Los SSE no deben comprimirse ni almacenarse en búfer.

Acción: comprimir `application/json` y excluir `text/event-stream`; verificar que las notificaciones en tiempo real siguen llegando sin retraso.

### H6. Índices faltantes reales en `workflow_bitacora` (alto impacto en detalle, bajo riesgo)

Producción acumula 1 108 seeks para `(id_entidad, tipo_entidad)` y 1 168 para `(id_usuario, id_entidad, tipo_entidad)`. La consulta de historial (`WorkflowQueryService.GetHistorialWorkflowAsync`) usa exactamente ese filtro, y corre cada vez que se abre una orden o solicitud. La tabla tiene 21 965 filas en develop y crece.

Acción: script nuevo en `lefarma.database/` con los dos índices y el de `error_logs (fecha_error)`, idempotente y con rollback. No se aplica a ninguna base sin que lo ejecute la persona.

### H7. Listados sin paginación ni lectura sin seguimiento (medio impacto, preventivo)

`OrdenCompraRepository.GetByEstadoAsync` y `GetBandejaAsync` no usan `AsNoTracking` ni paginan. Hoy hay 3 674 órdenes; el dashboard además carga todas las órdenes en memoria y calcula en C#.

Acción: `AsNoTracking` en lecturas, paginación en bandejas y agregación en SQL. No es el cuello actual, pero es lo que evita que vuelva a serlo.

### H8. Trabajo repetido en el cliente (bajo impacto, bajo riesgo)

Dos conexiones SSE por pestaña, dos tickets, sondeo de permisos cada 5 minutos y sincronización de configuración cada 10. Es correcto para tiempo real, pero conviene consolidar los dos streams en uno y no pedir permiso si el token ya trae los claims.

## Plan de ejecución

### Fase 1: bundle por módulo (1 a 2 días)

1. Pasar los imports de páginas a `lazy` en los cinco `*Routes.tsx`, con `Suspense` y loader ya existente.
2. Excluir `DemoComponents` y `Roadmap` del build productivo.
3. Cargar bajo demanda: `FileViewer` (xlsx), utilidades PDF (jsPDF), mapas (Leaflet), `WorkflowDiagram` (React Flow), `HelpView` (Shiki) y gráficas (Recharts).
4. Prefetch al pasar el mouse por el menú, para que la navegación no muestre el loader.

Verificación: `npm run build` con reporte de chunks; el chunk inicial baja y el login no carga módulos; `npm run lint` y `npm run test` verdes; smoke de rutas de las cinco apps.

### Fase 2: arranque de sesión (1 a 2 días)

1. Un endpoint de bootstrap o reutilizar una sola respuesta de `/profile` para perfil, permisos y firma.
2. Quitar la consulta a Asistencias del camino crítico y cachear área y puesto.
3. Cachear catálogos de contexto (empresas, sucursales, áreas).
4. Agrupar escrituras del login.
5. Compresión JSON y cabeceras de caché de assets.

Verificación: en Network, entrada con sesión con una sola llamada a `/profile` y sin esperar Asistencias; SSE sigue funcionando; login completo en menos de 2 s en LAN.

### Fase 3: base de datos (medio día, más revisión)

1. Script con los índices de `workflow_bitacora` y `error_logs`.
2. Medir con `SET STATISTICS IO ON` antes y después en develop.
3. Dejar el script en la Bandeja del panel SQL; la persona lo revisa y ejecuta.

Verificación: el historial de una orden pasa de scan a seek; sin índices duplicados; rollback probado.

### Fase 4: medición y cierre (medio día)

1. Medir con caché fría y caliente, y con red limitada, antes y después.
2. Registrar tiempos de `/profile`, dashboard y apertura de módulo.
3. Actualizar este documento con la tabla "después".

## Riesgos

- Un `Suspense` mal colocado puede dejar en blanco una ruta protegida. Mitigación: tests de rutas existentes y smoke manual de las cinco apps.
- Comprimir SSE rompe el tiempo real. Mitigación: excluir `text/event-stream` y probar una notificación real.
- Un índice nuevo puede bloquear escrituras al crearse. Mitigación: ventana de mantenimiento y script revisado por la persona.
- El caché de perfil puede mostrar datos viejos unos minutos. Mitigación: invalidar al cambiar firma o contexto.

## Fuera de alcance

- Rediseñar la navegación o el hub.
- Migrar a TanStack Query (mejora estructural, otro trabajo).
- Tocar producción, aplicar SQL o desplegar sin aprobación.
- Cambiar reglas de negocio, permisos o contratos de API.

## Aprobaciones necesarias

- Ejecutar los scripts de índices en develop y producción: los ejecuta la persona desde la Bandeja.
- Publicar a staging o producción: solo con petición explícita y bump de versión.
