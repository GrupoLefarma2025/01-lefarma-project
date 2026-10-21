import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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

/** Fecha local en ISO (aaaa-mm-dd); `toISOString` es UTC y correría el día. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ahora = new Date();
const HOY = isoLocal(ahora);
const AYER = isoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1));
const EN_DIEZ_DIAS = isoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 10));

const fila: SolicitudBandeja = {
  id_solicitud: 5,
  folio: 'VIA-TEST-0005',
  id_usuario_solicitante: 9,
  nombre_solicitante: 'Persona Solicitante',
  periodo: '2026-11',
  gerencia: '',
  destino: 'Destino Uno',
  estado: 'enviada',
  total: 2000,
  // El filtro por defecto es «Hoy» por fecha de creación: la fila tiene que
  // haber nacido hoy para que el concentrado la muestre sin tocar los filtros.
  fecha_creacion: `${HOY}T10:00:00`,
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
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /Ver detalle/ }));
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
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: /aprobar la opción elegida/i }));
    expect(mocks.autorizar).toHaveBeenCalledWith(5);
  });

  it('rechazar exige comentario y devolver queda deshabilitado sin endpoint', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeDisabled();
    await usuario.type(screen.getByLabelText(/comentario de revisión/i), 'Falta justificación');
    expect(screen.getByRole('button', { name: /rechazar/i })).not.toBeDisabled();
    const devolver = screen.getByRole('button', { name: /devolver para corrección/i });
    expect(devolver).toBeDisabled();
    expect(screen.getByText(/sin endpoint compatible/i)).toBeInTheDocument();
  });

  it('entra mostrando todas las enviadas, sin recortar por fecha', async () => {
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // El filtro por defecto es "Todas": la fecha no recorta nada.
    expect(screen.getByLabelText(/periodo/i)).toHaveValue('todas');
    expect(screen.queryByTestId('rango-visible')).not.toBeInTheDocument();
  });

  it('por fecha de viaje incluye el viaje en curso y descarta el que no toca el rango', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...fila, id_solicitud: 7, fecha_salida: AYER, fecha_regreso: EN_DIEZ_DIAS },
          { ...fila, id_solicitud: 8, fecha_salida: EN_DIEZ_DIAS, fecha_regreso: EN_DIEZ_DIAS },
        ],
      },
    });
    render(<ConcentradoPage />);

    // Con "Todas" no hay recorte: aparecen las dos.
    await waitFor(() => expect(screen.getByTestId('concentrado-7')).toBeInTheDocument());
    expect(screen.getByTestId('concentrado-8')).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/periodo/i), 'hoy');
    await usuario.selectOptions(screen.getByLabelText(/buscar por/i), 'viaje');

    // El viaje del 7 está en curso hoy; el del 8 empieza en diez días.
    expect(screen.getByTestId('concentrado-7')).toBeInTheDocument();
    expect(screen.queryByTestId('concentrado-8')).not.toBeInTheDocument();
  });

  it('muestra el folio en lugar del id y genera el documento FOR-008 con las filas visibles', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // La identidad que usa la persona es el folio, no el id interno.
    expect(within(screen.getByTestId('concentrado-5')).getByText('VIA-TEST-0005')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /generar documento/i }));

    expect(screen.getByTestId('documento-toolbar')).toBeInTheDocument();
    const documento = document.querySelector('#concentrado-viaticos-print');
    expect(documento).not.toBeNull();
    expect(documento).toHaveTextContent('Concentrado de Viáticos');
    expect(documento).toHaveTextContent('Destino Uno');
    expect(documento).toHaveTextContent('Persona Solicitante');
  });

  it('el rango personalizado se aplica solo cuando hay fecha inicial y final', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    await usuario.selectOptions(screen.getByLabelText(/periodo/i), 'personalizado');
    expect(screen.getByText(/elige la fecha inicial y la final/i)).toBeInTheDocument();
    // Sin ambas fechas no se recorta nada.
    expect(screen.getByTestId('concentrado-5')).toBeInTheDocument();

    // Los inputs date se llenan con change, no tecleando: jsdom no simula sus
    // segmentos de edición.
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: HOY } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: HOY } });
    expect(screen.getByTestId('rango-visible')).toHaveTextContent('al');
    expect(screen.getByTestId('concentrado-5')).toBeInTheDocument();
  });
});
