---
fecha_creacion: 2026-11-19 17:05
fecha_modificacion: 2026-11-19 17:05
resumen: La revisión de Autorizaciones abre comparando el viaje inicial con la ruta calculada y permite recalcular el viaje o editar costos antes de autorizar.
---

# 00003 — Comparación inicial vs calculada y acciones del revisor

## Status

Accepted

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
- [[#Fase 1 — Comparación como primera vista|Fase 1 — Comparación]]
- [[#Fase 2 — Acciones del revisor|Fase 2 — Acciones del revisor]]
- [[#Fase 3 — Autorizar con propuesta|Fase 3 — Autorizar con propuesta]]
- [[#Fase 4 — Pruebas y documentación|Fase 4 — Pruebas]]
- [[#Consequences|Consequences]]
- [[#Anexo — Archivos implicados|Anexo — Archivos implicados]]

## Decisión

El diálogo de revisión de `/viaticos/autorizaciones` deja de abrir en «Ruta autorizada» y arranca en una pestaña nueva, **«Inicial vs calculada»**, que muestra lado a lado lo que pidió el solicitante y la ruta que se va a autorizar. Encima del detalle se ofrecen las dos acciones del revisor, grandes y explícitas: **Recalcular viaje** y **Editar costos**.

1. **La comparación es la primera vista.** El viajero ya pasó por el asistente de cálculos en Mis viajes; el revisor no debe repetir ese recorrido ni empezar mirando una ruta que todavía no autoriza. Las pestañas quedan en este orden: «Inicial vs calculada» (solo en modo revisión), «Ruta calculada», «Viaje inicial» y «Ruta autorizada».
2. **Dos columnas con el mismo lenguaje visual.** A la izquierda, `ResumenViaje` con la ruta del viaje y las fechas que capturó el solicitante. A la derecha, la ruta calculada o la propuesta del revisor (timeline, opciones elegidas y casetas) más el `ComparadorRutas` cuando hay algo con qué comparar. El badge «Propuesta en revisión» distingue una propuesta en memoria de una ruta ya autorizada.
3. **Recalcular viaje reutiliza el asistente existente.** `CalculosViajeModal` ya tenía un modo `autorizar` que entregaba la propuesta al padre sin escribir en el servidor; estaba implementado pero ninguna pantalla lo usaba. Ahora el diálogo lo abre y guarda el resultado en memoria.
4. **Editar costos nace como diálogo propio.** No existía una forma de ajustar precios antes de autorizar. `EditarCostosDialog` edita el precio de cada opción elegida (el precio estimado puede quedar vacío), recalcula el costo de cada tramo y de cada parada de `ruta`, y devuelve una `PropuestaRuta` con su `resumenCostosRuta`. No escribe en el servidor.
5. **La propuesta vive en memoria y se aplica al autorizar.** Autorizar con propuesta envía `POST /api/viaticos/solicitudes/{id}/autorizar` con `{ calculo, opciones }`; el backend ya aceptaba ese contrato: guarda las opciones vigentes en `datos.opciones_originales` (solo la primera vez), reemplaza las opciones por las propuestas, escribe `calculo_autorizado` y deja el estado en `autorizada`. Sin propuesta, la llamada sigue siendo la de antes y autoriza la ruta existente.
6. **Se retira el botón pequeño «Recalcular ruta»** que vivía dentro de la pestaña «Ruta autorizada»: era la única acción de revisor y quedaba escondida. La acción grande de la barra la sustituye.

**Por qué:** el revisor decidía a ciegas sobre una ruta ya autorizada, sin ver lo que el viajero había pedido y sin poder corregir una ruta o un precio sin devolver la solicitud. Eso mezclaba tres momentos —comparar, ajustar, decidir— en una sola pantalla y obligaba a rechazar para corregir. Separarlos permite autorizar con la ruta correcta y deja el viaje original disponible para comparar después, porque una autorización con propuesta conserva `opciones_originales`.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **1** | Comparación como primera vista | Pestaña nueva por defecto en modo revisión | Pruebas de `VistaDetalle` en revisión y de la pestaña activa |
| **2** | Acciones del revisor | Recalcular (asistente en modo autorizar) y editar costos | Pruebas del diálogo de costos y del cableado en el diálogo de revisión |
| **3** | Autorizar con propuesta | Envío de `{ calculo, opciones }` al autorizar | Pruebas del diálogo revisando el payload |
| **4** | Pruebas y documentación | Suites, `tsc`, `eslint`, este ADR y su tarea | Suites de viáticos en verde |

---

## Fase 1 — Comparación

> Tarea: [[tareas/00003_comparacion-inicial-vs-calculada#Fase 1 — Comparación]]

- `VistaDetalle` recibe `pestanaInicial` con un valor nuevo, `'comparar'`, y en modo revisión lo usa por defecto aunque no se pase. «Autorizada» sigue abriéndose cuando se pide explícitamente y existe una versión autorizada.
- La pestaña izquierda se identifica con «Lo que pidió el solicitante»; la derecha, con «La ruta que vas a autorizar» o «Cómo se calculó el viaje» cuando todavía no hay propuesta. Ambas comparten el mismo ancho (`lg:grid-cols-2` con divisor vertical) para que la comparación sea de un vistazo.
- El mapa de la columna derecha abre con el título «Ruta propuesta» o «Ruta calculada» según el caso.
- `RevisarSolicitudDialog` pasa `pestanaInicial="comparar"`: la comparación es lo primero que ve quien autoriza.

## Fase 2 — Acciones del revisor

> Tarea: [[tareas/00003_comparacion-inicial-vs-calculada#Fase 2 — Acciones del revisor]]

- La barra de acciones del diálogo tiene dos botones de tamaño grande: **Recalcular viaje** (icono de recarga) y **Editar costos** (icono de cartera). El segundo queda deshabilitado cuando la solicitud no tiene cálculo con el que trabajar.
- **Recalcular viaje** abre `CalculosViajeModal` en `modo="autorizar"`. El asistente recalcula por tramos con el mismo motor de costos del viajero y, al terminar, entrega `{ calculo, opciones, resumen }` sin tocar el servidor. Al volver, el detalle muestra ese cálculo como propuesta.
- **Editar costos** abre `EditarCostosDialog` con las opciones elegidas. Cada precio se puede corregir; el precio estimado se puede dejar vacío, pero un precio de proveedor vacío o negativo bloquea el guardado con un aviso. Al confirmar se recalculan los costos de la ruta y el desglose, y el resultado también es una propuesta en memoria.
- La propuesta se pierde si se cierra el diálogo o se cambia de solicitud: no hay borrador en el servidor, porque solo se persiste al autorizar.

## Fase 3 — Autorizar con propuesta

> Tarea: [[tareas/00003_comparacion-inicial-vs-calculada#Fase 3 — Autorizar con propuesta]]

- Con propuesta, el botón cambia a «Autorizar ruta propuesta» y la descripción avisa que se va a autorizar la ruta propuesta.
- El envío usa el contrato existente `AutorizarSolicitudRequest { calculo, opciones }`; no hay endpoint ni permiso nuevos.
- El backend conserva las opciones que tenía la solicitud en `datos.opciones_originales` antes de reemplazarlas, y guarda `calculo_autorizado`. Eso es lo que alimenta el comparador y la pestaña «Ruta autorizada» después de autorizar.
- Sin propuesta, la autorización sigue siendo `autorizar(id)` y el servidor aplica la ruta que el viajero ya había calculado.

## Fase 4 — Pruebas y documentación

> Tarea: [[tareas/00003_comparacion-inicial-vs-calculada#Fase 4 — Pruebas y documentación]]

- `MisViajesPage.test.tsx`: la revisión arranca en la comparación, muestra ambos lados, no pinta el badge de propuesta sin propuesta, y mantiene la pestaña «Ruta autorizada» cuando se pide explícitamente.
- `EditarCostosDialog.test.tsx`: precios iniciales, edición de una opción, bloqueo con precio inválido y permiso de dejar vacío un estimado.
- `RevisarSolicitudDialog.test.tsx`: autorizar sin propuesta, recalcular → propuesta → autorizar con payload, editar costos → propuesta → autorizar con payload, y «Editar costos» deshabilitado sin cálculo.
- `tsc --noEmit` y `eslint` limpios en los archivos tocados.

## Consequences

**Positivas**

- El revisor ve primero lo que pidió el solicitante contra lo que va a autorizar, que es la decisión real que toma.
- Corregir una ruta o un precio deja de exigir rechazar la solicitud; se ajusta y se autoriza en el mismo diálogo.
- El viaje original no se pierde: queda en `opciones_originales` y el comparador muestra qué cambió.
- No hay endpoints, permisos ni tablas nuevas: se reutiliza el contrato de autorizar que ya existía.

**Negativas**

- La propuesta solo vive en memoria; si el revisor cierra el diálogo antes de autorizar, se pierde y debe recalcular o editar otra vez.
- Editar precios permite autorizar un monto distinto al que cotizó el proveedor; la evidencia (capturas) se conserva por opción, pero el cambio no queda auditado como un ajuste formal.
- `VistaDetalle` sigue creciendo: ahora conoce una vista más y depende del diálogo de costos para completar la comparación.

**Neutras**

- El botón pequeño «Recalcular ruta» desaparece de la pestaña «Ruta autorizada».
- El orden de pestañas cambia solo en modo revisión; Mis viajes y el concentrado conservan el suyo.
- `opcionesDePropuesta` sale de `MisViajesPage` a `viajes.helpers.ts` para no exportar funciones desde un archivo de componentes.

## Anexo — Archivos implicados

**Frontend**

- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/MisViajesPage.tsx` — pestaña de comparación, `pestanaInicial: 'comparar'`, mapa de la ruta propuesta, sin el botón pequeño de recalcular.
- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/viajes.helpers.ts` — `opcionesDePropuesta`.
- `lefarma.frontend/src/apps/viaticos/components/EditarCostosDialog.tsx` — diálogo nuevo de edición de costos.
- `lefarma.frontend/src/apps/viaticos/pages/autorizaciones/RevisarSolicitudDialog.tsx` — comparación por defecto, acciones grandes, propuesta en memoria y payload de autorizar.

**Pruebas**

- `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/MisViajesPage.test.tsx`
- `lefarma.frontend/src/apps/viaticos/components/EditarCostosDialog.test.tsx`
- `lefarma.frontend/src/apps/viaticos/pages/autorizaciones/RevisarSolicitudDialog.test.tsx`

**Backend**

- Sin cambios. Se apoya en `lefarma.backend/src/Lefarma.API/Features/Viaticos/AprobacionesController.cs` (`POST solicitudes/{id}/autorizar` con `calculo` y `opciones`) y en `SolicitudOpcionesParser`.
