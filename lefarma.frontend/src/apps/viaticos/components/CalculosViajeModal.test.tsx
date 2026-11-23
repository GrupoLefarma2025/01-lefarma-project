import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { CalculosViajeModal } from './CalculosViajeModal';
import type { CostosRutaHotel, CostosRutaOferta, CostosRutaRequest, CostosRutaResponse, PuntoSeleccion } from '../types/costosRuta.types';
import type { PropuestaRuta, Solicitud } from '../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  calcular: vi.fn(),
  geocodificarReversa: vi.fn(),
  autorizar: vi.fn(),
  enviar: vi.fn(),
  guardarOpciones: vi.fn(),
}));

vi.mock('../services/costosRuta.api', () => ({
  costosRutaApi: { calcular: mocks.calcular },
}));
vi.mock('../services/geocodificar.api', () => ({
  geocodificarReversa: mocks.geocodificarReversa,
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
  mocks.geocodificarReversa.mockReset().mockResolvedValue(null);
  mocks.calcular.mockReset().mockResolvedValue({ data: { success: true, data: respuestaMotor() } });
});

const carTrip = (explicitDeparture = true): Solicitud => ({
  ...solicitud,
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Viajera' },
    transporte: { modo: 'propio', compartir: false, acompanantes: [] },
    origen: {
      punto: {
        nombre: 'Guadalajara',
        latitud: 20.67,
        longitud: -103.34,
        municipio: 'Guadalajara',
        estado: 'Jalisco',
      },
      fechaSalida: explicitDeparture ? '2026-11-10' : '',
      horaSalida: explicitDeparture ? '08:00' : '',
    },
    destinos: [
      {
        punto: {
          nombre: 'Zapopan',
          latitud: 20.72,
          longitud: -103.39,
          municipio: 'Zapopan',
          estado: 'Jalisco',
        },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
  },
});

function disponibilidadSct(
  estado: import('../types/costosRuta.types').EstadoCasetasSct,
  peajeTotal: number | null = null,
  regreso = false,
): import('../types/costosRuta.types').CostosRutaCasetaDisponibilidad {
  return {
    tramo: 1,
    deMunicipio: regreso ? 'Zapopan' : 'Guadalajara',
    aMunicipio: regreso ? 'Guadalajara' : 'Zapopan',
    estado,
    kmTotal: estado === 'disponible' ? 97.35 : null,
    tiempoTotal: estado === 'disponible' ? '01:15' : null,
    peajeTotal,
    fuente: estado === 'disponible' ? 'SCT · Rutas Punto a Punto' : '',
  };
}

const carEngineResponse = (
  duration = '2h 00m',
  estado: import('../types/costosRuta.types').EstadoCasetasSct = 'destino_no_soportado',
  regreso = false,
): CostosRutaResponse => {
  const response = respuestaMotor();
  response.resultados[0].tramos = [
    {
      from: 'Guadalajara',
      to: 'Zapopan',
      km: 120,
      opciones: [
        {
          ...oferta('auto', 'Auto propio', 900),
          modo: 'auto',
          duracion: duration,
          combustible: 780,
          casetasEstimadas: 120,
          fuente: 'OSRM + CNE (fixture)',
        },
      ],
    },
  ];
  response.resultados[0].casetasDisponibilidad = [disponibilidadSct(estado, null, regreso)];
  return response;
};

const renderCarSummary = async (fixture: Solicitud) => {
  render(
    <CalculosViajeModal
      solicitud={fixture}
      open
      onOpenChange={vi.fn()}
      onEnviado={vi.fn()}
    />,
  );
  return await screen.findByRole('region', { name: 'Resumen calculado del viaje' });
};

describe('CalculosViajeModal calculated car summary', () => {
  it('prioritizes calculated arrival with explicit departure and supports responsive stacking', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });

    const summary = await renderCarSummary(carTrip());
    const arrival = within(summary).getByText(/10\/11\/2026 · 10:12 AM/);

    expect(within(summary).getByText('Llegada estimada')).toBeInTheDocument();
    expect(arrival).toHaveClass('break-words');
    expect(within(summary).getByText('Llega a tiempo')).toHaveClass(
      'h-auto',
      'max-w-full',
      'whitespace-normal',
      'text-center',
      'text-xs',
      'font-semibold',
      'leading-snug',
      'border-primary/30',
      'bg-primary/10',
      'text-primary',
    );
    expect(
      within(summary).getByText(/Salida de Guadalajara, Jalisco: .*8:00 AM/),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByText(/base \+ 10%/)).not.toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
    expect(summary.firstElementChild).toHaveClass(
      'flex',
      'flex-col',
      'sm:flex-row',
      'sm:items-start',
    );
  });

  it('exposes a late calculated arrival as wrappable text instead of color alone', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse('7h 00m') },
    });

    const summary = await renderCarSummary(carTrip());

    expect(within(summary).getByText(/10\/11\/2026 · 3:43 PM/)).toBeInTheDocument();
    expect(within(summary).getByText('No alcanza la llegada requerida')).toHaveClass(
      'max-w-full',
      'whitespace-normal',
      'text-amber-700',
    );
    expect(
      within(summary).getByText('Duración ajustada: 7h 43m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('preserves return arrival, departure context, feasibility, and per-leg API calls', async () => {
    const user = userEvent.setup();
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });
    render(
      <CalculosViajeModal
        solicitud={carTrip()}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
      />,
    );

    const nextButton = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(nextButton).toBeEnabled());
    await user.click(nextButton);

    const summary = await screen.findByRole('region', { name: 'Resumen calculado del viaje' });
    expect(within(summary).getByText('Llegada estimada al origen')).toBeInTheDocument();
    expect(within(summary).getByText(/10\/11\/2026 · 8:12 PM/)).toBeInTheDocument();
    expect(
      within(summary).getByText(/Salida de Zapopan, Jalisco: .*6:00 PM/),
    ).toBeInTheDocument();
    expect(within(summary).getByText('No alcanza la llegada requerida')).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(mocks.calcular).toHaveBeenCalledTimes(2);
  });

  it('uses a light readable success badge for a return arrival', async () => {
    const user = userEvent.setup();
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse('1h 00m') },
    });
    render(
      <CalculosViajeModal
        solicitud={carTrip()}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
      />,
    );

    const nextButton = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(nextButton).toBeEnabled());
    await user.click(nextButton);

    const summary = await screen.findByRole('region', { name: 'Resumen calculado del viaje' });
    expect(within(summary).getByText('Llegada estimada al origen')).toBeInTheDocument();
    expect(within(summary).getByText('Llega a tiempo')).toHaveClass(
      'h-auto',
      'max-w-full',
      'whitespace-normal',
      'text-center',
      'text-xs',
      'font-semibold',
      'leading-snug',
      'border-primary/30',
      'bg-primary/10',
      'text-primary',
    );
    expect(within(summary).queryByText('No alcanza la llegada requerida')).not.toBeInTheDocument();
  });

  it('prioritizes approximate departure without inventing feasibility for the estimated variant', async () => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse() },
    });

    const summary = await renderCarSummary(carTrip(false));

    expect(within(summary).getByText('Salida aproximada')).toBeInTheDocument();
    expect(within(summary).getByText(/10\/11\/2026 · 11:48 AM/)).toBeInTheDocument();
    expect(
      within(summary).getByText(/Llegada requerida: .*2:00 PM/),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText('Duración ajustada: 2h 12m · Incluye 10% de margen.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByText('Llega a tiempo')).not.toBeInTheDocument();
    expect(within(summary).queryByText('No alcanza la llegada requerida')).not.toBeInTheDocument();
    expect(summary.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });
});

describe('CalculosViajeModal presentation layout', () => {
  it('separates schedule and timing from metrics and SCT with readable responsive content', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetas = [
      {
        tramo: 1,
        deMunicipio: 'Guadalajara',
        aMunicipio: 'Zapopan',
        nombre: 'Ojo de Agua',
        carretera: 'México - Pachuca',
        km: 63.4,
        tarifa: 72,
        direccion: 'México - Pachuca',
        fuente: 'SCT · Rutas Punto a Punto',
      },
    ];
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    const summary = await renderCarSummary(carTrip());
    const layout = screen.getByTestId('calculos-viaje-layout');
    const scheduleColumn = within(layout).getByTestId('calculos-viaje-schedule-column');
    const costColumn = within(layout).getByTestId('calculos-viaje-cost-column');
    const metrics = screen.getByRole('region', { name: 'Distancia y duración del tramo' });
    const detail = screen.getByRole('region', { name: 'Detalle de casetas SCT' });

    expect(layout).toHaveClass('grid', 'grid-cols-1', 'items-start', 'gap-4', 'lg:grid-cols-2');
    expect(scheduleColumn).toHaveClass('min-w-0');
    expect(costColumn).toHaveClass('min-w-0');
    expect(scheduleColumn).toContainElement(screen.getByRole('region', { name: 'Horarios solicitados' }));
    expect(scheduleColumn).toContainElement(summary);
    expect(costColumn).toContainElement(metrics);
    expect(costColumn).toContainElement(detail);
    expect(within(summary).getByText(/10\/11\/2026 · 10:12 AM/)).toHaveClass(
      'break-words',
      'text-xl',
      'font-semibold',
      'text-foreground',
    );
    expect(metrics).toHaveTextContent('120 km');
    expect(metrics).toHaveTextContent('2h 00m base');
    expect(metrics).toHaveTextContent('+10% = 2h 12m');
    expect(within(detail).getByRole('note', { name: 'Fuente de la estimación del auto' })).toHaveTextContent(
      'Fuente de la estimación: OSRM + CNE (fixture). Ya está incluida en el precio seleccionado.',
    );

    const table = within(detail).getByRole('table');
    expect(table).toHaveClass('w-full', 'table-fixed', 'text-left', 'text-sm');
    expect(within(table).getByRole('columnheader', { name: 'Caseta' })).toHaveClass('py-2');
    expect(within(table).getByRole('cell', { name: 'Ojo de Agua' })).toHaveClass(
      'break-words',
      'py-2.5',
      'text-foreground',
    );
    const officialSource = within(detail).getByRole('note', { name: 'Fuente oficial SCT' });
    expect(officialSource).toHaveClass('text-xs', 'leading-relaxed');
    expect(officialSource).toHaveTextContent(
      'Fuente oficial: SCT · Rutas Punto a Punto. Referencia: 97.350 km · 01:15. No se suma al precio seleccionado.',
    );
  });
});

describe('CalculosViajeModal SCT availability and source labels', () => {
  it('shows official detail as reference and the estimated components already included in the auto price', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetas = [
      {
        tramo: 1,
        deMunicipio: 'Guadalajara',
        aMunicipio: 'Zapopan',
        nombre: 'Ojo de Agua',
        carretera: 'México - Pachuca',
        km: 63.4,
        tarifa: 72,
        direccion: 'México - Pachuca',
        fuente: 'SCT · Rutas Punto a Punto',
      },
    ];
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(within(detail).getByText('Ojo de Agua')).toBeInTheDocument();
    expect(within(detail).getByText('Total casetas del tramo')).toBeInTheDocument();
    expect(within(detail).getAllByText('$72')).toHaveLength(2);
    expect(detail).toHaveTextContent('Fuente oficial: SCT · Rutas Punto a Punto');
    expect(detail).toHaveTextContent('Referencia: 97.350 km · 01:15');
    expect(detail).toHaveTextContent('No se suma al precio seleccionado.');
    expect(detail).toHaveTextContent('combustible $780 + casetas estimadas $120 = $900');
    expect(detail).toHaveTextContent('Fuente de la estimación: OSRM + CNE (fixture).');
    expect(screen.getByRole('region', { name: 'Resumen calculado del viaje' }))
      .toHaveTextContent('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  });

  it('distinguishes a valid official zero-plaza result from unavailable detail', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 0)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('La SCT no reporta plazas de cobro para este tramo.');
    expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
    expect(detail).not.toHaveTextContent('Sin desglose de plazas para esta ruta.');
  });

  it.each([
    ['destino_no_soportado', 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.'],
    ['proveedor_no_disponible', 'No fue posible consultar la SCT. Intenta nuevamente.'],
    ['respuesta_invalida', 'No fue posible interpretar el desglose oficial de casetas.'],
  ] as const)('shows the exact message for %s without a false zero or reference table', async (estado, mensaje) => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse('2h 00m', estado) },
    });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent(mensaje);
    expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
    expect(detail).not.toHaveTextContent('$0');
  });

  it('does not present a complete official round-trip total when the return leg is unavailable', async () => {
    const user = userEvent.setup();
    const outbound = carEngineResponse('2h 00m', 'disponible');
    outbound.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular
      .mockResolvedValueOnce({ data: { success: true, data: outbound } })
      .mockResolvedValueOnce({
        data: { success: true, data: carEngineResponse('2h 00m', 'proveedor_no_disponible', true) },
      });
    render(
      <CalculosViajeModal solicitud={carTrip()} open onOpenChange={vi.fn()} onEnviado={vi.fn()} />,
    );

    const next = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);

    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('No fue posible consultar la SCT. Intenta nuevamente.');
    expect(detail).toHaveTextContent('No hay un total oficial de ida y vuelta');
    expect(screen.queryByText(/Total oficial SCT de ida y vuelta:/)).not.toBeInTheDocument();
  });

  it('sums official leg totals only when every leg is available', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const response = (regreso: boolean) => {
      const value = carEngineResponse('2h 00m', 'disponible', regreso);
      value.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72, regreso)];
      return value;
    };
    mocks.calcular.mockImplementation(async () => {
      calls += 1;
      return { data: { success: true, data: response(calls === 2) } };
    });
    render(
      <CalculosViajeModal solicitud={carTrip()} open onOpenChange={vi.fn()} onEnviado={vi.fn()} />,
    );

    const next = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);

    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('Total oficial SCT de ida y vuelta: $144');
    expect(screen.getByRole('region', { name: 'Resumen calculado del viaje' }))
      .toHaveTextContent('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

const genericPointsTrip = (): Solicitud => ({
  ...solicitud,
  datos: {
    ...(solicitud.datos as Record<string, unknown>),
    origen: {
      punto: {
        nombre: '  PUNTO SELECCIONADO EN MAPA  ',
        latitud: 19.4326,
        longitud: -99.1332,
      },
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: {
          nombre: 'Punto seleccionado en el mapa',
          latitud: 18.9186,
          longitud: -99.2342,
        },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
  },
});

describe('CalculosViajeModal generic map point recovery', () => {
  it('waits for reverse geocoding and calculates with resolved places and unchanged coordinates', async () => {
    const originResolution = deferred<PuntoSeleccion | null>();
    const destinationResolution = deferred<PuntoSeleccion | null>();
    mocks.geocodificarReversa
      .mockImplementationOnce(() => originResolution.promise)
      .mockImplementationOnce(() => destinationResolution.promise);

    render(
      <CalculosViajeModal
        solicitud={genericPointsTrip()}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.geocodificarReversa).toHaveBeenCalledTimes(2));
    expect(mocks.calcular).not.toHaveBeenCalled();
    expect(mocks.geocodificarReversa).toHaveBeenNthCalledWith(1, 19.4326, -99.1332);
    expect(mocks.geocodificarReversa).toHaveBeenNthCalledWith(2, 18.9186, -99.2342);

    await act(async () => {
      originResolution.resolve({
        nombre: 'Fábricas de Francia, Buenavista',
        latitud: 19.4326,
        longitud: -99.1332,
        municipio: 'Buenavista',
        estado: 'Ciudad de México',
      });
      destinationResolution.resolve({
        nombre: 'Potrero Verde',
        latitud: 18.9186,
        longitud: -99.2342,
        municipio: 'Cuernavaca',
        estado: 'Morelos',
      });
      await Promise.all([originResolution.promise, destinationResolution.promise]);
    });

    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    const heading = screen.getByRole('heading', { name: /Tramo 1:/ });
    expect(heading).toHaveTextContent('Buenavista, Ciudad de México');
    expect(heading).toHaveTextContent('Cuernavaca, Morelos');

    const request = mocks.calcular.mock.calls[0][0] as CostosRutaRequest;
    expect(request.personas[0].lugares).toMatchObject([
      {
        latitud: 19.4326,
        longitud: -99.1332,
        municipio: 'Buenavista',
        estado: 'Ciudad de México',
      },
      {
        latitud: 18.9186,
        longitud: -99.2342,
        municipio: 'Cuernavaca',
        estado: 'Morelos',
      },
    ]);
  });

  it('does not reverse-geocode points that already have valid names', async () => {
    render(
      <CalculosViajeModal solicitud={solicitud} open onOpenChange={vi.fn()} onEnviado={vi.fn()} />,
    );

    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    expect(mocks.geocodificarReversa).not.toHaveBeenCalled();
  });

  it('finishes the attempt and uses the persisted fallback when reverse resolution fails', async () => {
    mocks.geocodificarReversa.mockResolvedValue(null);
    render(
      <CalculosViajeModal
        solicitud={genericPointsTrip()}
        open
        onOpenChange={vi.fn()}
        onEnviado={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    expect(mocks.geocodificarReversa).toHaveBeenCalledTimes(2);
  });
});

const singleLegTrip = (id: number, origen: PuntoSeleccion, destino: PuntoSeleccion): Solicitud => ({
  ...solicitud,
  id_solicitud: id,
  datos: {
    ...(solicitud.datos as Record<string, unknown>),
    origen: {
      punto: origen,
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: destino,
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'otro', punto: null },
  },
});

const singleOfferResponse = (
  from: string,
  to: string,
  id: string,
  linea: string,
  costo: number,
): CostosRutaResponse => {
  const response = respuestaMotor();
  response.resultados[0].tramos = [
    {
      from,
      to,
      km: 88,
      opciones: [{ ...oferta(id, linea, costo), de: from, a: to }],
    },
  ];
  return response;
};

describe('CalculosViajeModal solicitud replacement', () => {
  it('invalidates a pending request A and submits only the fresh route and cost for request B', async () => {
    const user = userEvent.setup();
    const onPropuesta = vi.fn();
    const onOpenChange = vi.fn();
    const calculationA = deferred<{ data: { success: boolean; data: CostosRutaResponse } }>();
    const calculationB = deferred<{ data: { success: boolean; data: CostosRutaResponse } }>();
    mocks.calcular
      .mockImplementationOnce(() => calculationA.promise)
      .mockImplementationOnce(() => calculationB.promise);
    const tripA = singleLegTrip(
      101,
      { nombre: 'Guadalajara', latitud: 20.67, longitud: -103.34, municipio: 'Guadalajara', estado: 'Jalisco' },
      { nombre: 'Zapopan', latitud: 20.72, longitud: -103.39, municipio: 'Zapopan', estado: 'Jalisco' },
    );
    const tripB = singleLegTrip(
      202,
      { nombre: 'Puebla', latitud: 19.0414, longitud: -98.2063, municipio: 'Puebla', estado: 'Puebla' },
      { nombre: 'Tlaxcala', latitud: 19.3139, longitud: -98.2404, municipio: 'Tlaxcala', estado: 'Tlaxcala' },
    );
    const props = {
      open: true,
      onOpenChange,
      onEnviado: vi.fn(),
      modo: 'autorizar' as const,
      onPropuesta,
    };
    const { rerender } = render(<CalculosViajeModal solicitud={tripA} {...props} />);

    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /terminar/i })).toBeDisabled();

    rerender(<CalculosViajeModal solicitud={tripB} {...props} />);

    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(2));
    const requestB = mocks.calcular.mock.calls[1][0] as CostosRutaRequest;
    expect(requestB.personas[0].lugares).toMatchObject([
      { municipio: 'Puebla', estado: 'Puebla', latitud: 19.0414, longitud: -98.2063 },
      { municipio: 'Tlaxcala', estado: 'Tlaxcala', latitud: 19.3139, longitud: -98.2404 },
    ]);

    await act(async () => {
      calculationA.resolve({
        data: {
          success: true,
          data: singleOfferResponse('Guadalajara', 'Zapopan', 'a-late', 'Ruta A', 111),
        },
      });
      await calculationA.promise;
    });

    expect(screen.getByRole('button', { name: /terminar/i })).toBeDisabled();
    expect(screen.queryByText('Ruta A')).not.toBeInTheDocument();
    expect(onPropuesta).not.toHaveBeenCalled();

    await act(async () => {
      calculationB.resolve({
        data: {
          success: true,
          data: singleOfferResponse('Puebla', 'Tlaxcala', 'b-current', 'Ruta B', 777),
        },
      });
      await calculationB.promise;
    });

    const terminar = screen.getByRole('button', { name: /terminar/i });
    await waitFor(() => expect(terminar).toBeEnabled());
    expect(screen.getByText('Ruta B')).toBeInTheDocument();
    expect(screen.queryByText('Ruta A')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Elegir / }));
    await user.click(terminar);
    await user.click(await screen.findByRole('button', { name: 'Usar esta ruta' }));

    expect(onPropuesta).toHaveBeenCalledTimes(1);
    const propuesta = onPropuesta.mock.calls[0][0] as PropuestaRuta;
    expect(propuesta.calculo.tramos).toHaveLength(1);
    expect(propuesta.calculo.tramos[0]).toMatchObject({
      de: 'Puebla, Puebla',
      a: 'Tlaxcala, Tlaxcala',
      costo: 777,
      linea: 'Ruta B',
    });
    expect(propuesta.resumen).toMatchObject({ autobus: 777, total: 777 });
  });
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
