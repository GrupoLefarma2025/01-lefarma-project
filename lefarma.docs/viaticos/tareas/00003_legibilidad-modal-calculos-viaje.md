# Calculation Modal Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve only the calculation content presentation in `CalculosViajeModal` with a two-column desktop layout, stacked mobile layout, expanded content, stronger typography, quieter metrics, and a readable SCT table while preserving every existing behavior.

**Architecture:** Keep all request construction, calculations, providers, contracts, state effects, navigation, submission, dialog shell, header, tabs, and footer intact. Add one focused Vitest presentation test and extend the existing browser-mocked Playwright scenario before moving the existing schedule, timing, metric, cost, and SCT JSX into semantic responsive columns.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 3.4, Vitest 3, Testing Library, jest-dom, Playwright 1.58.

---

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 600-750, mostly moved JSX and data-driven browser coverage |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Unit 1: modal presentation plus focused Vitest; Unit 2: Playwright visual scenario |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Dependency | Verification |
|---|---|---|---|
| 1 | Responsive modal presentation and focused presentation test | None | Focused and complete modal Vitest file, targeted lint, build |
| 2 | Stable browser-mocked visual coverage | Unit 1 test IDs and regions | Playwright scenario, screenshots, overflow assertions |

## File Map

- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx`: presentation-only JSX between the existing leg heading and the non-car options branch.
- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`: one focused layout/typography/source/table test using existing fixtures.
- Modify `lefarma.frontend/tests/viaticos-casetas.spec.ts`: reusable condition-based visual assertions and screenshots for every SCT availability state at 1366×768 and 360 px.
- Do not modify calculation services, API types, providers, component props, dialog primitives, environment files, lockfiles, or any backend file.

### Task 0: Preserve the current working baseline

**Files:**
- Verify only; do not modify implementation files in this task.

- [x] **Step 1: Record the existing uncommitted work**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git status --short
git diff -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx lefarma.frontend/tests/viaticos-casetas.spec.ts
```

Expected: the modal contains generic-point reverse geocoding, open/ID-based session invalidation, late-response session guards, SCT availability states, selected-auto components, guarded round-trip totals, and the arrival-first timing summary. Do not stash, restore, format, or overwrite those changes.

### Task 1: Add the failing focused presentation test

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx:333`

- [x] **Step 1: Insert the presentation test after the calculated-car-summary describe block**

```tsx
describe('CalculosViajeModal presentation layout', () => {
  it('separates schedule and timing from metrics and SCT with readable responsive content', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetas = [
      {
        tramo: 1,
        deMunicipio: 'Guadalajara',
        aMunicipio: 'Zapopan',
        nombre: 'Ojo de Agua',
        carretera: 'México - Pachuca',
        km: 63.4,
        tarifa: 72,
        direccion: 'México - Pachuca',
        fuente: 'SCT · Rutas Punto a Punto',
      },
    ];
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    const summary = await renderCarSummary(carTrip());
    const layout = screen.getByTestId('calculos-viaje-layout');
    const scheduleColumn = within(layout).getByTestId('calculos-viaje-schedule-column');
    const costColumn = within(layout).getByTestId('calculos-viaje-cost-column');
    const metrics = screen.getByRole('region', { name: 'Distancia y duración del tramo' });
    const detail = screen.getByRole('region', { name: 'Detalle de casetas SCT' });

    expect(layout).toHaveClass('grid', 'grid-cols-1', 'items-start', 'gap-4', 'lg:grid-cols-2');
    expect(scheduleColumn).toHaveClass('min-w-0');
    expect(costColumn).toHaveClass('min-w-0');
    expect(scheduleColumn).toContainElement(screen.getByRole('region', { name: 'Horarios solicitados' }));
    expect(scheduleColumn).toContainElement(summary);
    expect(costColumn).toContainElement(metrics);
    expect(costColumn).toContainElement(detail);
    expect(within(summary).getByText(/10\/11\/2026 · 10:12 AM/)).toHaveClass(
      'break-words',
      'text-xl',
      'font-semibold',
      'text-foreground',
    );
    expect(metrics).toHaveTextContent('120 km');
    expect(metrics).toHaveTextContent('2h 00m base');
    expect(metrics).toHaveTextContent('+10% = 2h 12m');
    expect(within(detail).getByRole('note', { name: 'Fuente de la estimación del auto' })).toHaveTextContent(
      'Fuente de la estimación: OSRM + CNE (fixture). Ya está incluida en el precio seleccionado.',
    );

    const table = within(detail).getByRole('table');
    expect(table).toHaveClass('w-full', 'table-fixed', 'text-left', 'text-sm');
    expect(within(table).getByRole('columnheader', { name: 'Caseta' })).toHaveClass('py-2');
    expect(within(table).getByRole('cell', { name: 'Ojo de Agua' })).toHaveClass(
      'break-words',
      'py-2.5',
      'text-foreground',
    );
    const officialSource = within(detail).getByRole('note', { name: 'Fuente oficial SCT' });
    expect(officialSource).toHaveClass('text-xs', 'leading-relaxed');
    expect(officialSource).toHaveTextContent(
      'Fuente oficial: SCT · Rutas Punto a Punto. Referencia: 97.350 km · 01:15. No se suma al precio seleccionado.',
    );
  });
});
```

- [x] **Step 2: Run the new test and verify RED**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx -t "presentation layout"
```

Expected: FAIL with one failed test because `calculos-viaje-layout` does not exist; the other 16 tests are skipped. The failure must not be a TypeScript or fixture error.

### Task 2: Add the failing browser visual scenario

**Files:**
- Modify: `lefarma.frontend/tests/viaticos-casetas.spec.ts:1`
- Modify: `lefarma.frontend/tests/viaticos-casetas.spec.ts:194-303`

- [x] **Step 1: Add the Playwright types required by the helpers**

Replace the import with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test';
```

- [x] **Step 2: Insert condition-based layout, overflow, access, and screenshot helpers after `motorResponse`**

```ts
async function expectStableDialogBounds(dialog: Locator) {
  await expect.poll(async () => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const expectedWidth = Math.min(window.innerWidth * 0.96, 1400);
    return {
      settledWidth: Math.abs(rect.width - expectedWidth) <= 1,
      insideViewport: rect.left >= 0 && rect.right <= window.innerWidth,
      documentHasNoHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      dialogHasNoHorizontalOverflow: element.scrollWidth <= element.clientWidth + 1,
    };
  })).toEqual({
    settledWidth: true,
    insideViewport: true,
    documentHasNoHorizontalOverflow: true,
    dialogHasNoHorizontalOverflow: true,
  });
}

async function expectNoVerticalOverflow(dialog: Locator) {
  await expect.poll(async () => dialog.evaluate(
    (element) => element.scrollHeight <= element.clientHeight + 1,
  )).toBe(true);
}

async function expectDesktopColumns(dialog: Locator) {
  const layout = dialog.getByTestId('calculos-viaje-layout');
  const schedule = dialog.getByTestId('calculos-viaje-schedule-column');
  const costs = dialog.getByTestId('calculos-viaje-cost-column');
  await expect(layout).toBeVisible();
  await expect.poll(async () => {
    const [left, right] = await Promise.all([schedule.boundingBox(), costs.boundingBox()]);
    return left !== null
      && right !== null
      && left.x < right.x
      && Math.abs(left.y - right.y) <= 1;
  }).toBe(true);
}

async function expectMobileColumns(dialog: Locator) {
  const layout = dialog.getByTestId('calculos-viaje-layout');
  const schedule = dialog.getByTestId('calculos-viaje-schedule-column');
  const costs = dialog.getByTestId('calculos-viaje-cost-column');
  await expect(layout).toBeVisible();
  await expect.poll(async () => {
    const [left, right] = await Promise.all([schedule.boundingBox(), costs.boundingBox()]);
    return left !== null
      && right !== null
      && Math.abs(left.x - right.x) <= 1
      && right.y >= left.y + left.height;
  }).toBe(true);
}

async function captureModal(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

async function captureResponsiveModal(
  page: Page,
  dialog: Locator,
  name: string,
  typicalDesktopFixture = false,
) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await expectStableDialogBounds(dialog);
  await expectDesktopColumns(dialog);
  if (typicalDesktopFixture) await expectNoVerticalOverflow(dialog);
  await captureModal(page, `${name}-1366x768`);

  await page.setViewportSize({ width: 360, height: 900 });
  await expectStableDialogBounds(dialog);
  await expectMobileColumns(dialog);
  await captureModal(page, `${name}-360`);

  const detail = dialog.getByRole('region', { name: 'Detalle de casetas SCT' });
  await detail.scrollIntoViewIfNeeded();
  await expect(detail).toBeVisible();
  const searchAgain = dialog.getByRole('button', { name: /Volver a buscar|Reintentar/ });
  await searchAgain.scrollIntoViewIfNeeded();
  await expect(searchAgain).toBeVisible();
  await expect(dialog).toHaveCSS('overflow-y', 'auto');
}

async function openCalculosModal(page: Page) {
  await page.goto('/viaticos/concentrado', { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('concentrado-5');
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Ver detalle/i }).click();
  await expect(page.getByTestId('revision-solicitud')).toBeVisible();
  await page.getByRole('button', { name: 'Recalcular ruta' }).click();
  const dialog = page.getByRole('dialog', { name: /Cálculos del viaje/ });
  await expect(dialog).toBeVisible();
  return dialog;
}
```

- [x] **Step 3: Make 1366×768 the default browser viewport**

Replace the existing `test.use` call with:

```ts
test.use({ viewport: { width: 1366, height: 768 } });
```

- [x] **Step 4: Add deterministic scenario selection at the start of the existing test**

Replace `let calculationCalls = 0;` with:

```ts
  let calculationCalls = 0;
  type VisualScenario = 'roundtrip' | 'zero-plaza' | 'destino_no_soportado' | 'respuesta_invalida';
  let visualScenario: VisualScenario = 'roundtrip';
```

- [x] **Step 5: Extend only the mocked calculation response branch**

Replace the existing `/api/viaticos/costos-ruta/calcular` branch with:

```ts
    if (path === '/api/viaticos/costos-ruta/calcular' && request.method() === 'POST') {
      calculationCalls += 1;
      if (visualScenario === 'roundtrip') {
        await fulfill(motorResponse(calculationCalls === 1, calculationCalls === 2));
      } else if (visualScenario === 'zero-plaza') {
        const response = motorResponse(true);
        response.resultados[0].casetas = [];
        response.resultados[0].casetasDisponibilidad[0].peajeTotal = 0;
        await fulfill(response);
      } else {
        const response = motorResponse(false);
        response.resultados[0].casetasDisponibilidad[0].estado = visualScenario;
        await fulfill(response);
      }
      return;
    }
```

- [x] **Step 6: Replace the existing navigation/assertion tail with desktop, mobile, and all-state coverage**

Replace from the existing `await page.goto('/viaticos/concentrado', ...)` through the end of the test with:

```ts
  const dialog = await openCalculosModal(page);
  const detailRegion = dialog.getByRole('region', { name: 'Detalle de casetas SCT' });
  await expect(detailRegion).toBeVisible();
  await expect(detailRegion).toContainText('Ojo de Agua');
  await expect(detailRegion).toContainText('Referencia: 97.350 km · 01:15');
  await expect(detailRegion).toContainText('No se suma al precio seleccionado.');
  await expect(detailRegion).toContainText('combustible $780 + casetas estimadas $120 = $900');
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  await captureResponsiveModal(page, dialog, 'viaticos-calculos-disponible', true);

  await page.setViewportSize({ width: 1366, height: 768 });
  await expectStableDialogBounds(dialog);
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(detailRegion).toContainText('No fue posible consultar la SCT. Intenta nuevamente.');
  await expect(detailRegion).toContainText('No hay un total oficial de ida y vuelta');
  await expect(page.getByText(/Total oficial SCT de ida y vuelta:/)).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Llegada estimada al origen');
  await captureResponsiveModal(page, dialog, 'viaticos-calculos-incompleto');
  expect(calculationCalls).toBe(2);

  const scenarios = [
    {
      id: 'zero-plaza',
      message: 'La SCT no reporta plazas de cobro para este tramo.',
      screenshot: 'viaticos-calculos-cero-plazas',
    },
    {
      id: 'destino_no_soportado',
      message: 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.',
      screenshot: 'viaticos-calculos-destino-no-soportado',
    },
    {
      id: 'respuesta_invalida',
      message: 'No fue posible interpretar el desglose oficial de casetas.',
      screenshot: 'viaticos-calculos-respuesta-invalida',
    },
  ] as const;

  for (const item of scenarios) {
    calculationCalls = 0;
    visualScenario = item.id;
    const scenarioDialog = await openCalculosModal(page);
    const scenarioDetail = scenarioDialog.getByRole('region', { name: 'Detalle de casetas SCT' });
    await expect(scenarioDetail).toBeVisible();
    await expect(scenarioDetail).toContainText(item.message);
    await expect(scenarioDetail.getByRole('table')).toHaveCount(0);
    if (item.id === 'zero-plaza') {
      await expect(scenarioDetail).toContainText('Fuente oficial: SCT · Rutas Punto a Punto');
    } else {
      await expect(scenarioDetail).not.toContainText('$0');
    }
    await captureResponsiveModal(page, scenarioDialog, item.screenshot);
    expect(calculationCalls).toBe(1);
  }
});
```

- [x] **Step 7: Run the browser scenario and verify RED**

Run from `lefarma.frontend`:

```powershell
$env:PLAYWRIGHT_HTML_OPEN='never'; npx playwright test tests/viaticos-casetas.spec.ts --config=playwright.e2e.config.ts --project=chromium
```

Expected: FAIL because `calculos-viaje-layout` is not present. API responses remain browser-mocked; no backend or live SCT provider is required. Do not add `waitForTimeout` or another fixed delay for the existing 200 ms dialog transition.

### Task 3: Implement the presentation-only responsive layout

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx:695-917`

- [x] **Step 1: Replace only the schedule, loader, and car-presentation JSX with the responsive columns**

Keep the surrounding leg heading and the existing non-car options/warning/hotel code. Replace from the current schedule `<div className="space-y-2 text-sm">` through the car branch's `) : (` with:

```tsx
<div data-testid="calculos-viaje-layout" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
  <div data-testid="calculos-viaje-schedule-column" className="min-w-0 space-y-3">
    <section aria-label="Horarios solicitados" className="space-y-2 text-sm">
      {tramo.desde.explicita && fechaSalida ? (
        <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {paso === 0 ? 'Salida del origen' : `Salida de ${tramo.desde.nombre}`}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              {fechaSalida}
            </span>
            {horaSalidaAmPm ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                {horaSalidaAmPm}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {tramo.esRegreso ? 'Regreso estimado' : `Llegada a ${tramo.hasta.nombre}`}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
          {fechaLlegada ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
              {fechaLlegada}
            </span>
          ) : null}
          {horaLlegadaAmPm ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
              {horaLlegadaAmPm}
            </span>
          ) : null}
        </span>
      </div>
    </section>

    {resultadoActual && persona && !buscandoEste && esCarro ? (
      <>
        {tramo.esRegreso ? (
          <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Llegada estimada al origen
                </p>
                {llegadaCarro ? (
                  <p className="break-words text-xl font-semibold leading-tight text-foreground">
                    {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
                  </p>
                ) : null}
                <p className="break-words text-sm text-foreground">
                  Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                </p>
              </div>
              {llegaRegreso !== null ? (
                <Badge
                  variant={llegaRegreso ? 'secondary' : 'outline'}
                  className={llegaRegreso
                    ? 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-primary'
                    : 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-amber-700'}
                >
                  {llegaRegreso ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
            </p>
          </section>
        ) : tramo.desde.explicita && tramo.desde.fecha && tramo.desde.hora ? (
          <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Llegada estimada
                </p>
                {llegadaCarro ? (
                  <p className="break-words text-xl font-semibold leading-tight text-foreground">
                    {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
                  </p>
                ) : null}
                <p className="break-words text-sm text-foreground">
                  Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                </p>
              </div>
              {llegaCarro !== null ? (
                <Badge
                  variant={llegaCarro ? 'secondary' : 'outline'}
                  className={llegaCarro
                    ? 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-primary'
                    : 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-amber-700'}
                >
                  {llegaCarro ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
            </p>
          </section>
        ) : salidaCarro ? (
          <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Salida aproximada
                </p>
                <p className="break-words text-xl font-semibold leading-tight text-foreground">
                  {fechaCorta(salidaCarro.fecha) ?? salidaCarro.fecha} · {horaAmPm(salidaCarro.hora) ?? salidaCarro.hora}
                </p>
                <p className="break-words text-sm text-foreground">
                  Llegada requerida: {fechaCorta(tramo.hasta.fecha) ?? tramo.hasta.fecha} · {horaLlegadaAmPm ?? tramo.hasta.hora}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Duración ajustada: {duracionTexto(salidaCarro.minutos)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
            </p>
          </section>
        ) : null}
      </>
    ) : null}
  </div>

  <div data-testid="calculos-viaje-cost-column" className="min-w-0 space-y-3">
    {resultadoActual && persona && !buscandoEste && esCarro ? (
      <>
        <section aria-label="Distancia y duración del tramo" className="text-sm">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Car className="h-4 w-4 text-muted-foreground" aria-hidden />
            Recorrido en carro
          </h4>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Distancia</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {persona.rutaArmada.totales.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
              </dd>
            </div>
            {ofertaCarro ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Duración base</dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">{ofertaCarro.duracion} base</dd>
              </div>
            ) : null}
            {minutosCarro !== null ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Margen</dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  +{Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(minutosCarro)}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section aria-label="Detalle de casetas SCT" className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-semibold text-foreground">Casetas en la ruta</h4>
          {ofertaCostos?.modo === 'auto'
            && typeof ofertaCostos.combustible === 'number'
            && typeof ofertaCostos.casetasEstimadas === 'number' ? (
              <div className="border-b pb-3">
                <p className="text-sm leading-relaxed text-foreground">
                  Estimación de <span className="font-medium">{ofertaCostos.linea}</span>: combustible{' '}
                  <span className="font-semibold tabular-nums">{mxn(ofertaCostos.combustible)}</span> + casetas estimadas{' '}
                  <span className="font-semibold tabular-nums">{mxn(ofertaCostos.casetasEstimadas)}</span> ={' '}
                  <span className="font-semibold tabular-nums">{mxn(ofertaCostos.costoGrupo)}</span>.
                </p>
                <p role="note" aria-label="Fuente de la estimación del auto" className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  Fuente de la estimación: <span className="font-medium text-foreground">{ofertaCostos.fuente}</span>. Ya está incluida en el precio seleccionado.
                </p>
              </div>
            ) : null}
          {disponibilidadActual?.estado === 'disponible' ? (
            <>
              {casetasRuta.length > 0 ? (
                <table className="w-full table-fixed text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-xs text-muted-foreground">
                      <th className="w-[34%] py-2 pr-2 align-bottom font-medium">Caseta</th>
                      <th className="w-[14%] px-1 py-2 text-right align-bottom font-medium">Km</th>
                      <th className="w-[28%] px-2 py-2 align-bottom font-medium">Dirección</th>
                      <th className="w-[24%] py-2 pl-2 text-right align-bottom font-medium">Tarifa auto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {casetasRuta.map((plaza) => (
                      <tr key={`${plaza.nombre}-${plaza.km}`} className="border-b border-border/70 last:border-0">
                        <td className="break-words py-2.5 pr-2 align-top text-foreground">{plaza.nombre}</td>
                        <td className="px-1 py-2.5 text-right align-top tabular-nums text-foreground">{plaza.km}</td>
                        <td className="break-words px-2 py-2.5 align-top text-foreground">{plaza.direccion}</td>
                        <td className="py-2.5 pl-2 text-right align-top font-medium tabular-nums text-foreground">
                          {plaza.costo != null ? mxn(plaza.costo) : 's/d'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totalCasetasTramo !== null ? (
                    <tfoot>
                      <tr className="border-t-2 border-border/70 bg-muted/30">
                        <td className="py-2.5 pr-2 font-semibold text-foreground" colSpan={3}>Total casetas del tramo</td>
                        <td className="py-2.5 pl-2 text-right font-semibold tabular-nums text-foreground">{mxn(totalCasetasTramo)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              ) : (
                <p className="text-sm leading-relaxed text-foreground">La SCT no reporta plazas de cobro para este tramo.</p>
              )}
              <p role="note" aria-label="Fuente oficial SCT" className="break-words text-xs leading-relaxed text-muted-foreground">
                Fuente oficial: <span className="font-medium text-foreground">{disponibilidadActual.fuente}</span>. Referencia: {disponibilidadActual.kmTotal?.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km · {disponibilidadActual.tiempoTotal}. No se suma al precio seleccionado.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">{mensajeCasetasNoDisponible(disponibilidadActual?.estado)}</p>
          )}
          {tramo.esRegreso && totalIdaVuelta !== null ? (
            <p className="text-sm font-semibold leading-relaxed text-foreground">
              Total oficial SCT de ida y vuelta: {mxn(totalIdaVuelta)}. Incluye solo tramos con resultado oficial.
            </p>
          ) : null}
          {tramo.esRegreso && totalIdaVuelta === null ? (
            <p className="text-sm leading-relaxed text-foreground">
              No hay un total oficial de ida y vuelta: falta detalle oficial en al menos un tramo.
            </p>
          ) : null}
        </section>
      </>
    ) : null}
  </div>
</div>

{buscandoEste ? (
  <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row">
    <RutaLoader className="h-28 w-28 shrink-0" />
    <div className="w-full flex-1 space-y-2 text-center sm:text-left">
      <p className="text-sm font-medium">Buscando y optimizando la ruta…</p>
      <Progress value={progreso} className="h-1.5" />
      <p className="text-xs text-muted-foreground">
        {tramo.esRegreso
          ? 'Calculando kilómetros, tiempos y costos del regreso.'
          : `Calculando kilómetros, tiempos y costos para llegar a las ${horaLlegadaAmPm ?? tramo.hasta.hora}.`}
      </p>
    </div>
  </div>
) : (
  errores[paso] ? <p role="alert" className="text-sm text-destructive">{errores[paso]}</p> : null
)}

{resultadoActual && persona && !buscandoEste ? (
  <div className="space-y-3">
    {esCarro ? null : (
```

- [x] **Step 2: Confirm that no calculation or effect changed**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git diff -U0 -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx
```

Expected: only JSX between the leg heading and non-car options branch changed. There are no edits to imports, derived values, `resolverPuntosGenericos`, `sesionRef`, `buscadosRef`, request construction, API calls, `enviar`, dialog shell/header/tabs/footer, or `ResumenRutaModal`.

- [x] **Step 3: Run the focused presentation test and verify GREEN**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx -t "presentation layout"
```

Expected: PASS with one passed test and 16 skipped tests.

- [x] **Step 4: Run the complete modal test file and verify behavior preservation**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx
```

Expected: PASS with 17 tests: the new presentation test plus all 16 existing timing, SCT, geocoding, stale-request, authorization, navigation, and submission tests.

- [x] **Step 5: Run the browser scenario and verify GREEN**

Run from `lefarma.frontend`:

```powershell
$env:PLAYWRIGHT_HTML_OPEN='never'; npx playwright test tests/viaticos-casetas.spec.ts --config=playwright.e2e.config.ts --project=chromium
```

Expected: one passed test. Stable screenshots are written for available, provider-unavailable/incomplete round-trip, zero-plaza, unsupported-destination, and invalid-response states at both sizes; every overflow and column-geometry assertion passes without fixed sleeps.

### Task 4: Run final verification and inspect the review boundary

**Files:**
- Verify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx`
- Verify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`
- Verify: `lefarma.frontend/tests/viaticos-casetas.spec.ts`

- [x] **Step 1: Run all existing Viáticos frontend tests**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos
```

Expected: exit code 0 with every selected Viáticos test passing, including calculation/reconciliation tests and all modal regression tests.

- [x] **Step 2: Run targeted ESLint on exactly the changed implementation and test files**

Run from `lefarma.frontend`:

```bash
npx eslint src/apps/viaticos/components/CalculosViajeModal.tsx src/apps/viaticos/components/CalculosViajeModal.test.tsx tests/viaticos-casetas.spec.ts --max-warnings 0
```

Expected: exit code 0 with no warnings or errors.

- [x] **Step 3: Verify TypeScript and the production frontend build**

Run from `lefarma.frontend`:

```bash
npm run build
```

Expected: `tsc && vite build` exits with code 0 and no type or bundling errors.

- [x] **Step 4: Inspect every stable screenshot and the generated layout evidence**

Inspect these files under `lefarma.frontend/test-results`:

```text
viaticos-calculos-disponible-1366x768.png
viaticos-calculos-disponible-360.png
viaticos-calculos-incompleto-1366x768.png
viaticos-calculos-incompleto-360.png
viaticos-calculos-cero-plazas-1366x768.png
viaticos-calculos-cero-plazas-360.png
viaticos-calculos-destino-no-soportado-1366x768.png
viaticos-calculos-destino-no-soportado-360.png
viaticos-calculos-respuesta-invalida-1366x768.png
viaticos-calculos-respuesta-invalida-360.png
```

Expected: desktop has requested schedule plus calculated timing on the left and distance/cost/SCT on the right; mobile is single-column; all content is expanded; primary values are 20 px semibold; table/source text remains readable; no content is clipped horizontally; the typical one-plaza desktop fixture has no vertical modal overflow; mobile reaches SCT detail and footer actions through natural vertical scrolling; every status remains explicit text.

- [x] **Step 5: Check whitespace and the final three-file scope**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git diff --check -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx lefarma.frontend/tests/viaticos-casetas.spec.ts
git diff --stat -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx lefarma.frontend/tests/viaticos-casetas.spec.ts
```

Expected: `git diff --check` prints nothing. The stat contains only these three files; confirm the actual changed-line count against the forecast and keep the two review units separate if the 400-line budget is enforced. No commit, staging, restoration, or formatting command is part of this plan.
