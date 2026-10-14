# Tareas — 00009 Permisos y guards de Educación Médica

> Vinculada a: [[decisiones/00009_permisos-y-guards-educacion-medica]]
> Misma división por fases que la decisión: A Escalada horizontal, B Backend, C Frontend, D Seed SQL, E Verificación.
> Complementa [[tareas/00007_modulo-matriz-talleres]] y antecede a [[tareas/00008_modulo-imparticion-talleres]] (que deberá respetar este esquema de permisos).

## Fase A — Cerrar la escalada horizontal

- [x] `RutasController.GetAsignaciones`: ruta `talleres/asignaciones` sin `{idUsuario}`, usa `GetUserId()` del token + `[HasPermission(talleres.puede_capturar)]`
- [x] `educacionMedica.api.ts`: `rutas.asignaciones()` sin parámetro
- [x] `MisAsignacionesPage` y `MisTalleresPage`: sin `userId` en la llamada (se retiró `useAuthStore` huérfano)

## Fase B — `[HasPermission]` en los 14 controladores

- [x] Constantes tipadas en `Permissions.EducacionMedica` (`AuthorizationConstants.cs`): hub, hospitales ver/gestionar, productos ver, selecciones ver/gestionar, rutas ver/gestionar, configuración gestionar, talleres ver/capturar/revisar, bandeja ver-todos
- [x] Clase completa: `ProductosController`, `TipoGerenciaController` (ver de hospitales), `RegionesController` (ver de hospitales + configurar en mutaciones/estados-catalogo), `EquiposPareoController`, `ParametrosModuloController`, `ParametrosAnestesiasController`, `ConfigRankingController`, `RankingHospitalesController` (ver + gestionar en lote), `MatrizTalleresController` (ver + capturar en costos), `AprobacionesController` (hub)
- [x] Por método: `HospitalesController` (ver/gestionar), `SeleccionesMensualesController` (ver + gestionar en 8 mutaciones), `RutasController` (ver/gestionar/firmar/capturar), `TalleresController` (ver/capturar/revisar)
- [x] Firmar = permiso de ver del módulo + validación de participante del motor (sin política OR)
- [x] `dotnet build` 0 errores; 336/336 unit tests

## Fase C — Guards y menú (frontend)

- [x] `EducacionMedicaRoutes.tsx`: `PermissionGuard` por ruta con `blockedPath="/educacion-medica/bloqueado"` (mapa del ADR)
- [x] `menuItems.tsx`: `permission` por item (el sidebar oculta items y grupos vacíos)
- [x] `tsc` limpio; eslint limpio en archivos tocados; `vite build` OK

## Fase D — Seed SQL (script 0021)

- [x] Crear `0021_20261008-1200_educacion-medica_seed-permisos-guards.lefarma.sql` (idempotente, transacción única, estilo 0017)
  - [x] 5 permisos nuevos (rutas ver/gestionar/autorizar, configuración, bandeja ver-todos)
  - [x] Matriz rol↔permiso de los códigos nuevos
  - [x] Ajustes: CEM a `selecciones.puede_ver/gestionar` y `hospitales.puede_ver`; CA/DC a `selecciones.puede_ver`
  - [x] Re-grant del SuperAdministrador (patrón `legacy/026`)
- [x] Validar sintaxis con `PARSEONLY` contra LefarmaDev2 (sin ejecutar; exit 0)
- [ ] **Revisión del usuario del script**
- [ ] Ejecutar `0021` en **LefarmaDev2** (aplicar junto con el despliegue: sin él los endpoints quedan 403 salvo SuperAdmin)
- [ ] Ejecutar `0021` en **Lefarma** (prod; aplicar con el usuario)

## Fase E — Verificación y cierre

- [x] `dotnet test` (336/336), `tsc`, eslint de tocados, `vite build`
- [ ] Prueba por rol (EV/EP/GV/AEM/CA/DC/CEM/GG):
  - [ ] Menú y páginas visibles según la matriz
  - [ ] API 200 en flujos propios; **403** con usuario sin permiso (p. ej. EV en configuración)
  - [ ] `mis-asignaciones` de otro usuario ya no es consultable (endpoint propio)
  - [ ] Filtro "todos" de la Bandeja con y sin `puede_ver_todos`
- [ ] Opcional: test de integración 403/200 con `WebApplicationFactory`
- [ ] Marcar ADR-00009 como `Accepted` al aprobarse
