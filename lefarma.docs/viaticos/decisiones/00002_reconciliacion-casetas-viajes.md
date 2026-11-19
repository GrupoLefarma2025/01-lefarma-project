---
fecha_creacion: 2026-11-05
fecha_modificacion: 2026-11-05
resumen: Reconcile selected transportation costs and provide explicit, non-misleading SCT toll availability states without inventing plaza coverage.
---

# Toll reconciliation and availability for Viáticos

## Status

Accepted

## Índice

1. Decisión
2. Fase 1 — Selected-offer cost reconciliation
3. Fase 2 — SCT availability and parser correctness
4. Validación
5. Consequences
6. Anexo

## Decisión

Use the selected transportation offer as the single billable price, persist its cost components when available, and treat SCT plaza details as reference information rather than an additional charge. Add explicit SCT availability states and correct totals parsing. Do not substitute unsupported destinations, recalculate historical requests, change database schema, or introduce geographic toll discovery in this change.

## Fase 1 — Selected-offer cost reconciliation

### Why

The selected auto/rental price already contains estimated tolls, while the frontend preview and backend authorization can add displayed plaza tariffs again. This can inflate the total and allows the preview and persisted FOR-008 summary to encode the same defect.

### Cost contract

- Count every selected offer price exactly once.
- For newly calculated auto offers, persist `combustible`, `casetas_estimadas`, and the estimate source inside the existing option `datos` metadata.
- In both preview and authorization summaries, new auto offers produce `gasolina = combustible` and `casetas = casetas_estimadas`.
- SCT plaza rows and tariffs remain reference detail and never enter the billable total separately.
- Rental offers and legacy auto offers without persisted components retain their selected combined amount under the existing transport field; their toll detail is not added again and no component split is invented.
- Do not recalculate or silently rewrite sealed historical values.
- Preview and authorization must return identical summaries from the same selected options and metadata.

### Acceptance invariant

For a selected auto price of 300 composed of 180 fuel plus 120 estimated toll, the summary contains fuel 180, toll 120, and transportation total 300. Displaying an SCT plaza with a different reference tariff does not change that total.

## Fase 2 — SCT availability and parser correctness

### Availability states

Each calculated leg exposes one of these states:

| State | Meaning | Required presentation |
| --- | --- | --- |
| `disponible` | SCT returned a valid official route result, with or without plazas | Show official plaza rows; for a valid zero-plaza result, state that SCT reports no toll plazas |
| `destino_no_soportado` | Origin or destination is absent from the SCT catalog | `La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.` |
| `proveedor_no_disponible` | SCT request failed or was unavailable | `No fue posible consultar la SCT. Intenta nuevamente.` |
| `respuesta_invalida` | SCT returned content that could not be interpreted | `No fue posible interpretar el desglose oficial de casetas.`; retain technical detail in server logs |

Empty, unsupported, failed, and malformed results are not official zero values. Only successful official route responses may be cached for the existing cache duration. Do not cache temporary provider or parsing failures.

Each SCT consultation has a 20-second total deadline covering semaphore queueing and the complete provider sequence. Deadline expiry returns `proveedor_no_disponible`; caller-initiated cancellation continues to propagate. This prevents one slow SCT sequence from holding the process-wide gate beyond the browser's 30-second request budget.

### Parser correction

The parser must handle merged cells in the SCT totals row without skipping totals or assigning tariff values to the wrong column. Use a recorded HTML fixture from the read-only CDMX-to-Pachuca diagnostic only as a parser fixture, never as a substitute route for another destination. The fixture verifies:

- Official distance: 97.350 km.
- Official displayed time: 01:15.
- Plaza: Ojo de Agua.
- Cumulative plaza position: 63.4 km.
- Automobile tariff and official toll total: 72.0 MXN.

SCT totals remain reference data and do not replace OSRM distance/time or the selected offer's estimated toll component.

### Presentation rules

- Never substitute a nearby SCT city for the requested endpoint.
- Label official SCT detail and estimated toll components by source so users do not assume they are the same amount.
- Do not present a consolidated official round-trip toll total unless every included leg has a valid official result.
- Preserve the existing modal workflow and the previously approved timing-summary presentation.

### Out of scope

- Geographic toll-booth discovery or nearest-city approximation.
- New paid route providers, API keys, or database migrations.
- Changes to OSRM distance/time formulas, fuel rates, or the 10% driving-time margin.
- Recalculation of historical requests.
- Unrelated modal, authorization, or report refactoring.

## Validación

### Automated coverage

- SCT parser: normal rows, merged totals, valid zero-plaza success, unsupported endpoint, malformed response, and localized/malformed numbers.
- Cost preview and authorization: new auto components, rental combined amounts, legacy combined amounts, and SCT reference detail without double counting.
- Availability propagation: every state reaches the frontend with the corresponding message and no false zero.
- Round-trip aggregation: incomplete official detail cannot produce a seemingly complete official total.
- Existing Viáticos modal, calculation, and authorization regression suites.

### External evidence boundary

Live OSRM and Google Maps checks support the example's distance/time consistency. Live SCT checks confirmed that San Guillermo la Reforma and Mineral de la Reforma are not present in the current catalog and that simplified/detailed network modes do not change that coverage. These live checks are development evidence, not repeatable unit-test dependencies.

## Consequences

### Positive

- Preview and persisted authorization totals count selected transportation once.
- Users can distinguish official toll detail from unavailable or failed lookups.
- Supported SCT routes retain official plaza details and correctly parsed totals.
- Historical totals are preserved without fabricated component splits.

### Negative

- Unsupported municipalities still have no official plaza names or tariffs to display.
- Legacy/rental combined transport amounts remain less granular than new auto calculations.
- The public SCT HTML contract remains fragile and requires recorded parser fixtures.

### Neutral

- SCT reference tariffs may legitimately differ from the estimated toll component used in the selected offer; the UI must disclose their different roles.
- Geographic coverage expansion may be evaluated later as a separate decision.

## Anexo

No archived reference documents under `referencias/pdf` or `referencias/pdf-to-md` were used. No follow-up ADR is required unless geographic toll discovery or a new provider is proposed.
