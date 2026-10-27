# Tareas - 00019 Frontend Personas: ejecutivos, suplentes y especialistas

> Implementa el frontend de [[decisiones/00015_reparto-ejecutivo-rutas-especialista]].
> Depende de la API de Personas ya implementada (`PersonasController`) y del script `0038` aplicado.
> Sustituye la pantalla inexistente de Personas y elimina la dependencia visual de `EquiposPareo`.
>
> **Estado 2026-10-23:** frontend implementado; `build` y `lint` de los archivos nuevos en verde. Falta prueba manual contra backend con `0038` aplicado.

## Alcance

Una sola pantalla `PersonasPage` con tres tabs:

1. **Ejecutivos**: usuario, gerencia (derivada de la región), región(es) y estado. Sin columnas de vigencia.
2. **Suplentes**: usuario, gerencia (`Todas` si `idTipoGerencia = NULL`), región (`Todas` si `idRegionCatalogo = NULL`) y estado.
3. **Especialistas**: usuario, gerencias permitidas, región preferida y estado.

La lista de suplentes vive dentro de la misma pantalla, como pidió el usuario.

## Fase 0 - Contrato y datos

- [ ] Revisar con el usuario los textos de ayuda:
  - [ ] Ejecutivo: "dueño de la región en la selección".
  - [ ] Suplente: "cubre si no hay ejecutivo primario; nunca es la primera sugerencia".
  - [ ] `Todas` = cobertura total.
- [ ] Confirmar permisos: `educacion_medica.configuracion.puede_gestionar` para toda la pantalla.
- [ ] Verificar que `0038` esté aplicado en el ambiente.

## Fase 1 - API y tipos

- [x] Agregar tipos en `educacionMedica.types.ts`:
  - [x] `EjecutivoRegion` sin `fechaInicio`/`fechaFin`.
  - [x] `CrearEjecutivoRegionRequest` sin fechas.
  - [x] `ActualizarEjecutivoRegionRequest` sin fechas.
  - [x] `EjecutivoSuplente`, `CrearEjecutivoSuplenteRequest`, `ActualizarEjecutivoSuplenteRequest`.
  - [x] Tipos de especialista (`EspecialistaPersona`, gerencias, región preferida).
- [x] Agregar funciones en `educacionMedica.api.ts`:
  - [x] `personas.ejecutivos.list/create/update/deactivate`.
  - [x] `personas.suplentes.list/create/update/deactivate`.
  - [x] `personas.especialistas.list/save`.
- [x] Mantener `UsuarioSearchSelect` para buscar usuarios de Asokam.

## Fase 2 - Pantalla y componentes

- [x] Crear `pages/personas/PersonasPage.tsx`.
- [ ] Crear componentes:
  - [x] Tabs shadcn (`Ejecutivos` / `Suplentes` / `Especialistas`).
  - [x] `EjecutivoFormModal`.
  - [x] `SuplenteFormModal`.
  - [x] `EspecialistaFormModal`.
- [x] Filtros compartidos: búsqueda, gerencia, región, solo activos.
- [x] Tablas con acciones, contadores y orden visual por catálogo.
- [x] Estados vacíos, loading, error y confirmación de desactivación.
- [x] En suplentes mostrar `Todas` con ayuda; al elegir región, sincronizar la gerencia.
- [x] Validar duplicados/errores 409 del backend y conflicto de gerencia en cliente.
- [x] En ejecutivos, mostrar la gerencia derivada de la región; no pedir gerencia manual.
- [x] No mostrar “equipo” en ninguna parte.

## Fase 3 - Rutas, menú y permisos

- [x] Agregar ruta `/educacion-medica/personas` en `EducacionMedicaRoutes.tsx`.
- [x] Agregar item “Personas” en el menú, bajo Catálogos.
- [x] Envolver con `PermissionGuard` usando `configuracion`.
- [x] Retirar el acceso a `Equipos y pareo` del menú (la página queda como legado hasta la limpieza 00023).

## Fase 4 - Verificación

- [x] `npm run build` (frontend completo).
- [x] `npm run lint` de archivos nuevos (sin errores; el repo tiene errores preexistentes fuera de esta tarea).
- [ ] Crear ejecutivo, suplente con cobertura total, suplente por región y especialista contra backend real.
- [ ] Desactivar/reactivar cada uno y verificar filtros.
- [ ] Verificar que un suplente con región no permita gerencia incompatible.
- [ ] Verificar que no se envíen fechas de vigencia.
- [ ] Prueba visual desktop y móvil (tablas con scroll horizontal).

## Fuera de alcance

- Asignar ejecutivos a una selección (tarea 00020).
- Editar suplentes desde la selección.
- Historial de cambios de personas (solo `activo` + auditoría).
