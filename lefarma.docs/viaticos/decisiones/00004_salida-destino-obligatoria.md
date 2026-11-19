---
fecha_creacion: 2026-11-06
fecha_modificacion: 2026-11-06
resumen: Require destination departure date/time before advancing or calculating so the return to origin uses explicit user input while drafts remain partially saveable.
---

# Required destination departure for return calculation

## Status

Accepted

## Índice

1. Decisión
2. Fase 1 — Validation and return calculation
3. Validación
4. Consequences
5. Anexo

## Decisión

Require destination departure date and time before the user advances or calculates. Use that explicit value to construct the following leg and return to origin. Keep the existing two-hour fallback only for legacy/incomplete drafts and do not block saving partial drafts.

## Fase 1 — Validation and return calculation

### Why

The current optional field lets the wizard substitute departure with two hours after arrival. The user needs the return calculation based on a deliberate departure value instead of an invisible assumption. Requiring the value only when advancing/calculating preserves partial draft capture.

### Presentation and validation contract

- Change the label to `Hora de salida del destino (obligatoria)`.
- Add the helper text `La usamos para calcular el regreso al origen.`
- A destination can advance only when it has a point, required arrival date/time, and departure date/time.
- Both departure parts are required; a partial value leaves `Siguiente` disabled.
- Departure must be equal to or later than arrival; preserve the existing validation message for earlier values.
- Every destination in a multi-destination trip must satisfy the same rule.
- Existing calculation invalidation on departure changes remains active.
- Do not change the dialog, destination layout, API payloads, or backend contracts.

### Return and compatibility

- When departure is present, the existing leg builder uses it for the next leg and the return-to-origin calculation.
- Do not replace a newly captured valid departure with the two-hour estimate.
- Keep the two-hour fallback only when reading/calculating legacy or otherwise incomplete drafts; removing it would break compatibility.
- Saving a draft with an empty departure remains allowed. No database migration or historical rewrite occurs.

### Out of scope

- Changes to route providers, duration, tolls, costs, or time margins.
- Backend validation or schema changes.
- Historical data correction or automatic recalculation on the server.
- Unrelated wizard validation or visual changes.

## Validación

Update the existing optional-field test into required-field coverage and verify:

- Empty departure disables advancing.
- Date-only or time-only departure disables advancing.
- A valid departure at/after arrival enables advancing.
- Departure before arrival remains invalid.
- Every destination must be complete in a multi-destination trip.
- Saving a partial draft remains possible.
- The leg builder uses the explicit departure for return and retains only the legacy fallback test.
- Existing `SolicitudPage` and Viáticos regression tests remain green; run targeted ESLint and the frontend build.

## Consequences

### Positive

- Return calculations use deliberate user input instead of a hidden two-hour assumption.
- Users understand why the field is required.
- Partial drafts and legacy compatibility remain intact.

### Negative

- Users must complete an additional field before advancing.
- Legacy incomplete drafts still rely on the fallback until the user supplies the value.

### Neutral

- No backend or database change is required because the existing snapshot already contains both departure fields.

## Anexo

No archived reference documents under `referencias/pdf` or `referencias/pdf-to-md` were used. No follow-up ADR is required.
