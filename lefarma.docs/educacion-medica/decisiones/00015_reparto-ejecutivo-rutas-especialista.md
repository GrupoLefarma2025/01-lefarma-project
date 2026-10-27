---
fecha_creacion: 2026-10-23 10:00
fecha_modificacion: 2026-10-23 10:00
resumen: Sustituye el modelo de equipos de pareo EV+EP de ADR-00004 por un reparto en dos capas — la selección asigna regiones/hospitales a ejecutivos y la ruta se organiza por especialista, que puede atender varias gerencias y ejecutivos. Define elegibilidad especialista↔gerencia, región del ejecutivo, capacidad por especialista, parámetros y el motor de sugerencia de visitas por cercanía. La ruta es un draft sin workflow; la selección y la matriz conservan su autorización.
---

# ADR-00015 — Reparto por ejecutivo y rutas por especialista (sin equipos de pareo)

## Status

Proposed

> **Decisiones confirmadas por el usuario (2026-10-23):**
> - La ruta es **por especialista**.
> - El ejecutivo se pone de acuerdo con el especialista y selecciona el taller/hospital; la ruta define dónde y cuándo.
> - La gente con permiso puede ver que un especialista estará en Puebla el miércoles y asignarle un hospital de Puebla el jueves, aprovechando la visita; antes se hacía a mano en el Excel y ahora el sistema lo sugiere.
> - La ruta es **draft, sin workflow**.
> - La selección y la matriz conservan su autorización; los cambios de la matriz se resuelven por solicitud de taller (ADR-00018).
>
> **Supersede parcialmente a ADR-00004** en el modelo de equipos de pareo y en la ruta por equipo. Se conservan de ADR-00004: zonas calculadas por GPS, snapshot de coordenadas, capacidad 3/día/8/semana, viajes foráneos, versionado mínimo y el principio sistema-propone/humano-dispone. El ADR-00004 queda marcado `Superseded by ADR-00015`.

## Índice

1. [Decisión](#decisión)
2. [Contexto y problema](#contexto-y-problema)
3. [Modelo conceptual](#modelo-conceptual)
4. [Fases](#fases)
5. [Base de datos (script 0033)](#base-de-datos-script-0033)
6. [Backend](#backend)
7. [Frontend](#frontend)
8. [Parámetros configurables](#parámetros-configurables)
9. [Validación contra la operación documentada](#validación-contra-la-operación-documentada)
10. [Consequences](#consequences)
11. [Anexo — Fuentes](#anexo--fuentes)

## Decisión

El reparto de talleres se divide en **dos capas independientes**:

```
SELECCIÓN MENSUAL                         PLANEACIÓN (CALENDARIO)
¿Quién es dueño del hospital/región?      ¿Quién lo visita y qué día?
        │                                          │
        ▼                                          ▼
Ejecutivo de Ventas (id_ejecutivo)        Especialista de Producto (id_especialista)
        │                                          │
        └──────────── visita/taller ───────────────┘
                  (id_ejecutivo + id_especialista)
```

1. **La selección asigna regiones/hospitales a ejecutivos**, no a equipos. El ejecutivo es el dueño comercial de la zona y quien acuerda con el especialista la fecha del taller.
2. **La ruta se organiza por especialista**, porque el especialista es el recurso que viaja y puede atender hospitales de varios ejecutivos y de varias gerencias en el mismo viaje.
3. **Cada visita lleva ambos roles**: `id_ejecutivo` (dueño del hospital) e `id_especialista` (quien imparte). El especialista puede cambiar de ejecutivo entre visitas; no hay pareo exclusivo.
4. **Se elimina `equipos_pareo` como unidad operativa.** La tabla se conserva para histórico, pero no se usa para nuevas selecciones, rutas ni matrices.
5. **La ruta es un draft versionado sin workflow.** No se firma ni se cierra; la autorización vive en la **selección** y en la **matriz** (ADR-00006/00007/00018). La versión de rutas se conserva como contenedor de versiones y para el histórico.
6. **El sistema sugiere, el humano dispone.** El motor propone especialista y fecha agrupando visitas cercanas (misma ciudad/estado, días consecutivos, capacidad y elegibilidad); el planificador confirma o corrige con drag & drop o con un selector.
7. **La elegibilidad es dato, no permiso de aplicación.** `especialista_gerencia` define qué gerencias puede atender cada especialista; `ejecutivo_region` define la región del ejecutivo; `especialista_region` es opcional y solo alimenta la sugerencia.

## Contexto y problema

### Lo que hay hoy

El módulo está construido alrededor del equipo EV+EP:

- `EquipoPareo` une ejecutivo + especialista + región (`Domain/Entities/EducacionMedica/EquipoPareo.cs`).
- `SeleccionRegion.IdEquipo` asigna la zona al equipo (`Domain/Entities/EducacionMedica/SeleccionRegion.cs:13`).
- `Ruta.IdEquipo` crea una ruta por equipo (`Domain/Entities/EducacionMedica/Ruta.cs:13`).
- `MatrizIndividual.IdEquipo` captura por equipo (`Domain/Entities/EducacionMedica/MatrizIndividual.cs:11`).
- `RutasService` genera una ruta por equipo y valida capacidad por equipo (`Features/EducacionMedica/RutasService.cs:137-255`).
- `TalleresService` obtiene el equipo del hospital/región y de ahí saca ejecutivo y especialista (`Features/EducacionMedica/TalleresService.cs:155-190`).

Ese modelo impone dos restricciones que la operación real no tiene:

1. **Un especialista solo puede estar en un equipo activo a la vez** (ADR-00004, decisión 6). En la práctica un especialista puede dar taller en Veracruz y en Chiapas, con ejecutivos distintos y gerencias distintas.
2. **La ruta se planea por equipo**, no por especialista. El Excel real de calendario (`MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx`) está armado por **especialista**: cada bloque es un especialista y cada celda contiene `EJECUTIVO/Hospital + hora`. El especialista es el que viaja; el ejecutivo es el dueño del hospital.

### Evidencia operativa

El Excel de octubre 2026 muestra:

- Filas/bloques por especialista: Roberto, César García, Pablo Peña, Santiago Gutiérrez, Ángel, Juan Pablo.
- Celdas con `EJECUTIVO/Hospital + hora`; el mismo especialista aparece con Alma, Víctor, José, Paco, Carmen, Hilda, Alexander, Alberto, AGISS, etc.
- Varias visitas del mismo especialista el mismo día en la misma ciudad (p. ej. Cancún, CDMX, Monterrey).
- Celdas “INFORMATIVA” y “CAPTACIÓN DE QUEJA” además de talleres.
- Filas “VACANTE” cuando no hay especialista asignado.

La matriz (`PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF`) confirma que la matriz sí se organiza por gerencia e incluye **Ejecutivo/Especialista** por fila, además de fecha, hora, producto, cantidades y costos.

### Problema a resolver

- Asignar un especialista a una visita no debe depender de un equipo fijo.
- El sistema debe aprovechar que un especialista ya estará en una ciudad para sugerirle hospitales cercanos en días contiguos (ejemplo Puebla miércoles → Puebla jueves).
- La selección debe seguir siendo el documento que autoriza el universo de hospitales y el ejecutivo dueño.
- La matriz debe seguir siendo el documento que autoriza los talleres y sus costos.
- La ruta debe ser una herramienta de trabajo corregible, no un documento que frene la operación con otra cadena de firmas.

## Modelo conceptual

### Capa 1 — Selección (ejecutivo dueño)

- `selecciones_regiones.id_ejecutivo` (nuevo, obligatorio al cerrar la selección) e `id_especialista` (opcional, sugerencia/default).
- `selecciones_mensuales_hospitales.id_ejecutivo` (se agrega si falta; 0016 no la traía aunque 0003 sí) para override por hospital.
- `selecciones_mensuales_hospitales.id_especialista` (nuevo, opcional; si se captura, es una sugerencia/default para la planeación).
- El dropdown de ejecutivos se filtra por la gerencia de la selección usando `ejecutivo_region`.

### Capa 2 — Planeación (especialista asignado)

- `rutas.id_especialista` (nuevo; la ruta es del especialista).
- `rutas_visitas.id_ejecutivo` e `id_especialista` (denormalizados para consulta y trazabilidad).
- `rutas_visitas.id_seleccion_hospital` / `id_hospital`, fecha, orden, horas y `tipo_visita`.
- `talleres.id_ruta_visita` (nuevo) para enlazar ejecución con planeación.
- `matrices_individuales.id_ejecutivo` (nuevo; la captura individual deja de ser por equipo).
- `MatrizGeneral` sigue siendo por gerencia/mes y conserva su workflow.

### Catálogos de personas

| Tabla | Qué define | Obligatorio |
|---|---|---|
| `ejecutivo_region` | Región(es) del ejecutivo; de ahí se deriva su gerencia. Solo `activo`/`inactivo`, sin vigencia. | Sí, al menos una. |
| `ejecutivo_suplente` | Usuario que puede cubrir como ejecutivo cuando la región no tiene primario. `id_tipo_gerencia`/`id_region_catalogo` NULL = todas; nunca es la primera sugerencia. | No. |
| `especialista_gerencia` | Gerencias que puede atender el especialista. | Sí, al menos una; la pantalla Personas lo exige. |
| `especialista_region` | Región preferida del especialista (opcional; solo sugerencia). | No. |

> **Supuesto a validar:** si un especialista no tiene filas en `especialista_gerencia`, se trata como **no elegible** hasta configurarlo. La alternativa (sin filas = todas) es más permisiva pero menos predecible; la pantalla Personas debe dejar explícito cuál se usa.

### Sugerencia de visitas cercanas (ejemplo Puebla)

Entrada:

- Especialista con visita confirmada en Puebla el miércoles.
- Hospitales de Puebla sin especialista asignado, en la selección vigente.
- Capacidad del especialista (3/día, 8/semana, 3 viajes foráneos/mes).
- Elegibilidad del especialista para la gerencia del hospital.

Salida:

- Propuesta: asignar al especialista los hospitales de Puebla el jueves (o el mismo miércoles si cabe), evitando un viaje de regreso.
- La propuesta se muestra con badge **“Sugerido”** y el motivo (“ya está en Puebla”).
- El planificador acepta, ajusta o ignora. El sistema nunca asigna solo.
- La fecha se acuerda con el ejecutivo; el planificador la registra.

Algoritmo propuesto (determinista, explicable):

1. Construir los “bloques de ciudad/día” del especialista (visitas ya asignadas).
2. Para cada hospital sin especialista, calcular cercanía al bloque (misma ciudad/estado o distancia ≤ `radio_clustering_km`).
3. Filtrar por elegibilidad de gerencia.
4. Ordenar por: misma ciudad > misma zona > distancia; luego por carga del especialista.
5. Proponer el día contiguo con capacidad; si no cabe, proponer otro especialista o dejar sin asignar con aviso.
6. Nunca fragmentar una ciudad si cabe junta; si excede la capacidad diaria, dividir en días consecutivos (hereda la lógica de `DistribuirEnDias`).

### Estados

- **Selección**: `Creada → EnRevision → Cerrada` (+ `Rechazada`/`Cancelada`), sin cambios.
- **Ruta/versión**: draft versionado. Se conserva `rutas_versiones` como contenedor (`Creada`/`Archivada`), pero **no** es entidad del motor ni requiere firmas. La UI la etiqueta “Borrador”.
- **Matriz**: `MatrizGeneral` conserva su workflow (`GV → AEM costos → CA → DC`) y es la autorización de los talleres.
- **Taller**: `Creada → Programado → EnCurso → Realizado/Cancelado` (ADR-00008), con candado por taller después de la matriz (ADR-00018).

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Este ADR + tarea 00015; decisiones de usuario; validación de datos | Documento revisado y aprobado |
| **1** | Base de datos | Script 0033: catálogos de personas, columnas de ejecutivo/especialista, deprecación de equipos; 0037 limpia datos operativos; 0038 retira vigencia y agrega `ejecutivo_suplente` | Script idempotente, `PARSEONLY`, datos de dev limpios |
| **2** | Backend | Servicios/endpoints de personas, selección, rutas por especialista, sugerencias, talleres, matrices | `dotnet test` con pruebas de elegibilidad/capacidad/sugerencia |
| **3** | Frontend | Selección con ejecutivo, pantalla Personas, calendario (ADR-00016), ajustes en talleres/matriz | `npm run build`, `npm run lint`, E2E |
| **4** | Verificación | Limpieza, E2E, documentación | Flujo completo con 3 gerencias y roster variable |

## Base de datos (scripts 0033 y 0038)

`lefarma.database/educacion-medica/0033_20261023-1000_educacion-medica_reparto-ejecutivo-especialista.lefarma.sql`, idempotente, transacción única, estilo 0016/0027:

### Tablas nuevas

| Tabla | Columnas | Notas |
|---|---|---|
| `ejecutivo_region` | `id_ejecutivo_region` PK, `id_usuario` INT NOT NULL, `id_region_catalogo` INT NOT NULL FK, `activo` BIT, auditoría | FK lógica a `app.Usuarios` (Asokam); FK física a `regiones_cat`. Sin fechas: la baja se controla con `activo`; validar en servicio que todas las regiones de un ejecutivo sean de la misma gerencia. |
| `ejecutivo_suplente` | `id_ejecutivo_suplente` PK, `id_usuario` INT NOT NULL, `id_tipo_gerencia` INT NULL FK, `id_region_catalogo` INT NULL FK, `activo` BIT, auditoría | FK lógica a `app.Usuarios`; FK físicas a `tipo_gerencia`/`regiones_cat`. NULL = todas. El motor lo usa solo si no hay `ejecutivo_region` primario. |
| `especialista_gerencia` | `id_especialista_gerencia` PK, `id_usuario` INT NOT NULL, `id_tipo_gerencia` INT NOT NULL FK, `activo` BIT, auditoría | FK lógica a `app.Usuarios`; FK física a `tipo_gerencia`. Único activo `(id_usuario, id_tipo_gerencia)`. |
| `especialista_region` | `id_especialista_region` PK, `id_usuario` INT NOT NULL, `id_region_catalogo` INT NOT NULL FK, `activo` BIT, auditoría | Opcional; solo preferencia/sugerencia. |

### Columnas nuevas / cambios

| Tabla | Cambio | Por qué |
|---|---|---|
| `selecciones_regiones` | `id_ejecutivo INT NULL`, `id_especialista INT NULL` | Dueño de la región y sugerencia opcional. |
| `selecciones_mensuales_hospitales` | `id_ejecutivo INT NULL` (se agrega si falta), `id_especialista INT NULL` | Override por hospital y sugerencia opcional. |
| `rutas` | `id_especialista INT NULL`; `id_equipo` pasa a NULL | Ruta por especialista; `id_equipo` queda legacy. |
| `rutas_visitas` | `id_ejecutivo INT NULL`, `id_especialista INT NULL` | Dueño y ejecutor de la visita. `tipo_visita` se agrega en ADR-00016/script 0035. |
| `talleres` | `id_ruta_visita INT NULL` | Enlaza ejecución con planeación. |
| `matrices_individuales` | `id_ejecutivo INT NULL`; `id_equipo` pasa a NULL; el UNIQUE `(id_equipo, periodo)` se reemplaza por índices únicos filtrados | Captura individual por ejecutivo; `id_equipo` queda legacy. |

### Datos: sin backfill (limpieza)

**Decisión 2026-10-23:** no se migran datos históricos de `equipos_pareo`. Los datos operativos de desarrollo se limpian con `0037_..._limpieza-datos-operativos.lefarma.sql` y se empieza con el modelo nuevo desde cero.

1. **`0037`** borra, en orden hijo→padre: talleres y sus hijos, matrices, rutas/visitas, selecciones, equipos y rankings.
2. **No toca** catálogos ni configuración: `hospital_extension`, `regiones_cat`, `regiones_estados`, `tipo_gerencia`, `parametros_modulo`, `tipo_visita`, `tema_taller`, `config_ranking`, `parametros_anestesias`.
3. **No toca** `programas_anuales`/`programas_anuales_detalles`; el bloque para limpiarlos está comentado en `0037` por si el área lo pide.
4. La clasificación de gerencias se hace desde la pantalla Hospitales; `0034` solo crea la tercera gerencia y sus regiones, sin reclasificar hospitales.
5. Si en el futuro se decide migrar datos históricos, se hace con un script aparte, revisando duplicados de `id_ejecutivo`/`periodo`.

> **No** se eliminan columnas `id_equipo` en esta entrega: se vuelven NULLables y quedan como legado. La limpieza destructiva de columnas/tabla `equipos_pareo` queda como follow-up.

## Backend

### Servicios nuevos

| Servicio | Responsabilidad |
|---|---|
| `EjecutivoRegionService` | CRUD de regiones del ejecutivo; validar una sola gerencia por ejecutivo; resolver gerencia. |
| `EspecialistaGerenciaService` | CRUD de gerencias elegibles; validar al menos una; exponer elegibilidad al asignador. |
| `EspecialistaRegionService` | CRUD de región preferida (opcional). |
| `CalendarioService` | Ver ADR-00016: consulta unificada, sugerencias, asignación de especialista. |
| `AsignadorEspecialistasService` | Motor de sugerencia: bloques ciudad/día, cercanía, capacidad, elegibilidad, balanceo. |

### Cambios en servicios existentes

- **`SeleccionMensualService`**:
  - `AsignarEjecutivoAsync(idSeleccion, idRegion, idEjecutivo)`.
  - Validar que el ejecutivo tenga región en la gerencia de la selección.
  - Al cerrar (`CERRAR`), exigir **todas las regiones con ejecutivo** (análogo a la validación de equipos de ADR-00006).
  - DTO de región/hospital incluye ejecutivo y especialista opcional.
- **`RutasService`**:
  - `GenerarAsync` agrupa por **especialista** (no por equipo), parte de visitas con ejecutivo y gerencia, y propone especialista/fecha.
  - `MoverVisitaAsync` permite mover entre especialistas/días con revalidación de capacidad y elegibilidad.
  - `AsignarEspecialistaAsync(idVisita, idEspecialista, motivo?)`.
  - Se retira la validación “región → equipo”; se sustituye por “región → ejecutivo” y “visita → especialista elegible”.
  - Se retira el workflow de `RutaVersion`; no hay `enviar-revision`/`firmar`/`cerrar` de rutas.
- **`TalleresService`**:
  - Crear desde `idRutaVisita` (hereda ejecutivo/especialista/fecha/hospital).
  - Si se crea sin visita, exigir hospital de la selección y ejecutivo asignado; especialista opcional.
  - Default de cantidad de producto desde parámetro (`producto_cantidad_default`, default 2).
  - Extraordinario: alcance parametrizado (ADR-00017).
- **`MatrizTalleresService`**:
  - `MatrizIndividual` por ejecutivo/mes (no equipo).
  - `MatrizGeneral` por gerencia/mes se conserva.
  - Vista consolidada de todas las gerencias (consulta, sin tabla nueva).
- **`WorkflowService`**:
  - `TipoGerencia` 3 = IMSS Bienestar (ADR-00017).
  - `RutaVersion` deja de resolver workflow.

### Endpoints

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| `GET/POST/PUT` | `/api/educacion-medica/personas/ejecutivos` | `configuracion.personas.puede_gestionar` | CRUD ejecutivo↔región. |
| `GET/POST/PUT` | `/api/educacion-medica/personas/especialistas` | `configuracion.personas.puede_gestionar` | CRUD especialista↔gerencia/región. |
| `PUT` | `/api/educacion-medica/selecciones-mensuales/{id}/regiones/{idRegion}/ejecutivo` | `selecciones.puede_gestionar` | Asigna ejecutivo a la región. |
| `POST` | `/api/educacion-medica/selecciones-mensuales/{id}/rutas/generar` | `rutas.puede_gestionar` | Genera draft por especialista + sugerencias. |
| `PUT` | `/api/educacion-medica/rutas/visitas/{idVisita}/especialista` | `rutas.puede_gestionar` | Reasigna especialista con validación. |
| `GET` | `/api/educacion-medica/rutas/sugerencias?idSeleccion&idEspecialista&desde&hasta` | `rutas.puede_ver` | Sugerencias de hospitales cercanos. |

### Pruebas unitarias

- Ejecutivo sin región en la gerencia → rechazado.
- Región sin ejecutivo al cerrar → rechazado.
- Especialista sin elegibilidad para la gerencia → rechazado.
- Especialista con 3 visitas/día u 8/semana → rechazado en asignación directa; aviso en sugerencia.
- Sugerencia Puebla: especialista en Puebla miércoles + hospital Puebla jueves → propuesto; hospital de otra ciudad lejana → no propuesto.
- Reasignar visita entre especialistas conserva ejecutivo y actualiza la ruta.
- Taller desde visita hereda ejecutivo/especialista/fecha; sin visita exige selección/ejecutivo.
- Matriz individual por ejecutivo; general por gerencia.
- No regresión de selección/autorización/matriz.

## Frontend

- **Selección**: selector de ejecutivo por región; columna de especialista opcional; validación en vivo de gerencia; resumen con ejecutivo.
- **Personas**: nueva pantalla con dos tabs:
  - Ejecutivos: usuario, región(es), gerencia derivada, carga actual, activo.
  - Especialistas: usuario, gerencias permitidas, región preferida, carga actual, activo.
- **Planeación**: ver ADR-00016.
- **Talleres/Mis talleres**: dejar de depender de `EquipoPareo`; mostrar ejecutivo + especialista de la visita.
- **Matriz**: matriz individual por ejecutivo; general por gerencia; vista consolidada.
- **Eliminar**: `EquiposPareoPage` de la navegación (se conserva el archivo como legado o se elimina en un follow-up).
- **Permisos**: `configuracion.personas.puede_gestionar`, `rutas.puede_gestionar`, `calendario.*` (ADR-00016).

## Parámetros configurables

Todos en `parametros_modulo` (se agrega `tipo` y `valor_texto` para enums/booleanos):

| Clave | Default | Uso |
|---|---|---|
| `max_visitas_dia` | 3 | Capacidad por especialista/día. |
| `max_visitas_semana` | 8 | Capacidad por especialista/semana. |
| `max_viajes_foraneos_mes` | 3 | Viajes foráneos por especialista/mes. |
| `radio_clustering_km` | 50 | Cercanía para sugerencias/zonas. |
| `min_hospitales_por_zona` | 4 | Aviso de zona pequeña. |
| `min_hospitales_especialista_semana` | 4 | Cuota documentada por especialista. |
| `min_talleres_especialista_semana` | 6 | Cuota documentada por especialista. |
| `meta_talleres_mes_imss` | 64 | Meta mensual configurable. |
| `meta_talleres_mes_bienestar` | 64 | Meta mensual configurable. |
| `meta_talleres_mes_descentralizado` | 64 | Meta mensual configurable. |
| `min_visitas_ejecutivo_semana` | NULL | Regla nueva “mínimo 8” si se define semanal. |
| `min_visitas_ejecutivo_mes` | NULL | Regla nueva si se define mensual. |
| `producto_cantidad_default` | 2 | Default del recurso Producto. |
| `alcance_hospital_extraordinario` | `SELECCION` | `EJECUTIVO`/`GERENCIA`/`SELECCION`/`CATALOGO` (ADR-00017). |
| `matriz_requiere_autorizacion` | `true` | Si la matriz se autoriza (ADR-00018). |
| `bloqueo_taller_automatico` | `true` | Si el taller se bloquea al autorizar la matriz. |
| `dias_limite_cambio` | 45 | Ajustes/solicitudes (ADR-00010/00018). |

> El “mínimo 8” no está en los instructivos; queda como parámetro configurable y no como regla dura hasta que el área defina si es semanal o mensual y si aplica al ejecutivo o al especialista.

## Validación contra la operación documentada

| Regla | Fuente documental (cita literal) | Cómo se implementa |
|---|---|---|
| Agrupar por zonas y mínimo 4 hospitales por viaje foráneo | `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — *“Agrupa hospitales por zonas geográficas para que, en un mismo viaje foráneo, el ejecutivo de ventas visite varios hospitales y programe mínimo 4 hospitales para taller médico.”* | `min_hospitales_por_zona`; sugerencia por ciudad/bloques; aviso, no bloqueo. |
| Meta mensual IMSS y Descentralizados | Ídem — *“Se deben programar al menos 64 talleres en el mes en IMSS y la misma cantidad en Descentralizados.”* | Metas por gerencia en parámetros; tercera gerencia con su propia meta. |
| Cuota por especialista | Ídem — *“La cuota de talleres por especialista de producto es de al menos 4 hospitales y 6 talleres por semana.”* | `min_hospitales_especialista_semana` y `min_talleres_especialista_semana`; aviso. |
| Viajes foráneos | Ídem — *“En el mes se pueden programar hasta 3 viajes foráneos por especialista por mes.”* | `max_viajes_foraneos_mes`; aviso/bloqueo configurable. |
| Días laborables | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — *“Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres).”* | Calendario Lun–Vie; sábado/domingo no se usan para talleres. |
| Fecha y hora del taller | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — *“Fecha de taller: Escribir la fecha en la cual está programado el taller médico…”* · *“Hora: Escribir la hora en la cual se va a realizar el taller médico”* | La visita/taller conserva fecha y hora; la ruta las propone y el humano las confirma. |
| Ejecutivo y especialista en la matriz | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos *“Nombre del ejecutivo”* y la columna Ejecutivo/Especialista del formato | La matriz conserva ambos roles por fila. |

**Reglas de digitalización sin fuente en el papel** (marcadas como interpretación/operación real):

- La ruta por especialista y la sugerencia por ciudad/día son decisiones de digitalización; el papel no describe un algoritmo de rutas.
- La capacidad 3/día y 8/semana es una regla interna configurable (`reglas-negocio.md` §5.2), no una cita de instructivo.
- La elegibilidad `especialista_gerencia` y la región `ejecutivo_region` son modelo propio; Asokam no tiene esa información confiable.
- El “mínimo 8” por ejecutivo es una regla nueva del usuario (2026-10-23), pendiente de definir si es semanal/mensual.

## Consequences

**Positivas**

- El especialista deja de estar amarrado a un ejecutivo/equipo; puede cubrir varias gerencias y ejecutivos en un mismo viaje.
- El sistema replica y mejora el Excel: propone hospitales cercanos a un especialista que ya estará en la ciudad, en lugar de que el planificador los busque a mano.
- La selección conserva un dueño claro (ejecutivo) y la matriz conserva su autorización; la ruta no añade otra cadena de firmas.
- La capacidad y las cuotas se vuelven parámetros, no constantes de código.
- La matriz individual por ejecutivo y la general por gerencia siguen siendo comprensibles para el área.

**Negativas**

- Es un cambio rompiente de esquema, servicios y UI; requiere migración y ventana de despliegue.
- El algoritmo de asignación es más complejo que el reparto por equipo: debe resolver elegibilidad, capacidad, cercanía y balanceo.
- `equipos_pareo` queda como legado; hay que evitar que nuevas consultas lo usen.
- La ruta sin workflow puede generar dudas de “¿quién autorizó esto?”; la respuesta es la selección (universo) y la matriz (talleres/costos), no la ruta.
- La tercera gerencia (ADR-00017) agrega datos y variantes de workflow.

**Neutras / seguimiento**

- **Decisión 2026-10-23 (override por hospital y visita):** `selecciones_mensuales_hospitales.id_ejecutivo` y `rutas_visitas.id_ejecutivo` se validan contra `ejecutivo_region`/`ejecutivo_suplente`: deben estar activos para la misma región de catálogo y gerencia de la selección. La precedencia es `RutaVisita.IdEjecutivo` → `SeleccionHospital.IdEjecutivo` → `SeleccionRegion.IdEjecutivo`. Al recalcular regiones se limpian los overrides que dejan de ser elegibles. Endpoints: `PUT /selecciones-mensuales/{id}/hospitales/{idSeleccionHospital}/ejecutivo` y `PUT /rutas/{idRuta}/visitas/{idRutaVisita}/ejecutivo` (este último exige motivo y audita si la ruta está Cerrada).
- **Decisión 2026-10-23 (sin vigencia):** `ejecutivo_region` usa solo `activo`; las fechas `fecha_inicio`/`fecha_fin` se retiran con el script 0038. El histórico operativo queda en selecciones/rutas/talleres y en la auditoría.
- **Decisión 2026-10-23 (suplentes):** `ejecutivo_suplente` cubre regiones/gerencias sin primario. Sirve para cerrar la selección, sugerir y operar, pero el motor siempre prioriza un `ejecutivo_region` activo. Se administra desde Personas.
- La tabla `equipos_pareo` se conserva para histórico; la limpieza destructiva queda como follow-up.
- `RutaVersion` se conserva como contenedor de versiones; sus columnas de workflow quedan legacy.
- El “mínimo 8” se parametriza; el área debe definir su valor y periodicidad.
- Los datos de dev se limpian con `0037`; no se migran equipos. La clasificación de gerencias se hace desde la pantalla Hospitales.

## Anexo — Fuentes

**Documentales (referencias del módulo):**

- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — reglas de zonas, mínimo 4 hospitales, 64+64, cuota por especialista, 3 viajes foráneos, día 15.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md` — columnas Región, Hospital, Estado, Ciudad/Municipio, Ejecutivo, Producto, Observaciones.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos de fecha, hora, ejecutivo, participantes, producto y cantidades.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — agenda mensual, días laborables.
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — reagenda (nodo P2F) y fases del proceso.

**Evidencia operativa (no son fuentes documentales formales):**

- `MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx` — calendario real por especialista, celdas `EJECUTIVO/Hospital + hora`, visitas agrupadas por ciudad.
- `PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF` — matriz de sesiones con ejecutivo/especialista, producto, cantidades y costos.

**Planificación interna (no son fuentes documentales):**

- `reglas-negocio.md` §5.2–5.5, §5.10, §5.11, §5.13 y §7.
- ADR-00004 (zonas, capacidad, draft→select), ADR-00006 (workflow selección/matriz), ADR-00007 (matriz), ADR-00008 (impartición), ADR-00010 (ajustes/solicitudes), ADR-00011 (extraordinarios), ADR-00013 (planeación personal), ADR-00014 (viáticos por ruta).
- Código actual: `EquipoPareo.cs`, `SeleccionRegion.cs`, `Ruta.cs`, `RutaVisita.cs`, `MatrizIndividual.cs`, `RutasService.cs`, `TalleresService.cs`, `SeleccionMensualService.cs`.
