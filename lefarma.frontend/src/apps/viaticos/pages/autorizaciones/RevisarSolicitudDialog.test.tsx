import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
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
  guardarPropuesta: vi.fn(),
}));

vi.mock('../../services/solicitudes.api', () => ({ solicitudesApi: { detalle: mocks.detalle } }));
vi.mock('../../services/aprobaciones.api', () => ({
  aprobacionesApi: {
    autorizar: mocks.autorizar,
    rechazar: mocks.rechazar,
    guardarPropuesta: mocks.guardarPropuesta,
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../mis-viajes/MisViajesPage', () => ({
  VistaDetalle: ({
    pestanaInicial,
    versiones,
    acciones,
  }: {
    pestanaInicial?: string;
    versiones?: { numero: number }[];
    acciones?: ReactNode;
  }) => (
    <div data-testid="detalle-stub">
      {pestanaInicial === 'comparar' ? 'compara' : 'otra'}
      {versiones && versiones.length > 0 ? `-versiones-${versiones[versiones.length - 1].numero}` : ''}
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
    mocks.guardarPropuesta.mockResolvedValue({
      data: { success: true, data: { numero: 2, creado_en: '2026-11-26T12:00:00.000Z' } },
    });
    mocks.detalle.mockResolvedValue({ data: { success: true, data: solicitud() } });
  });

  it('abre la comparación y autoriza la ruta existente cuando no hay propuesta', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    const detalle = await screen.findByTestId('detalle-stub');
    expect(detalle).toHaveTextContent('compara');
    expect(detalle).toHaveTextContent('versiones-1');

    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));

    const confirmacion = screen.getByTestId('confirmar-autorizacion');
    expect(confirmacion).toHaveTextContent('¿Autorizar la solicitud VIA-1-0001?');
    expect(confirmacion).toHaveTextContent('Sin importe capturado: Autobús, Avión');
    expect(confirmacion).toHaveTextContent('0 conceptos elegidos');
    expect(mocks.autorizar).not.toHaveBeenCalled();

    await usuario.click(
      screen.getByRole('button', { name: 'Autorizar y enviar al concentrado' }),
    );

    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledWith(5));
  });

  it('manda la propuesta al autorizar después de recalcular el viaje', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    fireEvent.click(await screen.findByRole('button', { name: 'Recalcular viaje' }));
    fireEvent.click(screen.getByText('entregar propuesta'));

    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('versiones-2');

    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));
    const confirmacion = screen.getByTestId('confirmar-autorizacion');
    expect(confirmacion).toHaveTextContent('$1,500.00');
    expect(confirmacion).toHaveTextContent('1 concepto elegido');
    expect(confirmacion).toHaveTextContent('Vuelo Propuesto');
    await usuario.click(
      screen.getByRole('button', { name: 'Autorizar y enviar al concentrado' }),
    );

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

    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('versiones-2');

    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));
    await usuario.click(
      screen.getByRole('button', { name: 'Autorizar y enviar al concentrado' }),
    );
    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledTimes(1));
    expect(mocks.autorizar.mock.calls[0][1].opciones[0].linea).toBe('Vuelo Propuesto');
  });

  it('numera cada recálculo como propuesta nueva y la guarda en el historial', async () => {
    renderDialogo();

    fireEvent.click(await screen.findByRole('button', { name: 'Recalcular viaje' }));
    fireEvent.click(screen.getByText('entregar propuesta'));
    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('versiones-2');

    fireEvent.click(screen.getByRole('button', { name: 'Recalcular viaje' }));
    fireEvent.click(screen.getByText('entregar propuesta'));
    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('versiones-3');

    await waitFor(() => expect(mocks.guardarPropuesta).toHaveBeenCalledTimes(2));
    expect(mocks.guardarPropuesta.mock.calls[0][0]).toBe(5);
    expect(mocks.guardarPropuesta.mock.calls[0][1].origen).toBe('recalculo');
    expect(mocks.guardarPropuesta.mock.calls[0][1].resumen.avion).toBe(1500);
    expect(mocks.guardarPropuesta.mock.calls[1][1].resumen.total).toBe(1500);
  });

  it('deshabilita editar costos cuando la solicitud no tiene cálculo', async () => {
    mocks.detalle.mockResolvedValue({
      data: { success: true, data: solicitud({ datos: { version: 'solicitud-v2' } }) },
    });
    renderDialogo();

    const editar = await screen.findByRole('button', { name: 'Editar costos' });
    expect(editar).toBeDisabled();
  });

  it('pinta el detalle de la fila sin pasar por la pantalla de carga', () => {
    mocks.detalle.mockReturnValue(new Promise(() => {}));
    render(
      <RevisarSolicitudDialog
        idSolicitud={5}
        solicitudInicial={solicitud()}
        onClose={vi.fn()}
        onResuelta={vi.fn()}
      />,
    );

    expect(screen.getByTestId('detalle-stub')).toHaveTextContent('compara');
    expect(screen.getByText(/VIA-1-0001/)).toBeInTheDocument();
    expect(screen.queryByText(/Cargando detalle/)).not.toBeInTheDocument();
  });

  it('pide el motivo en un modal aparte al pulsar Rechazar y lo envía al confirmar', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    await screen.findByTestId('detalle-stub');
    expect(screen.queryByTestId('rechazar-solicitud')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/motivo del rechazo/i)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /^Rechazar$/ }));

    const dialogo = await screen.findByTestId('rechazar-solicitud');
    expect(dialogo).toHaveTextContent('¿Rechazar la solicitud VIA-1-0001?');
    const motivo = screen.getByLabelText(/motivo del rechazo/i);
    expect(motivo).toHaveFocus();
    const confirmar = screen.getByRole('button', { name: 'Rechazar solicitud' });
    expect(confirmar).toBeDisabled();
    expect(mocks.rechazar).not.toHaveBeenCalled();

    await usuario.type(motivo, 'Falta la justificación');
    expect(confirmar).not.toBeDisabled();
    await usuario.click(confirmar);

    await waitFor(() =>
      expect(mocks.rechazar).toHaveBeenCalledWith(5, 'Falta la justificación'),
    );
  });

  it('cierra el modal de rechazo sin llamar al servidor al cancelar', async () => {
    const usuario = userEvent.setup();
    renderDialogo();

    await screen.findByTestId('detalle-stub');
    await usuario.click(screen.getByRole('button', { name: /^Rechazar$/ }));
    await usuario.type(screen.getByLabelText(/motivo del rechazo/i), 'Motivo a medias');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByTestId('rechazar-solicitud')).not.toBeInTheDocument(),
    );
    expect(mocks.rechazar).not.toHaveBeenCalled();
  });

  it('avisa que el rechazo está en curso y no deja repetirlo', async () => {
    const usuario = userEvent.setup();
    const onResuelta = vi.fn();
    mocks.rechazar.mockReturnValue(new Promise(() => {}));
    render(<RevisarSolicitudDialog idSolicitud={5} onClose={vi.fn()} onResuelta={onResuelta} />);

    await screen.findByTestId('detalle-stub');
    await usuario.click(screen.getByRole('button', { name: /^Rechazar$/ }));
    await usuario.type(screen.getByLabelText(/motivo del rechazo/i), 'Falta la firma');
    await usuario.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));

    const enCurso = await screen.findByRole('button', { name: 'Rechazando…' });
    expect(enCurso).toBeDisabled();
    expect(screen.getByLabelText(/motivo del rechazo/i)).toBeDisabled();

    expect(mocks.rechazar).toHaveBeenCalledTimes(1);
    expect(onResuelta).not.toHaveBeenCalled();
  });

  it('vuelve a pedir el motivo al cambiar de solicitud', async () => {
    const usuario = userEvent.setup();
    const { rerender } = renderDialogo();

    await screen.findByTestId('detalle-stub');
    await usuario.click(screen.getByRole('button', { name: /^Rechazar$/ }));
    await usuario.type(screen.getByLabelText(/motivo del rechazo/i), 'Motivo anterior');

    mocks.detalle.mockResolvedValue({
      data: { success: true, data: solicitud({ id_solicitud: 6, folio: 'VIA-1-0002' }) },
    });
    rerender(
      <RevisarSolicitudDialog
        idSolicitud={6}
        solicitudInicial={solicitud({ id_solicitud: 6, folio: 'VIA-1-0002' })}
        onClose={vi.fn()}
        onResuelta={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('rechazar-solicitud')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rechazar$/ })).not.toBeDisabled();
    await waitFor(() => expect(screen.getByText(/VIA-1-0002/)).toBeInTheDocument());
  });

  it('mantiene el detalle de la fila y no avisa si el refresco falla', async () => {
    mocks.detalle.mockRejectedValue(new Error('sin red'));
    render(
      <RevisarSolicitudDialog
        idSolicitud={5}
        solicitudInicial={solicitud()}
        onClose={vi.fn()}
        onResuelta={vi.fn()}
      />,
    );

    expect(screen.getByTestId('detalle-stub')).toBeInTheDocument();
    await waitFor(() => expect(mocks.detalle).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('detalle-stub')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
