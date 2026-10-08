import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BandejaAprobacionesPage, { PERMISO_AUTORIZAR } from './BandejaAprobacionesPage';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const permisos = vi.hoisted(() => ({ codigos: [] as string[] }));

vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
// El hook real lee el store de auth; aqui se decide el permisoDirectamente.
vi.mock('@/hooks/usePermission', () => ({
  usePermission: ({ require: requerido }: { require?: string }) =>
    !requerido || permisos.codigos.includes(requerido),
}));

const solicitud = (over: Partial<SolicitudBandeja> = {}): SolicitudBandeja => ({
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  nombre_solicitante: 'Beto Empleado',
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  destino: 'Toluca',
  estado: 'enviada',
  total: 2110,
  fecha_creacion: '2026-10-05T12:00:00Z',
  ...over,
});

const ok = (data: unknown) => ({ data: { success: true, message: 'ok', data } });

const filas = () => screen.getAllByRole('row').slice(1);

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  permisos.codigos = [PERMISO_AUTORIZAR];
  mocks.get.mockResolvedValue(ok([solicitud()]));
});

describe('BandejaAprobacionesPage', () => {
  it('renderiza cada fila con exactamente los botones Autorizar y Ver opciones', async () => {
    render(<BandejaAprobacionesPage />);

    await waitFor(() => expect(screen.getByText('Beto Empleado')).toBeDefined());

    const [fila] = filas();
    const botones = within(fila).getAllByRole('button');
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['Autorizar', 'Ver opciones']);
  });

  it('muestra No., periodo, destino, total y estado de cada fila', async () => {
    render(<BandejaAprobacionesPage />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });

    expect(within(fila).getByText('101')).toBeDefined();
    expect(within(fila).getByText('2026-10')).toBeDefined();
    expect(within(fila).getByText('Toluca')).toBeDefined();
    expect(within(fila).getByText('Enviada')).toBeDefined();
    expect(within(fila).getByText('$2,110.00')).toBeDefined();
  });

  it('muestra — cuando el backend no trae destino', async () => {
    mocks.get.mockResolvedValue(ok([solicitud({ destino: null })]));

    render(<BandejaAprobacionesPage />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });
    expect(within(fila).getByText('—')).toBeDefined();
  });

  it('muestra — cuando el backend no conoce el total, nunca $0.00', async () => {
    mocks.get.mockResolvedValue(ok([solicitud({ total: null })]));

    render(<BandejaAprobacionesPage />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });
    // null es "no se sabe", no "costo cero".
    expect(within(fila).getByText('—')).toBeDefined();
    expect(within(fila).queryByText('$0.00')).toBeNull();
  });

  it('renderiza el nombre del solicitante tal cual lo resuelve el directorio', async () => {
    // El backend ya aplica su propio fallback "Usuario #<id>": no se maquilla.
    mocks.get.mockResolvedValue(ok([solicitud({ nombre_solicitante: 'Usuario #7' })]));

    render(<BandejaAprobacionesPage />);

    await waitFor(() => expect(screen.getByText('Usuario #7')).toBeDefined());
  });

  it('no renderiza Autorizar sin el permiso viaticos.autorizar', async () => {
    permisos.codigos = [];

    render(<BandejaAprobacionesPage />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });
    expect(within(fila).queryByRole('button', { name: 'Autorizar' })).toBeNull();
    expect(within(fila).getByRole('button', { name: 'Ver opciones' })).toBeDefined();
  });

  it('autorizar cambia el estado de la fila sin recargar la bandeja', async () => {
    mocks.post.mockResolvedValue({ data: { success: true, message: 'Solicitud autorizada.', data: null } });

    render(<BandejaAprobacionesPage />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });
    fireEvent.click(within(fila).getByRole('button', { name: 'Autorizar' }));

    await waitFor(() => expect(within(filas()[0]).getByText('Autorizada')).toBeDefined());
    expect(mocks.post).toHaveBeenCalledWith('/viaticos/solicitudes/101/autorizar');
    // Solo la carga inicial: la fila se parchea en local.
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('filtra por periodo en la consulta a la bandeja', async () => {
    mocks.get.mockResolvedValue(ok([solicitud({ id_solicitud: 202, periodo: '2026-11' })]));

    render(<BandejaAprobacionesPage />);

    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '2026-11' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith('/viaticos/solicitudes?periodo=2026-11')
    );
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it('filtra por estado y gerencia', async () => {
    render(<BandejaAprobacionesPage />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'autorizada' } });
    fireEvent.change(screen.getByLabelText('Gerencia'), { target: { value: 'Gerencia Norte' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith(
        '/viaticos/solicitudes?estado=autorizada&gerencia=Gerencia+Norte'
      )
    );
  });

  it('explica la bandeja vacía sin filtros', async () => {
    mocks.get.mockResolvedValue(ok([]));

    render(<BandejaAprobacionesPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/No hay solicitudes en la bandeja/)
      ).toBeDefined()
    );
  });

  it('explica la bandeja vacía por filtros y muestra el error con reintento', async () => {
    mocks.get.mockResolvedValue(ok([]));

    render(<BandejaAprobacionesPage />);

    await waitFor(() => expect(screen.getByText(/No hay solicitudes en la bandeja/)).toBeDefined());

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '2099-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() =>
      expect(screen.getByText(/No hay solicitudes que coincidan con los filtros/)).toBeDefined()
    );

    mocks.get.mockRejectedValueOnce(new Error('Fallo de red'));
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Fallo de red')).toBeDefined();
  });

  it('usa el callback onVerOpciones cuando T14 lo entrega', async () => {
    const onVerOpciones = vi.fn();
    render(<BandejaAprobacionesPage onVerOpciones={onVerOpciones} />);

    const [fila] = await waitFor(() => {
      expect(filas()).toHaveLength(1);
      return filas();
    });
    fireEvent.click(within(fila).getByRole('button', { name: 'Ver opciones' }));

    expect(onVerOpciones).toHaveBeenCalledWith(expect.objectContaining({ id_solicitud: 101 }));
  });
});