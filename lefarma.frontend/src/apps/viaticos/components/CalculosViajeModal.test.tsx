import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { CalculosViajeModal } from './CalculosViajeModal';
import type { CostosRutaHotel, CostosRutaOferta, CostosRutaRequest, CostosRutaResponse } from '../types/costosRuta.types';
import type { PropuestaRuta, Solicitud } from '../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  calcular: vi.fn(),
  autorizar: vi.fn(),
  enviar: vi.fn(),
  guardarOpciones: vi.fn(),
}));

vi.mock('../services/costosRuta.api', () => ({
  costosRutaApi: { calcular: mocks.calcular },
}));
vi.mock('../services/aprobaciones.api', () => ({
  aprobacionesApi: { autorizar: mocks.autorizar },
}));
vi.mock('../services/solicitudes.api', () => ({
  solicitudesApi: { enviar: mocks.enviar, guardarOpciones: mocks.guardarOpciones },
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  Tooltip: () => null,
}));

const solicitud: Solicitud = {
  id_solicitud: 42,
  id_usuario_solicitante: 7,
  periodo: '2026-11',
  gerencia: 'Operaciones',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T12:00:00',
  fecha_modificacion: '2026-11-05T12:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Viajera' },
    transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
    origen: {
      punto: { nombre: 'Guadalajara', latitud: 20.67, longitud: -103.34, municipio: 'Guadalajara', estado: 'Jalisco' },
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: { nombre: 'Zapopan', latitud: 20.72, longitud: -103.39, municipio: 'Zapopan', estado: 'Jalisco' },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
  },
  opciones: [],
  eventos: [],
};

const solicitudDosDestinos: Solicitud = {
  ...solicitud,
  id_solicitud: 43,
  datos: {
    ...(solicitud.datos as Record<string, unknown>),
    destinos: [
      {
        punto: { nombre: 'Zapopan', latitud: 20.72, longitud: -103.39, municipio: 'Zapopan', estado: 'Jalisco' },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
        hospedaje: { necesario: true, zona: 'actual', fechaEntrada: '', fechaSalida: '', hotel: null },
      },
      {
        punto: { nombre: 'León', latitud: 21.12, longitud: -101.68, municipio: 'León', estado: 'Guanajuato' },
        debeEstarFecha: '2026-11-11',
        debeEstarHora: '10:00',
        saleFecha: '2026-11-11',
        saleHora: '18:00',
        hospedaje: { necesario: false, zona: 'actual', fechaEntrada: '', fechaSalida: '', hotel: null },
      },
    ],
  },
};

const compra = (url: string) => ({
  url,
  sitio: 'ClickBus',
  accion: 'Comprar',
  objetivo: 'boleto',
  fecha: '2026-11-10',
});

const oferta = (id: string, linea: string, costoGrupo: number): CostosRutaOferta => ({
  id,
  modo: 'bus',
  linea,
  servicio: 'Primera',
  persona: 'Persona Viajera',
  tramo: 1,
  de: 'Guadalajara',
  a: 'Zapopan',
  salidaTxt: '10/11 09:00',
  llegadaTxt: '10/11 13:30',
  duracion: '4h 30m',
  puertaAPuertaH: 4.5,
  precioTxt: `$${costoGrupo}`,
  porPersona: false,
  costoGrupo,
  costoPorPersona: costoGrupo,
  aTiempo: true,
  llegaTarde: false,
  minutosTarde: 0,
  noTomable: false,
  badge: '',
  nota: '',
  fuente: 'ClickBus',
  estimado: false,
  comprar: compra(`https://comprar.test/${id}`),
});

const respuestaMotor = (): CostosRutaResponse => ({
  resultados: [
    {
      nombre: 'Persona Viajera',
      gasolina: 'magna',
      propuesta: { razones: [], lugares: [] },
      tramos: [
        {
          from: 'Guadalajara',
          to: 'Zapopan',
          km: 120,
          opciones: [oferta('a', 'Futura', 520), oferta('b', 'ETN', 980)],
        },
      ],
      rutaArmada: {
        tramos: [],
        totales: { km: 120, litros: 10, casetas: 0, subtotalMagna: 900, subtotalPremium: 1000 },
      },
      hotelesPropuestos: [],
      incumplimientos: [],
      casetas: [],
    },
  ],
  propuestas: [],
  categorias: {},
  recomendaciones: [],
  compartidos: [],
});

const respuestaConTramos = (
  tramos: CostosRutaResponse['resultados'][0]['tramos'],
  hoteles: CostosRutaHotel[] = [],
): CostosRutaResponse => {
  const base = respuestaMotor();
  return {
    ...base,
    resultados: [{ ...base.resultados[0], tramos, hotelesPropuestos: hoteles }],
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calcular.mockResolvedValue({ data: { success: true, data: respuestaMotor() } });
});

describe('CalculosViajeModal con hotel', () => {
  it('usa la cadena noche antes y suma taxi terminal↔hotel y taxi local', async () => {
    const usuario = userEvent.setup();
    const onPropuesta = vi.fn();
    const onOpenChange = vi.fn();

    const hotel: CostosRutaHotel = {
      lugar: 'Hotel Centro',
      nombre: 'Hotel Centro',
      ciudad: 'Zapopan',
      checkIn: '2026-11-09',
      checkOut: '2026-11-10',
      noches: 1,
      habitaciones: 1,
      distanciaKm: 1,
      precioNoche: 1500,
      precioTotal: 1500,
      motivo: 'Cerca del punto',
      fuente: 'Tabulador',
      tipoPrecio: 'referencia_tabulador',
      latitud: 20.72,
      longitud: -103.39,
      link: 'https://hotel.test/reserva',
    };
    const directo = oferta('directo', 'Directo', 211);
    const busHotel = {
      ...oferta('bus-hotel', 'ADO Hotel', 226),
      costoTaxiOrigen: 111.74,
      costoTaxiDestino: 121.24,
      terminalOrigen: { nombre: 'TAPO', latitud: 19.43, longitud: -99.13 },
      terminalDestino: { nombre: 'CAPU', latitud: 19.05, longitud: -98.20 },
    };
    const uberLocal = {
      ...oferta('uber-local', 'UberX', 55.19),
      modo: 'uber',
      fuente: 'seed apps',
      estimado: true,
    };
    const directa = respuestaConTramos([
      { from: 'Guadalajara', to: 'Zapopan', km: 120, opciones: [directo] },
    ]);
    const busqueda = respuestaConTramos([
      { from: 'Guadalajara', to: 'Hotel Centro', km: 120, opciones: [busHotel] },
      { from: 'Hotel Centro', to: 'Zapopan', km: 3, opciones: [uberLocal] },
    ], [hotel]);
    const rutaHotel = respuestaConTramos([
      { from: 'Guadalajara', to: 'Hotel Centro', km: 120, opciones: [busHotel] },
      { from: 'Hotel Centro', to: 'Zapopan', km: 3, opciones: [uberLocal] },
    ], [hotel]);

    mocks.calcular.mockImplementation((request: CostosRutaRequest) => {
      const hotelPlace = request.personas[0].lugares.find((lugar) => lugar.tipo === 'hotel');
      const data = !hotelPlace
        ? directa
        : hotelPlace.nombre === 'Hotel Centro'
          ? rutaHotel
          : busqueda;
      return Promise.resolve({ data: { success: true, data } });
    });

    render(
      <CalculosViajeModal
        solicitud={solicitud}
        open
        onOpenChange={onOpenChange}
        onEnviado={vi.fn()}
        modo="autorizar"
        onPropuesta={onPropuesta}
      />,
    );

    const checkHotel = await screen.findByRole('checkbox', { name: /Noche antes/i });
    await usuario.click(checkHotel);

    await screen.findByText('ADO Hotel');
    await waitFor(() => expect(screen.getByLabelText('Taxi local del hotel')).toHaveValue('uber-local'));

    await usuario.click(screen.getByRole('button', { name: /siguiente/i }));
    const siguienteOferta = await screen.findByRole('button', { name: /^Elegir / });
    await usuario.click(siguienteOferta);
    await usuario.click(await screen.findByRole('button', { name: /terminar/i }));
    await usuario.click(await screen.findByRole('button', { name: 'Usar esta ruta' }));

    expect(onPropuesta).toHaveBeenCalledTimes(1);
    const propuesta = onPropuesta.mock.calls[0][0] as PropuestaRuta;
    expect(propuesta.resumen).toMatchObject({
      autobus: 437,
      taxi: 288.17,
      hospedaje: 1500,
      total: 2225.17,
    });
    expect(propuesta.opciones.filter((opcion) => opcion.tipo === 'hotel' && opcion.fue_elegida)).toHaveLength(1);
    expect(propuesta.opciones.filter((opcion) => opcion.tipo === 'taxi').map((opcion) => opcion.precio))
      .toEqual(expect.arrayContaining([111.74, 121.24, 55.19]));
    expect(propuesta.calculo.tramos[0].costo).toBe(226);
    expect(propuesta.calculo.ruta?.puntos.some((punto) => punto.nombre === 'Hotel Centro')).toBe(true);
  });
});

describe('CalculosViajeModal con hotel intermedio de Educación Médica', () => {
  it('activa la noche después del destino anterior y arma hotel→siguiente destino', async () => {
    const usuario = userEvent.setup();
    const onPropuesta = vi.fn();

    const hotel: CostosRutaHotel = {
      lugar: 'Hotel Centro',
      nombre: 'Hotel Centro',
      ciudad: 'Zapopan',
      checkIn: '2026-11-10',
      checkOut: '2026-11-11',
      noches: 1,
      habitaciones: 1,
      distanciaKm: 1,
      precioNoche: 1500,
      precioTotal: 1500,
      motivo: 'Cerca del punto',
      fuente: 'Tabulador',
      tipoPrecio: 'referencia_tabulador',
      latitud: 20.73,
      longitud: -103.40,
      link: 'https://hotel.test/reserva',
    };
    const directo0 = oferta('directo-0', 'Directo 0', 200);
    const directo1 = oferta('directo-1', 'Directo 1', 210);
    const directo2 = oferta('directo-2', 'Directo 2', 220);
    const directa0 = respuestaConTramos([
      { from: 'Guadalajara', to: 'Zapopan', km: 120, opciones: [directo0] },
    ]);
    const directa1 = respuestaConTramos([
      { from: 'Zapopan', to: 'León', km: 350, opciones: [directo1] },
    ]);
    const directa2 = respuestaConTramos([
      { from: 'León', to: 'Guadalajara', km: 350, opciones: [directo2] },
    ]);
    const uberVuelta = {
      ...oferta('uber-vuelta', 'UberX', 57.02),
      modo: 'uber',
      fuente: 'seed apps',
      estimado: true,
    };
    const busVuelta = {
      ...oferta('bus-vuelta', 'ADO León', 189),
      costoTaxiOrigen: 209.16,
      costoTaxiDestino: 315.85,
      terminalOrigen: { nombre: 'CAPU', latitud: 19.05, longitud: -98.20 },
      terminalDestino: { nombre: 'Central León', latitud: 21.10, longitud: -101.70 },
    };
    const busqueda = respuestaConTramos([
      { from: 'Zapopan', to: 'Hotel Centro', km: 3, opciones: [uberVuelta] },
      { from: 'Hotel Centro', to: 'León', km: 350, opciones: [busVuelta] },
    ], [hotel]);
    const rutaHotel = respuestaConTramos([
      { from: 'Zapopan', to: 'Hotel Centro', km: 3, opciones: [uberVuelta] },
      { from: 'Hotel Centro', to: 'León', km: 350, opciones: [busVuelta] },
    ], [hotel]);

    mocks.calcular.mockImplementation((request: CostosRutaRequest) => {
      const lugares = request.personas[0].lugares;
      const hotelPlace = lugares.find((lugar) => lugar.tipo === 'hotel');
      if (hotelPlace) {
        const data = hotelPlace.nombre === 'Hotel Centro' ? rutaHotel : busqueda;
        return Promise.resolve({ data: { success: true, data } });
      }
      const salida = lugares[0]?.nombre;
      const data = salida === 'Guadalajara' ? directa0 : salida === 'Zapopan' ? directa1 : directa2;
      return Promise.resolve({ data: { success: true, data } });
    });

    render(
      <CalculosViajeModal
        solicitud={solicitudDosDestinos}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
        modo="autorizar"
        onPropuesta={onPropuesta}
      />,
    );

    const antes = await screen.findByRole('checkbox', { name: /Noche antes/i });
    expect(antes).not.toBeChecked();

    await usuario.click(screen.getByRole('button', { name: /siguiente/i }));
    const despues = await screen.findByRole('checkbox', { name: /Noche después: dormir cerca de Zapopan/i });
    expect(despues).toBeChecked();

    await screen.findByText('ADO León');
    expect(screen.getByText(/Opciones Hotel Centro → León/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Taxi local del hotel')).toHaveValue('uber-vuelta'));

    await usuario.click(screen.getByRole('button', { name: /siguiente/i }));
    await usuario.click(await screen.findByRole('button', { name: /^Elegir / }));
    await usuario.click(await screen.findByRole('button', { name: /terminar/i }));
    await usuario.click(await screen.findByRole('button', { name: 'Usar esta ruta' }));

    const propuesta = onPropuesta.mock.calls[0][0] as PropuestaRuta;
    const nombres = propuesta.calculo.ruta?.puntos.map((punto) => punto.nombre) ?? [];
    const indice = (nombre: string) => nombres.indexOf(nombre);
    expect(indice('Hotel Centro')).toBeGreaterThan(indice('Zapopan, Jalisco'));
    expect(indice('CAPU')).toBeGreaterThan(indice('Hotel Centro'));
    expect(indice('Central León')).toBeGreaterThan(indice('CAPU'));
    expect(indice('León, Guanajuato')).toBeGreaterThan(indice('Central León'));
  });
});

describe('CalculosViajeModal en modo autorizar', () => {
  it('entrega la propuesta al padre y no llama a la API de autorización', async () => {
    const usuario = userEvent.setup();
    const onPropuesta = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CalculosViajeModal
        solicitud={solicitud}
        open
        onOpenChange={onOpenChange}
        onEnviado={vi.fn()}
        modo="autorizar"
        onPropuesta={onPropuesta}
      />,
    );

    const siguiente = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(siguiente).toBeEnabled());
    // Primera oferta de cada tramo: la propuesta debe usar esa selección.
    await usuario.click(screen.getAllByRole('button', { name: /^Elegir / })[0]);
    await usuario.click(siguiente);

    const terminar = await screen.findByRole('button', { name: /terminar/i });
    await waitFor(() => expect(terminar).toBeEnabled());
    await usuario.click(screen.getAllByRole('button', { name: /^Elegir / })[0]);
    await usuario.click(terminar);

    await usuario.click(await screen.findByRole('button', { name: 'Usar esta ruta' }));

    expect(onPropuesta).toHaveBeenCalledTimes(1);
    const propuesta = onPropuesta.mock.calls[0][0] as PropuestaRuta;

    expect(propuesta.calculo.modo_transporte).toBe('solicitado');
    expect(propuesta.calculo.tramos).toHaveLength(2);
    expect(propuesta.calculo.tramos[0]).toMatchObject({
      costo: 520,
      moneda: 'MXN',
      url_compra: 'https://comprar.test/a',
      linea: 'Futura',
    });

    // Se guardan las dos alternativas de cada tramo, no solo la elegida.
    expect(propuesta.opciones).toHaveLength(4);
    expect(propuesta.opciones.filter((opcion) => opcion.fue_elegida)).toHaveLength(2);
    expect(propuesta.opciones.every((opcion) => opcion.datos?.tramo !== undefined)).toBe(true);

    expect(propuesta.resumen).toMatchObject({
      autobus: 1040,
      avion: null,
      casetas: null,
      comida: null,
      total: 1040,
    });
    expect(propuesta.calculo.ruta?.nodos.some((nodo) => nodo.costo === 520)).toBe(true);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.autorizar).not.toHaveBeenCalled();
    expect(mocks.enviar).not.toHaveBeenCalled();
    expect(mocks.guardarOpciones).not.toHaveBeenCalled();
  });
});
