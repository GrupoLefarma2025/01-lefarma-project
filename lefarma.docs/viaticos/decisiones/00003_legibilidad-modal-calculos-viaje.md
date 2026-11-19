---
fecha_creacion: 2026-11-06
fecha_modificacion: 2026-11-06
resumen: Improve readability and information hierarchy in the Viáticos calculation modal using a two-column desktop layout, stronger typography, and responsive behavior without collapsing content.
---

# Calculation modal readability and hierarchy

## Status

Accepted

## Índice

1. Decisión
2. Fase 1 — Layout and visual hierarchy
3. Validación
4. Consequences
5. Anexo

## Decisión

Redesign only the calculation content presentation in `CalculosViajeModal`. Use a two-column desktop layout, stronger typography and contrast, and a stacked mobile layout. Keep all information expanded and preserve calculations, data contracts, actions, navigation, and existing state behavior.

## Fase 1 — Layout and visual hierarchy

### Why

Important values currently compete with technical notes in small, low-emphasis text. Multiple dark badges and consecutive dense paragraphs make schedules, costs, and toll details difficult to scan. The user requires improved legibility without collapsing sections; desktop should avoid vertical scrolling for typical content, while mobile remains naturally scrollable.

### Desktop structure

At the agreed desktop breakpoint, present the existing content in two balanced, minimum-width-zero columns:

- Left: requested schedule and calculated timing summary, including explicit feasibility text when applicable.
- Right: distance/base duration/margin, selected auto cost components and source, and SCT toll detail.
- The leg title and existing navigation remain outside this content grid.
- Use the available width without changing the dialog shell, footer, or route tabs.
- Do not introduce accordions, hidden technical details, additional dialogs, or another wizard step.

### Typography and color

- Primary calculated date/time values: 18–20 px, semibold.
- Normal data values and table content: 14 px where space permits.
- Labels, source notes, and technical metadata: 12–13 px minimum.
- Use foreground color for values; reserve muted color for labels and supporting context, not important data.
- Preserve explicit textual status; color never carries meaning alone.
- Replace nonessential dark metric badges with quieter inline values or existing secondary/outline treatments.
- Increase row padding and separator clarity in the SCT table; keep totals visually distinct.

### Responsive and overflow rules

- Target no vertical modal scrolling for typical content at 1366×768, including the recorded one-plaza fixture.
- Below the desktop breakpoint, stack columns and allow natural vertical scrolling.
- No horizontal overflow is allowed at desktop or 360 px mobile width.
- Exceptionally long plaza lists may require vertical scrolling; never shrink text to force fit.
- Wait for the existing dialog width transition before measuring or capturing visual evidence.

### Out of scope

- Route, duration, margin, fuel, toll, and authorization calculation changes.
- Data contracts, provider behavior, persistence, and historical values.
- Header, route tabs, footer, and dialog shell redesign.
- Additional content removal, collapsible sections, or interaction redesign.
- Unrelated component or theme refactoring.

## Validación

- Preserve all existing `CalculosViajeModal` and calculation/reconciliation tests.
- Add focused presentation assertions for the two-column desktop region, readable value classes, explicit source roles, and mobile stacking.
- Extend the browser-mocked Playwright scenario to assert stable dialog bounds, no horizontal overflow, and no vertical modal overflow for the typical 1366×768 fixture.
- Retain the 360 px checks and natural vertical access to all content.
- Run the Viáticos frontend tests, TypeScript/production build, targeted ESLint on changed files, and browser visual checks.
- Inspect stable screenshots for available, unavailable, zero-plaza, and incomplete round-trip states.

## Consequences

### Positive

- Important values become easier to locate and read.
- Desktop width is used more effectively without hiding information.
- Official SCT reference data and selected-price estimates remain clearly distinguished.

### Negative

- The layout requires careful testing across several toll states and content lengths.
- Exceptionally long routes can still exceed the desktop height and require scrolling.

### Neutral

- Mobile retains a single-column, vertically scrollable presentation by explicit user agreement.

## Anexo

No archived reference documents under `referencias/pdf` or `referencias/pdf-to-md` were used. No follow-up ADR is required for this presentation-only change.
