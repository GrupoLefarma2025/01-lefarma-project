import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EditorAjustes from './EditorAjustes';
import { PERMISO_AJUSTAR } from '../../types/aprobaciones.types';
import type { Solicitud, SolicitudEvento, SolicitudOpcion } from '../../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const permisos = vi.hoisted(() => ({ codigos: [] as string[] }));

vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: ({ require: requerido }: { require?: string }) =>
    !requerido || permisos.codigos.includes(requerido),
}));

const ok = (data: unknown) => ({ data: { success: true, message: 'ok', data } });
const postOk = (message = 'Ajuste registrado.') => ({
  data: { success: true, message, data: null },
});

const opcion = (over: Partial<SolicitudOpcion> = {}): SolicitudOpcion => ({
  id_opcion: 1,
  tipo: 'vuelo',
  linea: 'Viva Aerobus CDMX-GDL',
  precio: 1200,
  moneda: 'MXN',
  url_compra: 'https://ejemplo.test/viva',
  fuente: 'Viva',
  fue_elegida: true,
  ruta_captura: null,
  ...over,
});

const eventoAjuste = (over: Partial<SolicitudEvento> = {}): SolicitudEvento => ({
  id_evento: 900,
  tipo: 'ajuste_aplicado',
  id_usuario: 42,
  fecha_creacion: '2026-10-05T12:00:00Z',
  payload: {
    campo: 'vuelo_elegido',
    valor_anterior: 'Viva Aerobus CDMX-GDL · $1,200.00',
    valor_nuevo: 'Volaris CDMX-GDL · $1,450.00',
    motivo: 'Volaris sale antes y cabe en viáticos',
    id_opcion: 2,
  },
  ...over,
});

const solicitud = (over: Partial<Solicitud> = {}): Solicitud => ({
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  estado: 'autorizada',
  activo: true,
  fecha_creacion: '2026-10-01T09:00:00Z',
  fecha_modificacion: '2026-10-05T12:00:00Z',
  datos: null,
  opciones: [
    opcion(),
    opcion({ id_opcion: 2, linea: 'Volaris CDMX-GDL', precio: 1450, fue_elegida: false }),
    opcion({ id_opcion: 3, tipo: 'hotel', linea: 'Hotelrys Guadalajara', precio: 2600, fue_elegida: true }),
  ],
  eventos: [],
  ...over,
});

const cuerpoPost = () => mocks.post.mock.calls.at(-1)![1] as Record<string, unknown>;
const dialogo = () => screen.getByRole('dialog');
const guardar = () => within(dialogo()).getByRole('button', { name: /Registrar ajuste/ });
const motivo = () => within(dialogo()).getByLabelText(/Motivo/);

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  permisos.codigos = [PERMISO_AJUSTAR];
  mocks.get.mockResolvedValue(ok(solicitud()));
  mocks.post.mockResolvedValue(postOk());
});

const abrirYEsperar = async (s: Solicitud) => {
  mocks.get.mockResolvedValue(ok(s));
  render(<EditorAjustes solicitud={solicitud()} />);
  await waitFor(() => expect(screen.queryByTestId('editor-cargando')).toBeNull());
};

describe('EditorAjustes', () => {
  it('muestra el total de partidas y el vuelo elegido', async () => {
    await abrirYEsperar(solicitud());

    expect(screen.getByText('Partidas (2)')).toBeDefined();
    expect(within(screen.getByTestId('partida-1')).getByText('Viva Aerobus CDMX-GDL')).toBeDefined();
    expect(screen.getAllByText('Volaris CDMX-GDL').length).toBeGreaterThan(0);
  });

  it('lista las alternativas de vuelo con precio y fuente para comparar', async () => {
    await abrirYEsperar(solicitud());

    const alternativa = within(screen.getByTestId('alternativa-2'));
    expect(alternativa.getByText('Volaris CDMX-GDL')).toBeDefined();
    expect(alternativa.getByText('$1,450.00')).toBeDefined();
    expect(alternativa.getByText('Viva')).toBeDefined();
  });

  // Requisito 4: el cambio manda los dos valores, y no pueden ser el mismo.
  it('cambiar de vuelo envía valor_anterior y valor_nuevo distintos', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: /Cambiar el vuelo a Volaris/ }));
    fireEvent.change(motivo(), { target: { value: 'Volaris sale antes' } });
    fireEvent.click(guardar());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post.mock.calls[0][0]).toBe('/viaticos/solicitudes/101/ajustes');

    const cuerpo = cuerpoPost();
    expect(cuerpo).toMatchObject({
      campo: 'vuelo_elegido',
      id_opcion: 2,
      valor_anterior: 'Viva Aerobus CDMX-GDL · $1,200.00',
      valor_nuevo: 'Volaris CDMX-GDL · $1,450.00',
      motivo: 'Volaris sale antes',
    });
    expect(cuerpo.valor_anterior).not.toBe(cuerpo.valor_nuevo);
  });

  it('editar el precio manda el precio anterior y el nuevo', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: /Editar el precio de Viva/ }));
    fireEvent.change(within(dialogo()).getByLabelText('Nuevo precio'), {
      target: { value: '1500' },
    });
    fireEvent.change(motivo(), { target: { value: 'Subió la tarifa' } });
    fireEvent.click(guardar());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(cuerpoPost()).toMatchObject({
      campo: 'precio_partida',
      id_opcion: 1,
      valor_anterior: '1200',
      valor_nuevo: '1500',
      motivo: 'Subió la tarifa',
    });
  });

  it('quitar una partida manda el valor anterior y la marca de quitada', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: /Quitar Viva Aerobus/ }));
    fireEvent.change(motivo(), { target: { value: 'El vuelo no se necesita' } });
    fireEvent.click(guardar());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(cuerpoPost()).toMatchObject({
      campo: 'partida_quitada',
      id_opcion: 1,
      valor_anterior: 'Viva Aerobus CDMX-GDL · $1,200.00',
      valor_nuevo: '(se quitó)',
      motivo: 'El vuelo no se necesita',
    });
  });

  it('agregar una partida manda id_opcion 0 y el concepto con su monto', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: 'Agregar una partida' }));
    fireEvent.change(within(dialogo()).getByLabelText('Concepto'), {
      target: { value: 'Cena de trabajo' },
    });
    fireEvent.change(within(dialogo()).getByLabelText('Monto'), {
      target: { value: '850' },
    });
    fireEvent.change(motivo(), { target: { value: 'Cena con el equipo' } });
    fireEvent.click(guardar());

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const cuerpo = cuerpoPost();
    expect(cuerpo).toMatchObject({
      campo: 'partida_agregada',
      id_opcion: 0,
      motivo: 'Cena con el equipo',
    });
    // No habia partida previa: el valor anterior va vacio explicito.
    expect(cuerpo.valor_anterior).toBe('');
    expect(cuerpo.valor_nuevo).toContain('Cena de trabajo');
    expect(cuerpo.valor_nuevo).toContain('850.00');
  });

  // Requisito 3: sin motivo no hay nada que confirmar.
  it('no confirma con el motivo vacío ni con espacios', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: /Editar el precio de Viva/ }));
    fireEvent.change(within(dialogo()).getByLabelText('Nuevo precio'), {
      target: { value: '1500' },
    });

    expect(guardar().hasAttribute('disabled')).toBe(true);

    fireEvent.change(motivo(), { target: { value: '   ' } });
    expect(guardar().hasAttribute('disabled')).toBe(true);

    // Ni siquiera un click forzado debe sacar el request.
    fireEvent.click(guardar());
    expect(mocks.post).not.toHaveBeenCalled();

    fireEvent.change(motivo(), { target: { value: 'Subió la tarifa' } });
    expect(guardar().hasAttribute('disabled')).toBe(false);
  });

  it('agregar partida exige concepto y monto antes de habilitar Guardar', async () => {
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: 'Agregar una partida' }));
    fireEvent.change(motivo(), { target: { value: 'Cena con el equipo' } });

    expect(guardar().hasAttribute('disabled')).toBe(true);

    // Concepto sin monto.
    fireEvent.change(within(dialogo()).getByLabelText('Concepto'), {
      target: { value: 'Cena' },
    });
    expect(guardar().hasAttribute('disabled')).toBe(true);

    // Monto no numérico.
    fireEvent.change(within(dialogo()).getByLabelText('Monto'), {
      target: { value: 'mucho' },
    });
    expect(guardar().hasAttribute('disabled')).toBe(true);

    fireEvent.change(within(dialogo()).getByLabelText('Monto'), { target: { value: '850' } });
    expect(guardar().hasAttribute('disabled')).toBe(false);

    // Concepto vacío vuelve a bloquear.
    fireEvent.change(within(dialogo()).getByLabelText('Concepto'), { target: { value: '  ' } });
    expect(guardar().hasAttribute('disabled')).toBe(true);
    fireEvent.click(guardar());
    expect(mocks.post).not.toHaveBeenCalled();
  });

  // Requisito 5: la bitácora muestra quién, cuándo, qué cambió y el motivo.
  it('la línea de tiempo muestra los ajustes del historial', async () => {
    await abrirYEsperar(
      solicitud({
        estado: 'autorizada_con_ajustes',
        eventos: [eventoAjuste()],
      }),
    );

    expect(screen.getByText('Ajustes registrados (1)')).toBeDefined();
    const fila = screen.getByTestId('ajuste-900');
    expect(within(fila).getByText('Vuelo elegido')).toBeDefined();
    expect(within(fila).getByText('Viva Aerobus CDMX-GDL · $1,200.00')).toBeDefined();
    expect(within(fila).getByText('Volaris CDMX-GDL · $1,450.00')).toBeDefined();
    expect(within(fila).getByText('Volaris sale antes y cabe en viáticos')).toBeDefined();
    expect(within(fila).getByText(/Usuario #42/)).toBeDefined();
  });

  it('degrada sin inventar valores cuando el ajuste no registró campo ni motivo', async () => {
    await abrirYEsperar(
      solicitud({ estado: 'autorizada_con_ajustes', eventos: [eventoAjuste({ payload: null })] }),
    );

    const fila = screen.getByTestId('ajuste-900');
    expect(within(fila).getByText('Ajuste aplicado')).toBeDefined();
    expect(within(fila).getByText(/No se registró el detalle de este ajuste/)).toBeDefined();
    expect(within(fila).queryByText('Antes:')).toBeNull();
  });

  it('explica que no hay ajustes cuando el historial está vacío', async () => {
    await abrirYEsperar(solicitud());
    expect(screen.getByTestId('historial-vacio')).toBeDefined();
  });

  it('sin viaticos.ajustar los controles no aparecen', async () => {
    permisos.codigos = [];

    await abrirYEsperar(solicitud({ estado: 'autorizada_con_ajustes' }));

    expect(screen.queryByRole('button', { name: 'Agregar una partida' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar el precio de/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Quitar Viva/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Cambiar el vuelo a/ })).toBeNull();
    expect(screen.getByText(/No tienes el permiso viaticos.ajustar/)).toBeDefined();
  });

  it('no ofrece ajustes si la solicitud no está autorizada', async () => {
    await abrirYEsperar(solicitud({ estado: 'enviada' }));

    expect(screen.getByText(/Los ajustes solo aplican a solicitudes autorizadas/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Agregar una partida' })).toBeNull();
  });

  it('muestra el estado de carga y el error con reintento', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Fallo de red'));
    render(<EditorAjustes solicitud={solicitud()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Fallo de red')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Partidas (2)')).toBeDefined());
  });

  it('muestra el error del backend al guardar y no cierra el diálogo', async () => {
    mocks.post.mockResolvedValue({
      data: { success: false, message: 'La solicitud cambió de estado.', data: null },
    });
    await abrirYEsperar(solicitud());

    fireEvent.click(screen.getByRole('button', { name: /Quitar Viva Aerobus/ }));
    fireEvent.change(motivo(), { target: { value: 'Ya no aplica' } });
    fireEvent.click(guardar());

    await waitFor(() => expect(screen.getByText('La solicitud cambió de estado.')).toBeDefined());
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('no hace nada cuando no hay solicitud', () => {
    const { container } = render(<EditorAjustes solicitud={null} />);
    expect(container.innerHTML).toBe('');
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
