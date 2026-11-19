# Calculated Trip Timing Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign only the calculated car-trip timing summary so the calculated result is primary, departure/required-arrival context is secondary, feasibility is explicit text, and the adjusted duration is a compact margin footnote.

**Architecture:** Keep all existing calculation, API, navigation, hotel, and submission code intact. Add focused presentation tests using the existing Vitest mocks, then replace only the three current car-summary JSX branches in `CalculosViajeModal.tsx` with a responsive named region using existing `Badge`, date/time, and duration APIs.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS, Vitest 3, Testing Library, jest-dom, user-event.

---

## File Map

- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`: add car-request fixtures and presentation coverage for explicit departure, late arrival, return leg, and estimated departure.
- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx:670-714`: replace only the three calculated-summary branches.
- Do not modify calculation services, component props, API types, environment files, lockfiles, or unrelated modal sections.

### Task 1: Add failing presentation coverage

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx:2`
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx:138`

- [ ] **Step 1: Import `within` for assertions scoped to the summary card**

Replace the Testing Library import with:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
```

- [ ] **Step 2: Add car fixtures using the existing response factory and API mock**

Insert this block immediately after the existing `beforeEach` block and before `describe('CalculosViajeModal en modo autorizar', ...)`:

```tsx
const carTrip = (explicitDeparture = true): Solicitud => ({
  ...solicitud,
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Viajera' },
    transporte: { modo: 'propio', compartir: false, acompanantes: [] },
    origen: {
      punto: {
        nombre: 'Guadalajara',
        latitud: 20.67,
        longitud: -103.34,
        municipio: 'Guadalajara',
        estado: 'Jalisco',
      },
      fechaSalida: explicitDeparture ? '2026-11-10' : '',
      horaSalida: explicitDeparture ? '08:00' : '',
    },
    destinos: [
      {
        punto: {
          nombre: 'Zapopan',
          latitud: 20.72,
          longitud: -103.39,
          municipio: 'Zapopan',
          estado: 'Jalisco',
        },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
  },
});

const carEngineResponse = (duration = '2h 00m'): CostosRutaResponse => {
  const response = respuestaMotor();
  response.resultados[0].tramos = [
    {
      from: 'Guadalajara',
      to: 'Zapopan',
      km: 120,
      opciones: [
        {
          ...oferta('auto', 'Auto propio', 900),
          modo: 'auto',
          duracion: duration,
        },
      ],
    },
  ];
  return response;
};

const renderCarSummary = async (fixture: Solicitud) => {
  render(
    <CalculosViajeModal
      solicitud={fixture}
      open
      onOpenChange={vi.fn()}
      onEnviado={vi.fn()}
    />,
  );
  return await screen.findByRole('region', { name: 'Resumen calculado del viaje' });
};
```

- [ ] **Step 3: Add the four variant, status, accessibility, and responsive tests**

Insert this block immediately after the helpers from Step 2:

```tsx
describe('CalculosViajeModal calculated car summary', () => {
  it('prioritizes calculated arrival with explicit departure and supports responsive stacking', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });

    const summary = await renderCarSummary(carTrip());
    const arrival = within(summary).getByText(/10\/11\/2026 · 10:12 AM/);

    expect(within(summary).getByText('Llegada estimada')).toBeInTheDocument();
    expect(arrival).toHaveClass('break-words');
    expect(within(summary).getByText('Llega a tiempo')).toHaveClass('whitespace-normal');
    expect(
      within(summary).getByText(/Salida de Guadalajara, Jalisco: .*8:00 AM/),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByText(/base \+ 10%/)).not.toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
    expect(summary.firstElementChild).toHaveClass(
      'flex',
      'flex-col',
      'sm:flex-row',
      'sm:items-start',
    );
  });

  it('exposes a late calculated arrival as wrappable text instead of color alone', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse('7h 00m') },
    });

    const summary = await renderCarSummary(carTrip());

    expect(within(summary).getByText(/10\/11\/2026 · 3:43 PM/)).toBeInTheDocument();
    expect(within(summary).getByText('No alcanza la llegada requerida')).toHaveClass(
      'max-w-full',
      'whitespace-normal',
      'text-amber-700',
    );
    expect(
      within(summary).getByText('Duración ajustada: 7h 43m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('preserves return arrival, departure context, feasibility, and per-leg API calls', async () => {
    const user = userEvent.setup();
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });
    render(
      <CalculosViajeModal
        solicitud={carTrip()}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
      />,
    );

    const nextButton = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(nextButton).toBeEnabled());
    await user.click(nextButton);

    const summary = await screen.findByRole('region', { name: 'Resumen calculado del viaje' });
    expect(within(summary).getByText('Llegada estimada al origen')).toBeInTheDocument();
    expect(within(summary).getByText(/10\/11\/2026 · 8:12 PM/)).toBeInTheDocument();
    expect(
      within(summary).getByText(/Salida de Zapopan, Jalisco: .*6:00 PM/),
    ).toBeInTheDocument();
    expect(within(summary).getByText('No alcanza la llegada requerida')).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(mocks.calcular).toHaveBeenCalledTimes(2);
  });

  it('prioritizes approximate departure without inventing feasibility for the estimated variant', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });

    const summary = await renderCarSummary(carTrip(false));

    expect(within(summary).getByText('Salida aproximada')).toBeInTheDocument();
    expect(within(summary).getByText(/10\/11\/2026 · 11:48 AM/)).toBeInTheDocument();
    expect(
      within(summary).getByText(/Llegada requerida: .*2:00 PM/),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByText('Llega a tiempo')).not.toBeInTheDocument();
    expect(within(summary).queryByText('No alcanza la llegada requerida')).not.toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the new tests and verify RED**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx -t "calculated car summary"
```

Expected: FAIL with four failed tests and the existing authorization test skipped. The failures must be caused by the missing named `Resumen calculado del viaje` region and its new presentation text, not by TypeScript errors or fixture errors.

### Task 2: Implement the minimal summary-only JSX change

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx:670-714`

- [ ] **Step 1: Replace only the three existing car-summary branches**

Replace the complete `tramo.esRegreso ? ... : tramo.desde.explicita ... ? ... : salidaCarro ? ... : null` expression with:

```tsx
{tramo.esRegreso ? (
  <section aria-label="Resumen calculado del viaje" className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Llegada estimada al origen
        </p>
        {llegadaCarro ? (
          <p className="break-words text-lg font-semibold leading-tight">
            {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
          </p>
        ) : null}
        <p className="break-words text-muted-foreground">
          Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
        </p>
      </div>
      {llegaRegreso !== null ? (
        <Badge
          variant={llegaRegreso ? 'secondary' : 'outline'}
          className={llegaRegreso
            ? 'h-auto max-w-full whitespace-normal text-center leading-snug text-primary'
            : 'h-auto max-w-full whitespace-normal text-center leading-snug text-amber-700'}
        >
          {llegaRegreso ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
        </Badge>
      ) : null}
    </div>
    <p className="text-xs text-muted-foreground">
      Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
    </p>
  </section>
) : tramo.desde.explicita && tramo.desde.fecha && tramo.desde.hora ? (
  <section aria-label="Resumen calculado del viaje" className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Llegada estimada
        </p>
        {llegadaCarro ? (
          <p className="break-words text-lg font-semibold leading-tight">
            {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
          </p>
        ) : null}
        <p className="break-words text-muted-foreground">
          Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
        </p>
      </div>
      {llegaCarro !== null ? (
        <Badge
          variant={llegaCarro ? 'secondary' : 'outline'}
          className={llegaCarro
            ? 'h-auto max-w-full whitespace-normal text-center leading-snug text-primary'
            : 'h-auto max-w-full whitespace-normal text-center leading-snug text-amber-700'}
        >
          {llegaCarro ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
        </Badge>
      ) : null}
    </div>
    <p className="text-xs text-muted-foreground">
      Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
    </p>
  </section>
) : salidaCarro ? (
  <section aria-label="Resumen calculado del viaje" className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Salida aproximada
        </p>
        <p className="break-words text-lg font-semibold leading-tight">
          {fechaCorta(salidaCarro.fecha) ?? salidaCarro.fecha} · {horaAmPm(salidaCarro.hora) ?? salidaCarro.hora}
        </p>
        <p className="break-words text-muted-foreground">
          Llegada requerida: {fechaCorta(tramo.hasta.fecha) ?? tramo.hasta.fecha} · {horaLlegadaAmPm ?? tramo.hasta.hora}
        </p>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      Duración ajustada: {duracionTexto(salidaCarro.minutos)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
    </p>
  </section>
) : null}
```

Do not change the derivation of `salidaCarro`, `minutosCarro`, `llegadaCarro`, `llegaCarro`, or `llegaRegreso`; do not add a feasibility status to the estimated-departure branch; leave all existing decorative icons and their `aria-hidden` attributes untouched.

- [ ] **Step 2: Run the focused tests and verify GREEN**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx -t "calculated car summary"
```

Expected: PASS with four passed tests and the existing authorization test skipped.

- [ ] **Step 3: Run the complete modal test file**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx
```

Expected: PASS with five tests, including the pre-existing authorization/proposal contract test and no new API calls beyond the existing per-leg calculations.

### Task 3: Verify scope, compilation, lint, and responsive presentation

**Files:**
- Verify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx`
- Verify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`

- [ ] **Step 1: Verify TypeScript and the production bundle**

Run from `lefarma.frontend`:

```bash
npm run build
```

Expected: `tsc && vite build` exits successfully with no type or bundling errors.

- [ ] **Step 2: Verify lint**

Run from `lefarma.frontend`:

```bash
npm run lint
```

Expected: exit code 0 with no warnings or errors.

- [ ] **Step 3: Verify that only the intended frontend source files changed**

Run from the repository root:

```bash
git diff --check -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx
git diff --name-only -- lefarma.frontend/src
git diff -U0 -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx
```

Expected: the first command prints nothing; the second lists only the modal and its test; the third shows only the three summary JSX branches, with no calculation, request, callback, submission, navigation, or contract edits.

- [ ] **Step 4: Perform the required desktop and narrow-width visual check**

With the backend available at `https://localhost:7034`, run from `lefarma.frontend`:

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:5173/viaticos/mis-viajes`, use a draft whose transport is `propio`, and activate its `Enviar a concentrado` action. Check an explicit-departure draft, the same trip's return leg via `Siguiente`, and a draft without explicit origin date/time at viewport widths 1280 px and 360 px.

Expected: each named summary shows the correct primary value, secondary context, compact adjusted-duration footnote, and branch-appropriate textual status; estimated departure has no feasibility badge; dates, locations, and messages wrap or stack without truncation or horizontal overflow; requested-schedule rows, car metrics, tolls, hotel controls, and both dialogs retain their existing behavior.
