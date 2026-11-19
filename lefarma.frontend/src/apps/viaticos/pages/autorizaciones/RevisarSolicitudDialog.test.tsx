import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisarSolicitudDialog } from './RevisarSolicitudDialog';
import type { CalculoViaje, PropuestaRuta, Solicitud } from '../../types/solicitud.types';

const fixtures = vi.hoisted(() => {
  const tramo = (de: string, a: string) => ({
    de,
    a,
    km: 100,
    duracion: '2h',
    duracion_con_margen: '2h 12m',
    salida_fecha: '2026-11-10',
    salida_hora: '07:00',
    llegada_fecha: '2026-11-10',
    llegada_hora: '09:00',
    alcanza: true,
    casetas: [] as { nombre: string; km: number; direccion: string; costo: number | null }[],
  });

  const calculo = (de: string, a: string): CalculoViaje => ({
    generado_en: '2026-11-05T12:00:00.000Z',
    margen: 0.1,
    modo_transporte: 'solicitado',
    km_total: 200,
    horas_total: '4h 24m',
    tramos: [tramo(de, a)],
  });

  const propuesta = (): PropuestaRuta => ({
    calculo: calculo('Ruta propuesta', 'Destino propuesto'),
    opciones: [
      {
        tipo: 'vuelo',
        linea: 'Vuelo Propuesto',
        precio: 1500,
        moneda: 'MXN',
        url_compra: null,
        fuente: 'proveedor',
        fue_elegida: true,
        ruta_captura: null,
        capturas: [],
        datos: { tramo: 0 },
      },
    ],
    resumen: {
      autobus: null,
      avion: 1500,
      gasolina: null,
      casetas: null,
      hospedaje: null,
      comida: null,
      taxi: null,
      total: 1500,
    },
  });

  return { calculo, propuesta };
});

const mocks = vi.hoisted(() => ({
  detalle: vi.fn(),
  autorizar: vi.fn(),
  rechazar: vi.fn(),
}));

vi.mock('../../services/solicitudes.api', () => ({ solicitudesApi: { detalle: mocks.detalle } }));
vi.mock('../../services/aprobaciones.api', () => ({
  aprobacionesApi: { autorizar: mocks.autorizar, rechazar: mocks.rechazar },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../mis-viajes/MisViajesPage', () => ({
  VistaDetalle: ({
    pestanaInicial,
    propuesta,
    acciones,
  }: {
    pestanaInicial?: string;
    propuesta?: unknown;
    acciones?: ReactNode;
  }) => (
    <div data-testid="detalle-stub">
      {pestanaInicial === 'comparar' ? 'compara' : 'otra'}
      {propuesta ? '-con-propuesta' : ''}
      {acciones}
    </div>
  ),
}));
vi.mock('../../components/CalculosViajeModal', () => ({
  CalculosViajeModal: ({
    open,
    onPropuesta,
  }: {
    open: boolean;
    onPropuesta: (propuesta: PropuestaRuta) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onPropuesta(fixtures.propuesta())}>
        entregar propuesta
      </button>
    ) : null,}));
vi.mock('../../components/EditarCostosDialog', () => ({
  EditarCostosDialog: ({
    onGuardar,
    onOpenChange,
  }: {
    onGuardar: (propuesta: PropuestaRuta) => void;
    onOpenChange: (abierto: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onGuardar(fixtures.propuesta());
        onOpenChange(false);
      }}
    >
      guardar costos
    </button>
  ),
}));

const solicitud = (extra: Record<string, unknown> = {}): Solicitud =>
  ({
    id_solicitud: 5,
    folio: 'VIA-1-0001',
    estado: 'enviada',
    datos: { version: 'solicitud-v2', calculo: fixtures.calculo('Ruta del viajero', 'Destino original') },
    opciones: [],
    ...extra,
  }) as unknown as Solicitud;

const renderDialogo = () =>
  render(<RevisarSolicitudDialog idSolicitud={5} onClose={vi.fn()} onResuelta={vi.fn()} />);

describe('RevisarSolicitudDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.autorizar.mockResolvedValue({ data: { success: true } });
    mocks.rechazar.mockResolvedValue({ data: { success: true } });
    mocks.detalle.mockResolvedValue({ data: { success: true, data: solicitud() } });
  });

  it('abre la comparación y autoriza la ruta existente cuando no hay propuesta', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    const detalle = await screen.findByTestId('detalle-stub');
    expect(detalle).toHaveTextContent('compara');

    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));

    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledWith(5));
  });

  it('manda la propuesta al autorizar después de recalcular el viaje', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    fireEvent.click(await screen.findByRole('button', { name: 'Recalcular viaje' }));
    fireEvent.click(screen.getByText('entregar propuesta'));

    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('con-propuesta');

    await usuario.click(screen.getByRole('button', { name: 'Autorizar ruta propuesta' }));

    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledTimes(1));
    const [id, payload] = mocks.autorizar.mock.calls[0];
    expect(id).toBe(5);
    expect(payload.opciones).toHaveLength(1);
    expect(payload.opciones[0].linea).toBe('Vuelo Propuesto');
    expect(payload.calculo.tramos[0].a).toBe('Destino propuesto');
  });

  it('también manda la propuesta cuando los costos se editan', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    await usuario.click(await screen.findByRole('button', { name: 'Editar costos' }));
    fireEvent.click(screen.getByText('guardar costos'));

    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('con-propuesta');

    await usuario.click(screen.getByRole('button', { name: 'Autorizar ruta propuesta' }));
    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledTimes(1));
    expect(mocks.autorizar.mock.calls[0][1].opciones[0].linea).toBe('Vuelo Propuesto');
  });

  it('deshabilita editar costos cuando la solicitud no tiene cálculo', async () => {
    mocks.detalle.mockResolvedValue({
      data: { success: true, data: solicitud({ datos: { version: 'solicitud-v2' } }) },
    });
    renderDialogo();

    const editar = await screen.findByRole('button', { name: 'Editar costos' });
    expect(editar).toBeDisabled();
  });
});
