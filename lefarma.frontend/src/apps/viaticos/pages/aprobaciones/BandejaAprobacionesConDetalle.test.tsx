import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BandejaAprobacionesConDetalle } from './BandejaAprobacionesConDetalle';
import { PERMISO_AJUSTAR } from '../../types/aprobaciones.types';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import type { Solicitud, SolicitudOpcion } from '../../types/solicitud.types';

/**
 * Cableado de la ruta `/viaticos/aprobaciones`: lo que se monta es el host con
 * el visor real, no la bandeja con el Dialog placeholder. Estos tests fijan las
 * dos consecuencias de ese cableado:
 *
 * 1. "Ver opciones" abre el visor que agrupa las no elegidas, no el placeholder.
 * 2. El editor de ajustes se monta dentro del detalle y solo con
 *    `viaticos.ajustar`.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const permisos = vi.hoisted(() => ({ codigos: [] as string[] }));

vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: ({ require: requerido }: { require?: string }) =>
    !requerido || permisos.codigos.includes(requerido),
}));

const BANDEJA: SolicitudBandeja = {
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  nombre_solicitante: 'Beto Empleado',
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  destino: 'Toluca',
  estado: 'enviada',
  total: 2110,
  fecha_creacion: '2026-10-05T12:00:00Z',
};

const opcion = (over: Partial<SolicitudOpcion>): SolicitudOpcion => ({
  id_opcion: 1,
  tipo: 'vuelo',
  linea: 'Viva Aerobus CDMX-GDL',
  precio: 1200,
  moneda: 'MXN',
  url_compra: 'https://ejemplo.test/viva',
  fuente: 'Viva',
  fue_elegida: false,
  ruta_captura: null,
  ...over,
});

/** 2 elegidas (1200 + 2600) y 2 descartadas (1450, 1800). */
const OPCIONES: SolicitudOpcion[] = [
  opcion({ id_opcion: 1, linea: 'Viva Aerobus CDMX-GDL', precio: 1200, fue_elegida: true }),
  opcion({ id_opcion: 2, tipo: 'hotel', linea: 'Hotelrys Guadalajara', precio: 2600, fue_elegida: true }),
  opcion({ id_opcion: 3, linea: 'Volaris CDMX-GDL', precio: 1450 }),
  opcion({ id_opcion: 4, linea: 'Aeromexico CDMX-GDL', precio: 1800 }),
];

const detalle = (estado = 'enviada'): Solicitud => ({
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  estado,
  activo: true,
  fecha_creacion: '2026-10-01T09:00:00Z',
  fecha_modificacion: '2026-10-05T12:00:00Z',
  datos: { destino: 'Toluca' },
  opciones: OPCIONES,
  eventos: [],
});

const ok = (data: unknown) => ({ data: { success: true, message: 'ok', data } });

/** El GET depende de la URL: bandeja (listado) vs detalle (por id). */
const getPorUrl = (solicitud: Solicitud) =>
  mocks.get.mockImplementation((url: string) =>
    Promise.resolve(
      // La bandeja es la collection; el detalle va por id.
      /\/viaticos\/solicitudes\/?(\?|$)/.test(url) ? ok([BANDEJA]) : ok(solicitud),
    ),
  );

const verOpciones = async () => {
  const [fila] = await waitFor(() => {
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(1);
    return filas;
  });
  fireEvent.click(within(fila).getByRole('button', { name: 'Ver opciones' }));
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  permisos.codigos = [];
  getPorUrl(detalle());
});

describe('BandejaAprobacionesConDetalle', () => {
  it('"Ver opciones" abre el visor real con las no elegidas agrupadas, no el placeholder', async () => {
    render(<BandejaAprobacionesConDetalle />);

    await verOpciones();

    // El modal real: titulo del visor y sus dos secciones.
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Opciones de la solicitud 101')).toBeDefined();
    expect(within(dialogo).getByTestId('total-elegidas').textContent).toBe('$3,800.00');

    const encabezado = within(dialogo).getByRole('heading', { name: 'Opciones no elegidas (2)' });
    const seccion = encabezado.closest('section') as HTMLElement;
    expect(within(seccion).getAllByTestId(/^opcion-/).map((el) => el.getAttribute('data-testid'))).toEqual([
      'opcion-3',
      'opcion-4',
    ]);
    // Las elegidas quedan en su propia sección, fuera de la de descartadas.
    expect(within(seccion).queryByTestId('opcion-1')).toBeNull();
    expect(
      within(
        within(dialogo).getByRole('heading', { name: 'Opciones elegidas (2)' }).closest('section') as HTMLElement,
      ).getAllByTestId(/^opcion-/),
    ).toHaveLength(2);
  });

  it('con viaticos.ajustar el editor de ajustes se monta dentro del detalle', async () => {
    permisos.codigos = [PERMISO_AJUSTAR];
    getPorUrl(detalle('autorizada'));

    render(<BandejaAprobacionesConDetalle />);

    await verOpciones();

    const dialogo = await screen.findByRole('dialog');
    // El editor es el que ofrece las cuatro acciones de ajuste.
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Agregar una partida' })).toBeDefined(),
    );
    // Un boton por partida elegida (vuelo y hospedaje).
    expect(within(dialogo).getAllByRole('button', { name: /Editar el precio de/ })).toHaveLength(2);
    expect(within(dialogo).getByRole('button', { name: /Cambiar el vuelo a Volaris/ })).toBeDefined();
  });

  it('sin viaticos.ajustar el editor de ajustes no se monta', async () => {
    permisos.codigos = [];
    getPorUrl(detalle('autorizada'));

    render(<BandejaAprobacionesConDetalle />);

    await verOpciones();

    // El visor normal sigue completo; lo que no aparece es el editor.
    const dialogo = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialogo).getByTestId('total-elegidas')).toBeDefined());
    expect(screen.queryByRole('button', { name: 'Agregar una partida' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar el precio de/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Ajustes de la solicitud/ })).toBeNull();
  });
});

/**
 * Cableado del concentrado FOR-008, que hasta ahora era un componente huerfano:
 * se abre desde la bandeja y solo imprime las solicitudes autorizadas. El
 * concentrado consulta su propia bandeja (autorizadas del periodo), asi que el
 * mock de la collection devuelve este universo mixto.
 */
const BANDEJA_CONCENTRADO: SolicitudBandeja[] = [
  {
    ...BANDEJA,
    id_solicitud: 201,
    nombre_solicitante: 'Ana Autorizada',
    estado: 'autorizada',
    total: 1234.5,
    fecha: '05/10/2026 AL 09/10/2026',
    origen: 'CDMX',
    autobus: 600,
    avion: null,
    gasolina: null,
    casetas: null,
    hospedaje: null,
    comida: 450,
    taxi: 184.5,
  },
  { ...BANDEJA, id_solicitud: 202, nombre_solicitante: 'Beto Ajustes', estado: 'autorizada_con_ajustes', total: 500 },
  { ...BANDEJA, id_solicitud: 203, nombre_solicitante: 'Caro Enviada', estado: 'enviada', total: 999 },
];

/** La collection alimenta tanto la lista como el concentrado; el detalle va por id. */
const getConBandeja = (bandeja: SolicitudBandeja[]) =>
  mocks.get.mockImplementation((url: string) =>
    Promise.resolve(
      /\/viaticos\/solicitudes\/?(\?|$)/.test(url) ? ok(bandeja) : ok(detalle()),
    ),
  );

const abrirConcentrado = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Imprimir concentrado/ }));
  return screen.findByRole('dialog', { name: 'Concentrado de viáticos' });
};

/** La tabla de datos del concentrado, no la de la bandeja ni el encabezado. */
const tablaConcentrado = (): HTMLElement | null =>
  document.querySelector('[aria-label="Concentrado de viáticos autorizados"]');

describe('BandejaAprobacionesConDetalle — concentrado FOR-008', () => {
  it('abre el concentrado desde la bandeja y solo imprime las solicitudes autorizadas', async () => {
    getConBandeja(BANDEJA_CONCENTRADO);
    render(<BandejaAprobacionesConDetalle />);

    await abrirConcentrado();

    await waitFor(() => expect(tablaConcentrado()).not.toBeNull());
    const tabla = tablaConcentrado()!;
    const cuerpo = tabla.querySelector('tbody')!;
    expect(within(cuerpo).getAllByRole('row')).toHaveLength(2);
    expect(within(cuerpo).getByText('Ana Autorizada')).toBeDefined();
    expect(within(cuerpo).getByText('Beto Ajustes')).toBeDefined();
    // La enviada vive en la lista, pero no entra al concentrado.
    expect(tabla).not.toHaveTextContent('Caro Enviada');
  });

  it('mapea el desglose real del backend; un concepto null queda "—" y nunca "$0.00"', async () => {
    getConBandeja(BANDEJA_CONCENTRADO);
    render(<BandejaAprobacionesConDetalle />);

    await abrirConcentrado();

    await waitFor(() => expect(tablaConcentrado()).not.toBeNull());
    const tabla = tablaConcentrado()!;
    const filas = within(tabla.querySelector('tbody')!).getAllByRole('row');

    // Columnas: No., Solicitante, Fecha, Origen, Destino | 8 conceptos (13 hojas).
    const primera = within(filas[0]).getAllByRole('cell');
    expect(primera).toHaveLength(13);
    // El encabezado del FOR-008 que manda el servidor se imprime, no "—".
    expect(primera[2]).toHaveTextContent('05/10/2026 AL 09/10/2026');
    expect(primera[3]).toHaveTextContent('CDMX');
    // El desglose real por concepto, tal cual llega del servidor.
    expect(primera[5]).toHaveTextContent('$600.00'); // Autobus
    expect(primera[6]).toHaveTextContent('—'); // Avion null: celda vacia
    expect(primera[7]).toHaveTextContent('—'); // Gasolina null
    expect(primera[8]).toHaveTextContent('—'); // Casetas null
    expect(primera[9]).toHaveTextContent('—'); // Hospedaje null
    expect(primera[10]).toHaveTextContent('$450.00'); // Comida
    expect(primera[11]).toHaveTextContent('$184.50'); // Taxi
    expect(primera[12]).toHaveTextContent('$1,234.50'); // Total del viaje

    // Un concepto null es celda vacia: cero dinero inventado.
    expect(tabla).not.toHaveTextContent('$0.00');
    expect(tabla).toHaveTextContent('—');

    const totales = within(tabla.querySelector('tfoot tr')!).getAllByRole('cell');
    expect(totales[8]).toHaveTextContent('$1,734.50'); // 1,234.50 + 500.00
  });

  it('sin autorizadas en el periodo lo dice y no imprime una tabla vacía', async () => {
    getConBandeja([{ ...BANDEJA, estado: 'enviada' }]);
    render(<BandejaAprobacionesConDetalle />);

    await abrirConcentrado();

    const vacio = await screen.findByTestId('concentrado-vacio');
    expect(vacio).toHaveTextContent(/No hay solicitudes autorizadas en el periodo/);
    expect(tablaConcentrado()).toBeNull();
  });

  it('si falla la carga del concentrado muestra el error en vez de una tabla vacía', async () => {
    mocks.get.mockImplementation((url: string) =>
      /\/viaticos\/solicitudes\/?(\?|$)/.test(url)
        ? Promise.reject(new Error('boom-concentrado'))
        : Promise.resolve(ok(detalle())),
    );
    render(<BandejaAprobacionesConDetalle />);

    const dialogo = await abrirConcentrado();

    expect(await within(dialogo).findByText('boom-concentrado')).toBeDefined();
    expect(tablaConcentrado()).toBeNull();
  });
});