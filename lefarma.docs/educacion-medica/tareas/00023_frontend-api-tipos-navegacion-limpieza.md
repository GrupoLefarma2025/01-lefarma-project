# Tareas - 00023 Frontend: API, tipos, navegación y limpieza

> Tarea transversal de las tareas 00019-00022 y de [[decisiones/00009_permisos-y-guards-educacion-medica]].
> Depende de 00019 y 00020; idealmente se ejecuta por incrementos en paralelo a 00021/00022 y se cierra al final.

## Alcance

- Centralizar tipos y cliente API del nuevo modelo ejecutivo/especialista/suplente.
- Actualizar rutas y menú.
- Retirar la navegación del modelo de equipos sin borrar código histórico antes de tiempo.
- Alinear permisos/guards.
- Verificación final `build`/`lint`/E2E de las 5 tareas.

## Fase 1 - Tipos

- [ ] Revisar `educacionMedica.types.ts` y eliminar/ajustar:
  - [ ] `EquipoPareo` en flujos nuevos (conservar como legacy si aún lo usan pantallas históricas).
  - [ ] `EjecutivoRegion` sin `fechaInicio`/`fechaFin`.
  - [ ] `SeleccionRegion`/`SeleccionHospital` con `idEjecutivo`/`nombreEjecutivo`.
  - [ ] `Ruta` sin `idEjecutivo`; `RutaVisita` con `idEjecutivo` e `idTipoVisita`.
  - [ ] `MatrizIndividual` por ejecutivo.
  - [ ] `Taller` con `idRutaVisita`.
- [ ] Agregar:
  - [ ] `EjecutivoSuplente`.
  - [ ] `CalendarioItem`, `CalendarioFiltro`.
  - [ ] `AsignarEjecutivoRegionRequest`, `AsignarEjecutivoHospitalRequest`, `AsignarEjecutivoVisitaRequest`.
  - [ ] `CrearTallerRequest.idRutaVisita`.
- [ ] Evitar `any` y duplicar tipos entre páginas.

## Fase 2 - Cliente API

- [ ] Agregar funciones para:
  - [ ] Personas: ejecutivos, suplentes, especialistas.
  - [ ] Selección: ejecutivo por región y override por hospital.
  - [ ] Rutas: ejecutivo por visita.
  - [ ] Calendario: listado, detalle, sugerencias, actividad.
  - [ ] Talleres: crear desde visita, editar, mover, solicitar cambio, cancelar.
- [ ] Mantener compatibilidad con endpoints legacy de equipos solo para lecturas históricas.
- [ ] Revisar manejo de errores 409 y mensajes del backend.
- [ ] Incluir `AbortSignal` donde el patrón actual lo use.

## Fase 3 - Rutas y menú

- [ ] `EducacionMedicaRoutes.tsx`:
  - [ ] Agregar `/educacion-medica/personas`.
  - [ ] Reemplazar `/educacion-medica/calendario` por `CalendarioPage`.
  - [ ] Redirigir `/educacion-medica/seleccion/:id/rutas` al calendario con `idSeleccion`.
  - [ ] Redirigir `/educacion-medica/talleres/mis-talleres` al calendario con filtro “Mis talleres”.
  - [ ] Mantener `MatrizTalleresPage` para autorización/costos.
- [ ] Menú:
  - [ ] Agregar Personas.
  - [ ] Agregar Calendario (reemplaza Mi planeación).
  - [ ] Retirar “Equipos y pareo”.
  - [ ] Retirar “Mis talleres” como página; dejar acceso rápido dentro del calendario.
  - [ ] Revisar textos y orden de secciones.
- [ ] Conservar archivos `EquiposPareoPage`, `RutasPage`, `MiPlaneacionPage`, `MisTalleresPage` como legado hasta validar que no quedan enlaces; luego eliminarlos o marcarlos obsoletos.

## Fase 4 - Permisos y guards

- [ ] Alinear `PERMISOS` del frontend con `Permissions.EducacionMedica` del backend.
- [ ] Definir permisos de calendario/asignación:
  - [ ] Ver calendario.
  - [ ] Asignar especialista.
  - [ ] Asignar ejecutivo.
  - [ ] Editar fecha/hora.
  - [ ] Solicitar cambio.
- [ ] Guards en rutas y acciones; mostrar candado cuando el usuario no pueda editar.
- [ ] Verificar roles: CEM, GG, coordinador, GV, ejecutivo, especialista, AEM/CA.

## Fase 5 - Pruebas y cierre

- [ ] `npm run build`.
- [ ] `npm run lint`.
- [ ] Smoke E2E de las 5 tareas:
  - [ ] Personas: CRUD de ejecutivo/suplente/especialista.
  - [ ] Selección: ejecutivo, suplente, override.
  - [ ] Calendario: vistas, filtros, asignar especialista/ejecutivo, crear taller, mover.
  - [ ] Tabla/Matriz: cambio de vista, totales, candado, enlace a matriz general.
  - [ ] Roles/permisos.
- [ ] Buscar referencias residuales a `equipo`, `EquipoPareo`, `idEquipo` en flujos nuevos.
- [ ] Actualizar documentación de pantallas/menú.
- [ ] Reportar pendientes reales (no “legacy” si ya no se usa).

## Fuera de alcance

- Eliminación destructiva de tablas/columnas de equipos en backend (follow-up 00015).
- Rediseño de la pantalla de autorización de matriz.
- Reportes/indicadores.

## Estado de implementación (24-oct-2026)

Implementado:

- [x] La pantalla y el menú se muestran como **Colaboradores**; la ruta `/educacion-medica/personas` se conserva por compatibilidad.
- [x] Tipos alineados: `RutaVisita` con `idEjecutivo`, `idEspecialista` e `idTipoVisita`; `Taller` con `idRutaVisita`; `CalendarioItem` con ciudad y costo.
- [x] API de calendario, personas, selección y talleres reutilizada; sin nuevas duplicaciones en las pantallas del calendario.
- [x] `/seleccion/:id/rutas` redirige a calendario con `idSeleccion` y `vista=especialista`.
- [x] `/talleres/mis-talleres` redirige a calendario con `filtro=mis`.
- [x] `/catalogos/equipos-pareo` redirige a Colaboradores; las páginas legado quedan en disco.
- [x] Menú sin “Equipos y pareo” ni “Mis talleres”; Calendario usa `talleres.puede_ver`.
- [x] El calendario lee `filtro` desde query string y conserva la vista en `vista`.
- [x] Lectura de personas para filtros de calendario/selección autorizada con `talleres.puede_ver`; escritura sigue con `configuracion.puede_gestionar`.
- [x] `CalendarioController` de lectura usa `talleres.puede_ver`; las asignaciones siguen con `rutas.puede_gestionar`/`rutas.puede_ajustar`.

Pendientes reales:

- [ ] Eliminar o marcar obsoletos `EquiposPareoPage`, `RutasPage`, `MiPlaneacionPage` y `MisTalleresPage` después de validar que no existan enlaces externos.
- [ ] Endpoint de actividad reciente del calendario.
- [ ] E2E con roles reales (CEM, GV, ejecutivo, especialista, AEM/CA) y datos de producción.
- [ ] Exportación CSV/XLSX y validación de costos en Tabla/Matriz.
- [ ] `npm run lint` global: quedan errores preexistentes ajenos a este cierre; los archivos tocados pasan lint focalizado.