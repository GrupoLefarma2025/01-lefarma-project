---
fecha_creacion: 2026-10-10 17:30
fecha_modificacion: 2026-10-10 19:00
resumen: Dashboard de Educación Médica — landing adaptativo por permisos que compone una fila de KPIs con iconos (talleres, realizados, pendientes de firma y costo del mes), tarjetas (situación del equipo v2, visitas del mes, matriz general, solicitudes de cambio y accesos rápidos) y una tabla de últimos talleres con filtros por estado, reutilizando endpoints existentes y sin backend nuevo en Fase 1. Incluye el reparo de la matriz rol↔permiso con el script 0032 (CEM recupera talleres.ver y se completan los guards de 0021/0029). Indicadores y Panel del mes quedan fuera (hoy son wireframes).
---

# 00012 — Dashboard de Educación Médica

## Status

Proposed

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Contexto y hallazgos|Contexto y hallazgos]]
- [[#Fases|Fases]]
- [[#Fila de KPIs, tarjetas y tabla|Fila de KPIs, tarjetas y tabla]]
- [[#Matriz rol → bloques|Matriz rol → bloques]]
- [[#Invariantes de implementación|Invariantes de implementación]]
- [[#Consequences|Consequences]]
- [[#Anexo — fuentes|Anexo — fuentes]]

## Decisión

Sustituir el placeholder de `/educacion-medica/dashboard` por un **dashboard adaptativo por permisos**: una sola página que compone **bloques independientes** y se auto-oculta cuando falta permiso o no hay datos. Arriba va una **fila de 4 KPIs compactos con iconos** (talleres, realizados, pendientes de firma y costo del mes), en medio las tarjetas de detalle y abajo una **tabla de últimos talleres** con filtros por estado. No se ramifica por nombre de rol; cada bloque se gatea con un permiso existente (`usePermission`) y los datos provienen de endpoints ya implementados. La **Fase 1 es solo frontend** (para revisar la UX antes de invertir en backend). Indicadores y Panel del mes (hoy wireframes) quedan fuera. El prerrequisito de permisos se entrega como **script SQL idempotente `0032`**, para revisión y aplicación posterior.

## Contexto y hallazgos

- El dashboard actual es un placeholder ("módulo en construcción") y es la ruta de entrada del módulo (`EducacionMedicaRoutes.tsx` → `dashboard`).
- El menú ya expone **Indicadores** y **Panel del mes**, pero ambas pantallas son wireframes estáticos sin API (`pages/seguimiento/IndicadoresPage.tsx`, `PanelMesPage.tsx`). También son wireframes Calendario y Programa Anual.
- Existe un patrón de landing en el repo: `RhDashboard` (saludo + tarjeta de pendientes + grid), con `usePermission`, `useAuthStore` (roles/permisos) y componentes shadcn (`Card`, `Badge`, `Progress`).

**Fuentes de datos reutilizables (ya implementadas):**

| Endpoint | Permiso | Qué entrega |
|---|---|---|
| `GET /talleres/mis-talleres` | `talleres.puede_ver` | Equipo del usuario, matriz individual del periodo y talleres (devuelve vacío si no pertenece a un equipo) |
| `GET /talleres/asignaciones` | `talleres.puede_capturar` | Visitas confirmadas del mes del EV/EP |
| `GET /aprobaciones/documentos?filtro=pendientes` | `baseapp.hub.puede_ver_educacion_medica` | Documentos en pasos de firma donde participa el usuario |
| `GET /matrices-talleres` + `/{id}` | `talleres.puede_ver` | Panorama por gerencia (estado del workflow, total de talleres, costo) y detalle con `solicitudCambioPendiente` |

**Estado real de la matriz de permisos en Asokam (verificado 2026-10-10):**

- 0017 (base) aplicado completo; los 29 códigos del módulo existen y están activos.
- 0021 (guards: rutas, configuración, bandeja "todos", refuerzos CEM/CA/DC) **sin celdas aplicadas**.
- 0029: el bloque de la matriz del CEM está **comentado** en el script; los 4 permisos exclusivos solo los tiene SuperAdministrador.
- **CEM solo tiene 3 permisos y no tiene `talleres.puede_ver`**: hoy no puede abrir la Matriz ni resolver solicitudes de cambio (ADR-00010).
- SuperAdministrador tiene 29/29 (re-grant).

**Validación con el proceso (sistema legacy):** el dashboard no reemplaza ningún formulario; es una superficie de entrada. El proceso define los 6 indicadores semanales que el CEM presenta a GG y DC (`referencias/pdf-to-md/Diagramas/Diagrama del Proceso de Talleres Médicos.md`, nodo P5B): *"CEM: Presenta semanalmente a GG y DC los indicadores: 1. No. talleres realizados vs. programados. 2. No. de producto entregado. 3. Resultados de satisfacción de los talleres. 4. No. de médicos que acudieron al taller. 5. No. de médicos adscritos. 6. No. de médicos residentes."* Esos indicadores quedan en Fase 3 (pantalla propia), no en el landing.

## Fases

### Fase 0 — Plan y revisión (esta entrega)

Se acuerda el alcance antes de tocar código: adaptativo por permisos, Fase 1 solo frontend, permisos como script revisable e indicadores fuera. **Por qué:** evita invertir en un endpoint agregado o en pantallas de indicadores antes de validar que la composición de tarjetas funciona para los 8 roles.

### Fase 1 — Dashboard frontend (sin backend nuevo)

1. **Estructura**: tres archivos — `pages/dashboard/EducacionMedicaDashboard.tsx` (layout, saludo, KPIs y composición), `pages/dashboard/useDashboardData.ts` (carga y estado) y `pages/dashboard/DashboardCards.tsx` (tarjetas, tabla y helpers de presentación). No se crea un archivo por tarjeta.
2. **Fila de KPIs + tarjetas + tabla** (ver catálogo abajo), cada bloque con su propio estado de carga/error y auto-ocultamiento.
3. **Tabla de últimos talleres**: 8 filas, chips de estado y columnas Hospital/Fecha/Equipo/Estado/Participantes/Costo.
4. **Accesos rápidos** derivados de `educacionMedicaMenuItems` (mismos permisos, sin duplicar códigos).
5. **Carga tolerante**: cada fuente captura su propio error (`Promise.all` con `catch` por petición); un 403 o error de una fuente no rompe la página.
6. **Verificación**: `npm run build` + ESLint; matriz rol→bloques revisada por el usuario (la verificación visual la hace el usuario).

**Por qué:** la información ya existe y está paginada en las pantallas operativas; el landing solo resume "qué me toca" y "cómo va el mes" sin duplicar lógica.

### Fase 2 — Endpoint agregado (implementada)

`GET /api/educacion-medica/dashboard?periodo=YYYY-MM` (implementado en `DashboardController` + `DashboardService`): devuelve `DashboardResumenDto` con pendientes, visitas, mis talleres, matrices, talleres del periodo y solicitudes. El permiso del hub vive en el controller; las fuentes de talleres/visitas se consultan solo si el usuario tiene `talleres.puede_ver` / `talleres.puede_capturar` (claims). El frontend usa una sola llamada (`useDashboardData`).

**Por qué:** reduce las 4–7 llamadas de la Fase 1 a una y mantiene una foto consistente del periodo.

### Fase 3 — Indicadores y Panel del mes (fuera de este plan)

Implementar las pantallas de seguimiento (hoy wireframes): `GET /indicadores/semanal` (6 indicadores del P5B) y `GET /panel-mes`; permiso nuevo `educacion_medica.indicadores.puede_ver`.

**Por qué:** son decisiones de datos y permisos distintas al landing; mezclarlas retrasa la validación del dashboard.

## Fila de KPIs, tarjetas y tabla

**Fila superior — 4 KPIs compactos** (icono en chip de color, número y link):

| KPI | Valor | Permiso | Link |
|---|---|---|---|
| Talleres del mes | EV/EP: total de su equipo. Demás roles: suma de talleres de las matrices del periodo | `talleres.puede_ver` | Mis talleres / Matriz |
| Realizados | EV/EP: conteo del equipo. Demás: conteo del periodo (subtítulo "de X talleres") | `talleres.puede_ver` | Igual que arriba |
| Pendientes de firma | Bandeja (pendientes) | `hub` | Bandeja |
| Costo del mes | EV/EP: suma de `costoTotal` de sus talleres. Demás: suma de matrices | `talleres.puede_ver` | Matriz |

**Tarjetas (grid).** La tarjeta de "Pendientes de tu firma" se retira: su conteo vive en el KPI y el link a la Bandeja queda ahí.

| # | Tarjeta | Datos | Permiso | Se muestra a | Contenido |
|---|---|---|---|---|---|
| T2 | Panel de situación del equipo (v2) | Mis talleres | `talleres.puede_capturar` + `idEquipo != null` | EV/EP | KPIs del mes + barra `Realizados/Total` + próximos 3 talleres + CTA Mis talleres |
| T3 | Mis visitas del mes | Asignaciones | `talleres.puede_capturar` | EV/EP (oculta si 0) | Total, próxima visita y CTA Mi planeación |
| T4 | Matriz general del mes | Matrices | `talleres.puede_ver` | Roles con permiso (oculta si no hay matrices) | Por gerencia: estado del workflow (color), total de talleres, costo total + CTA Matriz |
| T5 | Solicitudes de cambio | Matriz detalle | `talleres.puede_ver` | Roles con permiso (oculta si 0) | Talleres con `solicitudCambioPendiente` + CTA Matriz (resolver solo CEM) |
| T6 | Accesos rápidos | Menú | Por item | Todos | Links filtrados por permiso |

> **T7 — Próximos 7 días (ADR-00013):** mini agenda de visitas + talleres del usuario con link a "Mi planeación"; se oculta si no hay eventos. Su visibilidad sigue las mismas fuentes que T3 y los talleres (permisos de ADR-00013).

**Tabla — Últimos talleres** (ancho completo, debajo del grid):

| Aspecto | Definición |
|---|---|
| Datos | EV/EP: talleres de su equipo (`mis-talleres`). Demás roles con `talleres.puede_ver`: talleres del periodo (detalles de matriz ya consultados para T5). Sin llamadas nuevas. |
| Orden y límite | Fecha más reciente primero; 8 filas + "Ver todos" (Mis talleres o Matriz según rol). |
| Columnas | Hospital, Fecha (dd/mm + hora), Equipo (solo roles sin equipo), Estado (pill con color), Participantes, Costo. |
| Filtros | Chips Todos / Programados / En curso / Realizados / Cancelados (cliente). |
| Título | "Últimos talleres del equipo" o "Últimos talleres del mes". |
| Vacío | "Sin talleres registrados en el periodo". |

## Matriz rol → bloques (estado actual de permisos)

| Rol | KPI talleres/realizados/costo | KPI pendientes | T2 | T3 | T4 | T5 | T6 | Tabla |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| EV / EP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GV | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| AEM | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| CEM | ⚠ tras aplicar 0032 | ✓ | — | — | ⚠ tras aplicar 0032 | ⚠ tras aplicar 0032 | ✓ | ⚠ tras aplicar 0032 |
| CA / GG / DC | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| SuperAdministrador | ✓ | ✓ | si tiene equipo | ✓ | ✓ | ✓ | ✓ | ✓ |

> T2 y T3 se ocultan solas en roles sin equipo de pareo (AEM/GV/CA/GG/DC/CEM) porque el endpoint devuelve vacío. CEM recupera los KPIs de talleres, T4, T5 y la tabla al aplicar `0032`. Sin `0032`, el dashboard sigue funcionando (los bloques sin permiso no se pintan), pero CEM queda reducido al KPI de pendientes y T6.

## Invariantes de implementación

- **Permission-driven**: los bloques se gatean con `usePermission` y códigos existentes; nunca por nombre de rol.
- **Hide-if-empty**: sin permiso o sin datos, el bloque no se renderiza (nada de ceros o tablas vacías).
- **Sin datos inventados**: Indicadores/Panel no se muestran hasta que existan; no se enlazan pantallas wireframe.
- **KPIs sin tendencias históricas**: los números son del periodo actual; no hay comparativo semanal en los datos, así que no se muestran deltas.
- **Tabla sin llamadas nuevas**: reutiliza los talleres del equipo (`mis-talleres`) o los detalles de matriz que ya se consultan para T5.
- **Una sola llamada**: el dashboard consume `GET /dashboard`; si falla, muestra estados vacíos sin romper la página.
- **Periodo**: mes actual por defecto; sin selector global en v1.
- **Presupuesto de red**: una petición por carga del dashboard.

## Consequences

**Positivas**
- Un solo punto de entrada que muestra "qué me toca" y "cómo va el mes" a cada rol sin pantallas nuevas.
- La fila de KPIs y la tabla dan lectura inmediata sin abrir las pantallas operativas.
- Una sola petición por carga (endpoint agregado) y filtrado por permisos en backend.
- Reutiliza endpoints y permisos existentes.
- La composición por permisos evita ramas por rol y facilita incorporar indicadores después.

**Negativas**
- Para roles sin equipo o sin permisos aplicados el dashboard puede quedar muy vacío (solo KPI de pendientes y T6) hasta corregir Asokam.
- El endpoint agregado concentra la orquestación en backend (más superficie a mantener que 4 llamadas del cliente).
- No sustituye Indicadores ni Panel del mes: el seguimiento formal sigue pendiente (Fase 3).

**Neutras**
- Introduce el script `0032` como parche idempotente de la matriz de permisos; los seeds canónicos (0017/0021/0029) siguen siendo la referencia y deben re-ejecutarse con UTF-8 en prod.
- "Calendario" y "Programa Anual" siguen como wireframes; el dashboard no los enlaza como si tuvieran datos.

## Anexo — fuentes

- `referencias/pdf-to-md/Diagramas/Diagrama del Proceso de Talleres Médicos.md` — nodo P5B, cita literal de los 6 indicadores semanales (base para Fase 3).
- El dashboard de aterrizaje es una decisión de producto/UI interna: no reemplaza un formulario del proceso y no requiere cita de formato.
