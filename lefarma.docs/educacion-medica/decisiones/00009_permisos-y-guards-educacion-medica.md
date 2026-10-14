---
fecha_creacion: 2026-10-08 12:00
fecha_modificacion: 2026-10-08 12:00
resumen: Permisos y guards de Educación Médica — cierra la escalada horizontal del endpoint de asignaciones (solo el usuario autenticado), aplica [HasPermission] en los 14 controladores del módulo con los permisos ya sembrados en 0017 más 5 códigos nuevos (rutas, configuración, bandeja "ver todos"), agrega PermissionGuard por ruta y filtrado del menú en el frontend, y siembra la matriz rol↔permiso con el script 0021 (idempotente). El candado real es el backend; el guard del frontend es UX.
---

# 00009 — Permisos y guards de Educación Médica

## Status

Proposed

> Complementa a los ADR-00001 (esquema), 00004 (rutas), 00006 (workflow) y 00007 (matriz de talleres). **No cambia esquemas ni workflows**: endurece la superficie HTTP del módulo y alinea la navegación con los permisos que ya existían desde `0017`, más 5 códigos nuevos y ajustes de matriz (script `0021`).

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Mapa endpoint → permiso (backend)|Mapa endpoint → permiso]]
- [[#Mapa ruta → permiso (frontend)|Mapa ruta → permiso]]
- [[#Matriz rol↔permiso de los códigos nuevos|Matriz rol↔permiso]]
- [[#Fases|Fases]]
- [[#Validación|Validación]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

1. **Candado real en el backend, guard de UX en el frontend.** Cada endpoint del módulo se protege con `[HasPermission]`; el permiso se resuelve contra `app.RolesPermisos`/`app.UsuariosPermisos` vía `PermissionHandler` (caché de 5 min, `Shared/Authorization/PermissionHandler.cs`). El `PermissionGuard` del frontend y el filtrado del sidebar (`AppSidebar` filtra por `item.permission`) son experiencia de usuario; el **403 del backend es la garantía**.
2. **Firmar = permiso de ver + validación de participante.** Los `POST .../firmar` se guardan con el permiso de ver del módulo y dejan la autorización fina al motor (`WorkflowFirmaHelper` valida participante/creador por paso, ya probado en los tests). Así se evita una política OR por acción y los participantes siguen siendo la única fuente de verdad de quién firma (configurados en el admin).
3. **Asignaciones del equipo: solo el propio usuario.** `GET /rutas/talleres/asignaciones` deja de recibir `{idUsuario}` y usa el id del token (`GetUserId()`): elimina la escalada horizontal sobre datos del hospital (dirección, correo, coordenadas).
4. **Bandeja de Autorizaciones visible a todo el módulo** (`baseapp.hub.puede_ver_educacion_medica`). El backend ya filtra "pendientes donde participas" / "míos"; el filtro `todos` exige `educacion_medica.aprobaciones.puede_ver_todos` (permiso que se usaba en código pero **nunca se sembró**; se corrige en `0021`).
5. **Cinco permisos nuevos + ajustes de matriz** (script `0021`, idempotente, patrón de `0017`): rutas ver/gestionar/autorizar, configuración gestionar y bandeja ver-todos; además CEM entra a `selecciones.puede_ver`/`selecciones.puede_gestionar`/`hospitales.puede_ver` (crea y envía la selección, ADR-00006 §Fase 4) y CA/DC a `selecciones.puede_ver` (abren documentos de rutas desde la Bandeja y la pantalla de Rutas). El SuperAdministrador hereda todos los permisos activos (bloque de `legacy/026`).

## Mapa endpoint → permiso (backend)

| Controlador | Lectura | Mutaciones | Firmar / especial |
|---|---|---|---|
| `HospitalesController` | `hospitales.puede_ver` | `hospitales.puede_gestionar` (extension, sincronizar) | — |
| `ProductosController` | `productos.puede_ver` | — | — |
| `TipoGerenciaController` | `hospitales.puede_ver` | — | — |
| `RegionesController` | `hospitales.puede_ver` (getAll, sugerencia, estados) | `configuracion.puede_gestionar` (CRUD, estados-catalogo, aplicar-mapeo, PATCH) | — |
| `EquiposPareoController` | `configuracion.puede_gestionar` | `configuracion.puede_gestionar` | — |
| `ParametrosModuloController` / `ParametrosAnestesiasController` | `configuracion.puede_gestionar` | `configuracion.puede_gestionar` | — |
| `ConfigRankingController` | `configuracion.puede_gestionar` | `configuracion.puede_gestionar` | — |
| `RankingHospitalesController` | `selecciones.puede_ver` | `selecciones.puede_gestionar` (lote de hospitales) | ranking: `selecciones.puede_ver` |
| `SeleccionesMensualesController` | `selecciones.puede_ver` | `selecciones.puede_gestionar` (crear, hospitales, agrupar, equipos, dividir, enviar-revisión) | firmar: `selecciones.puede_ver` + motor |
| `RutasController` | `rutas.puede_ver` | `rutas.puede_gestionar` (generar, cancelar, mover/agregar/quitar visitas) | firmar: `rutas.puede_ver` + motor |
| `RutasController` (asignaciones) | `talleres.puede_capturar` (propio usuario) | — | — |
| `TalleresController` | `talleres.puede_ver` (mis-talleres) | `talleres.puede_capturar` (crear/editar/eliminar/generar matriz) | reabrir: `talleres.puede_revisar` |
| `MatrizTalleresController` | `talleres.puede_ver` | costos AEM: `talleres.puede_capturar` | firmar: `talleres.puede_ver` + motor |
| `AprobacionesController` | `baseapp.hub.puede_ver_educacion_medica` (+ `puede_ver_todos` para el filtro `todos`) | — | — |

## Mapa ruta → permiso (frontend)

| Ruta | Permiso |
|---|---|
| `dashboard`, `aprobaciones` | `baseapp.hub.puede_ver_educacion_medica` |
| `catalogos/hospitales` | `educacion_medica.hospitales.puede_ver` |
| `catalogos/productos` | `educacion_medica.productos.puede_ver` |
| `catalogos/tipo-gerencia`, `regiones`, `equipos-pareo`, `parametros`, `config-ranking` | `educacion_medica.configuracion.puede_gestionar` |
| `programa-anual` | `educacion_medica.programas.puede_ver` |
| `seleccion` | `educacion_medica.selecciones.puede_ver` |
| `seleccion/:idSeleccion/rutas` | `educacion_medica.rutas.puede_ver` |
| `calendario`, `talleres`, `indicadores`, `panel-mes` | `educacion_medica.talleres.puede_ver` |
| `talleres/mis-talleres`, `mis-asignaciones` | `educacion_medica.talleres.puede_capturar` |
| `perfil` | sin guard |

El `PermissionGuard` usa `blockedPath="/educacion-medica/bloqueado"` (ruta que ya crea la fábrica `createAppRoutes`).

## Matriz rol↔permiso de los códigos nuevos

| Código | Roles |
|---|---|
| `educacion_medica.rutas.puede_ver` | Gerente de Ventas, Gerente General, Coordinador Administrativo, Director Corporativo, Coordinador de Educación Médica, Auxiliar Administrativo Educación Médica |
| `educacion_medica.rutas.puede_gestionar` | Coordinador de Educación Médica, Auxiliar Administrativo Educación Médica, Gerente de Ventas |
| `educacion_medica.rutas.puede_autorizar` | Gerente de Ventas, Coordinador Administrativo, Director Corporativo |
| `educacion_medica.configuracion.puede_gestionar` | Gerente de Ventas, Gerente General, Auxiliar Administrativo Educación Médica, Coordinador de Educación Médica, Coordinador Administrativo |
| `educacion_medica.aprobaciones.puede_ver_todos` | Gerente de Ventas, Gerente General, Coordinador Administrativo, Director Corporativo |

> **Asunción**: el "planificador" de rutas es CEM/AEM/GV (ADR-00006 §Fase 4: *"CEM crea y envía selección … planificador envía"*). Es editable en el admin de permisos.

## Fases

### Fase A — Cerrar la escalada horizontal (implementado)

- `RutasController.GetAsignaciones`: ruta `talleres/asignaciones` (sin `{idUsuario}`), `GetUserId()` del token.
- Frontend: `educacionMedica.api.ts` sin parámetro; `MisAsignacionesPage` y `MisTalleresPage` sin id.

### Fase B — `[HasPermission]` en los 14 controladores (implementado)

- Constantes tipadas en `Permissions.EducacionMedica` (`Shared/Constants/AuthorizationConstants.cs`).
- Atributos por el mapa de la tabla superior (clase o método según mezcla de lecturas/mutaciones).
- `RutasController`/`TalleresController` usan atributos por método (sus endpoints tienen permisos distintos).

### Fase C — Guards y menú (implementado)

- `EducacionMedicaRoutes.tsx`: cada página con `PermissionGuard` y `blockedPath` de subárbol.
- `menuItems.tsx`: `permission` por item (el sidebar oculta los no permitidos y los grupos vacíos).

### Fase D — Seed de permisos (script `0021`, en disco, **no aplicado**)

- `0021_20261008-1200_educacion-medica_seed-permisos-guards.lefarma.sql`: 5 permisos nuevos + matriz + ajustes CEM/CA/DC + re-grant del SuperAdministrador.

## Validación

- `dotnet build` 0 errores; **336/336** unit tests; `tsc` limpio; eslint limpio en archivos tocados; `vite build` OK.
- Pendiente: aplicar `0021` en LefarmaDev2 y probar por rol (menú, página, 200/403). **Sin `0021` aplicado, los endpoints de EM responden 403 a todos salvo SuperAdministrador** (los permisos nuevos no existen en BD).

## Consequences

- **Positivas**: la superficie HTTP del módulo queda cerrada por permiso real; la UI deja de mostrar páginas/acciones sin permiso; se corrige el hueco del permiso `puede_ver_todos`; los DTOs con datos del hospital (dirección/correo/coordenadas) dejan de ser consultables para terceros.
- **Negativas/neutrales**: durante la ventana entre desplegar el código y aplicar `0021`, el módulo queda bloqueado salvo SuperAdmin (aplicar el script en el mismo pase); el cache de permisos (5 min backend / polling frontend) retrasa cambios de matriz; los endpoints de `firmar` dependen del motor para la autorización fina (documentado).
- **Follow-ups**: el ADR-00008 (impartición: material, asistencias, evidencias, máquina de estados) deberá definir sus permisos y guards siguiendo este esquema; opcional: test de integración 403/200; prueba E2E por rol.

## Anexo — Fuentes

- `lefarma.database/educacion-medica/0017_20261007-1300_educacion-medica_seed-catalogos.lefarma.sql` — 20 permisos del módulo y su matriz rol↔permiso (roles EV/EP/GV/GG/CA/AEM/CEM/DC).
- `lefarma.database/legacy/026_rol_super_administrador.sql` — *"Cuando agregues un permiso nuevo a app.Permisos, corre este bloque otra vez"* (re-grant del SuperAdministrador).
- `lefarma.backend/src/Lefarma.API/Shared/Authorization/PermissionHandler.cs` — *"Validates permissions by delegating to UserPermissionService, which reads from app.RolesPermisos + app.UsuariosPermisos via a shared 5-minute IMemoryCache."*
- `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/` — los 14 controladores con `[HasPermission]`.
- `lefarma.frontend/src/apps/educacion-medica/EducacionMedicaRoutes.tsx` y `menuItems.tsx` — guards y permisos de navegación.
- `lefarma.database/educacion-medica/0021_20261008-1200_educacion-medica_seed-permisos-guards.lefarma.sql` — seed de los permisos nuevos.
