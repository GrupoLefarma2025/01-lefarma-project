---
fecha_creacion: 2026-11-04
fecha_modificacion: 2026-11-04
resumen: Improve the readability of the calculated schedule summary in the Viáticos send-to-concentration modal without changing calculations or submission behavior.
---

# Calculated schedule summary in Viáticos

## Status

Accepted

## Índice

1. Decisión
2. Fase 1 — Presentation redesign
3. Validación
4. Consequences
5. Anexo

## Decisión

Redesign only the calculated timing summary in `CalculosViajeModal`. Make the calculated result the primary visual element, keep departure information as secondary context, and present the duration margin as a compact footnote. Do not change route calculations, request data, API contracts, the two-dialog workflow, or submission behavior.

## Fase 1 — Presentation redesign

### Why

The current panel presents departure, estimated arrival, feasibility, and margin as consecutive small-text lines. This gives equal visual weight to primary and secondary information, repeats data already shown elsewhere in the modal, and makes the calculated arrival difficult to scan.

### Presentation contract

- Use one compact summary card within the existing calculated-route section.
- Show the label `Llegada estimada` and its existing formatted date/time as the primary content when arrival is calculated.
- Show an explicit textual status such as `Llega a tiempo` or `No alcanza la llegada requerida`; color may reinforce the status but must not be its only indicator.
- Keep the existing departure location and time as secondary context.
- Replace the repeated mathematical formula with one compact line: adjusted duration plus a note that it includes the 10% margin.
- Allow the status and values to wrap or stack on narrow screens without truncating dates, locations, or messages.
- Preserve semantic text and decorative-icon behavior; do not introduce a routine `role="alert"` for non-urgent results.

### Variant behavior

| Existing variant | Primary content | Secondary content |
| --- | --- | --- |
| Explicit departure | Estimated arrival and feasibility | Departure context and adjusted duration |
| Return leg | Estimated arrival at origin and feasibility | Return departure context and adjusted duration |
| Estimated departure | Approximate departure | Required arrival and adjusted duration; do not invent a new feasibility calculation |

### Out of scope

- Requested-schedule rows above the summary.
- Car metrics, tolls, purchase options, hotel selection, and final confirmation dialog.
- Date formats, duration calculations, margin values, API calls, and navigation.
- General modal or tab refactoring.

### Verification

Add focused presentation coverage for the three existing variants in `CalculosViajeModal.test.tsx`. Verify that primary values, secondary context, and existing feasibility messages remain correct. Run the relevant frontend tests and perform a visual check at desktop and narrow widths after implementation.

## Validación

No legacy-system or database validation is required because this is a presentation-only change. The approved inputs are the current modal screenshot supplied by the user and the selected arrival-first hierarchy. Runtime visual validation remains required after implementation.

## Consequences

### Positive

- The calculated result becomes easier to locate and understand.
- Repetition and mathematical noise are reduced.
- Existing behavior and data contracts remain isolated from the visual change.

### Negative

- Departure receives less emphasis in variants where arrival is calculated.
- The summary requires branch-specific presentation tests that do not currently exist.

### Neutral

- The estimated-departure variant emphasizes approximate departure instead of arrival because its arrival is the required input, not a calculated estimate.

## Anexo

No external documentary sources were used. No follow-up ADR is required for this scoped presentation change.
