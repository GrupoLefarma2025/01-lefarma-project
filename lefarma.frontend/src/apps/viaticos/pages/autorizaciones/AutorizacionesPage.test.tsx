import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutorizacionesPage } from './AutorizacionesPage';
import type { Solicitud } from '../../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  porAutorizar: vi.fn(),
  detalle: vi.fn(),
  autorizar: vi.fn(),
  rechazar: vi.fn(),
}));

vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: {
    porAutorizar: mocks.porAutorizar,
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

    expect(mocks.autorizar).toHaveBeenCalledWith(5);
    await waitFor(() => expect(mocks.porAutorizar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('viaje-5')).not.toBeInTheDocument());
  });

  it('rechazar exige el motivo antes de llamar al servidor', async () => {
    const usuario = userEvent.setup();
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-5')).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: /Revisar la solicitud VIA-TEST-0005/ }));
    await waitFor(() => expect(screen.getByTestId('revision-autorizacion')).toBeInTheDocument());

    const rechazar = screen.getByRole('button', { name: /^Rechazar$/ });
    expect(rechazar).toBeDisabled();
    await usuario.type(screen.getByLabelText(/motivo del rechazo/i), 'Falta la justificación');
    expect(rechazar).not.toBeDisabled();
    await usuario.click(rechazar);

    expect(mocks.rechazar).toHaveBeenCalledWith(5, 'Falta la justificación');
  });

  it('avisa en pantalla cuando el servidor no deja cargar la cola', async () => {
    mocks.porAutorizar.mockRejectedValue(new Error('sin red'));
    render(<AutorizacionesPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
