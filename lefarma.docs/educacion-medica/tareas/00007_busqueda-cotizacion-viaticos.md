# Tareas — 00007 Búsqueda y cotización de viáticos (capa de evidencia)

> Vinculada a: [[decisiones/00007_busqueda-cotizacion-viaticos]]
> **Extiende** a [[decisiones/00003_estimador-viaticos-catalogo]]; **no lo reemplaza**. El ADR-0003 se marca `Superseded by ADR-00007` solo en su línea de Status (el resto de su cuerpo queda intacto como registro histórico).
> Misma división por fases que la decisión: B1 Frontend/tipos, B2 Backend/cotización, B3 Evidencia/capturas, B4 UI estimado-vs-cotizado, B5 Invariante de no-escritura.
>
> **Estado de los checkboxes:** solo se marcan `[x]` lo verificado por quien escribió este documento (el fixture R) o lo que tiene evidencia directa en el repo (B1.1, B2.1). El resto queda `[ ]` **pendiente de confirmar con quien implementó** cada fase: no se afirmó trabajo hecho sin haberlo verificado.

## Objetivo en una frase

Dar a quien planea el **precio real** de una ruta (vuelo/autobús/hotel) con evidencia auditable, **sin** que ese precio entre al cálculo del estimado oficial, que sigue siendo 100% catálogo (`educacion_medica.viatico_tarifas`).

---

## Fase B1 — Tipos de oferta y propuesta (Frontend)

- [x] **B1.1** Tipos de la capa de cotización en `viaticos/types/costosRuta.types.ts`: `CostosRutaOferta`, `CostosRutaHotel`, `CostosRutaPropuesta`, `CostosRutaCompra`. Ya existen con `fuente`, `estimado` y el bloque `comprar {url, sitio, accion, objetivo, fecha}`.
- [ ] **B1.1b** **Falta `captura` en el contrato**: hoy la evidencia se apoya en `comprar.url`, pero el ADR exige una referencia de captura propia. Decidir si `captura_url` entra al tipo de oferta o vive solo en la evidencia del backend (B3.1) antes de tocar el contrato.
- [ ] **B1.2** Verificar que cada oferta conserve su `fuente` y su bandera `estimado` al mapearse a propuesta.
  - Verificación: test unitario del mapper oferta↔propuesta; la `fuente` sobrevive el mapeo.
- [ ] **B1.3** Documentar en el tipo que estas categorías (`autobus/avion/hospedaje/comida/taxi`) son de **cotizado**, distintas de las categorías de cálculo del catálogo (`BusRuta/VueloRuta/Hospedaje/Alimentos/Taxi`).

> Nota: los tipos ya existen en el repo (`CostosRutaOferta`, `CostosRutaHotel`, `CostosRutaPropuesta`, `CostosRutaCompra`). B1 es verificar/documentar la frontera, no reescribir.

## Fase B2 — Backend: cotización que no toca el catálogo

- [x] **B2.1** `POST /api/viaticos/costos-ruta/calcular` existe (`services/costosRuta.api.ts` → `costosRutaApi.calcular`) y devuelve ofertas por tramo, hoteles y totales por persona, con `fuente`/`estimado` por oferta.
- [ ] **B2.1b** La respuesta **aún no incluye `captura` por oferta**: depende de B1.1b/B3.1. Mientras tanto la evidencia queda en `comprar.url`.
- [ ] **B2.2** **Invariante dura**: el endpoint es de cálculo puro; **no escribe** en `educacion_medica.viatico_tarifas`.
  - Verificación: test de integración que cotiza y comprueba que `viatico_tarifas` queda intacta.
- [ ] **B2.3** Una propuesta rechazable sin efectos colaterales (si no se elige, no queda rastro de escritura).

## Fase B3 — Evidencia / capturas

- [ ] **B3.1** `POST /api/viaticos/costos-ruta/capturas` registra la evidencia (URL/imagen, `precio_txt`, `fecha_captura`) de una oferta seleccionada.
- [ ] **B3.2** La captura se asocia a la oferta y queda visible en la pantalla de propuesta.
- [ ] **B3.3** La evidencia vive **al lado** de la cotización, **nunca dentro** de `viatico_tarifas`.
- [ ] **B3.4** `GET /api/viaticos/costos-ruta/{id}/propuesta` relee la propuesta con su evidencia (solo lectura).

> Por qué importa: es lo que permite justificar un importe cotizado ante Controloría/Auditoría, y cierra parcialmente el hueco "valores de referencia, no precios reales" del ADR-0003 **para la parte que sí se cotizó**.

## Fase B4 — UI: estimado (catálogo) vs cotizado (captura)

- [ ] **B4.1** Mostrar las dos cifras con etiquetas explícitas: **"Estimado (catálogo)"** (autorizable) y **"Cotizado (captura)"** (real, con evidencia).
- [ ] **B4.2** Nunca presentar el cotizado como si fuera el estimado aprobable.
  - Verificación: test de render; ambas etiquetas visibles y sin ambigüedad.
- [ ] **B4.3** Cada oferta muestra su `fuente` y su marca `estimado`; la seleccionada muestra su captura.

## Fase B5 — La invariante que blinda la reconciliación

- [ ] **B5.1** Ninguna acción de la capa de búsqueda/cotización actualiza `viatico_tarifas`.
  - Verificación: test — cotizar vuelo/hotel deja `viatico_tarifas` intacta.
- [ ] **B5.2** La carga de un precio real al catálogo sigue siendo el flujo administrativo de F2/F3 del ADR-0003 (`POST/PUT/DELETE /api/viaticos/tarifas`), es decir un acto explícito, no un efecto colateral de cotizar.
- [ ] **B5.3** El catálogo y su CRUD quedan sin cambios (la capa es **aditiva**).

## Fixture de regresión — octubre 2026

- [x] **R.1** Congelar los 20 viajes + la fila de totales del concentrado real en `viaticos/test/fixtures/octubre2026.ts`.
  - Fuente: `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` (solo el markdown; los `.xlsx` no se tocan).
- [x] **R.2** Helper `sumaCategoria(viajes, categoria)` y `sumaCategorias(viaje)` para recalcular totales en tests.
- [x] **R.3** La suma de las 20 filas debe igualar la fila de totales del concentrado ($276,357.00) y cada categoría su columna.

## Permisos — PENDIENTE POR DECISIÓN DEL USUARIO

> **No inventar la jerarquía de roles.** El usuario pospuso explícitamente la matriz "quién ve qué". Mientras tanto, esta capa se despliega **solo para superadmin** y los permisos del catálogo (`educacion_medica.viaticos_tarifas.puede_ver`/`.puede_editar`) los define el ADR-0003 sin cambio.

- [ ] **P.1** Definir con el usuario la matriz completa: ¿quién **cotiza**? ¿quién **aprueba** el estimado? ¿quién **ve capturas**/precios reales? ¿diferencia por gerencia (IMSS/Descentralizados)?
- [ ] **P.2** Traducir P.1 a constantes de permiso en backend + `usePermission`/`PermissionGuard` en frontend (patrón del repo).
- [ ] **P.3** Registrar el resultado como ADR de permisos si la jerarquía resulta lo bastanteidiosicratica para justificarlo aparte.

> `puede_cotizar` y `puede_ver_capturas` son **provisionales** (solo superadmin) y existen para que el frontend/backend tengan una constante que consultar; no constituyen la política final.

## Fuera de alcance

- [ ] **H.1** Conciliación post-gasto (CFDI/transacciones, tipo Clara) — sigue fuera, igual que en el ADR-0003; esta capa es de **pre-gasto** (cotizar antes de viajar).
- [ ] **H.2** Cualquier integración que escriba precios externos directo al catálogo de forma automática — explícitamente excluida por B5.

---

## Trazabilidad con el ADR-0003

| Punto del ADR-0003 | Cómo se reconcilia aquí |
|---|---|
| *"calculará cotizaciones solo leyendo el catálogo"* | Se mantiene literal: el **cálculo** no cambia. Lo nuevo es una capa **alrededor**, no **dentro**. |
| *"nunca como dependencia en tiempo de ejecución"* | La búsqueda es apoyo de planeación y de actualización del catálogo, no insumo del cálculo del estimado. |
| *"Valores de referencia, no precios reales"* | La capa aporta el **precio real cotizado con evidencia**, pero como dato de planeación, no como estimado aprobable. |
| *"Carga operativa: mantener tarifas al día"* | La capa genera el insumo para esa actualización, pero la carga al catálogo sigue siendo el acto administrativo explícito de F2/F3. |
| *"separar cotización de comprobación del gasto real"* | Se mantiene la separación: esta capa es de pre-gasto; la comprobación posgasto sigue aparte. |

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000007_<tipo>_<nombre>`), si se requieren:

- [ ] `000007_flujo_estimado_vs_cotizado.html` — catálogo → estimado (autorizable) + búsqueda → cotización (con captura), sin flecha entre ambas al catálogo.