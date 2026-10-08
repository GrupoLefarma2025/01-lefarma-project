import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DetalleSolicitudModal } from './DetalleSolicitudModal';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import type { Solicitud, SolicitudOpcion } from '../../types/solicitud.types';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get, post: vi.fn() } }));

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
  linea: 'Aeroméxico',
  precio: 1000,
  moneda: 'MXN',
  url_compra: 'https://ejemplo.mx/volar',
  fuente: 'cotizacion.agent',
  fue_elegida: false,
  ruta_captura: null,
  ...over,
});

/** 2 elegidas (1000 + 600) y 3 descartadas (5000, 7000, 9000). */
const CINCO_OPCIONES: SolicitudOpcion[] = [
  opcion({ id_opcion: 1, linea: 'Aeroméxico', precio: 1000, fue_elegida: true, ruta_captura: '/caps/1.png' }),
  opcion({ id_opcion: 2, tipo: 'hotel', linea: 'Hotel Camino Real', precio: 600, fue_elegida: true }),
  opcion({ id_opcion: 3, linea: 'Volaris', precio: 5000 }),
  opcion({ id_opcion: 4, linea: 'Aeroméxico Express', precio: 7000, ruta_captura: '/caps/4.png' }),
  opcion({ id_opcion: 5, linea: 'Viva', precio: 9000 }),
];

const detalle = (opciones: SolicitudOpcion[]): Solicitud => ({
  id_solicitud: 101,
  id_usuario_solicitante: 7,
  periodo: '2026-10',
  gerencia: 'Gerencia Norte',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-10-05T12:00:00Z',
  fecha_modificacion: '2026-10-05T12:00:00Z',
  datos: { destino: 'Toluca', total: 1600 },
  opciones,
  eventos: [],
});

const ok = (data: unknown) => ({ data: { success: true, message: 'ok', data } });

const renderModal = (props: Partial<Parameters<typeof DetalleSolicitudModal>[0]> = {}) =>
  render(
    <DetalleSolicitudModal solicitud={BANDEJA} abierta onCerrar={vi.fn()} {...props} />
  );

beforeEach(() => {
  mocks.get.mockReset();
  mocks.get.mockResolvedValue(ok(detalle(CINCO_OPCIONES)));
  // jsdom no implementa createObjectURL/revokeObjectURL.
  (URL as unknown as Record<string, unknown>).createObjectURL =
    vi.fn(() => 'blob:detalle-captura');
  (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
});

describe('DetalleSolicitudModal', () => {
  it('renderiza las 5 opciones que se ofrecieron, no solo las elegidas', async () => {
    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    for (const o of CINCO_OPCIONES) {
      expect(screen.getByTestId(`opcion-${o.id_opcion}`)).toBeDefined();
    }
    expect(screen.getAllByTestId(/^opcion-/)).toHaveLength(5);
    expect(mocks.get).toHaveBeenCalledWith('/viaticos/solicitudes/101');
  });

  it('bajo el encabezado "Opciones no elegidas (3)" solo aparecen las 3 descartadas', async () => {
    renderModal();

    const encabezado = await screen.findByRole('heading', { name: 'Opciones no elegidas (3)' });
    const seccion = encabezado.closest('section');
    expect(seccion).not.toBeNull();

    const descartadas = within(seccion as HTMLElement).getAllByTestId(/^opcion-/);
    expect(descartadas.map((el) => el.getAttribute('data-testid'))).toEqual([
      'opcion-3',
      'opcion-4',
      'opcion-5',
    ]);
    // Las elegidas quedan fuera de esa sección.
    expect(within(seccion as HTMLElement).queryByTestId('opcion-1')).toBeNull();

    const elegidas = within(
      (screen.getByRole('heading', { name: 'Opciones elegidas (2)' }).closest('section') as HTMLElement)
    ).getAllByTestId(/^opcion-/);
    expect(elegidas).toHaveLength(2);
  });

  it('el total NO incluye las opciones descartadas', async () => {
    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    // 1000 + 600 = 1600. Las descartadas suman 21,000 y el total de las cinco
    // seria 22,600: ninguna de esas dos cifras puede ser el total mostrado.
    expect(screen.getByTestId('total-elegidas').textContent).toBe('$1,600.00');
    expect(screen.getByTestId('total-elegidas').textContent).not.toContain('22,600');
    expect(screen.queryByText('$21,000.00')).toBeNull();
    expect(screen.queryByText('$22,600.00')).toBeNull();
  });

  it('el total no se inventa cuando ninguna elegida trae precio', async () => {
    mocks.get.mockResolvedValue(
      ok(
        detalle([
          opcion({ id_opcion: 1, precio: null, fuente: 'estimado', fue_elegida: true }),
          opcion({ id_opcion: 2, precio: null, fuente: 'estimado', fue_elegida: true }),
          opcion({ id_opcion: 3, precio: 5000 }),
        ])
      )
    );

    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    expect(screen.getByTestId('total-elegidas').textContent).toBe(
      'Estimado: ninguna de las 2 opciones elegidas trae precio de proveedor.'
    );
  });

  it('una opción sin captura muestra placeholder y nunca una imagen rota', async () => {
    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    // La opción 2 no trae ruta_captura.
    const sinCaptura = screen.getByTestId('opcion-2');
    expect(within(sinCaptura).getByText('Sin captura')).toBeDefined();
    expect(within(sinCaptura).queryByRole('img')).toBeNull();
    // La que sí trae, muestra miniatura con alt y abre la imagen grande.
    const miniatura = within(screen.getByTestId('opcion-1')).getByRole('img');
    expect(miniatura.getAttribute('src')).toBe('/caps/1.png');
    expect(miniatura.closest('a')?.getAttribute('href')).toBe('/caps/1.png');
  });

  it('muestra la fuente distinguiendo estimado de cotizado', async () => {
    mocks.get.mockResolvedValue(
      ok(
        detalle([
          opcion({ id_opcion: 1, precio: 1000, fue_elegida: true, fuente: 'cotizacion.agent' }),
          opcion({ id_opcion: 2, precio: null, fuente: 'estimado', ruta_captura: null }),
        ])
      )
    );

    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    expect(within(screen.getByTestId('opcion-1')).getByText('Cotizado')).toBeDefined();
    const estimada = screen.getByTestId('opcion-2');
    expect(within(estimada).getByText('Estimado')).toBeDefined();
    // La fuente cruda nunca se oculta, ni estimada ni cotizada.
    expect(within(estimada).getByText('estimado')).toBeDefined();
    expect(within(screen.getByTestId('opcion-1')).getByText('cotizacion.agent')).toBeDefined();
  });

  it('cada opción expone su link de compra y explica la que no lo trae', async () => {
    mocks.get.mockResolvedValue(
      ok(
        detalle([
          opcion({ id_opcion: 1, url_compra: 'https://ejemplo.mx/comprar/1', fue_elegida: true }),
          opcion({ id_opcion: 2, url_compra: null, fue_elegida: true }),
        ])
      )
    );

    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    expect(
      within(screen.getByTestId('opcion-1')).getByRole('link', { name: /Comprar Aeroméxico/ }).getAttribute('href')
    ).toBe('https://ejemplo.mx/comprar/1');
    expect(within(screen.getByTestId('opcion-2')).getByRole('button', { name: /Comprar sin URL/ })).toBeDefined();
  });

  it('funciona sin fila de bandeja: el solicitante ve los datos del detalle', async () => {
    // El solicitante no tiene fila de bandeja: solo el id, y todo lo demás sale
    // del detalle que le devuelve su propio GET.
    renderModal({ solicitud: { id_solicitud: 101 } });

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    expect(mocks.get).toHaveBeenCalledWith('/viaticos/solicitudes/101');
    // Sin nombre de la bandeja cae al id que devuelve el propio detalle.
    expect(screen.getByText('Usuario #7')).toBeDefined();
    // Destino sale de datos_json, igual que lo lee el backend para la bandeja.
    expect(screen.getByText('Toluca')).toBeDefined();
    expect(screen.getByText('2026-10')).toBeDefined();
    expect(screen.getByText('Enviada')).toBeDefined();
    expect(screen.getAllByTestId(/^opcion-/)).toHaveLength(5);
  });

  it('muestra el estado de carga y no consulta nada mientras está cerrado', async () => {
    renderModal({ abierta: false });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('muestra el error del backend con reintento', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Solo el dueño puede ver esta solicitud'));

    renderModal();

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Solo el dueño puede ver esta solicitud')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
  });

  it('pide la captura por el endpoint autenticado, no por <img src> directo', async () => {
    mocks.get.mockImplementation((url: string) =>
      url.startsWith('/viaticos/capturas/')
        ? Promise.resolve({ data: new Blob(['png'], { type: 'image/png' }) })
        : Promise.resolve(
            ok(detalle([opcion({ id_opcion: 1, ruta_captura: '/api/media/capturas-viaticos/1.png' })]))
          )
    );

    renderModal();

    await waitFor(() => expect(screen.getByTestId('total-elegidas')).toBeDefined());
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('/viaticos/capturas/1.png', { responseType: 'blob' }),
    );
    const miniatura = await within(screen.getByTestId('opcion-1')).findByRole('img');
    expect(miniatura.getAttribute('src')).toBe('blob:detalle-captura');
  });

  it('explica una solicitud sin opciones en vez de dejar el modal vacío', async () => {
    mocks.get.mockResolvedValue(ok(detalle([])));

    renderModal();

    await waitFor(() => expect(screen.getByTestId('detalle-sin-opciones')).toBeDefined());
    expect(screen.getByTestId('total-elegidas').textContent).toBe(
      'Sin total: la solicitud no tiene opciones elegidas.'
    );
    expect(screen.queryByRole('heading', { name: /Opciones no elegidas/ })).toBeNull();
  });

  it('explica cuando ninguna opción quedó elegida sin sumar las descartadas', async () => {
    mocks.get.mockResolvedValue(
      ok(detalle([opcion({ id_opcion: 3, precio: 5000 }), opcion({ id_opcion: 5, precio: 9000 })]))
    );

    renderModal();

    await waitFor(() => expect(screen.getByText('Opciones no elegidas (2)')).toBeDefined());
    expect(screen.getByTestId('total-elegidas').textContent).toBe(
      'Sin total: la solicitud no tiene opciones elegidas.'
    );
    expect(screen.getByText(/Ninguna opción quedó elegida/)).toBeDefined();
    expect(screen.queryByText('$14,000.00')).toBeNull();
  });
});
