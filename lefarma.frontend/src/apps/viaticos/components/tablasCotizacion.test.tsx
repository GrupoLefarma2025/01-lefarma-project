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
  it('no muestra la columna Fuente, quita "precio del grupo" y pinta el total como badge', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'real', linea: 'Volaris', estimado: false, fuente: 'volaris.com' }),
          oferta({
            id: 'grupo',
            linea: 'Renta SUV',
            modo: 'renta',
            estimado: true,
            fuente: 'seed renta',
            porPersona: false,
            precioTxt: '$1967–$2203 MXN total',
          }),
        ]}
      />,
    );

    // La columna Fuente ya no existe en la tabla de opciones de transporte.
    expect(screen.queryByRole('columnheader', { name: 'Fuente' })).not.toBeInTheDocument();
    expect(screen.queryByText('volaris.com')).not.toBeInTheDocument();
    expect(screen.queryByText('seed renta')).not.toBeInTheDocument();
    // El total del renglón va solo en el badge: sin la leyenda redundante.
    expect(screen.queryByText(/precio del grupo/i)).not.toBeInTheDocument();
    expect(within(fila('Renta SUV')).getByText('$1967–$2203 MXN total')).toBeInTheDocument();
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

  it('muestra el modo como badge propio: bus, avion, taxi y transporte público', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'bus', linea: 'ETN', modo: 'bus' }),
          oferta({ id: 'avion', linea: 'Volaris', modo: 'avion' }),
          oferta({ id: 'taxi', linea: 'Uber', modo: 'uber' }),
          oferta({ id: 'publico', linea: 'Transporte público (Camión urbano)', modo: 'publico' }),
          // Cálculos guardados antes del cambio de nombre.
          oferta({ id: 'legacy', linea: 'Transporte público (Metro)', modo: 'metro' }),
        ]}
      />,
    );

    expect(within(fila('ETN')).getByText('Bus')).toBeInTheDocument();
    expect(within(fila('Volaris')).getByText('Avión')).toBeInTheDocument();
    // Uber es taxi para el viajero: mismo badge.
    expect(within(fila('Uber')).getByText('Taxi')).toBeInTheDocument();
    // El camión urbano no es metro: el modo es transporte público.
    const publico = fila('Transporte público (Camión urbano)');
    expect(within(publico).getByText('Público')).toBeInTheDocument();
    expect(within(publico).queryByText('metro')).not.toBeInTheDocument();
    expect(within(fila('Transporte público (Metro)')).getByText('Público')).toBeInTheDocument();
  });

  it('explica el tiempo total: viaje + estar antes + taxi a la terminal', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'bus', linea: 'ETN', modo: 'bus', duracion: '10h 43m', minutosAntes: 30, minutosTaxi: 20 }),
          oferta({
            id: 'avion',
            linea: 'Volaris',
            modo: 'avion',
            duracion: '3h 38m',
            minutosAntes: 120,
            minutosDespues: 30,
            minutosTaxi: 40,
          }),
        ]}
      />,
    );

    // La columna declara qué suma el total.
    expect(screen.getByRole('button', { name: /qué incluye el tiempo total/i })).toBeInTheDocument();

    // Bus: 10h 13m de viaje + 30 min antes + 20 min de taxi = 11h 03m.
    const etn = fila('ETN');
    expect(within(etn).getByText('11h 03m')).toBeInTheDocument();
    // El desglose vive en una mini tabla concepto → minutos, sin frases largas.
    expect(within(etn).getByRole('table')).toBeInTheDocument();
    expect(within(etn).getByText('Viaje')).toBeInTheDocument();
    expect(within(etn).getByText('10 h 13 min')).toBeInTheDocument();
    expect(within(etn).getByText('En terminal')).toBeInTheDocument();
    expect(within(etn).getByText('30 min')).toBeInTheDocument();
    expect(within(etn).getByText('Taxi')).toBeInTheDocument();
    expect(within(etn).getByText('20 min')).toBeInTheDocument();
    expect(within(etn).queryByText('Maletas')).not.toBeInTheDocument();

    // Avión: 1h 08m de viaje + 2 h antes + 30 min de maletas + 40 min de taxi.
    const vuelo = fila('Volaris');
    expect(within(vuelo).getByText('4h 18m')).toBeInTheDocument();
    expect(within(vuelo).getByText('1 h 8 min')).toBeInTheDocument();
    expect(within(vuelo).getByText('2 h')).toBeInTheDocument();
    expect(within(vuelo).getByText('Maletas')).toBeInTheDocument();
    expect(within(vuelo).getByText('30 min')).toBeInTheDocument();
    expect(within(vuelo).getByText('40 min')).toBeInTheDocument();
  });

  it('muestra salida y llegada con badge de fecha en letra y badge de hora', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({ id: 'bus', linea: 'ETN', modo: 'bus', salidaTxt: '23/10 22:30', llegadaTxt: '24/10 02:03' }),
        ]}
      />,
    );

    const etn = fila('ETN');
    // La fecha va en letra y la hora en 12 h con AM/PM.
    expect(within(etn).getByText('23 de octubre')).toBeInTheDocument();
    expect(within(etn).getByText('10:30 PM')).toBeInTheDocument();
    expect(within(etn).getByText('24 de octubre')).toBeInTheDocument();
    expect(within(etn).getByText('2:03 AM')).toBeInTheDocument();
    // Ya no queda el texto crudo "dd/MM HH:mm" en las celdas.
    expect(within(etn).queryByText('23/10 22:30')).not.toBeInTheDocument();
  });

  it('distingue salir antes de tu hora ("Sale antes") de llegar después del límite ("Tarde")', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          // Sale antes de la hora declarada, pero llega muy antes del límite.
          oferta({ id: 'antes', linea: 'VivaAerobus', aTiempo: false, llegaTarde: false, noTomable: true }),
          // Llega después del límite: ese sí es "Tarde".
          oferta({
            id: 'tarde',
            linea: 'ADO',
            modo: 'bus',
            aTiempo: false,
            llegaTarde: true,
            minutosTarde: 174,
            noTomable: false,
          }),
        ]}
      />,
    );

    const viva = fila('VivaAerobus');
    expect(within(viva).getByText('Sale antes')).toBeInTheDocument();
    // Salir antes no es llegar tarde: nunca ambos badges por el mismo motivo.
    expect(within(viva).queryByText('Tarde')).not.toBeInTheDocument();

    const ado = fila('ADO');
    expect(within(ado).getByText('Tarde')).toBeInTheDocument();
    expect(within(ado).queryByText('Sale antes')).not.toBeInTheDocument();
    expect(within(ado).getByText('Tarde')).toHaveAttribute(
      'title',
      'Llega 2 h 54 min después de tu hora límite de llegada.',
    );
  });

  it('desglosa los dos taxis: del punto a la terminal y de la terminal al punto', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({
            id: 'bus',
            linea: 'ETN',
            modo: 'bus',
            duracion: '13h 33m',
            minutosAntes: 30,
            minutosTaxi: 14,
            minutosTaxiOrigen: 9,
            minutosTaxiDestino: 5,
          }),
        ]}
      />,
    );

    const etn = fila('ETN');
    expect(within(etn).getByText('Taxi punto → terminal')).toBeInTheDocument();
    expect(within(etn).getByText('9 min')).toBeInTheDocument();
    expect(within(etn).getByText('Taxi terminal → punto')).toBeInTheDocument();
    expect(within(etn).getByText('5 min')).toBeInTheDocument();
  });

  it('marca el segundo taxi como "por confirmar" cuando no se conoce la terminal de llegada', () => {
    render(
      <TablaOpciones
        titulo="Tramo 1"
        ofertas={[
          oferta({
            id: 'viva',
            linea: 'VivaAerobus',
            modo: 'avion',
            duracion: '6h 31m',
            minutosAntes: 120,
            minutosDespues: 30,
            minutosTaxi: 32,
            minutosTaxiOrigen: 32,
            minutosTaxiDestino: null,
          }),
        ]}
      />,
    );

    const viva = fila('VivaAerobus');
    // Los dos taxis se listan siempre; el desconocido no se inventa como 0.
    expect(within(viva).getByText('Taxi punto → terminal')).toBeInTheDocument();
    expect(within(viva).getByText('32 min')).toBeInTheDocument();
    expect(within(viva).getByText('Taxi terminal → punto')).toBeInTheDocument();
    expect(within(viva).getByText('por confirmar')).toBeInTheDocument();
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
    expect(within(filaHotel).queryByText(/sin proveedor de precios/i)).not.toBeInTheDocument();
    expect(within(filaHotel).getByText('seed tabulador SHCP')).toBeInTheDocument();
  });

  it('deshabilita Reservar con explicacion cuando el hotel no trae link', () => {
    render(<TablaHoteles hoteles={[hotel({ lugar: 'Hotel Sin Link', link: '' })]} />);

    expect(screen.getByRole('button', { name: /reservar sin link/i })).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/no trae link de reservaci/i)).toBeInTheDocument();
  });
});
