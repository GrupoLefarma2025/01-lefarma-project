import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutorizacionesPage } from './AutorizacionesPage';
import type { Solicitud } from '../../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  porAutorizar: vi.fn(),
  autorizadas: vi.fn(),
  detalle: vi.fn(),
  autorizar: vi.fn(),
  rechazar: vi.fn(),
}));

vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: {
    porAutorizar: mocks.porAutorizar,
    autorizadas: mocks.autorizadas,
    detalle: mocks.detalle,
    misSolicitudes: vi.fn(),
    eliminar: vi.fn(),
  },
}));
vi.mock('../../services/aprobaciones.api', () => ({
  aprobacionesApi: {
    autorizar: mocks.autorizar,
    rechazar: mocks.rechazar,
    bandeja: vi.fn(),
    registrarAjuste: vi.fn(),
  },
}));
vi.mock('../../services/evidencias.api', () => ({
  evidenciasApi: {
    obtener: vi.fn(() => new Promise(() => {})),
    generar: vi.fn(),
    buscar: vi.fn(),
  },
}));
vi.mock('../mis-viajes/MisViajesPage', () => ({ VistaDetalle: () => <div>DETALLE_MARK</div> }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: number; nombre: string } | null }) => unknown) =>
    selector({ user: { id: 7, nombre: 'Persona Actual' } }),
}));

const solicitud = (id: number, extra: Record<string, unknown> = {}): Solicitud => ({
  id_solicitud: id,
  id_usuario_solicitante: 9,
  periodo: '2026-11',
  gerencia: '',
  estado: 'enviada',
  activo: true,
  persona_solicitante: 'Persona Solicitante',
  persona_viajera: 'Persona Solicitante',
  fecha_creacion: '2026-11-05T12:00:00',
  fecha_modificacion: '2026-11-05T12:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Solicitante' },
    destinos: [{ punto: { nombre: 'Destino Uno' } }],
    calculo: {
      generado_en: '2026-11-05T12:00:00.000Z',
      modo_transporte: 'solicitado',
      km_total: 120,
      horas_total: '2h',
      tramos: [],
    },
  },
  opciones: [],
  eventos: [],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.porAutorizar.mockResolvedValue({
    data: { success: true, data: [solicitud(5, { folio: 'VIA-TEST-0005' })] },
  });
  mocks.autorizadas.mockResolvedValue({ data: { success: true, data: [] } });
  mocks.detalle.mockResolvedValue({ data: { success: true, data: solicitud(5, { folio: 'VIA-TEST-0005' }) } });
  mocks.autorizar.mockResolvedValue({ data: { success: true, message: 'Solicitud autorizada.' } });
  mocks.rechazar.mockResolvedValue({ data: { success: true, message: 'Solicitud rechazada.' } });
});

describe('AutorizacionesPage', () => {
  it('lista las solicitudes enviadas por cualquier persona con su botón de revisar', async () => {
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());

    expect(screen.getByText('Solicitudes por autorizar')).toBeInTheDocument();
    expect(screen.getByText('Pendientes: 1')).toBeInTheDocument();
    expect(screen.getByText(/Persona Solicitante/)).toBeInTheDocument();
    expect(mocks.porAutorizar).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }),
    ).toBeInTheDocument();
  });

  it('autorizar saca la solicitud de la cola y recarga la lista', async () => {
    const usuario = userEvent.setup();
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }));
    await waitFor(() => expect(screen.getByTestId('revision-autorizacion')).toBeInTheDocument());
    expect(screen.getByText('DETALLE_MARK')).toBeInTheDocument();

    mocks.porAutorizar.mockResolvedValue({ data: { success: true, data: [] } });
    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));
    await usuario.click(
      screen.getByRole('button', { name: 'Autorizar y enviar al concentrado' }),
    );

    expect(mocks.autorizar).toHaveBeenCalledWith(5);
    await waitFor(() => expect(mocks.porAutorizar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('viaje-5')).not.toBeInTheDocument());
  });

  it('abre la revisión con los datos de la fila sin esperar a que cargue el detalle', async () => {
    const usuario = userEvent.setup();
    mocks.detalle.mockReturnValue(new Promise(() => {}));
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());

    await usuario.click(screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }));

    expect(await screen.findByTestId('revision-autorizacion')).toBeInTheDocument();
    expect(screen.getByText('DETALLE_MARK')).toBeInTheDocument();
    expect(screen.queryByText(/Cargando detalle/)).not.toBeInTheDocument();
  });

  it('pide el motivo en un modal y no llama al servidor hasta confirmarlo', async () => {
    const usuario = userEvent.setup();
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }));
    await waitFor(() => expect(screen.getByTestId('revision-autorizacion')).toBeInTheDocument());

    expect(screen.queryByTestId('rechazar-solicitud')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /^Rechazar$/ }));
    expect(await screen.findByTestId('rechazar-solicitud')).toBeInTheDocument();
    const motivo = screen.getByLabelText(/motivo del rechazo/i);
    const confirmar = screen.getByRole('button', { name: 'Rechazar solicitud' });
    expect(confirmar).toBeDisabled();
    expect(mocks.rechazar).not.toHaveBeenCalled();

    await usuario.type(motivo, 'Falta la justificación');
    expect(confirmar).not.toBeDisabled();
    await usuario.click(confirmar);

    expect(mocks.rechazar).toHaveBeenCalledWith(5, 'Falta la justificación');
  });

  it('avisa en pantalla cuando el servidor no deja cargar la cola', async () => {
    mocks.porAutorizar.mockRejectedValue(new Error('sin red'));
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('pasa la solicitud a la pestaña Autorizados en cuanto se autoriza', async () => {
    const usuario = userEvent.setup();
    render(<AutorizacionesPage hoy={new Date(2026, 10, 15, 12)} />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Autorizados (0)' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }));
    await waitFor(() => expect(screen.getByTestId('revision-autorizacion')).toBeInTheDocument());

    mocks.porAutorizar.mockResolvedValue({ data: { success: true, data: [] } });
    mocks.autorizadas.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(5, {
            folio: 'VIA-TEST-0005',
            estado: 'autorizada',
            fecha_modificacion: '2026-11-15T10:00:00',
          }),
        ],
      },
    });

    await usuario.click(screen.getByRole('button', { name: /^Autorizar$/ }));
    await usuario.click(screen.getByRole('button', { name: 'Autorizar y enviar al concentrado' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Autorizados (1)' })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Por autorizar (0)' })).toBeInTheDocument();
  });

  it('muestra solo lo autorizado dentro del rango del mes y lo abre en solo lectura', async () => {
    const usuario = userEvent.setup();
    mocks.autorizadas.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(7, {
            folio: 'VIA-TEST-0007',
            estado: 'autorizada',
            fecha_modificacion: '2026-11-10T09:00:00',
          }),
          solicitud(8, {
            folio: 'VIA-TEST-0008',
            estado: 'autorizada',
            fecha_modificacion: '2026-10-31T09:00:00',
          }),
        ],
      },
    });
    render(<AutorizacionesPage hoy={new Date(2026, 10, 15, 12)} />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());

    await usuario.click(screen.getByRole('tab', { name: 'Autorizados (1)' }));

    expect(await screen.findByTestId('viaje-7')).toBeInTheDocument();
    expect(screen.queryByTestId('viaje-8')).not.toBeInTheDocument();
    expect(screen.getByText('Autorizados: 1')).toBeInTheDocument();
    expect(
      screen.getByText(/Mostrando por fecha de autorización: 2026-11-01 al 2026-11-15/),
    ).toBeInTheDocument();

    await usuario.click(
      screen.getByRole('button', { name: /Ver el detalle de la solicitud VIA-TEST-0007/ }),
    );

    expect(await screen.findByTestId('detalle-autorizada')).toBeInTheDocument();
    expect(screen.getByText('DETALLE_MARK')).toBeInTheDocument();
    expect(screen.getByText(/no se puede editar ni recalcular/)).toBeInTheDocument();
  });
});
