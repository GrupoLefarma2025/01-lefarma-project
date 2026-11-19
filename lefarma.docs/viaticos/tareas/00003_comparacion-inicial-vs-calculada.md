# Tarea — Comparación inicial vs calculada y acciones del revisor

> **Estado:** Implementado (2026-11-19). Frontend y pruebas en verde; backend sin cambios.
>
> **Decisión:** [[decisiones/00003_comparacion-inicial-vs-calculada]]
>
> **Alcance:** sin permisos nuevos, sin cambios de esquema y sin endpoints nuevos.

## Objetivo

Que la revisión de una solicitud en `/viaticos/autorizaciones` empiece por lo que el revisor necesita decidir: el viaje que pidió el solicitante contra la ruta calculada, lado a lado, con dos acciones grandes para ajustarla antes de autorizar.

La ruta que ya se autorizaba directamente pasa a ser una más de las pestañas del detalle; la comparación es la primera.

## Fase 1 — Comparación

- [x] **1.1** `VistaDetalle` acepta `pestanaInicial: 'comparar' | 'calculada' | 'inicial' | 'autorizada'` y en modo revisión arranca en `'comparar'`.
  - [x] La pestaña «Inicial vs calculada» solo existe en modo revisión.
  - [x] «Ruta autorizada» sigue abriéndose cuando se pide explícitamente y hay versión autorizada; si no, cae a «Ruta calculada».
- [x] **1.2** Contenido de la comparación en dos columnas: izquierda `ResumenViaje` con el viaje inicial; derecha la ruta calculada o propuesta con timeline, opciones elegidas y casetas.
  - [x] Badge «Propuesta en revisión» solo cuando la ruta viene del revisor y todavía no se autorizó.
  - [x] `ComparadorRutas` cuando hay opciones originales con las que comparar.
  - [x] Mapa de la columna derecha con el título «Ruta propuesta» o «Ruta calculada».
- [x] **1.3** `RevisarSolicitudDialog` abre con `pestanaInicial="comparar"`.
- [x] **1.4** Se retira el botón pequeño «Recalcular ruta» de la pestaña «Ruta autorizada».

## Fase 2 — Acciones del revisor

- [x] **2.1** Barra de acciones grandes en el diálogo de revisión: **Recalcular viaje** y **Editar costos**.
- [x] **2.2** «Recalcular viaje» abre `CalculosViajeModal` con `modo="autorizar"`; la propuesta se guarda en memoria y no se escribe en el servidor.
- [x] **2.3** Nuevo `EditarCostosDialog`: edita el precio de cada opción elegida, permite vaciar un precio estimado, bloquea precios inválidos o de proveedor vacíos y devuelve una `PropuestaRuta` con costos de tramo, costos de parada y desglose recalculados.
- [x] **2.4** «Editar costos» queda deshabilitado cuando la solicitud no tiene cálculo.
- [x] **2.5** La propuesta se descarta al cerrar el diálogo o cambiar de solicitud.

## Fase 3 — Autorizar con propuesta

- [x] **3.1** Con propuesta, el botón dice «Autorizar ruta propuesta» y la descripción del diálogo lo avisa.
- [x] **3.2** Autorizar con propuesta envía `{ calculo, opciones }` al endpoint existente; sin propuesta se conserva la llamada anterior.
- [x] **3.3** Sin cambios de backend: el controlador ya guardaba `opciones_originales`, `calculo_autorizado` y validaba las opciones con `SolicitudOpcionesParser`.

## Fase 4 — Pruebas y documentación

- [x] **4.1** `MisViajesPage.test.tsx`: la revisión arranca en la comparación, muestra ambos lados y mantiene «Ruta autorizada» cuando se pide.
- [x] **4.2** `EditarCostosDialog.test.tsx` (4 pruebas): precios iniciales, edición de una opción, bloqueo con precio inválido y precio estimado vacío.
- [x] **4.3** `RevisarSolicitudDialog.test.tsx` (4 pruebas): autorizar sin propuesta, propuesta por recálculo, propuesta por edición de costos y acción deshabilitada sin cálculo.
- [x] **4.4** Suites afectadas en verde: 42 pruebas en 5 archivos.
- [x] **4.5** `npx tsc --noEmit` limpio y `npx eslint` sin errores en los archivos tocados.
- [x] **4.6** ADR [[decisiones/00003_comparacion-inicial-vs-calculada]] y esta tarea.

## Fuera de alcance (mencionado, no ejecutado)

- Guardar la propuesta como borrador en el servidor antes de autorizar: hoy vive solo en memoria del diálogo.
- Auditar los cambios de precio como un ajuste formal: `EditorAjustes` (permiso `viaticos.ajustar`, estados ajustables) sigue siendo el flujo de ajuste posterior a la autorización.
- Corregir el desfase preexistente de `nodosDesdeCalculo` al buscar la opción del tramo (usa el número 1-based del título contra `datos.tramo`, que se guarda 0-based); los costos guardados en el cálculo lo tapan hoy.
