---
fecha_creacion: 2026-08-27 12:00
fecha_modificacion: 2026-09-10 12:00
resumen: Diseño del reparto por zonas y la planificación de rutas (draft→select) del módulo Educación Médica — equipos de pareo con vigencia, zonas GPS calculadas y persistidas, rutas versionadas con visitas fechadas, algoritmo greedy por fases y estados separados selección/rutas.
---

# 00004 — Reparto por zonas y planificación de rutas (draft → select)

## Status

Accepted

> Complementa al ADR-00001 (esquema de datos del módulo; parcialmente superseded por ADR-00002 en la parte de cálculo de anestesias, que no afecta esta decisión). No reemplaza ningún ADR: define la capa de **planificación** (reparto y rutas) que se apoya en las tablas `selecciones_mensuales` / `selecciones_mensuales_hospitales` ya creadas en el script 0003.

> **Revisión 2026-09-09** — Se ajusta la frontera Selección/Rutas con la operación real: la generación de rutas **ya no re-clusteriza ni reasigna zona→equipo** (eso ocurre solo en la Selección, paso Reparto); Rutas **solo calendariza y ordena lo ya autorizado**. El alta manual de visitas respeta la asignación región→equipo (el cruce se rechaza y el mensaje apunta al paso Reparto); el endpoint de mover visita se renombra a `PUT .../visitas/{id}/mover`. Detalles: decisión 10, Fase 2 y Fase 3.

> **Revisión 2026-09-10** — El empaque del draft pasa de "distancia al centroide de la región" a **bloques por localidad (ciudad/estado)**: las ciudades de una región se ordenan con vecino más cercano determinista y **no se fragmentan entre días** salvo que superen la capacidad diaria (entonces van a días consecutivos). Evita el patrón observado "lunes Tepic → salto → jueves otra vez Tepic" y visitas de ciudades distintas mezcladas en un día cuando cabían juntas. El criterio es **seleccionable por el usuario en `POST /generar`** (`estrategia`: `ciudad` default | `centroide` = empaque clásico que llena los días aunque mezclen ciudades) — sigue siendo una sugerencia corregible; el usuario cambia todo con drag & drop. El script 0013 clasifica en bloque `es_zona_metropolitana` (CDMX + municipios conurbados del Edoméx = locales) para que el conteo de viajes foráneos deje de contar NULLs.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (scripts 0006 y 0007)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

Esta decisión define cómo el módulo pasa de **"hospitales seleccionados"** (salida de la reunión del día 15) a **"rutas asignadas"** (cada equipo sabe qué hospital visita, qué día y en qué orden), respetando las reglas de capacidad, pareo y zonas.

El flujo, con su frontera clara:

```
Selección mensual (día 15)                    Planificación de rutas
─────────────────────────                     ──────────────────────────
¿QUÉ hospitales y a QUÉ equipo?               ¿QUÉ DÍA y en QUÉ orden?

seleccionar hospitales (45 días)              generar draft (versión N+1)
  → agrupar por zona GPS (persistir)            → ordenar por cercanía (sin reagrupar)
  → asignar zona → equipo                       → distribuir en días (Lun–Vie)
  → validar capacidad y metas                   → validar 3/día y 8/semana
  → doble firma (GV + GG) → AUTORIZADA          → humano corrige (drag & drop)
                                                → CONFIRMAR rutas
                                                    → publica asignaciones
                                                      (alimenta /mis-asignaciones)
```

Regla central heredada de la planificación del módulo (reglas-negocio §5.5): **el sistema propone, el humano dispone** — el draft nunca se confirma solo y ningún ajuste manual se pierde silenciosamente.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Revisión de diseño, decisiones, ADR + tareas + scripts | Este documento + scripts en disco |
| **1** | Base de datos | Script 0006 (equipos de pareo + estados) y 0007 (zonas y rutas) | Scripts aplicados en LefarmaDev, tablas y `MS_Description` visibles en SSMS |
| **2** | Backend | `EquiposPareoController`, `SeleccionesMensualesController` (agrupación), `RutasController` (generar/versionar/confirmar) | API funcionando; validaciones de capacidad con pruebas unitarias |
| **3** | Frontend | Pantallas Equipos y Pareo, Selección y reparto, Planificación de rutas | Flujo completo: seleccionar → autorizar → generar → corregir → confirmar |

---

## Fase 0 — Decisiones de diseño (el porqué de cada una)

> Tareas: [[tareas/00004_reparto-y-planificacion-rutas#Fase 0 — Planificación]]

Las decisiones 1–12 se tomaron revisando esta propuesta con una revisión de diseño externa (2026-08-27, anexo); los "porqués" marcados como *interpretación* son razonamiento de planificación, no citas de las fuentes.

### Modelo conceptual

1. **La visita planificada es una entidad (`rutas_visitas`), no una relación N:M simple.**
   *Por qué:* la unidad de trabajo real es **equipo + hospital + fecha + posición dentro del día**. La regla de capacidad (máx. 3/día, 8/semana) se calcula sobre esa unidad; una tabla puente `id_ruta`+`id_hospital` no podría expresarla. Con `fecha_visita` + `orden`, el backend valida capacidad con un `GROUP BY` y el frontend pinta el calendario directamente.

2. **Selección, zonas y rutas tienen ciclos de vida separados y tablas separadas.**
   *Por qué:* regenerar las rutas **no debe tocar la selección** (la selección es el universo aprobado; las rutas son una capa de planificación posterior y desechable). Por la misma razón NO se agrega `id_ruta` a `selecciones_mensuales_hospitales` — la relación se construye al revés: `rutas_visitas` apunta a `id_seleccion_hospital`.

3. **`rutas_visitas` guarda `id_seleccion_hospital`, no solo `id_hospital`.**
   *Por qué:* garantiza trazabilidad "esta visita proviene de ese hospital seleccionado dentro de esa selección" y permite un `UNIQUE (id_ruta, id_seleccion_hospital)` que impide duplicar un hospital seleccionado dentro de la misma ruta. La unicidad del hospital entre rutas de la **misma versión activa** se valida en servicio (un índice filtrado no puede mirar el estado de la tabla padre).

4. **Las zonas calculadas se PERSISTEN (`selecciones_zonas`), no se recalculan al vuelo.**
   *Por qué:* (a) el clustering debe ser determinístico y reproducible — con los mismos hospitales y parámetros, el mismo resultado — para poder responder "¿por qué este hospital quedó en esta zona?"; (b) se guarda un **snapshot de latitud/longitud** por hospital seleccionado, porque los hospitales vienen de Asokam (externo) y sus coordenadas pueden cambiar después: la ruta se generó con las coordenadas del momento y debe poder explicarse así; (c) la asignación **zona → equipo** se persiste a nivel zona, no hospital, porque así lo dice la regla de negocio ("los hospitales de la misma zona se asignan a la misma persona").

5. **La columna `id_ejecutivo` existente en `selecciones_mensuales_hospitales` (script 0003) deja de usarse como asignación.**
   *Por qué:* expresaba "hospital → ejecutivo"; la regla es "zona → equipo". Se deja la columna (no se borra) y la asignación vigente vive en `selecciones_zonas.id_equipo`. *Interpretación:* evitar un ALTER destructivo sobre una tabla ya creada; la limpieza se hará cuando el módulo de talleres migre.

### Capacidad y pareo

6. **Pareo exclusivo: un EV (y un EP) solo puede estar en un equipo activo a la vez.**
   *Por qué:* simplifica el algoritmo (cada equipo = la capacidad de una persona, sin conflictos de doble uso) y hace la validación de capacidad inequívoca. La exclusividad es una regla de **configuración actual**, no histórica: por eso el índice único es filtrado (`WHERE activo = 1`) — en el histórico sí puede repetir persona.

7. **`equipos_pareo` con vigencia (`fecha_inicio` / `fecha_fin`), no solo `activo`.**
   *Por qué:* una ruta confirmada debe conservar la pareja que existía **en ese momento**. Si el EP cambia a mitad de año, el histórico del equipo no se reescribe; el nuevo pareo aplica a planificaciones futuras.

8. **Capacidad por semana calendario real (Lun–Vie), no "8 visitas genéricas por semana".**
   *Por qué:* la selección cubre ~45 días; la validación de 8/semana y 3/día debe calcularse sobre fechas reales del periodo (semana ISO Lun–Dom, visitas solo Lun–Vie) para que el usuario vea "3/3 lunes, 2/3 martes… 6/8 semana". En v1 **no** hay catálogo de festivos (día laboral = Lun–Vie); se deja como ADR futuro si el negocio lo pide.

9. **Zona que no cabe → bloqueo explícito con opciones, nunca división silenciosa.**
   *Por qué:* si la demanda de una zona excede la capacidad del equipo en el periodo (p. ej. 20 hospitales vs. 16 visitas disponibles), el sistema muestra el déficit y ofrece [Reasignar zona] / [Dividir zona — requiere decisión humana]. El algoritmo no decide por el negocio. Ídem cuando la capacidad total de todos los equipos es menor que la demanda: se bloquea la generación con el déficit numerado.

### Algoritmo de generación del draft

10. **Generación del draft: solo calendariza lo autorizado (sin re-clusterizar ni reasignar).**
    *Por qué:* las zonas y su equipo se definieron y firmaron en la Selección; regenerar rutas **no puede cambiar lo ya autorizado** (rompería la doble firma). El generador parte de `selecciones_regiones` con `id_equipo` ya asignado y solo decide **fecha y orden**: (1) leer regiones con equipo → (2) validar capacidad global por equipo (demanda vs. capacidad del periodo) → (3) distribuir hospitales en días Lun–Vie **agrupando por localidad (ciudad)** dentro de cada región: las ciudades de una región se ordenan con un recorrido voraz de vecino más cercano (determinista) y cada ciudad viaja **en bloque** — si no cabe en lo que queda del día pero cabría en uno fresco, se pasa al día siguiente en vez de fragmentar la ciudad; una ciudad mayor que la capacidad diaria se reparte en días **consecutivos** → (4) validar 3/día, 8/semana y viajes foráneos → (5) crear el draft (versión N+1). Hospitales sin región o sin equipo quedan **sin planificar con aviso explícito**, nunca re-asignados en silencio; el cruce región→equipo también se bloquea en el alta manual de visitas (se corrige en el paso Reparto de la selección). La priorización de "zonas difíciles" vive en el paso Reparto (asignación zona→equipo), no en el generador.

    **Definición operativa de "viaje foráneo" (regla documental IDT-003 2.2).** El instructivo fija *"hasta 3 viajes foráneos por especialista por mes"*, pero ninguna fuente define qué es un viaje foráneo; para que el algoritmo pueda contarlos se define así:
    - **Clasificación del hospital** vive en `hospital_extension.es_zona_metropolitana` (catálogo propio, pantalla Hospitales): `1` = local (CDMX / zona metropolitana), `0` = foráneo, `NULL` = sin clasificar. Es un **atributo geográfico factual**, no "es_foraneo": si la definición de local cambia, cambia el dato capturado sin migrar la regla. Se deriva de la misma convención del papel (`Impartición de Talleres Médicos`: *"Si el taller se realizó fuera de la Ciudad de México o zona metropolitana…"*).
    - **Hospital sin clasificar (`NULL`) cuenta como foráneo y genera advertencia** — conservador: nunca planifica viajes de menos en silencio; el paso Reparto muestra "N hospitales sin clasificar" para que se completen en la pantalla Hospitales.
    - **Viaje foráneo** = secuencia de **días consecutivos con visitas foráneas a la MISMA zona** (`selecciones_zonas` del hospital). Dos reglas que lo hacen inequívoco: (a) cambiar de zona foránea entre días consecutivos cuenta como **otro viaje** (ej. Querétaro lunes y Guadalajara martes = 2 viajes); (b) días **no consecutivos**, aunque sean la misma zona, también son viajes distintos. Una visita foránea sin zona asignada forma su propio viaje de un día. *Interpretación de diseño* ("cambiar de destino implica otro viaje") a validar con negocio en la primera operación; si negocio decide lo contrario (una excursión multi-zona = 1 viaje), el ajuste es solo de agrupación en el servicio, sin cambio de esquema.
    - **Límite por equipo** (3, configurable en Parámetros): dado que el pareo 1 EV + 1 EP viaja junto, "por especialista" = por equipo.
    - **Exceso del límite** → advertencia explícita con acción humana (mismo trato que el déficit de capacidad), nunca ajuste silencioso.

### Versionado y estados

11. **Versionado mínimo de rutas: `version` + archivado, nunca borrado silencioso.**
    *Por qué:* "Regenerar propuesta" crea la versión N+1 y marca la anterior `Archivada` (con advertencia si había cambios manuales sin confirmar). El trabajo humano nunca desaparece: la versión vieja queda consultable. El versionado completo por generación (`generaciones_rutas` con parámetros del algoritmo) queda pospuesto hasta que el negocio lo pida — la columna `version` ya deja el camino abierto.

12. **Estados separados: la selección y las rutas no comparten máquina de estados.**
    *Por qué:* "la selección fue autorizada" y "las rutas fueron confirmadas" son cosas distintas.
    - Selección: `Borrador → EnRevision → Autorizada → Cerrada` (la **doble firma GV + GG vive aquí**, antes de planificar rutas).
    - Rutas: `Draft → Confirmada → Cancelada` (+ `Archivada` para versiones pasadas).
    - Cambio post-confirmación: **no se edita una ruta confirmada**; v1 = Cancelar rutas → regenerar → confirmar de nuevo (queda huella por versiones). Una pantalla de "solicitud de modificación" formal queda como ADR futuro.

13. **`rutas_visitas` y `talleres` son entidades distintas con vínculo futuro.**
    *Por qué:* `talleres` (script 0003) ya tiene su ciclo de ejecución (`Borrador → Elaborado → … → Realizado`) y nace de la captura del EV/EP. La visita planificada nace del algoritmo. En v1 no se toca `talleres`; cuando se construya el módulo de talleres se agregará `id_ruta_visita` (nullable) para enlazar ejecución con plan. Evita dos fuentes de verdad para capacidad: la validación 3/día / 8/semana de la planificación se hace **solo sobre `rutas_visitas`**.

---

## Fase 1 — Base de datos (scripts 0006 y 0007)

> Tareas: [[tareas/00004_reparto-y-planificacion-rutas#Fase 1 — Base de datos]]

Convenciones heredadas del script 0003: schema `educacion_medica`, snake_case, `id_<tabla>` IDENTITY PK, auditoría (`fecha_creacion`/`fecha_modificacion`, `id_usuario_creacion/modificacion`, FK lógica a `app.Usuarios` de Asokam), guards idempotentes, `MS_Description` en tablas y columnas. `activo` solo en tablas madre (AGENTS/propuesta §4.4); `rutas` usa `estado` porque versiona (no es soft-delete).

### Script 0006 — `create-equipos-pareo-estados`

| Tabla / ALTER | Qué agrega y por qué |
|---|---|
| `equipos_pareo` (nueva) | Pareo 1 EV + 1 EP. `id_ejecutivo` / `id_especialista` NOT NULL (el equipo no existe sin pareo completo). `fecha_inicio` / `fecha_fin` = vigencia (decisión 7). **Índices únicos filtrados** `WHERE activo = 1` sobre cada integrante = exclusividad actual sin bloquear el histórico (decisión 6). Sin FK física a Asokam (cross-DB): validación en servicio |
| `selecciones_mensuales` + `estado` | `Borrador / EnRevision / Autorizada / Cerrada` con CHECK — hoy la tabla solo tiene `activo BIT` y no distingue borrador de autorizada (decisión 12) |
| `selecciones_mensuales` + firmas | `firma_gv_fecha`, `firma_gg_fecha` (DATETIME2 NULL) — la doble firma de la selección. Quién firmó queda en auditoría + bitácora del endpoint |
| `selecciones_mensuales_hospitales` + snapshot | `latitud_snapshot`, `longitud_snapshot` DECIMAL(10,7) NULL — coordenadas congeladas al momento de la selección (decisión 4) |
| `selecciones_mensuales_hospitales` + `id_zona` | Columna NULL; la FK física se crea en 0007 (dependencia de `selecciones_zonas`) |
| `hospital_extension` + `es_zona_metropolitana` | `1` = local CDMX/zona metro, `0` = foráneo, `NULL` = sin clasificar — alimenta la regla de ≤3 viajes foráneos/mes (decisión 10); se mantiene desde la pantalla Hospitales |

### Script 0007 — `create-zonas-rutas`

| Tabla | Qué modela y por qué |
|---|---|
| `selecciones_zonas` | Zonas calculadas de una selección: `centro_latitud/longitud` (centroide), `cantidad_hospitales`, `algoritmo` (p. ej. `haversine-greedy-v1`), `fecha_calculo`, `id_equipo` (asignación zona → equipo, FK física — misma BD). Al regenerar la agrupación, las zonas de la selección se recalculan (DELETE + INSERT; son hijas de un agregado en revisión, no histórico firmado) |
| `rutas` | Ruta por equipo y versión: `id_seleccion_mensual`, `id_equipo`, `version`, `estado` (`Draft/Confirmada/Cancelada/Archivada`), `fecha_confirmacion`. Una misma versión puede tener varias rutas del mismo equipo (zona dividida autorizada) — no hay UNIQUE (equipo, versión) |
| `rutas_visitas` | La visita planificada: `id_ruta`, `id_seleccion_hospital` (trazable, decisión 3), `id_hospital` (denormalizado para consulta, FK lógica a Asokam), `fecha_visita DATE` NOT NULL, `orden TINYINT` NOT NULL, `hora_salida` / `hora_llegada` TIME NULL (regla de horario laboral). `UNIQUE (id_ruta, fecha_visita, orden)` y `UNIQUE (id_ruta, id_seleccion_hospital)`. Sin columna `estado` propia: el estado de la ruta gobierna sus visitas (v1); se agregará si aparece cancelación de visita individual |

---

## Fase 2 — Backend

> Tareas: [[tareas/00004_reparto-y-planificacion-rutas#Fase 2 — Backend]]

Feature `Features/EducacionMedica/` (ya existe); controllers nuevos. Todos los endpoints de escritura validan permisos `educacion_medica.*` y registran en bitácora (Serilog).

### `EquiposPareoController` — `api/educacion-medica/equipos-pareo`

| Endpoint | Qué hace | Validación clave |
|---|---|---|
| `GET /` | Lista equipos (filtro `vigentes=true/false`) | — |
| `POST /` | Crea pareo (EV + EP) | EV/EP existen en `app.Usuarios`; **ninguno en otro equipo activo** (índice filtrado + check en servicio para error amigable) |
| `PUT /{id}/desactivar` | Cierra vigencia (`fecha_fin` + `activo = 0`) | No desactiva si tiene rutas en draft de la versión actual (avisar) |

### `SeleccionesMensualesController` — `api/educacion-medica/selecciones-mensuales`

| Endpoint | Qué hace | Validación clave |
|---|---|---|
| `GET /?anio&mes` · `GET /{id}` | Lista / detalle con hospitales y zonas | — |
| `POST /` | Crea selección `Borrador` (periodo de 45 días) | No duplicar periodo+gerencia activo |
| `POST /{id}/hospitales` · `DELETE /{id}/hospitales/{idSelHospital}` | Agrega / quita hospitales | Hospital existe en Asokam; snapshot de lat/long al agregar; **borrar hospital elimina su zona si queda vacía** |
| `POST /{id}/agrupar` | Clustering haversine sobre snapshot → persiste `selecciones_zonas` | Determinístico; aviso zonas con **< 4 hospitales**; regenerar borra zonas previas (advertencia si había equipos asignados) |
| `PUT /{id}/zonas/{idZona}/equipo` | Asigna zona → equipo | Capacidad del equipo en el periodo vs. hospitales de la zona; déficit → 409 con opciones (reasignar/dividir) |
| `POST /{id}/zonas/{idZona}/dividir` | Divide zona en dos (excepción humana) | Requiere observación del motivo |
| `POST /{id}/enviar-revision` | `Borrador → EnRevision` | Mínimo 1 zona con equipo |
| `POST /{id}/autorizar` | `EnRevision → Autorizada` (**doble firma** GV + GG) | Roles correctos; meta ≥ talleres_objetivo avisada (no bloqueante si negocio decide excepción) |
| `POST /{id}/cerrar` | `Autorizada → Cerrada` (mes planificado y ejecutado) | Rutas confirmadas |

### `RutasController` — `api/educacion-medica/selecciones-mensuales/{id}/rutas`

| Endpoint | Qué hace | Validación clave |
|---|---|---|
| `GET /?version=actual` | Rutas + visitas de la versión indicada (default: máxima) | — |
| `POST /generar` | Calendariza lo autorizado → crea `version = N+1`; la `Draft` anterior pasa a `Archivada`. Parte de regiones con equipo ya asignado; **no re-clusteriza ni reasigna**. Body opcional: `{ estrategia }` — `ciudad` (default: ciudades viajan juntas) o `centroide` (empaqué clásico: llena el día aunque mezcle ciudades); la respuesta devuelve la estrategia aplicada | Selección `Autorizada`; **advertencia de cambios manuales** si la draft actual tenía ediciones (el front confirma); déficit de capacidad global → 409 bloqueante con números (hospitales, capacidad, faltan); **≤3 viajes foráneos por equipo al mes** (hospitales con `es_zona_metropolitana = 0/NULL`; viaje = días consecutivos de foráneos en la misma región — cambio de región o día no consecutivo = otro viaje) — exceso → advertencia con acción humana; hospitales sin región/sin equipo → aviso (sin planificar); estrategia desconocida → 409 |
| `PUT /{idRuta}/visitas/{idVisita}/mover` | Mover visita (fecha/orden) — el drag & drop | Revalida 3/día y 8/semana del equipo; hospital no duplicado en otra ruta de la misma versión activa |
| `POST /{idRuta}/visitas` · `DELETE /{idRuta}/visitas/{idVisita}` | Alta / baja manual de visita | Alta: hospital de la selección y sin planificar; **respeta la frontera región→equipo** (rechaza el cruce a otra región/equipo — se corrige en Reparto); sin región o sin equipo → alta permitida con aviso explícito (única vía de cobertura 100% en selección ya autorizada) |
| `POST /confirmar` | `Draft → Confirmada` (todas las rutas de la versión) | Cobertura 100% de hospitales de la selección planificados; publica asignaciones que alimenta `GET /talleres/asignaciones/{idUsuario}` |
| `POST /cancelar` | `Confirmada → Cancelada` (flujo de cambio post-confirmación) | Motivo obligatorio; habilita regenerar |

**Algoritmo (POST /generar), determinístico:** leer regiones con su equipo ya asignado (autorizado en la Selección, paso Reparto) → validar capacidad global por equipo → dentro de cada región, ordenar ciudades con vecino más cercano desde el centroide (empate por clave alfabética) y repartir en días Lun–Vie **sin fragmentar ciudades** (una ciudad no se parte entre días si cabe junta en un día; si excede la capacidad diaria, se divide en días consecutivos) → validar capacidad (8/semana ISO real y **≤3 viajes foráneos/mes por equipo**, contando días consecutivos foráneos en la misma región) → crear `rutas_visitas` en draft (versión N+1). Hospitales sin región o sin equipo quedan sin planificar con aviso, nunca re-asignados. Parámetros (radio de clustering, capacidades diaria/semanal y límite de viajes foráneos) salen de la pantalla de Parámetros (configurables sin código); el radio de clustering solo aplica al agrupar en el paso Reparto.

---

## Fase 3 — Frontend

> Tareas: [[tareas/00004_reparto-y-planificacion-rutas#Fase 3 — Frontend]]

Tres pantallas con fronteras explícitas (nombres de UI elegidos para comunicar intervención humana):

### 1. Equipos y Pareo — `/catalogos/equipos-pareo` (completar wireframe existente)
- Tabla de equipos con vigencia (activos / históricos, toggle).
- Modal alta/edición: selector EV + EP (usuarios de `GET /usuarios`); bloquea si ya están en otro equipo activo (error del servicio mostrado inline).
- Desactivar con confirmación (fecha fin = hoy).

### 2. Selección y reparto — `/seleccion` (completar wireframe existente)
Wizard de 3 pasos: **Hospitales → Reparto → Autorización**.
- *Hospitales:* búsqueda/filtros sobre catálogo; contador seleccionados; meta (≥64/64) en vivo.
- *Reparto:* botón "Calcular zonas" → cards por zona (nombre editable, hospitales, centro GPS); aviso <4 hospitales por zona; aviso **hospitales sin clasificar** (`es_zona_metropolitana` NULL) con enlace a la pantalla Hospitales; selector de equipo por zona con **capacidad consumida/total**; zona con déficit → panel ⚠ con [Reasignar] / [Dividir]; mapa reutilizando `HospitalesMap.tsx` (Leaflet) pintando zonas y centroides.
- *Autorización:* resumen de validaciones (metas, capacidad, advertencias) + doble firma (GV firma → GG firma) sobre selección `EnRevision`.

### 3. Planificación de rutas — `/seleccion/{id}/rutas` (nueva `RutasPage`)
- Encabezado: estado (DRAFT / CONFIRMADA), selector de versión (N actual; versiones archivadas de solo lectura), **selector de criterio de propuesta** ("Ciudades juntas" / "Compacto por distancia al centroide" → `estrategia` del POST /generar, default ciudades juntas), [Regenerar propuesta] (con advertencia de cambios manuales), [Confirmar rutas].
- Layout maestro–detalle: equipos a la izquierda (carga total x/N), rutas a la derecha agrupadas **por día** (LUN 03/09 · 3/3 ✓) con cards de visita arrastrables.
- **Contexto de la selección en el encabezado**: periodo (vigencia), gerencia y estado de la selección (Autorizada/Cerrada), junto al estado de las rutas (DRAFT/CONFIRMADA).
- Días agrupados en **secciones por semana ISO** con badge "Semana N: x/8" (rojo si excede); contador **"Foráneos: x/3"** por equipo (rojo si excede); topes leídos de Parámetros.
- Drag & drop de visita entre días/rutas → `PUT /visitas/{id}/mover` y badges de capacidad reaccionan al instante (4/3 🔴 si excede); si el movimiento rompe el límite de foráneos, el aviso aparece al regenerar y el badge lo marca.
- Solo editable en `Draft`; en `Confirmada` el botón disponible es [Solicitar cambio] = flujo cancelar → regenerar.
- Mapa opcional (Leaflet) para visualizar el recorrido del día.

> **Nota — pantalla Hospitales (ADR-00001):** gana el campo `es_zona_metropolitana` en la extensión del hospital (checkbox local/foráneo); es el dato que alimenta la regla de viajes foráneos.

### Permisos (complementan ADR-00001 §3.2)

| Permiso | Quién |
|---|---|
| `educacion_medica.equipos.puede_ver` / `puede_gestionar` | (ya definidos en ADR-00001) GG gestiona; CA ajusta |
| `educacion_medica.selecciones.puede_ver` | (ya definido) EV ve su asignación; AEM lectura |
| `educacion_medica.selecciones.puede_editar` | GV (su gerencia) |
| `educacion_medica.selecciones.puede_autorizar` | GG + GV (doble firma; quien firma no captura) |
| `educacion_medica.rutas.puede_ver` | EV/EP/GV/CA/AEM |
| `educacion_medica.rutas.puede_planificar` | GV (draft) |
| `educacion_medica.rutas.puede_confirmar` | GG |

---

## Validación contra la operación documentada

| Regla implementada | Fuente documental (cita literal) |
|---|---|
| Agrupar hospitales por zonas; mínimo 4 hospitales por viaje foráneo | `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — *"2. Agrupa hospitales por zonas geográficas para que, en un mismo viaje foráneo, el ejecutivo de ventas visite varios hospitales y programe mínimo 4 hospitales para taller médico."* |
| Meta mensual por gerencia | Ídem — *"3. Se deben programar al menos 64 talleres en el mes en IMSS y la misma cantidad en Descentralizados."* |
| Cuota por especialista | Ídem — *"2.1 La cuota de talleres por especialista de producto es de al menos 4 hospitales y 6 talleres por semana."* |
| Límite de viajes foráneos | Ídem — *"2.2 En el mes se pueden programar hasta 3 viajes foráneos por especialista por mes."* — **implementado en el algoritmo** (fase 5 de validación + parámetro configurable); la definición operativa de "viaje foráneo" es propia del diseño (decisión 10, el papel no la define) |
| Reunión del día 15 y registro por parte del GV | Ídem — *"4. Gerente de Ventas registra en el formato 'Selección de Hospitales para Talleres Médicos' los hospitales que serán visitados el próximo mes…"* |
| Agrupación por valor de mercado y ubicación | `Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md` — *"Selección con base en valor de mercado y ubicación geográfica; agrupación por zonas: mínimo 4 hospitales por viaje foráneo."* |
| Prioridad a hospitales sin taller en el año | Ídem / IDT-003 — *"Seleccionan de manera preferente, hospitales en los cuales aún no se han hecho talleres en el año."* |

**Reglas de planificación interna sin documento fuente del papel** (marcadas explícitamente como *interpretación/operación real*, no citas): capacidad máx. 3 visitas/día y 8/semana por persona; pareo 1 EV + 1 EP por ruta; misma zona → misma persona; zonas calculadas por clustering GPS porque `genContactosCat.zona` está vacío en 97.6% (validado contra Asokam, ADR-00001 §1.2). Consolidadas en reglas-negocio §5.2–5.5.

## Consequences

**Positivas**
- La capacidad (3/día, 8/semana) se valida **antes** de comprometer fechas — hoy no se valida en absoluto.
- Trazabilidad completa: versiones de rutas, vigencia de pareos y snapshots de coordenadas permiten responder "¿qué se planeó, con qué datos y con quién?" en cualquier fecha.
- El draft es explicable (fases nombradas, zonas determinísticas) y corregible a mano — cumple el principio sistema-propone/humano-dispone.
- `rutas_visitas` con fecha/orden deja listo el calendario, el drag & drop y la futura ejecución de talleres.

**Negativas**
- Más tablas y joins (6 nuevas) que la alternativa de un simple flag; el backend del generador es la pieza más compleja del módulo hasta ahora.
- El greedy no es óptimo: con equipos muy justos de capacidad puede requerir corrección manual frecuente (mitigado: prioridad de zonas difíciles + bloqueo explícito).
- El versionado obliga a filtrar siempre por versión activa en las consultas de rutas.
- Los snapshots de coordenadas pueden divergir del catálogo vigente de Asokam (es deliberado, pero hay que comunicarlo).
- La regla de viajes foráneos depende de un **dato nuevo a mantener** (`hospital_extension.es_zona_metropolitana`): si la clasificación está incompleta, la generación advierte y cuenta los NULL como foráneos (conservador).

**Neutras / seguimiento**
- **ADR futuro:** vínculo `rutas_visitas` ↔ `talleres` (ejecución de visitas) cuando se construya el módulo de talleres.
- **ADR futuro (opcional):** catálogo de festivos para días laborables; versión completa del historial (`generaciones_rutas` con parámetros del algoritmo); solicitud formal de modificación de rutas confirmadas.
- La columna `id_ejecutivo` de `selecciones_mensuales_hospitales` queda en desuso (migración de limpieza pendiente).

## Anexo — Fuentes

**Documentos fuente (operación en papel):**
- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (IDT-003) — reglas de agrupación por zonas, mín. 4 hospitales/viaje, ≥64 talleres/mes, cuota por especialista, día 15.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md` (FOR-004) — criterios de selección y agrupación.
- `referencias/pdf-to-md/Instructivos/Elaborar Plan de Trabajo.md` (ASK-VEN-IDT-001) — contexto del plan de trabajo y unidades médicas asignadas por ejecutivo.

**Planificación interna (no son fuentes documentales, son decisiones propias):**
- `reglas-negocio.md` §5.2–5.5 (capacidad, pareo, zonas, draft→select), §7 (parámetros configurables).
- `decisiones/00001_esquema-datos-educacion-medica.md` — tablas `selecciones_mensuales`/`_hospitales`/`talleres`, validación Asokam (`zona` 97.6% vacío, lat/long 100%), permisos base.
- Revisión de diseño externa (2026-08-27) — sugerencias incorporadas: `rutas_visitas` como entidad, zonas persistidas, vigencia de pareos, greedy por fases con prioridades, bloqueo por capacidad, versionado mínimo, estados separados, snapshot de coordenadas.
