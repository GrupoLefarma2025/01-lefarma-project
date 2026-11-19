# Required Destination Departure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require both destination departure fields before wizard advancement while preserving temporal validation, partial-draft saving, explicit-departure leg construction, and the legacy two-hour fallback.

**Architecture:** Make the existing `destinoCompleto` predicate the single advancement guard for every destination; it already feeds `Siguiente`, adding destinations, and multi-destination validation without affecting `guardarBorrador`. Keep `construirTramos` unchanged because it already prefers a complete explicit departure and otherwise applies the legacy fallback. Add focused wizard and leg-builder regression tests only.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 3, Testing Library, jest-dom, ESLint 9, Vite 7.

---

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 180-230, predominantly tests |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | One focused frontend change |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## File Map

- Modify `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.tsx`: require both departure parts in `destinoCompleto`; change the label and add the approved helper.
- Modify `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx`: replace the optional-field test and add multi-destination and partial-draft coverage.
- Modify `lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts`: add explicit next-leg/return and legacy-fallback characterization tests.
- Do not modify `calculoViaje.ts`, backend files, schemas, providers, payloads, destination layout, or unrelated wizard behavior.

### Task 0: Preserve the current working baseline

**Files:**
- Verify only; do not modify files in this task.

- [ ] **Step 1: Record existing uncommitted work before editing**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git status --short
```

Expected: the existing Viáticos backend/frontend modifications and untracked docs/tests remain present. Do not stash, restore, format, or overwrite them. During implementation, confine edits to the three files in the File Map.

### Task 1: Add wizard requirement and compatibility tests

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx:209-216`
- Modify: `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx:218`

- [ ] **Step 1: Replace the optional-departure test with empty, partial, and valid coverage**

Replace the existing test named `la salida del destino es opcional` with:

```tsx
  it('exige fecha y hora de salida del destino antes de avanzar', async () => {
    await irAlPaso(5, 'solicitado');
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    fireEvent.change(screen.getByLabelText(/-debe-fecha$/), { target: { value: FECHA_DESTINO } });
    fireEvent.change(screen.getByLabelText(/-debe-hora$/), { target: { value: '12:00' } });

    expect(siguiente()).toBeDisabled();
    expect(screen.getByText('Hora de salida del destino (obligatoria)')).toBeInTheDocument();
    expect(screen.getByText('La usamos para calcular el regreso al origen.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: FECHA_DESTINO } });
    expect(siguiente()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '18:00' } });
    expect(siguiente()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: FECHA_DESTINO } });
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '12:00' } });
    expect(siguiente()).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '18:00' } });
    expect(siguiente()).not.toBeDisabled();
  });
```

- [ ] **Step 2: Add multi-destination and partial-draft tests immediately after that test**

Insert:

```tsx
  it('exige la salida de cada destino en un viaje con varios destinos', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro destino' }));
    completarDestino();
    expect(siguiente()).not.toBeDisabled();

    fireEvent.click(screen.getByRole('tab', { name: /^1\. Toluca, México/ }));
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '' } });
    expect(siguiente()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '18:00' } });
    expect(siguiente()).not.toBeDisabled();

    fireEvent.click(screen.getByRole('tab', { name: /^2\. Toluca, México/ }));
    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: '' } });
    expect(siguiente()).toBeDisabled();
  });

  it('permite guardar un borrador aunque la salida del destino esté incompleta', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    await irAViaticos();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al paso 5: Destinos' }));
    expect(await screen.findByTestId('paso-5')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ir al paso 7: Resumen' }));
    expect(await screen.findByTestId('paso-7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    expect(mocks.crear.mock.calls[0][0].datos.destinos[0]).toMatchObject({
      saleFecha: '',
      saleHora: '',
    });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/viaticos/mis-viajes'));
  });
```

Keep the existing test named `la llegada no puede ser antes de la salida del origen ni la salida antes de la llegada` unchanged at current lines 218-236; it already covers arrival before origin, departure before arrival, both existing error messages, and a valid correction.

- [ ] **Step 3: Run only the new requirement tests and verify RED**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx -t "exige fecha y hora de salida|exige la salida de cada destino"
```

Expected: FAIL with two failed tests. The first currently allows advancement with no departure and still has the optional label; the second currently allows advancement when either destination has a partial departure. All other tests in the file are skipped.

- [ ] **Step 4: Verify draft saving remains GREEN before implementation**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx -t "permite guardar un borrador"
```

Expected: PASS with one test and the rest skipped. This is a characterization test, not a RED requirement test.

### Task 2: Characterize explicit departures and the legacy fallback

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts:1-16`
- Modify: `lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts:456`

- [ ] **Step 1: Add the leg-builder import and `Solicitud` type**

Add `construirTramos` to the value import from `./calculoViaje`, keeping the existing names:

```ts
import {
  claveHotel,
  construirCalculo,
  construirOpcionesPropuesta,
  construirTramos,
  leerCalculoDesdeDatos,
  resumenCostosRuta,
  type TramoViaje,
} from './calculoViaje';
```

Replace the existing `solicitud.types` import with:

```ts
import type { CalculoViaje, CasetaCalculada, OpcionCotizacion, Solicitud } from '../types/solicitud.types';
```

- [ ] **Step 2: Append explicit next-leg/return and legacy-fallback tests**

Append this complete block after the existing `resumenCostosRuta` describe block:

```ts
function destinoParaTramos(
  nombre: string,
  municipio: string,
  llegada: { fecha: string; hora: string },
  salida: { fecha: string; hora: string },
) {
  return {
    id: `dest-${nombre}`,
    punto: punto(nombre, municipio),
    debeEstarFecha: llegada.fecha,
    debeEstarHora: llegada.hora,
    saleFecha: salida.fecha,
    saleHora: salida.hora,
    hospedaje: {
      necesario: false,
      zona: 'actual' as const,
      fechaEntrada: '',
      fechaSalida: '',
      hotel: null,
    },
  };
}

function solicitudParaTramos(destinos: ReturnType<typeof destinoParaTramos>[]): Solicitud {
  return {
    id_solicitud: 1,
    id_usuario_solicitante: 7,
    periodo: '2026-11',
    gerencia: 'IMSS',
    estado: 'borrador',
    activo: true,
    fecha_creacion: '2026-11-01T08:00:00.000Z',
    fecha_modificacion: '2026-11-01T08:00:00.000Z',
    datos: {
      version: 'solicitud-v2',
      persona: { modo: 'mia', empleadoId: null, nombre: 'Viajero', motivo: 'Visita' },
      transporte: { modo: 'propio', compartir: false, acompanantes: [] },
      origen: {
        punto: punto('Origen', 'Guadalajara'),
        fechaSalida: '2026-11-10',
        horaSalida: '06:00',
      },
      destinos,
      retorno: {
        necesario: true,
        llegadaRequeridaFecha: '',
        llegadaRequeridaHora: '',
        destino: 'origen',
        punto: null,
      },
    },
    opciones: [],
    eventos: [],
  };
}

describe('construirTramos destination departure', () => {
  it('uses each explicit departure for the next leg and the return to origin', () => {
    const resultado = construirTramos(solicitudParaTramos([
      destinoParaTramos(
        'Centro Zapopan',
        'Zapopan',
        { fecha: '2026-11-10', hora: '10:00' },
        { fecha: '2026-11-10', hora: '16:30' },
      ),
      destinoParaTramos(
        'Centro Tlajomulco',
        'Tlajomulco',
        { fecha: '2026-11-11', hora: '09:00' },
        { fecha: '2026-11-11', hora: '15:45' },
      ),
    ]));

    expect(resultado.error).toBeNull();
    expect(resultado.tramos).toHaveLength(3);
    expect(resultado.tramos[1]).toMatchObject({
      desde: {
        fecha: '2026-11-10',
        hora: '16:30',
        nombre: 'Zapopan, Jalisco',
        explicita: true,
      },
      esRegreso: false,
    });
    expect(resultado.tramos[2]).toMatchObject({
      desde: {
        fecha: '2026-11-11',
        hora: '15:45',
        nombre: 'Tlajomulco, Jalisco',
        explicita: true,
      },
      hasta: {
        fecha: '2026-11-11',
        hora: '17:45',
        nombre: 'Regreso al origen',
      },
      esRegreso: true,
    });
  });

  it('retains the two-hour fallback for a legacy draft without departure', () => {
    const resultado = construirTramos(solicitudParaTramos([
      destinoParaTramos(
        'Centro Zapopan',
        'Zapopan',
        { fecha: '2026-11-10', hora: '23:30' },
        { fecha: '', hora: '' },
      ),
    ]));

    expect(resultado.error).toBeNull();
    expect(resultado.tramos).toHaveLength(2);
    expect(resultado.tramos[1]).toMatchObject({
      desde: {
        fecha: '2026-11-11',
        hora: '01:30',
        explicita: false,
      },
      hasta: {
        fecha: '2026-11-11',
        hora: '03:30',
        nombre: 'Regreso al origen',
      },
      esRegreso: true,
    });
  });
});
```

Do not change `construirTramos`: lines 648-657 already select the complete explicit departure before applying the two-hour fallback, and the return leg already starts at that selected departure.

- [ ] **Step 3: Run the leg-builder characterization tests and verify GREEN**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/services/calculoViaje.propuesta.test.ts -t "construirTramos destination departure"
```

Expected: PASS with two tests and the existing tests skipped. These tests lock current compatible behavior; they are intentionally not RED and require no production-service edit.

### Task 3: Require destination departure in the wizard

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.tsx:413-419`
- Modify: `lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.tsx:1109-1121`

- [ ] **Step 1: Make both departure fields mandatory in the existing advancement predicate**

Replace `destinoCompleto` and its comment with:

```tsx
  /** Un destino está listo con punto, llegada y salida explícita. */
  function destinoCompleto(d: DestinoV2): boolean {
    if (!d.punto || !d.debeEstarFecha || !d.debeEstarHora || !d.saleFecha || !d.saleHora) return false;
    const llegada = `${d.debeEstarFecha}T${d.debeEstarHora}`;
    if (origen.fechaSalida && origen.horaSalida && llegada < `${origen.fechaSalida}T${origen.horaSalida}`) return false;
    return `${d.saleFecha}T${d.saleHora}` >= llegada;
  }
```

Leave `puedeAvanzar`, `pasoValido`, `actualizarDestino`, `construirDatos`, and `guardarBorrador` unchanged. This preserves `destinos.every(destinoCompleto)`, departure-change recalculation invalidation, and unrestricted draft serialization.

- [ ] **Step 2: Replace the optional label and add the approved helper without changing the picker or layout**

Replace only the departure editor block with:

```tsx
        <div className="space-y-1">
          <Label htmlFor={`dest-${destino.id}-sale`}>Hora de salida del destino (obligatoria)</Label>
          <DateTimePicker
            id={`dest-${destino.id}-sale`}
            fecha={destino.saleFecha}
            hora={destino.saleHora}
            desde={destino.debeEstarFecha && destino.debeEstarHora ? { fecha: destino.debeEstarFecha, hora: destino.debeEstarHora } : null}
            onFecha={(f) => props.onCambiar({ saleFecha: f })}
            onHora={(h) => props.onCambiar({ saleHora: h })}
            placeholder="Elige fecha y hora de salida"
          />
          <p className="text-xs text-muted-foreground">La usamos para calcular el regreso al origen.</p>
          {salidaAntesDeLlegada ? <p role="alert" className="text-xs text-destructive">La salida no puede ser antes de la llegada al destino.</p> : null}
        </div>
```

- [ ] **Step 3: Run the focused wizard file and verify GREEN**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx
```

Expected: PASS for all 16 tests, including empty/date-only/time-only departure, departure equal to and after arrival, departure before arrival, every destination in a multi-destination trip, and partial-draft saving.

- [ ] **Step 4: Re-run both focused service tests and verify GREEN**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: PASS for all 17 tests; the explicit departures still drive the next leg and return, and only the legacy no-departure case uses arrival plus two hours.

### Task 4: Run scoped regression verification

**Files:**
- Verify the three modified files; do not change commands or add backend/schema/provider coverage.

- [ ] **Step 1: Run targeted ESLint**

Run from `lefarma.frontend`:

```bash
npx eslint src/apps/viaticos/pages/solicitud/SolicitudPage.tsx src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx src/apps/viaticos/services/calculoViaje.propuesta.test.ts --max-warnings 0
```

Expected: exit code 0 with no warnings or errors.

- [ ] **Step 2: Run all Viáticos frontend tests**

Run from `lefarma.frontend`:

```bash
npm test -- src/apps/viaticos
```

Expected: PASS for every Viáticos test file and test, with no failed suites. Do not weaken unrelated assertions to make this pass.

- [ ] **Step 3: Run the frontend production build**

Run from `lefarma.frontend`:

```bash
npm run build
```

Expected: `tsc` and `vite build` exit successfully with no TypeScript errors.

- [ ] **Step 4: Confirm the final scope and preservation of unrelated work**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git status --short
git diff --stat -- lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.tsx lefarma.frontend/src/apps/viaticos/pages/solicitud/SolicitudPage.test.tsx lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: only the three planned files contain changes from this implementation; all pre-existing uncommitted work remains. Estimated implementation diff is 180-230 changed lines. Do not commit as part of this plan.
