# Tareas — 00012 Dashboard de Educación Médica

> Vinculada a: [[decisiones/00012_dashboard-educacion-medica]]
> Fases: 0 plan/revisión, 1 frontend, 2 endpoint agregado (implementada), 3 Indicadores/Panel del mes (fuera).

## Fase 0 — Plan y revisión

- [x] Decisión del usuario: dashboard **adaptativo por permisos** (no vistas por rol).
- [x] Decisión del usuario: **Fase 1 solo frontend** para revisar cómo queda.
- [x] Decisión del usuario: el fix de permisos será un **script para revisar** (`0032`).
- [x] Indicadores / Panel del mes: fuera por ahora (se revisará después).
- [x] **Revisión del usuario del plan** (este ADR, tarea y script `0032`) _(aprobado 2026-10-10)_.
- [x] Ajustar el alcance si la revisión cambia cartas o permisos _(se agregaron la fila de KPIs y la tabla de últimos talleres; T1 pasó a KPI)_.

## Fase 1 — Frontend

### 1.1 Permisos (script para revisar)

- [x] Crear `0032_20261010-1730_educacion-medica_reparar-matriz-permisos.lefarma.sql`
      (idempotente; **NO aplicado**): CEM `talleres.ver`, celdas de 0021, 4 exclusivos de 0029 y re-grant SuperAdmin.
- [ ] Revisión del usuario del script.
- [ ] Aplicar `0032` en **LefarmaDev2** (con el usuario) y verificar la matriz con la consulta del final del script.
- [ ] Aplicar `0032` en **Lefarma** (prod, al desplegar) + re-ejecutar 0017/0021/0029 con UTF-8 (`sqlcmd -f 65001`).

### 1.2 Dashboard adaptativo

- [x] Crear **3 archivos**: `pages/dashboard/EducacionMedicaDashboard.tsx` (layout, saludo, KPIs y composición), `pages/dashboard/useDashboardData.ts` (carga y estado) y `pages/dashboard/DashboardCards.tsx` (tarjetas, tabla y helpers); actualizar el import en `EducacionMedicaRoutes.tsx`.
  - Se extrajo `DashboardCards.tsx` por la regla de ~300 líneas (la página quedó en 373 antes de dividir). No se creó un archivo por tarjeta.
- [x] Hook `useDashboardData()`: periodo actual, una sola llamada al endpoint agregado; estado de carga y fallback a vacíos.
- [x] **Fila de 4 KPIs con iconos**: talleres del mes (equipo/periodo), realizados (con "de X talleres"), pendientes de firma y costo del mes; cada una con link (Mis talleres/Matriz/Bandeja).
- [x] **T1 retirada como tarjeta**: el conteo de pendientes vive en el KPI y el link a la Bandeja.
- [x] **T2 — Panel de situación del equipo** (mis talleres; `talleres.puede_capturar` + `idEquipo`): KPIs, barra de avance, próximos 3 talleres, CTA a Mis talleres.
- [x] **T3 — Mis visitas del mes** (asignaciones; `talleres.puede_capturar`; oculta si 0): total, próxima visita, CTA a Mis hospitales.
- [x] **T4 — Matriz general del mes** (matrices; `talleres.puede_ver`; oculta si no hay): gerencia, estado del workflow con color, total de talleres, costo total, CTA a Matriz.
- [x] **T5 — Solicitudes de cambio** (matriz detalle; `talleres.puede_ver`; oculta si 0): talleres con solicitud pendiente + CTA a Matriz.
- [x] **T6 — Accesos rápidos**: derivados de `educacionMedicaMenuItems`, filtrados por permiso (sin duplicar códigos).
- [x] **Tabla "Últimos talleres"**: equipo (EV/EP) o periodo (demás roles con `talleres.ver`), orden fecha desc, 8 filas, chips por estado y columnas Hospital/Fecha/Equipo/Estado/Participantes/Costo; sin llamadas nuevas (reutiliza los detalles de matriz de T5).
- [x] Estados vacíos, skeletons (KPIs + tarjetas), responsive y dark mode.
- [x] Sin enlaces a pantallas wireframe (Indicadores, Panel del mes, Calendario, Programa Anual).
- [x] `npm run build` + ESLint en archivos tocados _(build y lint en verde)_.
- [ ] Verificación por rol con la matriz del ADR (la hace el usuario).

### 1.3 Documentación

- [x] ADR-00008, decisión 14: marcar la v2 del panel de situación como implementada en el dashboard.
- [x] Tarea 00008: cerrar el pendiente "v2: reutilizar el resumen en `EducacionMedicaDashboard`".
- [ ] Al aprobar la implementación: mover este ADR a `Accepted` y sincronizar la tarea.

## Fase 2 — Endpoint agregado (implementada)

- [x] `GET /api/educacion-medica/dashboard?periodo=YYYY-MM` (`DashboardController` + `DashboardService`; permiso hub y gating por claims de `talleres.puede_ver` / `talleres.puede_capturar`).
- [x] DTO de resumen (`DashboardResumenDto`) + pruebas unitarias (`DashboardServiceTests`, 4 casos).
- [x] `useDashboardData` cambiado a una sola llamada; `educacionMedicaApi.dashboard.get`.
- [x] Verificación en vivo con DevToken (usuario 70): `success=true`, periodo 2026-10, 1 matriz, 2 talleres del periodo, 18 asignaciones.

> El detalle de matriz se resuelve en el backend; la tabla del dashboard ya no consulta `matrices-talleres/{id}` desde el cliente.

## Fase 3 — Indicadores y Panel del mes (fuera de este plan)

> Bloqueada parcialmente: el módulo no captura satisfacción (encuesta QR), médicos adscritos ni residentes; implementar los 6 indicadores requiere una decisión de datos (campos/encuesta) además de endpoints y permisos.

- [ ] Implementar las pantallas hoy wireframe (`IndicadoresPage`, `PanelMesPage`) con datos reales.
- [ ] `GET /indicadores/semanal` (6 indicadores del P5B) y `GET /panel-mes`.
- [ ] Permiso `educacion_medica.indicadores.puede_ver` (sembrar en Asokam y asignar a GG/DC/CA; CEM presenta).
- [ ] Revisar si el dashboard incorpora un resumen de indicadores (T7) cuando existan.

## Prerrequisitos y riesgos

- **Asokam hoy**: 0021 sin celdas y CEM sin `talleres.ver`; sin `0032` el dashboard funciona pero CEM queda con el KPI de pendientes y T6, y GV/CA/DC pierden accesos de rutas/configuración.
- **CEM y Matriz**: sin `talleres.ver` no puede resolver solicitudes de cambio (ADR-00010); el script `0032` lo corrige.
- **Roles sin equipo** (AEM/GV/CA/GG/DC/CEM): T2/T3 no aplican; no es un error, es el diseño.
- **Wireframes**: no mostrar datos falsos ni enlazar Indicadores/Panel/Calendario/Programa hasta implementarlos.
- **Notificaciones por correo**: siguen deshabilitadas (solo in-app) por decisión del usuario (ADR-00010, revisión 2026-10-10).

## Criterios de aceptación

- Cada rol ve exactamente las tarjetas de la matriz del ADR, sin 403 ni errores en consola.
- Tarjetas sin datos o sin permiso no se renderizan; no hay ceros ni tablas vacías.
- Carga en paralelo; una fuente caída no bloquea el resto.
- Links solo a pantallas implementadas y con permiso.
- `npm run build` y ESLint en verde; sin cambios de esquema (el endpoint agregado no altera tablas).
- Una sola petición por carga (`GET /dashboard`).
