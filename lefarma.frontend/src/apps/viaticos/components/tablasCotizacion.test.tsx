import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { TablaOpciones } from './TablaOpciones';
import { TablaHoteles } from './TablaHoteles';
import type { CostosRutaHotel, CostosRutaOferta } from '../types/costosRuta.types';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: api.get, post: vi.fn() } }));

beforeEach(() => {
  api.get.mockReset();
  api.get.mockResolvedValue({ data: new Blob(['png'], { type: 'image/png' }) });
  // jsdom no implementa createObjectURL/revokeObjectURL.
  (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:captura-tabla');
  (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
});

const compra = (url: string) => ({
  url,
  sitio: 'volaris.com',
  accion: 'comprar',
  objetivo: 'vuelo',
  fecha: '2026-11-10',
});

const oferta = (over: Partial<CostosRutaOferta> = {}): CostosRutaOferta => ({
  id: 'p1-t1-avion',
  modo: 'avion',
  linea: 'Volaris',
  servicio: 'VL',
  persona: 'Ana',
  tramo: 1,
  de: 'CDMX',
  a: 'GDL',
  salidaTxt: '10/11 06:05',
  llegadaTxt: '10/11 07:35',
  duracion: '1h 30m',
  puertaAPuertaH: 1.5,
  precioTxt: '$2450 MXN /persona',
  porPersona: true,
  costoGrupo: 2450,
  costoPorPersona: 2450,
  aTiempo: true,
  llegaTarde: false,
  minutosTarde: 0,
  noTomable: false,
  badge: '',
  nota: '',
  fuente: 'volaris.com',
  estimado: false,
  comprar: compra('https://www.volaris.com/vuelos/cdmx-gdl'),
  ...over,
});

const hotel = (over: Partial<CostosRutaHotel> = {}): CostosRutaHotel => ({
  lugar: 'Base Norte',
  ciudad: 'Guadalajara',
  checkIn: '2026-11-10',
  checkOut: '2026-11-12',
  noches: 2,
  habitaciones: 1,
  motivo: 'pernocte 2 noche(s) × 1 hab · tarifa tabulador ~$600/noche',
  fuente: 'seed tabulador SHCP',
  link: 'https://www.booking.com/searchresults.es.html?ss=Guadalajara',
  ...over,
});

/** Localiza la fila por su celda de transportista: los botones y enlaces repiten el nombre. */
const fila = (transportista: string) => {
  const celda = screen.getByText(transportista, { selector: 'div' });
  return celda.closest('tr') as HTMLElement;
};

describe('TablaOpciones', () => {
  it('distingue visualmente un estimado de una cotizacion real', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'real', linea: 'Volaris', estimado: false, fuente: 'volaris.com' }),
          oferta({ id: 'est', linea: 'Vuelo estimado', estimado: true, fuente: 'estimado fase 1 (sin proveedor)' }),
        ]}
      />,
    );

    const real = fila('Volaris');
    const est = fila('Vuelo estimado');
    // La cotizacion real muestra su fuente tal cual y el badge "Cotizado".
    expect(within(real).getByText('Cotizado')).toBeInTheDocument();
    expect(within(real).getByText('volaris.com')).toBeInTheDocument();

    // El estimado se badgea distinto y su texto de fuente dice que no hay proveedor.
    expect(within(est).getByText('Estimado')).toBeInTheDocument();
    expect(within(est).getByText(/sin proveedor de precios/i)).toBeInTheDocument();
    expect(within(est).queryByText('Cotizado')).not.toBeInTheDocument();

    // La fuente cruda del backend nunca se oculta, estimada o no.
    expect(within(est).getByText(/estimado fase 1/)).toBeInTheDocument();
  });

  it('da un <a href> real a cada fila que trae URL y thumbnail cuando hay captura', async () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'a', linea: 'Volaris', capturas: ['https://ejemplo.test/cap-a.png'] }),
          oferta({ id: 'b', linea: 'Viva Aerobus', rutaCaptura: '/api/media/capturas-viaticos/b.png' }),
        ]}
      />,
    );

    // La captura interna llega por fetch autenticado + object URL (no por <img src> directo).
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(4));
    const enlaces = screen.getAllByRole('link');
    // 2 de compra + 2 de captura.
    expect(enlaces).toHaveLength(4);
    for (const enlace of enlaces) {
      expect(enlace.getAttribute('href')).toBeTruthy();
      expect(enlace.getAttribute('target')).toBe('_blank');
      expect(enlace.getAttribute('rel')).toBe('noreferrer');
    }

    expect(api.get).toHaveBeenCalledWith('/viaticos/capturas/b.png', { responseType: 'blob' });
    // La externa se pinta directo; la interna, por el object URL autenticado.
    expect(fila('Volaris').querySelector('img')?.getAttribute('src')).toBe('https://ejemplo.test/cap-a.png');
    expect(fila('Viva Aerobus').querySelector('img')?.getAttribute('src')).toBe('blob:captura-tabla');
  });

  it('una captura que falla muestra error, nunca una imagen rota', async () => {
    api.get.mockRejectedValue(new Error('403'));

    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'b', linea: 'Viva Aerobus', rutaCaptura: '/api/media/capturas-viaticos/b.png' }),
        ]}
      />,
    );

    expect(await within(fila('Viva Aerobus')).findByRole('alert')).toHaveTextContent(
      'No se pudo cargar la captura.',
    );
    expect(fila('Viva Aerobus').querySelector('img')).toBeNull();
  });

  it('deshabilita el boton de compra y explica el motivo cuando la opcion no trae URL', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[oferta({ id: 'sin-url', linea: 'ETN', comprar: compra('') })]}
      />,
    );

    const boton = screen.getByRole('button', { name: /comprar sin url/i });
    expect(boton).toBeDisabled();
    // Nunca un enlace roto ni un href vacio.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // El motivo queda disponible como tooltip accesible del boton deshabilitado.
    expect(screen.getByText(/no trae URL de compra/i)).toBeInTheDocument();
  });

  it('muestra placeholder de captura, no una imagen rota, cuando no hay ruta_captura', () => {
    render(<TablaOpciones titulo="Tramo 1" ofertas={[oferta({ id: 'sin-cap', linea: 'ETN' })]} />);

    expect(screen.getByText('Sin captura')).toBeInTheDocument();
    expect(fila('ETN').querySelector('img')).toBeNull();
  });

  it('expone un boton Elegir por fila y resalta la elegida', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[oferta({ id: 'a', linea: 'Volaris' }), oferta({ id: 'b', linea: 'Viva' })]}
        opcionElegidaId="b"
        onElegir={() => undefined}
      />,
    );

    const botones = screen.getAllByRole('button', { name: /^Elegir /i });
    expect(botones).toHaveLength(2);
    expect(within(fila('Viva')).getByRole('button', { name: /^Elegir /i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(fila('Volaris')).getByRole('button', { name: /^Elegir /i })).toHaveAttribute('aria-pressed', 'false');  });
});

describe('TablaHoteles', () => {
  it('lista cada hotel con link de reservacion y sin presentarlo como cotizacion real', () => {
    render(<TablaHoteles hoteles={[hotel(), hotel({ lugar: 'Hotel Centro', link: 'https://ejemplo.test/hotel' })]} />);

    const enlaces = screen.getAllByRole('link');
    expect(enlaces).toHaveLength(2);
    for (const enlace of enlaces) expect(enlace.getAttribute('href')).toBeTruthy();

    const filaHotel = fila('Hotel Centro');
    expect(within(filaHotel).getByText('Estimado')).toBeInTheDocument();
    expect(within(filaHotel).getByText(/sin proveedor de precios/i)).toBeInTheDocument();
    expect(within(filaHotel).getByText('seed tabulador SHCP')).toBeInTheDocument();
  });

  it('deshabilita Reservar con explicacion cuando el hotel no trae link', () => {
    render(<TablaHoteles hoteles={[hotel({ lugar: 'Hotel Sin Link', link: '' })]} />);

    expect(screen.getByRole('button', { name: /reservar sin link/i })).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/no trae link de reservaci/i)).toBeInTheDocument();
  });
});
