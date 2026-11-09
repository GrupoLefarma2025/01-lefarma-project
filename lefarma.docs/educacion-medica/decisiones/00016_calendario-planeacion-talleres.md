---
fecha_creacion: 2026-10-23 10:00
fecha_modificacion: 2026-10-23 10:00
resumen: Pantalla única de calendario para planeación y talleres — vistas Semana/Mes/Por especialista/Por ejecutivo, rail de filtros/ejecutivos/especialistas, inspector de detalle/solicitudes, agenda móvil y creación de talleres desde la visita. La vista primaria es por especialista porque el especialista es el recurso que viaja; el ejecutivo es el dueño del hospital. Incluye catálogo tipo_visita, tema_taller, sugerencia de visitas cercanas y endpoints de calendario.
---

# ADR-00016 — Calendario unificado de planeación y talleres

## Status

Proposed

> **Decisiones confirmadas por el usuario (2026-10-23):**
> - Se combinan planeación de rutas y talleres en una sola pantalla.
> - La vista primaria es el calendario; el panel izquierdo tiene accesos/filtros; el derecho muestra detalle y solicitudes.
> - En móvil se usa agenda + bottom sheet (la mayoría de ejecutivos no tiene laptop).
> - El planificador puede arrastrar especialistas/visitas en desktop; en móvil se usa un select.
> - El sistema sugiere hospitales cercanos cuando un especialista ya estará en la ciudad (ejemplo Puebla miércoles → Puebla jueves).
> - El tipo de visita y el tema del taller se modelan con catálogos para mejorar indicadores y reportes.
>
> Depende de ADR-00015 (ruta por especialista) y ADR-00017 (tercera gerencia). El candado y las solicitudes de cambio viven en ADR-00018.

## Índice

1. [Decisión](#decisión)
2. [Contexto y evidencia](#contexto-y-evidencia)
3. [Vistas y layout](#vistas-y-layout)
4. [Interacciones](#interacciones)
5. [Permisos y roles](#permisos-y-roles)
6. [Catálogos y modelo de datos](#catálogos-y-modelo-de-datos)
7. [Backend y endpoints](#backend-y-endpoints)
8. [Fases](#fases)
9. [Validación contra la operación documentada](#validación-contra-la-operación-documentada)
10. [Consequences](#consequences)
11. [Anexo — Fuentes](#anexo--fuentes)

## Decisión

Se crea una sola pantalla **Planeación** (`/educacion-medica/planeacion` o la ruta que defina el menú) que absorbe la planeación de rutas y la captura/consulta de talleres. La matriz, los reportes y la configuración viven en pantallas separadas.

### Principios

1. **Calendario primero**: el usuario trabaja sobre el tiempo y el territorio, no sobre una tabla de registros.
2. **Por especialista como vista primaria**: el especialista es el recurso escaso y el que viaja; el ejecutivo es el dueño del hospital.
3. **Una sola pantalla, varias vistas**: Semana, Mes, Por especialista, Por ejecutivo; la misma data, distinta proyección.
4. **El sistema propone, el humano dispone**: sugiere especialista/fecha por cercanía y capacidad; el planificador confirma.
5. **Mobile-first para ejecutivos**: agenda, bottom sheet y acciones grandes; sin drag & drop.
6. **Permisos visibles**: lo que no se puede editar se muestra deshabilitado con candado, no desaparece.

### Alcance

- **Incluye**: calendario, asignación de especialista, creación/edición de taller desde la visita, cambio de fecha/hora, hospital no planificado, envío a autorización (matriz), solicitud de cambio por taller, actividad reciente.
- **No incluye**: autorización de la selección (pantalla existente), matriz detallada (pantalla Matriz), catálogos de personas (pantalla Personas), reportes de cierre (Indicadores/Panel).

## Contexto y evidencia

El Excel `MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx` está organizado por **especialista**:

- Bloques por especialista: Roberto, César García, Pablo Peña, Santiago Gutiérrez, Ángel, Juan Pablo.
- Columnas por día/semana; celdas con `EJECUTIVO/Hospital + hora`.
- Varias visitas del mismo especialista el mismo día, a menudo en la misma ciudad.
- Celdas “INFORMATIVA” y “CAPTACIÓN DE QUEJA” además de talleres.
- Filas “VACANTE” cuando no hay especialista.

El PDF `PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF` muestra la matriz que se envía a autorización:

- No., Región, Institución, Estado, Ciudad/Municipio, Hospital, No. de Participantes, Ejecutivo/Especialista, Fecha, Hora, Producto, Cantidades, Costos.
- La matriz se arma antes del inicio de los talleres y puede cambiar por agenda del hospital; esos cambios se gestionan por solicitud de taller (ADR-00018).

La pantalla actual no refleja esa operación:

- `RutasPage` está organizada por equipo y usa drag & drop de visitas.
- `MisTalleresPage` es una tabla separada de talleres.
- `CalendarioPage`/`MiPlaneacionPage` son vistas personales/wireframes.
- El usuario tiene que saltar entre pantallas para ver el calendario, crear un taller y revisar una solicitud.

## Vistas y layout

### Desktop (≥1280 px)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Planeación · Octubre 2026      [Día] [Semana] [Mes] [Por especialista] [Por ejecutivo]│
│ Filtros: Gerencia · Región · Especialista · Ejecutivo · Estado        [ + Nuevo taller ]│
│ Resumen: 18 talleres · 4 pendientes · 2 conflictos        [Enviar a autorización] [⋯] │
├──────────────────┬───────────────────────────────────────────────┬───────────────────┤
│ IZQUIERDA        │ CALENDARIO                                    │ DERECHA           │
│                  │                                               │                   │
│ Buscar...        │  Lun 20    Mar 21    Mié 22    Jue 23   Vie 24│ Actividad /       │
│ Hoy              │  07:00     [Taller]  [Taller]                 │ Solicitudes (2)   │
│ Esta semana      │  08:00     [Taller]                           │                   │
│ Solicitudes (2)  │  09:00                                        │ ┌───────────────┐ │
│ Mis talleres     │  10:00           [Taller]                     │ │ Taller selec. │ │
│ Traslados        │  11:00                                        │ │ Hospital      │ │
│                  │  12:00                                        │ │ Fecha/Hora    │ │
│ EJECUTIVOS       │  13:00     [Taller]                           │ │ Ejecutivo     │ │
│ ● Alma      12   │  14:00                                        │ │ Especialista  │ │
│ ● Víctor     8   │  15:00                                        │ │ Estado        │ │
│ ● Carmen     6   │  ...                                          │ │ [Editar]      │ │
│ ● José       9   │                                               │ │ [Reasignar]   │ │
│                  │                                               │ │ [Solicitar]   │ │
│ ESPECIALISTAS    │                                               │ └───────────────┘ │
│ ● Roberto   14   │                                               │                   │
│ ● César     12   │                                               │                   │
│ ● Pablo      9   │                                               │                   │
│                  │                                               │                   │
│ ┌──────────────┐ │                                               │                   │
│ │ Próximo      │ │                                               │                   │
│ │ taller       │ │                                               │                   │
│ │ 10:15 HGZ 20 │ │                                               │                   │
│ │ Alma+Roberto │ │                                               │                   │
│ └──────────────┘ │                                               │                   │
└──────────────────┴───────────────────────────────────────────────┴───────────────────┘
```

**Izquierda (240 px, colapsable):**
- Buscador global (hospital, ejecutivo, especialista).
- Accesos: **Hoy**, **Esta semana**, **Solicitudes** (badge), **Mis talleres**, **Pendientes de autorización**.
- Lista de **Ejecutivos** con color y conteo; clic = filtrar/ocultar.
- Lista de **Especialistas** con color y carga; clic = filtrar/ocultar.
- Card **“Próximo taller”** con hora, hospital, ejecutivo + especialista y botón “Ver”.
- En móvil, todo se va al drawer.

**Centro:**
- **Vista Semana**: columnas = días Lun–Vie, filas = horas 07:00–18:00. Tarjetas por taller/visita.
- **Vista Mes**: semanas como filas, días como columnas; chips compactos dentro del día (como el Excel).
- **Vista Por especialista**: filas = especialistas, columnas = días; cada celda con sus visitas. Vista primaria.
- **Vista Por ejecutivo**: filas = ejecutivos, columnas = días; útil para el gerente de ventas.
- Tarjeta: hora, hospital corto, iniciales del ejecutivo, avatar/color del especialista, estado; iconos de extraordinario/conflicto/pendiente.
- Cabecera de cada día: fecha + resumen “3 talleres · 1 pendiente”.
- Scroll horizontal en móvil/tablet si el usuario fuerza la vista de calendario; por defecto, agenda.

**Derecha (320–360 px, sticky):**
- **Sin selección**: tabs “Actividad reciente” y “Solicitudes pendientes”. Cada item: quién, cuándo, qué cambió y badge de estado.
- **Con un taller seleccionado**: ficha con hospital, región, gerencia, fecha/hora, ejecutivo, especialista, producto/cantidad, participantes, costo, estado y candado.
- Acciones contextuales: Editar, Reasignar especialista, Mover fecha/hora, Crear taller, Enviar a autorización/Solicitar cambio, Cancelar, Historial.
- En móvil, este panel es un **bottom sheet** con drag handle.

### Mobile (≤768 px)

```text
┌─────────────────────────────┐
│ ☰  Planeación   Oct 2026  🔍│
│ [Hoy] [Semana] [Filtros]    │
│ 18 talleres · 4 pendientes  │
├─────────────────────────────┤
│ Lun 20                      │
│ ┌─────────────────────────┐ │
│ │ 07:00  HGZ 20 Olivo     │ │
│ │ Alma · Roberto          │ │
│ │ [Programado]            │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 13:30  HGZ 20 Olivo     │ │
│ │ Alma · Roberto          │ │
│ └─────────────────────────┘ │
│ Mar 21                      │
│ ┌─────────────────────────┐ │
│ │ 08:00  HGZ 30           │ │
│ │ Paco · Roberto          │ │
│ └─────────────────────────┘ │
│                             │
│        [ + Nuevo taller ]   │
└─────────────────────────────┘
```

- Agenda por día; tarjetas full-width.
- Tap = bottom sheet con detalle/acciones.
- Filtros en bottom sheet; chips rápidos “Mis talleres”, “Pendientes”, “Hoy”.
- Sin drag & drop; el detalle tiene selects de especialista/fecha.
- El “Próximo taller” puede ser una tarjeta fija arriba de la agenda.
- Botón “Nuevo taller” como FAB o acción primaria.

## Interacciones

### Asignar especialista

- **Desktop**: arrastrar la tarjeta de una visita a la fila de otro especialista (vista Por especialista) o a otro día (vista Semana/Mes). El destino muestra carga y elegibilidad; si no cumple, se pinta rojo con el motivo.
- **Móvil**: en el bottom sheet, botón **“Reasignar”** → select con especialistas elegibles, carga y conflictos.
- El select muestra: avatar, nombre, gerencias permitidas, visitas del día/semana, viaje foráneo, badge “Sugerido” si el motor lo propone.
- Si el especialista no es elegible para la gerencia, aparece deshabilitado con el motivo.
- Si la asignación deja al especialista por encima de capacidad, se muestra un aviso; el planificador puede continuar solo si el permiso/parametro lo permite.

### Crear taller

- Desde una visita: botón **“Agregar taller”** o **“Crear taller”**; el formulario se prellena con hospital, fecha, hora, ejecutivo y especialista de la visita.
- Desde un día vacío: **“Nuevo taller”**; el formulario pide hospital de la selección del ejecutivo, fecha/hora, especialista (opcional), producto y cantidad (default 2), participantes, recursos.
- Si el hospital no está planificado pero está en la selección, se crea la visita y el taller; si el alcance de extraordinario lo permite (ADR-00017), se marca como no planificado.
- El taller nace `Creada`; se puede enviar a autorización (matriz) o dejar en draft según el flujo (ADR-00018).

### Mover fecha/hora

- **Desktop**: drag & drop a otro día/hora (si el permiso lo permite); confirmation con el resumen del cambio.
- **Móvil**: “Mover” → date/time picker.
- Si el taller ya está bloqueado por la matriz, el cambio se convierte en **“Solicitar cambio”** (ADR-00018), no en edición directa.
- El sistema revalida capacidad del especialista y sincroniza la visita de la ruta (ADR-00010).

### Enviar a autorización / candado

- El botón **“Enviar a autorización”** opera sobre la matriz del período/gerencia, no sobre la ruta.
- Si la matriz ya está autorizada, el botón cambia a **“Solicitar cambio”** por taller; el taller se muestra con candado.
- El inspector muestra el estado del candado y el motivo.

### Panel de actividad/solicitudes

- **Actividad reciente**: últimas altas, cambios, cancelaciones y aprobaciones; quién y cuándo.
- **Solicitudes pendientes**: cambios por taller con diff (antes/después), solicitante, motivo y estado; el autorizador abre el detalle y resuelve.
- Al seleccionar una solicitud, el calendario resalta el taller y el inspector muestra el diff.

### Sugerencias de cercanía

- Cuando un especialista tiene visitas en una ciudad/día, el sistema calcula hospitales cercanos sin especialista y propone asignarlos en días contiguos.
- Se muestran en:
  - Un badge “Sugerido” en el selector de especialista.
  - Una sección “Sugerencias” en el inspector o en el panel de actividad.
  - Un indicador en la vista Por especialista (p. ej. “2 hospitales en Puebla sin asignar; Roberto estará allí el miércoles”).
- El planificador acepta una o todas; el sistema no asigna solo.

## Permisos y roles

| Rol | Ve | Puede |
|---|---|---|
| CEM / GG / coordinador | Todos los ejecutivos y especialistas | Crear, asignar, mover, enviar a autorización, resolver solicitudes |
| Gerente de Ventas | Su gerencia/región y sus ejecutivos | Revisar, crear, solicitar cambios; autorizar si se habilita |
| Ejecutivo | Solo sus talleres/visitas | Crear taller, editar antes del candado, solicitar cambio después |
| Especialista | Solo su calendario | Consultar; confirmar o solicitar cambio si se habilita |
| AEM / CA | Calendario y matriz | Costos, matriz, exportar; sin edición de calendario |

Permisos nuevos propuestos:

- `educacion_medica.calendario.puede_ver`
- `educacion_medica.calendario.puede_editar`
- `educacion_medica.calendario.puede_asignar_especialista`
- `educacion_medica.calendario.puede_autorizar`
- `educacion_medica.talleres.puede_solicitar_cambio`
- `educacion_medica.personas.puede_gestionar`
- Reutilizar `selecciones.*`, `rutas.*`, `talleres.*`, `matriz.*` donde aplique.

## Catálogos y modelo de datos

### Catálogos nuevos

| Catálogo | Valores iniciales | Uso |
|---|---|---|
| `tipo_visita` | `Taller`, `Informativa`, `Captación de queja`, `Otro` | Clasifica el evento del calendario; `es_taller` indica si genera taller/matriz. |
| `tema_taller` | Opcional; se puede poblar con los productos o temas de presentación | Asunto del taller/visita para reportes. |

`rutas_visitas.tipo_visita_id` (o `tipo_visita` VARCHAR con FK lógica) y `talleres.tema_taller_id` (nullable).

> Si el área prefiere no crear `tema_taller`, el tema se toma del producto (`talleres`/`taller_recursos`). El catálogo de tipo de visita sí es necesario para separar talleres de informativas/captación y evitar que contaminen indicadores.

### DTO del calendario

```ts
interface CalendarioItemDto {
  idRutaVisita: number;
  idTaller: number | null;
  idSeleccionHospital: number | null;
  idHospital: number | null;
  hospital: string;
  region: string | null;
  gerencia: string;
  institucion: string | null;
  fecha: string;              // yyyy-MM-dd
  hora: string | null;        // HH:mm
  idEjecutivo: number | null;
  nombreEjecutivo: string | null;
  idEspecialista: number | null;
  nombreEspecialista: string | null;
  tipoVisita: string;
  tema: string | null;
  producto: string | null;
  cantidad: number | null;
  participantes: number | null;
  estado: string;             // Creada/Programado/EnCurso/Realizado/Cancelado
  esExtraordinario: boolean;
  bloqueado: boolean;
  solicitudCambioPendiente: boolean;
  conflictos: string[];
}
```

### Reglas de consulta

- Default: período = mes actual; rango máximo = 45 días de la selección (o el que defina el parámetro).
- Filtros combinables: gerencia, región, ejecutivo, especialista, estado, tipo de visita.
- Orden: fecha, hora, especialista, hospital.
- `bloqueado` se deriva de la matriz autorizada + estado del taller; no se guarda un flag nuevo si no hace falta.
- `conflictos` se calculan al vuelo (choque de hora, capacidad, elegibilidad, hospital sin especialista).

## Backend y endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET` | `/api/educacion-medica/calendario?desde&hasta&idGerencia&idRegion&idEjecutivo&idEspecialista&estado&tipoVisita` | `calendario.puede_ver` | Lista unificada de visitas + talleres. |
| `GET` | `/api/educacion-medica/calendario/{idRutaVisita}` | `calendario.puede_ver` | Detalle de la visita/taller. |
| `PUT` | `/api/educacion-medica/calendario/visitas/{id}/especialista` | `calendario.puede_asignar_especialista` | Asigna/reasigna especialista con validación. |
| `PUT` | `/api/educacion-medica/calendario/visitas/{id}/fecha` | `calendario.puede_editar` | Mueve fecha/hora con validación y auditoría. |
| `POST` | `/api/educacion-medica/calendario/talleres` | `talleres.puede_capturar` | Crea taller desde visita/hospital (o reutiliza `POST /talleres`). |
| `GET` | `/api/educacion-medica/calendario/sugerencias?idSeleccion&idEspecialista&desde&hasta` | `calendario.puede_ver` | Hospitales cercanos sugeridos. |
| `GET` | `/api/educacion-medica/calendario/actividad?desde&hasta` | `calendario.puede_ver` | Últimos cambios y solicitudes. |
| `POST` | `/api/educacion-medica/calendario/talleres/{id}/solicitudes-cambio` | `talleres.puede_solicitar_cambio` | Solicitud de cambio (reutiliza ADR-00010/00018). |
| `POST` | `/api/educacion-medica/calendario/solicitudes-cambio/{id}/resolver` | `calendario.puede_autorizar` | Aprueba/rechaza el cambio. |

**Servicios:**

- `CalendarioService`: consulta unificada, DTO, conflictos, actividad.
- `AsignadorEspecialistasService`: sugerencias y validación de asignación.
- `SugerenciaCercaniaService`: bloques ciudad/día, hospitales cercanos, propuestas.
- `TalleresService`/`RutasService`: reutilizados para creación/movimiento.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Este ADR + tarea 00016; wireframes y validación con el área | Documento revisado |
| **1** | Base de datos | Script 0035: `tipo_visita`, `tema_taller`, `rutas_visitas.tipo_visita_id`, `talleres.tema_taller_id`, parámetros | Script idempotente, `PARSEONLY` |
| **2** | Backend | `CalendarioController/Service`, DTO, sugerencias, asignación, actividad | `dotnet test` |
| **3** | Frontend | `PlaneacionPage`, vistas, inspector, móvil, modales, filtros | `npm run build`, `npm run lint` |
| **4** | Verificación | E2E desktop/móvil, roles, drag & drop/select, sugerencias | Prueba con 3 gerencias y roster variable |

## Validación contra la operación documentada

| Regla | Fuente documental (cita literal) | Cómo se implementa |
|---|---|---|
| Calendario mensual de talleres | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — *“Lugar y hora: Escribir el nombre del ejecutivo de ventas, hospital o lugar que va a visitar y la hora”* | La tarjeta del calendario muestra ejecutivo, hospital, fecha y hora. |
| Días no laborables | Ídem — *“Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres).”* | Lun–Vie; sábado/domingo no se usan para talleres. |
| Fecha y hora del taller | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — *“Fecha de taller: Escribir la fecha en la cual está programado el taller médico…”* · *“Hora: Escribir la hora en la cual se va a realizar el taller médico”* | El taller conserva fecha/hora; el calendario las muestra y permite moverlas con permiso. |
| Ejecutivo y especialista en la matriz | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos *“Nombre del ejecutivo”* y columna Ejecutivo/Especialista | La tarjeta y la matriz muestran ambos roles. |
| Hospital y participantes | Ídem — *“Hospital”*, *“No. de participantes”* | La ficha del taller los muestra/edita. |
| Tipo de visita | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — la agenda admite “hospital o lugar” y el proceso distingue visitas/talleres | Catálogo `tipo_visita`; la matriz solo incluye `es_taller = 1`. |

**Reglas de digitalización sin fuente en el papel** (interpretación/operación real):

- La vista “Por especialista” y la sugerencia por ciudad/día son decisiones de producto basadas en el Excel operativo, no en un instructivo.
- El layout de tres paneles, el drag & drop y la agenda móvil son decisiones de UX.
- La combinación de planeación y talleres en una pantalla es una decisión de producto (2026-10-23), no un requisito documental.
- El catálogo `tema_taller` es opcional; el producto puede seguir siendo el tema.

## Consequences

**Positivas**

- Un solo lugar para ver el calendario, crear talleres y revisar solicitudes; se elimina el salto entre `RutasPage`, `MisTalleresPage` y `CalendarioPage`.
- La vista Por especialista replica la operación real y facilita aprovechar viajes (Puebla miércoles → Puebla jueves).
- El ejecutivo en móvil ve su agenda y sus talleres sin la complejidad del calendario completo.
- Los tipos de visita y temas mejoran los indicadores y evitan mezclar talleres con informativas.
- El sistema sugiere, pero el humano decide; se mantiene la trazabilidad.

**Negativas**

- Es una pantalla compleja: muchas vistas, filtros, permisos y estados; requiere pruebas de usabilidad.
- El drag & drop en desktop y los selects en móvil son dos caminos de interacción que deben mantener la misma validación.
- Depende de que la ruta por especialista (ADR-00015) y la tercera gerencia (ADR-00017) estén implementadas.
- El calendario unificado puede tentar a editar la matriz desde ahí; hay que separar claramente “planeación” de “autorización”.

**Neutras / seguimiento**

- `MisTalleresPage` y `MiPlaneacionPage` se conservan como vistas personales o se integran como tabs; la decisión final de navegación queda en la tarea 00016.
- El calendario de la matriz (FOR-006) sigue siendo una decisión aparte (ADR-00013, Fase 5).
- La vista “Por especialista” puede ser la única que permita drag & drop; las demás usan selects para reducir riesgo.

## Anexo — Fuentes

**Documentales (referencias del módulo):**

- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos de fecha, hora, ejecutivo, participantes, producto y cantidades.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — agenda mensual, lugar/hora, días laborables.
- `referencias/pdf-to-md/Instructivos/Impartición de Talleres Médicos.md` — víspera, llegada 1 hora antes, registro, 80 %, evidencias.
- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — día 15, 45 días, zonas, cuotas.
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — fases y reagenda.

**Evidencia operativa (no son fuentes documentales formales):**

- `MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx` — calendario real por especialista, celdas `EJECUTIVO/Hospital + hora`, visitas agrupadas por ciudad, “INFORMATIVA”/“CAPTACIÓN DE QUEJA”.
- `PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF` — matriz con ejecutivo/especialista, producto, cantidades y costos.

**Planificación interna (no son fuentes documentales):**

- `reglas-negocio.md` §5.2–5.5, §5.9–5.13 y §7.
- ADR-00004 (zonas/capacidad), ADR-00006 (workflow selección/matriz), ADR-00007 (matriz), ADR-00008 (impartición), ADR-00010 (ajustes/solicitudes), ADR-00013 (planeación personal), ADR-00015 (ruta por especialista), ADR-00017 (tercera gerencia), ADR-00018 (candado/solicitudes).
- Código actual: `RutasPage.tsx`, `MisTalleresPage.tsx`, `CalendarioPage`, `MiPlaneacionPage.tsx`, `TallerFormModal.tsx`, `MatrizTalleresPage.tsx`.
