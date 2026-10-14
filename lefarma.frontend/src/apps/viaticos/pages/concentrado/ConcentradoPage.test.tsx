import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConcentradoPage } from './ConcentradoPage';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';

const flags = vi.hoisted(() => ({ verTodos: true, autorizar: true }));
const mocks = vi.hoisted(() => ({ bandeja: vi.fn(), detalle: vi.fn(), autorizar: vi.fn(), rechazar: vi.fn() }));
vi.mock('../../services/aprobaciones.api', () => ({
  aprobacionesApi: { bandeja: mocks.bandeja, autorizar: mocks.autorizar, rechazar: mocks.rechazar, registrarAjuste: vi.fn() },
}));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: { detalle: mocks.detalle, crear: vi.fn(), guardarOpciones: vi.fn(), misSolicitudes: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: ({ require }: { require?: string }) => {
    if (require === 'viaticos.ver_todos') return flags.verTodos;
    if (require === 'viaticos.autorizar') return flags.autorizar;
    return false;
  },
}));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const fila: SolicitudBandeja = {
  id_solicitud: 5,
  id_usuario_solicitante: 9,
  nombre_solicitante: 'Persona Solicitante',
  periodo: '2026-11',
  gerencia: '',
  destino: 'Destino Uno',
  estado: 'enviada',
  total: 2000,
  fecha_creacion: '2026-11-04T10:00:00',
};

const detalleOk = {
  data: {
    success: true,
    data: {
      id_solicitud: 5,
      id_usuario_solicitante: 9,
      periodo: '2026-11',
      gerencia: '',
      estado: 'enviada',
      activo: true,
      fecha_creacion: '2026-11-04T10:00:00',
      fecha_modificacion: '2026-11-04T11:00:00',
      datos: {},
      opciones: [
        { id_opcion: 1, tipo: 'avion', linea: 'Vuelo Elegido', precio: 2000, moneda: 'MXN', url_compra: 'https://x', fuente: 'x', fue_elegida: true, ruta_captura: null },
        { id_opcion: 2, tipo: 'avion', linea: 'Vuelo Alterno', precio: 3500, moneda: 'MXN', url_compra: 'https://y', fuente: 'y', fue_elegida: false, ruta_captura: null },
      ],
      eventos: [],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  flags.verTodos = true;
  flags.autorizar = true;
  mocks.bandeja.mockResolvedValue({ data: { success: true, data: [fila] } });
  mocks.detalle.mockResolvedValue(detalleOk);
  mocks.autorizar.mockResolvedValue({ data: { success: true, message: 'Autorizada', data: {} } });
});

describe('ConcentradoPage', () => {
  it('muestra la opción elegida Y las alternativas originales con sus precios', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /revisar/i }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    const revision = screen.getByTestId('revision-solicitud');
    expect(revision).toHaveTextContent('Vuelo Elegido');
    expect(revision).toHaveTextContent('Vuelo Alterno');
    expect(revision).toHaveTextContent(/3,500/);
    // La revisión autoriza la opción elegida, no un reemplazo.
    expect(within(revision).getByText('Elegida por la persona viajera')).toBeInTheDocument();
    expect(within(revision).getByText('Alternativa descartada')).toBeInTheDocument();
  });

  it('aprobar autoriza la solicitud elegida sin reemplazar la opción', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /revisar/i }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: /aprobar la opción elegida/i }));
    expect(mocks.autorizar).toHaveBeenCalledWith(5);
  });

  it('rechazar exige comentario y devolver queda deshabilitado sin endpoint', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /revisar/i }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeDisabled();
    await usuario.type(screen.getByLabelText(/comentario de revisión/i), 'Falta justificación');
    expect(screen.getByRole('button', { name: /rechazar/i })).not.toBeDisabled();
    const devolver = screen.getByRole('button', { name: /devolver para corrección/i });
    expect(devolver).toBeDisabled();
    expect(screen.getByText(/sin endpoint compatible/i)).toBeInTheDocument();
  });

  it('sin ver_todos declara el recorte a solicitudes propias', async () => {
    flags.verTodos = false;
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByText(/solo ves tus propias solicitudes/i)).toBeInTheDocument());
  });
});
