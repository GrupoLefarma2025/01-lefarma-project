---
fecha_creacion: 2026-10-10 20:00
fecha_modificacion: 2026-10-10 20:00
resumen: Pantalla "Mi planeación" para EV/EP — vista semanal de solo lectura de su ruta confirmada (visitas) más los talleres del equipo, con horas, navegación por semana y filtros. Reutiliza los endpoints existentes (asignaciones con filtros desde/hasta y mis-talleres) sin permisos nuevos. El handoff a la cotización de viáticos queda como última fase (requiere prefill, permisos viaticos.solicitar y el catálogo/estimador pendiente). Sustituye el wireframe de Calendario; el FOR-006 (calendario de talleres) queda como decisión aparte.
---

# 00013 — Mi planeación semanal (personal) y handoff futuro a viáticos

## Status

Proposed

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Contexto y hallazgos|Contexto y hallazgos]]
- [[#Fases|Fases]]
- [[#Pantalla y datos|Pantalla y datos]]
- [[#Permisos (hoy y a futuro)|Permisos (hoy y a futuro)]]
- [[#Consequences|Consequences]]
- [[#Anexo — fuentes|Anexo — fuentes]]

## Decisión

Reemplazar el wireframe de **Calendario** por **"Mi planeación"**: una pantalla **personal y de solo lectura** para EV/EP con dos vistas:

1. **Semana**: visitas confirmadas y talleres de la semana (con horas), navegación ‹ Semana › y filtros.
2. **Rutas**: todas las rutas confirmadas del usuario, agrupadas por ruta, con la lista completa de sus destinos/visitas.

El **handoff a la cotización de viáticos** queda como **última fase** (no se implementa en esta entrega): un botón **"Cotizar viáticos" por ruta** abrirá un modal para enviar **toda la ruta o solo los destinos seleccionados** a `/viaticos/solicitud` con el prefill correspondiente. La cotización y la autorización viven en el módulo de Viáticos.

El **FOR-006** (calendario mensual de talleres del AEM) **no es esta pantalla**: queda como decisión separada (implementarlo aparte o fundirlo en la Matriz).

## Contexto y hallazgos

- Hoy `CalendarioPage.tsx` es un wireframe (mes + tabla de talleres) sin API. El menú "Calendario" usa `talleres.puede_ver`.
- Ya existen tres superficies que muestran visitas del equipo: la planeación semanal (`RutasPage`, con drag & drop y capacidad), la lista `Mis hospitales del mes` (`/mis-asignaciones`) y la tarjeta del dashboard (`/dashboard`). Un calendario mensual nuevo duplicaría las tres.
- La planeación de rutas es **semanal** (ADR-00004: Lun-Vie, 3/día, 8/semana, viajes foráneos) y el ejecutivo recibe su asignación el día 15 por correo (sustituido por "Asignación del Ejecutivo", ADR-00001). La vista personal semanal es la evolución natural de esa asignación.
- **Viáticos es un proceso vecino**, no integrado:
  - ADR-00001 lo dejó fuera del alcance del módulo.
  - ADR-00003 (catálogo `viatico_tarifas` como estimado oficial) está `Superseded by ADR-00007`; **la tabla/seed/CRUD no existen** en la BD ni en el backend.
  - ADR-00007 (Accepted) implementó la capa de cotización real con evidencia (`POST /viaticos/costos-ruta/calcular`), pero el wizard de Viáticos captura origen/destinos **a mano** y no consume rutas de EM.
  - Los permisos de Viáticos (`viaticos.solicitar/autorizar/ver_todos/ajustar`) hoy **solo los tiene SuperAdministrador** (verificado en Asokam); la matriz de roles de Viáticos está pendiente.
- El dashboard (ADR-00012) ya consume `GET /dashboard?periodo` con visitas + talleres; la mini agenda "Próximos 7 días" puede reutilizar esta vista.

## Fases

### Fase 0 — Plan y revisión (esta entrega)

Se acuerda: vista semanal personal, visitas + talleres, reutilizar endpoints con filtros, sin permisos nuevos, handoff a viáticos al final y FOR-006 aparte. **Por qué:** valida la UX sin abrir frentes de permisos ni de cotización.

### Fase 1 — Backend mínimo (extender lo existente)

- `AsignacionDto`: exponer `horaSalida`/`horaLlegada` (de `RutaVisita`).
- `GET /talleres/asignaciones`: parámetros opcionales `desde`/`hasta` (DateOnly, inclusivos); sin parámetros conserva el comportamiento actual. Rango invertido (`desde > hasta`) responde `400`.
- Tests del servicio: rango inclusivo, sin rango = actual, horas mapeadas.
- **Sin endpoint nuevo y sin permisos nuevos.**

**Por qué:** la vista semanal necesita horas y un rango; extender el endpoint que ya usan "Mis hospitales" y el dashboard evita duplicar consultas y permisos.

### Fase 2 — Frontend "Mi planeación"

- Reemplazar el wireframe (`CalendarioPage`) por la página real; renombrar el ítem del menú a **"Mi planeación"** (se conserva la ruta `/educacion-medica/calendario` para no romper enlaces).
- **Vista Semana**: header con equipo/región, navegación ‹ Semana › + "Hoy", filtros `Todo / Visitas / Talleres`; semana Lun-Vie con tarjetas por día (solo lectura): visitas (hospital, hora, región, extraordinaria) y talleres (hospital, hora, estado).
- **Vista Rutas a pantalla completa**: selector compacto de ruta (dropdown si hay varias), badges de equipo/región, métricas (destinos, días, rango, cotización) y tabla de visitas **agrupada por día** (encabezado con fecha larga y "Hoy/Mañana", fondos alternados por bloque, icono de hospital, región como pill, horario o "Sin hora", tipo Normal/Extraordinaria y hover). El botón "Cotizar viáticos" abre un **modal de selección** (todos o algunos destinos).
- Reutilizar el lenguaje visual de `SemanaRuta`/`DiaRuta` y helpers de fecha (`rutasUtils`), pero **sin** DnD ni badges de capacidad.
- Talleres desde `GET /talleres/mis-talleres` (mes) filtrados por semana en cliente; enlace a "Mis talleres" para el detalle.
- Estados vacíos por día/semana/rutas; responsive (semana apilada en móvil).

**Por qué:** la semana responde "qué tengo esta semana"; la vista por rutas responde "qué rutas tengo y cuáles puedo mandar a cotizar" (la ruta es la unidad del viaje, no la semana).

### Fase 3 — Reutilización en el dashboard

- Mini agenda **"Próximos 7 días"** (visitas + talleres) con el mismo origen de datos.
- La tarjeta "Mis visitas del mes" enlaza a "Mi planeación".

### Fase 4 — Handoff a viáticos (futura, no en esta entrega)

> Mientras se implementa, cada ruta muestra el botón **"Cotizar viáticos"** en modo visual (abre el modal de selección; sin acción real; toast "Próximamente") para validar la UX.

- Botón **"Cotizar viáticos" por ruta** en la vista **Rutas** de "Mi planeación".
- El modal permite **toda la ruta o un subconjunto de destinos**; el payload del handoff es la selección (todas las visitas/destinos con fecha, hora, hospital y coordenadas, o solo las marcadas).
- Contrato de prefill hacia `/viaticos/solicitud` (ruta/equipo/visitas con fechas, horas y hospitales) o un endpoint de borrador; hoy el wizard solo hidrata borradores por `:id`.
- Dependencias: implementar el catálogo/estimador oficial (ADR-00003) o aceptar la capa de cotización real (ADR-00007); sembrar la matriz de roles de Viáticos (`viaticos.solicitar` para EV/EP; `autorizar` para GV/CA/GG/DC) y reconciliar los códigos documentados con los implementados.
- **Permisos requeridos a futuro:** ver sección siguiente.

### Fase 5 — FOR-006 (fuera de este plan)

Decidir si el calendario de talleres del AEM se implementa como pantalla propia o se funde en la Matriz (las fechas ya viven ahí). No se mezcla con "Mi planeación".

## Pantalla y datos

| Bloque | Fuente | Notas |
|---|---|---|
| Asignaciones (vista Semana y Rutas) | `GET /talleres/asignaciones` | Se cargan todas las visitas del usuario; la semana se filtra en cliente. Incluye horas y extraordinaria; permiso `talleres.puede_capturar` |
| Talleres del mes | `GET /talleres/mis-talleres?periodo=YYYY-MM` | Se filtran por semana en cliente; se actualizan al crear/editar talleres; permiso `talleres.puede_ver` |
| Rutas | Agrupación en cliente por `idRuta` | `nombreRuta`, total de destinos y rango de fechas |
| Cotización (visual) | Modal `CotizarRutaModal` | Selección de todos o algunos destinos; conteo y toast; sin envío real |
| Encabezado del equipo | `mis-talleres` (`nombreEjecutivo`, `nombreEspecialista`, `nombreRegion`) | — |
| Navegación | Cliente | Semana ISO; "Hoy"; sin selector de mes |

- **Día de la semana:** Lun-Vie (la planeación no usa fines de semana).
- **Tarjeta de visita:** hospital, hora salida–llegada, región, badge "Extraordinaria".
- **Tarjeta de taller:** hospital, hora, estado; clic/enlace a Mis talleres.
- **Vacío:** "Sin visitas ni talleres esta semana".
- **Lista:** se mantiene "Mis hospitales del mes" como pantalla aparte por ahora; fusionarla como pestaña "Lista" es una decisión posterior (no bloquea).

## Permisos (hoy y a futuro)

**Hoy (sin cambios):**
- `educacion_medica.talleres.puede_capturar` → visitas (endpoint de asignaciones).
- `educacion_medica.talleres.puede_ver` → talleres (`mis-talleres`) y visibilidad del menú.
- No se crean permisos nuevos.

**A futuro, solo para el handoff de viáticos (resaltado):**
- `viaticos.solicitar` → crear/editar la solicitud de viáticos (EV/EP).
- `viaticos.autorizar` → aprobar/rechazar (GV/CA/GG/DC).
- `viaticos.ver_todos` → concentrado global.
- `viaticos.ajustar` → ajustes.
- Del ADR-00007: `educacion_medica.viaticos_costos_ruta.puede_cotizar` / `.puede_ver_capturas` (hoy provisionales de SuperAdmin).
- Del ADR-00003: `educacion_medica.viaticos_tarifas.puede_ver` / `.puede_editar` y `educacion_medica.viaticos.puede_cotizar` / `.puede_aprobar` (documentados; reconciliar con los implementados antes de sembrar).
- Estado actual: **solo SuperAdministrador** tiene permisos de viáticos; la matriz de roles está pendiente.
- El script `0032` (permisos EM/CEM) queda fuera de este plan; lo aplica el usuario.

## Consequences

**Positivas**
- El equipo ve su semana real (visitas + talleres) en una sola pantalla, con horas y sin capturar nada.
- La vista por rutas permite revisar todas las rutas confirmadas y preparar la cotización de la **ruta completa**.
- Reutiliza endpoints existentes; sin backend nuevo ni permisos nuevos en Fase 1–3.
- Los talleres se actualizan solos al crearse/editarse.
- Deja preparado el handoff natural a Viáticos.

**Negativas**
- Solo muestra rutas **confirmadas** (los borradores de planeación no se ven).
- El rango de fechas del endpoint excluye selecciones vencidas por la regla actual de asignaciones; el histórico de meses pasados queda limitado hasta ajustar esa regla.
- Sin catálogo/estimador oficial de viáticos, el handoff no puede completarse todavía.

**Neutras**
- El menú "Calendario" cambia de nombre a "Mi planeación"; el path se conserva.
- El FOR-006 (calendario de talleres) sigue pendiente como decisión aparte.
- "Mis hospitales del mes" se mantiene; su fusión como pestaña es opcional.
- La mini agenda del dashboard usa los talleres del periodo actual; si la ventana de 7 días cruza de mes, los del siguiente aparecen al cambiar el periodo.

## Anexo — fuentes

- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — §5.2.1: *"Notifica por correo electrónico los días 15 de cada mes a los ejecutivos de Ventas a su cargo, los hospitales que deberán visitar. Anexa el formato 'ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos'."* (la vista personal sustituye ese correo).
- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — §4.3: *"Viáticos: Son los recursos monetarios asignados a los trabajadores para el desempeño de sus actividades, cuando deban trasladarse a un lugar distinto al de su adscripción; dichos recursos cubren gastos de transporte, hospedaje, alimentación y alquiler de autos."* (base del handoff futuro).
- `referencias/pdf-to-md/Instructivos/Elaborar Plan de Trabajo.md` — campos del formato de viáticos: *"Transporte Tipo | Transporte Importe | Alimentos Tipo | Alimentos Importe | Hospedaje | Gasolina | Casetas | Taxis | Avion"*.
- La vista semanal personal es una decisión de producto/UI interna: no reemplaza un formulario del proceso.
