# Tareas — 00013 Mi planeación semanal (personal) y handoff futuro a viáticos

> Vinculada a: [[decisiones/00013_planeacion-personal-viaticos]]
> Fases: 0 plan/revisión, 1 backend mínimo, 2 frontend, 3 dashboard, 4 handoff viáticos (futuro), 5 FOR-006 (fuera).

## Fase 0 — Plan y revisión

- [x] Decisión del usuario: vista **semanal personal** (como rutas), no calendario mensual.
- [x] Decisión del usuario: **visitas + talleres**; los talleres se actualizan al crearse.
- [x] Decisión del usuario: reutilizar el endpoint existente y **agregar filtros**.
- [x] Decisión del usuario: **handoff a viáticos al final** del plan.
- [x] Decisión del usuario: **sin permisos nuevos por ahora**; dejar documentados los futuros.
- [x] Decisión del usuario: el script `0032` lo aplica/revisa el usuario; fuera de este plan.
- [ ] Revisión del usuario de este ADR y la tarea.

## Fase 1 — Backend mínimo (extender lo existente)

- [x] `AsignacionDto`: agregar `horaSalida`/`horaLlegada` (TimeOnly, desde `RutaVisita`).
- [x] `GET /talleres/asignaciones`: parámetros opcionales `desde`/`hasta` (DateOnly inclusivos); sin parámetros = comportamiento actual; rango invertido → `400`.
- [x] `GetAsignacionesAsync`: filtrar visitas por rango y mapear horas.
- [x] Tests: rango inclusivo + horas (`GetAsignacionesAsync_ConRango_Debe_FiltrarYExponerHoras`); los 4 tests de `DashboardServiceTests` siguen en verde.
- [x] `dotnet build` 0 errores; pruebas del cambio 5/5 en verde. _(La suite completa: 487/491; los 4 fallos son preexistentes de `RutasServiceTests` por fechas fijas vencidas, ajenos a esta fase.)_
- [x] Verificación en vivo con DevToken: 18 asignaciones con `horaSalida`/`horaLlegada` en el JSON (null en datos actuales) y rango invertido → `400`.
- [x] **Sin endpoint nuevo y sin permisos nuevos.**

## Fase 2 — Frontend "Mi planeación"

- [x] Reemplazar el wireframe `CalendarioPage` por la página real (ruta `/educacion-medica/calendario`).
- [x] Renombrar el ítem del menú "Calendario" → **"Mi planeación"** (mismo path).
- [x] Header con tabs **Semana / Rutas**, equipo (EV + EP), región, navegación ‹ Semana › + "Hoy", filtros `Todo / Visitas / Talleres`.
- [x] **Vista Semana**: Lun-Vie con tarjetas por día (solo lectura):
  - [x] Visita: hospital, hora salida–llegada, región, badge "Extraordinaria".
  - [x] Taller: hospital, hora, estado; enlace a Mis talleres.
- [x] **Vista Rutas a pantalla completa**: selector compacto de ruta (dropdown si hay varias) + badges de equipo/región + métricas (destinos, días, rango, cotización).
- [x] Tabla agrupada por día: encabezado con fecha larga y "Hoy/Mañana", fondos alternados por bloque, icono de hospital, región en pill, horario o badge "Sin hora", tipo Normal/Extraordinaria y hover en filas.
- [x] **Modal de cotización por ruta** (`CotizarRutaModal`): permite enviar toda la ruta o seleccionar algunos destinos; conteo y toast "Próximamente" (sin handoff real).
- [x] Controles con color: tabs `Semana/Rutas`, `Hoy`, atrás/adelante y `Actualizar`; contenedor ampliado a `max-w-7xl`.
- [x] Talleres desde `mis-talleres` (mes) filtrados por semana en cliente; se refrescan al crearse/editarse (botón Actualizar).
- [x] Reutilizar helpers de fecha de `rutasUtils` y el lenguaje visual de `SemanaRuta`/`DiaRuta`, **sin** DnD ni capacidad.
- [x] Estados vacíos por día/semana/rutas; responsive (semana apilada en móvil).
- [x] `npm run build` + ESLint en archivos tocados _(en verde)_.
- [x] Botón visual **"Cotizar viáticos" por ruta** (abre el modal de selección; sin handoff). Se retiró del header para evitar mandar solo la semana.
- [ ] Verificación por rol (EV/EP con equipo; otros roles ven vacío/oculto).

> Archivos: `pages/planificacion/MiPlaneacionPage.tsx` (nuevo), `pages/planificacion/components/CotizarRutaModal.tsx` (nuevo), `EducacionMedicaRoutes.tsx` y `menuItems.tsx` actualizados; `CalendarioPage.tsx` (wireframe) eliminado.
> La página carga todas las asignaciones (sin rango) para poder agrupar por ruta; la semana se filtra en cliente. Los filtros `desde`/`hasta` del endpoint siguen disponibles para otros consumidores.

## Fase 3 — Dashboard

- [x] Mini agenda **"Próximos 7 días"** (visitas + talleres) en el dashboard, con el mismo origen de datos (sin llamadas nuevas).
- [x] La tarjeta "Mis visitas del mes" enlaza a "Mi planeación" (`/calendario`).
- [x] `npm run build` + ESLint _(en verde)_.

> Nota: la mini agenda usa los talleres del periodo actual del dashboard; si la ventana de 7 días cruza de mes, los talleres del siguiente mes se verán al cambiar el periodo.

## Fase 4 — Handoff a viáticos (futura, no implementar ahora)

> El botón "Cotizar viáticos" ya se muestra **por ruta** en la vista Rutas, en modo visual (sin acción; toast "Próximamente"). Al implementar esta fase se conecta el prefill y los permisos.

- [ ] Diseñar el contrato de prefill **de la ruta completa** (todas sus visitas/destinos con fecha, hora, hospital y coordenadas) → `/viaticos/solicitud` (hoy el wizard solo hidrata borradores por `:id`).
- [ ] Conectar el botón "Cotizar viáticos" de cada ruta al handoff (no a la semana visible).
- [ ] Dependencias:
  - [ ] Catálogo/estimador oficial del ADR-00003 (`viatico_tarifas`) **o** decisión de cotizar solo con la capa real del ADR-00007.
  - [ ] Matriz de roles de Viáticos (hoy **solo SuperAdministrador**).
- [ ] **Permisos requeridos a futuro** (dejar sembrado en la matriz cuando se apruebe):
  - `viaticos.solicitar` → EV/EP.
  - `viaticos.autorizar` → GV/CA/GG/DC.
  - `viaticos.ver_todos`, `viaticos.ajustar` → según operación.
  - ADR-00007: `educacion_medica.viaticos_costos_ruta.puede_cotizar` / `.puede_ver_capturas` (hoy provisionales de SuperAdmin).
  - ADR-00003: `educacion_medica.viaticos_tarifas.puede_ver` / `.puede_editar`, `educacion_medica.viaticos.puede_cotizar` / `.puede_aprobar` (reconciliar códigos con los implementados).
- [ ] Actualizar este ADR/tarea cuando se apruebe el handoff.

## Fase 5 — FOR-006 (fuera de este plan)

- [ ] Decidir si el calendario mensual de talleres del AEM (FOR-006) se implementa aparte o se funde en la Matriz.
- [ ] No mezclarlo con "Mi planeación".

## Riesgos y notas

- **Solo rutas confirmadas**: los borradores de planeación no se muestran (regla actual de asignaciones).
- **Selecciones vencidas**: el endpoint actual excluye selecciones vencidas; el histórico de meses pasados queda limitado hasta cambiar esa regla.
- **Talleres**: se muestran por mes y se filtran por semana en cliente; si el volumen crece, agregar filtro semanal al endpoint.
- **Viáticos**: sin catálogo/estimador oficial y sin permisos de negocio; el handoff no se puede cerrar hasta resolverlos.
- **Permisos EM**: `0032` (CEM/guards) queda en manos del usuario; no se aplica en este plan.

## Criterios de aceptación (Fases 1–3)

- EV/EP ven su semana (Lun-Vie) con visitas y talleres, horas y estados; navegación por semana y "Hoy".
- Solo se muestran datos de su equipo (el backend ya filtra por participación).
- El endpoint de asignaciones acepta `desde`/`hasta` y devuelve horas; sin filtros conserva el comportamiento actual.
- Sin permisos nuevos; sin endpoints nuevos; sin cambios de esquema.
- Dashboard muestra "Próximos 7 días" y enlaza a "Mi planeación".
- `dotnet build`/tests y `npm run build`/ESLint en verde.
