---
fecha_creacion: 2026-10-22 12:00
fecha_modificacion: 2026-10-22 14:30
resumen: Varias cotizaciones de viáticos por ruta - la unidad es ruta + conjunto de visitas. Agrega la tabla liga viaticos.solicitud_origen_em_visita (una fila por visita cotizada), endpoint de creación/reutilización con bloqueo de visitas ya cotizadas, endpoint de cotizaciones por ruta y persistencia del total al guardar la cotización. Muestra en Mi planeación todas las cotizaciones de la ruta con folio, estado y costo, y marca por hospital en qué cotización está. No aplica cambios a la BD: los scripts quedan para revisión.
---

# 00014 - Cotizaciones de viáticos por ruta (tabla liga por visita)

## Status

Proposed

> Implementación en código completada: tabla liga, endpoints, bloqueo/dedupe, panel y columna de EM, y persistencia del total. Los scripts `0012`/`0013` **no se aplicaron**. El ADR sigue `Proposed` hasta la revisión del usuario.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Contexto y hallazgos|Contexto y hallazgos]]
- [[#Modelo de datos|Modelo de datos]]
- [[#Reglas de creación, bloqueo y deduplicación|Reglas de creación, bloqueo y deduplicación]]
- [[#UX en Mi planeación|UX en Mi planeación]]
- [[#Costo de la cotización|Costo de la cotización]]
- [[#Fases|Fases]]
- [[#Consequences|Consequences]]
- [[#Anexo - fuentes|Anexo - fuentes]]

## Decisión

1. **Una ruta puede tener N cotizaciones.** La unidad real es **ruta + conjunto de visitas seleccionadas**; el usuario puede cotizar 10 hospitales y después otros 10 de la misma ruta.
2. La relación se guarda en una **tabla liga en el esquema `viaticos`**, una fila por visita cotizada:
   `viaticos.solicitud_origen_em_visita (id_solicitud, id_ruta, id_ruta_visita, id_seleccion_mensual, fecha_creacion)`.
   - `id_solicitud` es FK física a `viaticos.solicitudes`.
   - `id_ruta`/`id_ruta_visita` son **referencias lógicas** a `educacion_medica` (sin FK física, para no acoplar el despliegue de los dos módulos).
   - No se agregan columnas `id_cotizacion` a rutas ni a visitas: una visita puede estar en una cotización y la ruta en varias.
3. **Bloqueo de visitas**: una visita que ya está en una cotización **activa** (borrador, enviada, autorizada o autorizada con ajustes) no se puede volver a cotizar. El backend lo valida y la UI la muestra deshabilitada con el folio que la contiene.
4. **Deduplicación**: se reutiliza un `borrador` solo si la ruta y el **conjunto exacto de visitas** coinciden; si el conjunto es distinto, se crea una cotización nueva. El chequeo y la creación son atómicos en el backend.
5. **Consulta por ruta**: `GET /api/viaticos/solicitudes/por-ruta/{idRuta}` devuelve **todas** las cotizaciones de la ruta con folio, estado, costo, número de destinos, fecha y las visitas que cubre.
6. **Costo**: al guardar/enviar la cotización desde Mis viajes se persisten las opciones elegidas y el **total cotizado** (suma de opciones con precio); la consulta por ruta lo expone. Un borrador sin cotización guardada muestra "Sin cotización" (total nulo).
7. **No se modifica la BD en esta entrega**: los scripts SQL quedan para revisión y aplicación posterior por el usuario.

## Contexto y hallazgos

- La ruta **9** (`Ruta Equipo 4 · v1`) tiene hoy dos borradores en `viaticos.solicitudes` (14 y 15) con las mismas 18 visitas. El 14 es legado y **no tiene `origenEm`**; el 15 sí (`idRuta: 9`, `idRutaVisitas: [60..77]`). La deduplicación anterior, basada en `datos_json.origenEm.idRuta`, no podía reconocer al 14 y por eso se duplicó.
- Ambos borradores tienen **0 filas en `viaticos.solicitud_opciones`**: los borradores no se cotizaron. El cotizador existente vive en Mis viajes (`CalculosViajeModal`/`ImportarCotizacion`) y ahora envía el total; el asistente de la solicitud solo guarda el borrador.
- El modelo anterior usaba `sistema_origen = 'educacion_medica'` + `datos_json.origenEm` (relación lógica). No había relación por visita ni una forma consultable de "qué cotizaciones cubren esta visita".
- La regla de bloqueo y la tabla liga permiten resolver los tres problemas: duplicados, múltiples cotizaciones por ruta y visibilidad de folio/costo por hospital.

## Modelo de datos

### Tabla liga (esquema `viaticos`)

```
viaticos.solicitud_origen_em_visita
  id_solicitud          INT NOT NULL   -- FK -> viaticos.solicitudes
  id_ruta               INT NOT NULL   -- referencia lógica a educacion_medica.rutas
  id_ruta_visita        INT NOT NULL   -- referencia lógica a educacion_medica.rutas_visitas
  id_seleccion_mensual  INT NULL       -- contexto de la ruta
  fecha_creacion        DATETIME2(7) NOT NULL DEFAULT sysutcdatetime()
  PK (id_solicitud, id_ruta_visita)
  FK id_solicitud -> viaticos.solicitudes (ON DELETE CASCADE)
```

- Una cotización con 10 visitas inserta 10 filas; otra con otras 10 inserta 10 más.
- Índice `IX_solicitud_origen_em_visita_ruta (id_ruta, id_ruta_visita) INCLUDE (id_solicitud, id_seleccion_mensual)` para consultar por ruta/visita.
- Índice `IX_solicitud_origen_em_visita_solicitud (id_solicitud) INCLUDE (id_ruta, id_ruta_visita)`.
- **Sin FK física a `educacion_medica`**: la relación es lógica, igual que las referencias a Asokam; así el módulo de Viáticos no depende del orden de despliegue de Educación Médica.
- **No se agregan columnas** `id_ruta_em`/`id_cotizacion` a las tablas de Educación Médica. La ruta obtiene sus cotizaciones por la liga.

### Estados de una cotización (para el bloqueo)

- **Activa** (bloquea visitas): `borrador`, `enviada`, `autorizada`, `autorizada_con_ajustes`.
- **No activa** (no bloquea): `rechazada`, `cancelada` (si existe en el catálogo de estados de Viáticos).
- La lista exacta se centraliza en el backend; el frontend consume el estado.

## Reglas de creación, bloqueo y deduplicación

1. **Crear o reutilizar** (`POST /api/viaticos/solicitudes/desde-educacion-medica`):
   - Payload: `{ id_ruta, id_seleccion_mensual, id_ruta_visitas: number[], datos: { …solicitud-v2… } }`.
   - Requiere `viaticos.solicitar`.
   - Valida que las visitas pertenezcan a la ruta (referencias lógicas) y que el conjunto no esté vacío.
   - Busca un **borrador** de la misma ruta cuyo conjunto de visitas (liga) sea **exactamente igual** al solicitado:
     - si existe, lo devuelve (`reutilizado: true`);
     - si no, revisa si alguna visita está en una **cotización activa**:
       - si está, responde **409** con `{ visitas: [{ id_ruta_visita, id_solicitud, folio, estado }] }`;
       - si no, crea la solicitud + las filas de liga en **una transacción** y devuelve `{ id_solicitud, folio, reutilizado: false }`.
   - La creación reutiliza la lógica actual de `POST /solicitudes` (folio, personas, numeración) para no duplicar reglas.
2. **No duplicar por doble clic**: el endpoint es idempotente para el mismo conjunto en `borrador`; el frontend además deshabilita el botón mientras crea.
3. **Visitas bloqueadas**: el bloqueo se evalúa contra cotizaciones activas; si un borrador se cancela/elimina, la visita se libera.
4. **Concurrencia**: el chequeo de bloqueo + inserción se hace en una transacción `Serializable` en SQL Server; un índice único no es suficiente porque el estado vive en la tabla padre. En EF InMemory (pruebas) se omite la transacción.
5. **Borradores legados** (sin filas de liga) no participan en dedupe ni bloqueo. No se modifican ni se eliminan automáticamente; el usuario puede gestionarlos con los scripts 0013 o desde Viáticos.

## UX en Mi planeación

### Panel de cotizaciones de la ruta

En la vista **Rutas**, al seleccionar una ruta, mostrar un panel **"Cotizaciones de la ruta"** con **todas** las cotizaciones:

| Folio | Estado | Destinos | Costo | Acción |
|---|---|---|---|---|
| VIA-21-0015 | Borrador | 10 | Sin cotización | Abrir borrador |
| VIA-21-0021 | Enviada | 10 | $12,345.00 | Ver en Mis viajes |

- Orden: más reciente primero.
- Si no hay: "Por cotizar" en la métrica; el botón "Cotizar viáticos" sigue disponible.
- Borrador → abre `/viaticos/solicitud/:id`; enviada/autorizada → `/viaticos/mis-viajes` (lectura).
- La métrica del encabezado muestra el conteo de cotizaciones.

### Por hospital (tabla de la ruta)

- Agregar una columna **"Cotización"** (o un badge junto al nombre del hospital):
  - Si la visita pertenece a una cotización: `VIA-21-0015 · Borrador` (badge con color del estado).
  - Si pertenece a varias: la más reciente + `+N` con `title` que liste todas.
  - Si no: `—` (texto atenuado).
- Al hacer clic en el folio, abrir la cotización (borrador) o Mis viajes (enviada/autorizada).

### Modal de cotización

- Los hospitales que ya están en una cotización **activa** se muestran con checkbox deshabilitado y badge `En VIA-… (Estado)`.
- El check del día y el "Seleccionar todos" solo abarcan visitas **disponibles**.
- Se muestra un aviso con el número de visitas bloqueadas; las filas muestran el folio que las contiene.
- Las visitas sin coordenadas siguen deshabilitadas con su aviso y "Copiar lista".

## Costo de la cotización

- La cotización se guarda desde Mis viajes (`CalculosViajeModal`/`ImportarCotizacion`), que ya llamaba `PUT /api/viaticos/solicitudes/{id}/opciones`:
  - `solicitudesApi.guardarOpciones` construye las opciones vuelo/hotel y calcula el **total cotizado** como la suma de las opciones con precio.
  - El total viaja en `cotizacion.total`; el backend lo persiste en `datos_json.total` sin perder el snapshot y transiciona a `enviada`.
  - Si todas las opciones son estimadas (precio null), no se envía total y el panel muestra "Sin cotización".
- Comidas, extras y otros gastos del viaje permanecen en el snapshot (`datos.gastos`) y no se suman al total de la cotización. Si se requiere el total de viaje completo, es un incremento posterior.
- El endpoint `por-ruta` devuelve `total` (o `null` si el borrador aún no tiene cotización).
- En Mi planeación:
  - Borrador sin cotización → "Sin cotización" (no $0).
  - Cotización guardada → total formateado.
- El asistente de la solicitud (`SolicitudPage`) sigue guardando el borrador; no se duplica el cotizador en dos pantallas.

## Fases

### Fase 0 - Plan y revisión (esta entrega)

Decisiones del usuario: bloquear visitas ya cotizadas, tabla liga, mostrar todas las cotizaciones, dejar el borrador legado intacto y no tocar la BD (scripts para revisión), incluir el costo en esta fase.

### Fase 1 - Scripts SQL (revisión, sin aplicar)

- `lefarma.database/viaticos/0012_20261022-1200_viaticos_solicitud-origen-em-visita.lefarma.sql`: tabla liga, índices y extended properties; idempotente; **sin backfill ni borrados**.
- `lefarma.database/viaticos/0013_20261022-1400_viaticos_eliminar-cotizacion-duplicada.lefarma.sql`: soft delete del borrador legado 14, con guards; **no se aplica solo**.
- Validar sintaxis (PARSEONLY) sin ejecutar; el usuario los aplica cuando los apruebe.

### Fase 2 - Backend Viáticos

- Entidad `SolicitudOrigenEmVisita` + configuración EF + DbSet.
- `POST /api/viaticos/solicitudes/desde-educacion-medica` (crear/reutilizar, bloquear visitas, insertar liga en transacción).
- `GET /api/viaticos/solicitudes/por-ruta/{idRuta}` (todas las cotizaciones + visitas + total; dueño o `ver_todos`).
- `PUT /opciones`: persistir opciones y `datos_json.total`; transición a `enviada`.
- Pruebas: dedupe exacto, bloqueo, múltiples cotizaciones, total.

### Fase 3 - Frontend Viáticos

- `guardarOpciones` calcula y envía el total cotizado desde Mis viajes (`CalculosViajeModal`/`ImportarCotizacion`).
- Verificar que el estado pasa a `enviada`, que las opciones quedan en `solicitud_opciones` y el total en `datos_json.total`.
- El asistente de la solicitud solo guarda el borrador; no se duplica el cotizador.

### Fase 4 - Frontend Educación Médica

- Servicio de handoff al nuevo endpoint (elimina la dedupe por `misSolicitudes`).
- Panel "Cotizaciones de la ruta" con todas; columna/badge "Cotización" por hospital.
- Modal: bloqueo de visitas activas, avisos y checks solo de disponibles.
- Enlaces a borrador (wizard) o Mis viajes (enviada/autorizada).

### Fase 5 - Verificación y cierre

- E2E: ruta → 10 hospitales → cotización 1 → otros 10 → cotización 2; una visita bloqueada; folio/costo visibles; reintento no duplica.
- Actualizar ADR-00013/tarea 00013 con la extensión y marcar este ADR.

## Consequences

**Positivas**
- Modela correctamente varias cotizaciones por ruta (subconjuntos distintos).
- Elimina duplicados y permite reutilizar el borrador exacto.
- Trazabilidad por visita: se sabe qué cotización cubre cada hospital.
- Folio, estado y costo visibles en Mi planeación.
- La liga en `viaticos` mantiene el módulo de Viáticos autocontenido; Educación Médica no cambia su esquema.

**Negativas**
- Requiere script SQL, backend, cambios en Mis viajes y UI de EM.
- Los borradores legados sin liga no aparecen en el panel ni bloquean visitas (no se tocan automáticamente).
- El costo mostrado es el de la cotización (opciones), no el total de viaje con comidas/extras.
- El bloqueo de visitas activas requiere validación en servicio (no un índice único simple).

**Neutras**
- No se agregan columnas a rutas/visitas; la relación vive en la liga.
- El borrador legado 14 se deja intacto hasta que el usuario ejecute 0013.
- La cotización sigue siendo un documento de Viáticos con su ciclo de vida; la ruta es el insumo.

## Anexo - fuentes

- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` - §4.3: *"Viáticos: Son los recursos monetarios asignados a los trabajadores para el desempeño de sus actividades, cuando deban trasladarse a un lugar distinto al de su adscripción; dichos recursos cubren gastos de transporte, hospedaje, alimentación y alquiler de autos."*
- `referencias/pdf-to-md/Instructivos/Elaborar Plan de Trabajo.md` - campos del formato de viáticos: *"Transporte Tipo | Transporte Importe | Alimentos Tipo | Alimentos Importe | Hospedaje | Gasolina | Casetas | Taxis | Avion"*.
- La relación ruta↔cotización es una decisión técnica interna; no reemplaza un formulario del proceso.
