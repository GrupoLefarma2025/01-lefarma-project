# Tareas — 00013 Mi planeación semanal (personal) y handoff a viáticos

> Vinculada a: [[decisiones/00013_planeacion-personal-viaticos]]
> Fases: 0 plan/revisión, 1 backend mínimo, 2 frontend, 3 dashboard, 4 handoff viáticos (implementada), 5 FOR-006 (fuera).

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
- [x] **Vista Semana**: Lun-Vie con tarjetas blancas por día (solo lectura): fecha larga con badges "Hoy/Mañana" (sin repetir día corto), métricas con iconos (visitas, talleres, días con actividad), iconos, región en pill sólida, horario o "Sin hora", y hover.
  - [x] Visita: hospital, hora salida–llegada, región, badge "Extraordinaria".
  - [x] Taller: hospital, hora, estado; enlace a Mis talleres.
- [x] Ajustes visuales: controles (Hoy, Actualizar, atrás/adelante) con fondo; badges con color sólido o texto plano (sin bordes vacíos); fondos sólidos en cards, ítems y métricas.
- [x] **Vista Rutas a pantalla completa**: selector compacto de ruta (dropdown si hay varias) + metadatos de equipo/región como texto con iconos + métricas con iconos (destinos, días, rango, cotización).
- [x] Tabla agrupada por día: encabezado con fecha larga y "Hoy/Mañana", fondos alternados sólidos por bloque, icono de hospital, región en pill sólida, horario o "Sin hora", tipo Normal/Extraordinaria (texto/badge) y hover en filas.
- [x] **Modal de cotización por ruta** (`CotizarRutaModal`): permite enviar toda la ruta o seleccionar algunos destinos; conteo y toast "Próximamente" (sin handoff real).
- [x] Controles con fondo: tabs `Semana/Rutas`, `Hoy` (primario), atrás/adelante y `Actualizar` (fondo neutro); contenedor ampliado a `max-w-7xl`.
- [x] Talleres desde `mis-talleres` (mes) filtrados por semana en cliente; se refrescan al crearse/editarse (botón Actualizar).
- [x] Reutilizar helpers de fecha de `rutasUtils` y el lenguaje visual de `SemanaRuta`/`DiaRuta`, **sin** DnD ni capacidad.
- [x] Estados vacíos por día/semana/rutas; responsive (semana apilada en móvil).
- [x] `npm run build` + ESLint en archivos tocados _(en verde)_.
- [x] Botón visual **"Cotizar viáticos" por ruta** (abre el modal de selección; sin handoff). Se retiró del header para evitar mandar solo la semana.
- [ ] Verificación por rol (EV/EP con equipo; otros roles ven vacío/oculto).

> Archivos: `pages/planificacion/MiPlaneacionPage.tsx` (nuevo), `pages/planificacion/components/CotizarRutaModal.tsx` (nuevo), `pages/planificacion/viaticosHandoff.ts` (nuevo), `pages/planificacion/viaticosHandoff.test.ts` (nuevo), `EducacionMedicaRoutes.tsx` y `menuItems.tsx` actualizados; `CalendarioPage.tsx` (wireframe) eliminado.
> La página carga todas las asignaciones (sin rango) para poder agrupar por ruta; la semana se filtra en cliente. Los filtros `desde`/`hasta` del endpoint siguen disponibles para otros consumidores.

## Fase 3 — Dashboard

- [x] Mini agenda **"Próximos 7 días"** (visitas + talleres) en el dashboard, con el mismo origen de datos (sin llamadas nuevas).
- [x] La tarjeta "Mis visitas del mes" enlaza a "Mi planeación" (`/calendario`).
- [x] `npm run build` + ESLint _(en verde)_.

> Nota: la mini agenda usa los talleres del periodo actual del dashboard; si la ventana de 7 días cruza de mes, los talleres del siguiente mes se verán al cambiar el periodo.

## Fase 4 — Handoff a viáticos (implementada)

> **Extensión (2026-10-22):** ver [[tareas/00014_cotizaciones-por-ruta-viaticos]] — tabla liga por visita, múltiples cotizaciones por ruta, bloqueo de visitas activas y costo. La dedupe por ruta de esta fase queda sustituida por la dedupe por conjunto de visitas del ADR-00014.

- [x] Snapshot `solicitud-v2`: persona, transporte por defecto, origen/retorno vacíos, destinos **solo con coordenadas y sin hora**, y bloque `origenEm` con `idRuta`/`idSeleccionMensual`/ids de visitas para trazabilidad.
- [x] Crear borrador con `POST /viaticos/solicitudes` (`sistema_origen: educacion_medica`) y navegar a `/viaticos/solicitud/:id`.
- [x] Reutilizar un borrador existente de la misma ruta (dedupe) y avisar al usuario.
- [x] Modal agrupado por día: check por día, check por hospital, contador de seleccionables y botón **"Copiar lista"** para los hospitales sin coordenadas (deshabilitados y con aviso).
- [x] Ocultar el botón "Cotizar viáticos" si el usuario no tiene `viaticos.solicitar`.
- [x] Tests unitarios del snapshot (coordenadas, sin hora, trazabilidad) y build/lint en verde.
- [ ] Asignar la matriz de roles de Viáticos (`viaticos.solicitar` para EV/EP; `autorizar` para GV/CA/GG/DC) — **lo hará el usuario**.
- [ ] Catálogo/estimador oficial del ADR-00003 (`viatico_tarifas`) — pendiente, no bloquea (se cotiza con ADR-00007).
- [ ] Verificación E2E/visual del flujo completo (ruta → modal → borrador → asistente → cotización).

## Fase 5 — FOR-006 (fuera de este plan)

- [ ] Decidir si el calendario mensual de talleres del AEM (FOR-006) se implementa aparte o se funde en la Matriz.
- [ ] No mezclarlo con "Mi planeación".

## Riesgos y notas

- **Solo rutas confirmadas**: los borradores de planeación no se muestran (regla actual de asignaciones).
- **Selecciones vencidas**: el endpoint actual excluye selecciones vencidas; el histórico de meses pasados queda limitado hasta cambiar esa regla.
- **Talleres**: se muestran por mes y se filtran por semana en cliente; si el volumen crece, agregar filtro semanal al endpoint.
- **Viáticos**: el handoff funciona con `viaticos.solicitar` (el usuario asignará la matriz); el catálogo oficial sigue pendiente y se usa la cotización real (ADR-00007). Los hospitales sin coordenadas no se envían y se avisa al gerente.
- **Permisos EM**: `0032` (CEM/guards) queda en manos del usuario; no se aplica en este plan.

## Criterios de aceptación (Fases 1–4)

- EV/EP ven su semana (Lun-Vie) con visitas y talleres, horas y estados; navegación por semana y "Hoy".
- Solo se muestran datos de su equipo (el backend ya filtra por participación).
- El endpoint de asignaciones acepta `desde`/`hasta` y devuelve horas; sin filtros conserva el comportamiento actual.
- Sin endpoints nuevos; sin cambios de esquema.
- Dashboard muestra "Próximos 7 días" y enlaza a "Mi planeación".
- Handoff: el botón se oculta sin `viaticos.solicitar`; el modal agrupa por día y excluye hospitales sin coordenadas; crea/reutiliza borrador y abre el asistente con los destinos.
- `dotnet build`/tests y `npm run build`/ESLint/unitarios en verde.
