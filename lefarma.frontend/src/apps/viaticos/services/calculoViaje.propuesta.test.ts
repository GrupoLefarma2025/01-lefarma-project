import { describe, expect, it } from 'vitest';
import {
  claveHotel,
  construirCalculo,
  construirOpcionesPropuesta,
  construirTramos,
  leerCalculoDesdeDatos,
  resumenCostosRuta,
  type TramoViaje,
} from './calculoViaje';
import type {
  CostosRutaHotel,
  CostosRutaOferta,
  CostosRutaResponse,
} from '../types/costosRuta.types';
import type { CalculoViaje, CasetaCalculada, OpcionCotizacion, Solicitud } from '../types/solicitud.types';

const punto = (nombre: string, municipio: string) => ({
  nombre,
  latitud: 20.67,
  longitud: -103.34,
  estado: 'Jalisco',
  municipio,
});

const tramo = (de: string, a: string, esRegreso = false): TramoViaje => ({
  desde: {
    punto: punto(de, 'Guadalajara'),
    fecha: '2026-11-10',
    hora: '08:00',
    nombre: de,
    explicita: true,
  },
  hasta: {
    punto: punto(a, 'Zapopan'),
    fecha: '2026-11-10',
    hora: '14:00',
    nombre: a,
  },
  esRegreso,
});

const compra = (url: string) => ({
  url,
  sitio: 'ClickBus',
  accion: 'Comprar',
  objetivo: 'boleto',
  fecha: '2026-11-10',
});

function oferta(
  parcial: Partial<CostosRutaOferta> & Pick<CostosRutaOferta, 'id' | 'linea' | 'costoGrupo'>,
): CostosRutaOferta {
  return {
    modo: 'bus',
    servicio: 'Primera',
    persona: 'Viajero',
    tramo: 1,
    de: 'Guadalajara',
    a: 'Zapopan',
    salidaTxt: '10/11 09:00',
    llegadaTxt: '10/11 12:00',
    duracion: '3h 00m',
    puertaAPuertaH: 3,
    precioTxt: `$${parcial.costoGrupo}`,
    porPersona: false,
    costoPorPersona: parcial.costoGrupo,
    aTiempo: true,
    llegaTarde: false,
    minutosTarde: 0,
    noTomable: false,
    badge: '',
    nota: '',
    fuente: 'ClickBus',
    estimado: false,
    comprar: compra(`https://comprar.test/${parcial.id}`),
    ...parcial,
  };
}

const caseta = (parcial: Partial<CasetaCalculada> = {}): CasetaCalculada => ({
  nombre: 'Caseta Zapopan',
  km: 20,
  direccion: 'Norte',
  costo: 150.25,
  ...parcial,
});

function respuesta(opciones: CostosRutaOferta[]): CostosRutaResponse {
  return {
    resultados: [
      {
        nombre: 'Viajero',
        gasolina: 'magna',
        propuesta: { razones: [], lugares: [] },
        tramos: [{ from: 'Guadalajara', to: 'Zapopan', km: 120, opciones }],
        rutaArmada: {
          tramos: [],
          totales: { km: 120, litros: 10, casetas: 250.25, subtotalMagna: 900, subtotalPremium: 1000 },
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
  };
}

const hotel = (parcial: Partial<CostosRutaHotel> & Pick<CostosRutaHotel, 'lugar' | 'checkIn' | 'checkOut'>): CostosRutaHotel => ({
  nombre: 'Hotel Centro',
  ciudad: 'Zapopan',
  noches: 1,
  habitaciones: 1,
  motivo: 'Cerca del punto',
  fuente: 'Tabulador',
  link: 'https://hotel.test/reserva',
  ...parcial,
});

function opcionElegida(parcial: Partial<OpcionCotizacion> & Pick<OpcionCotizacion, 'tipo' | 'precio'>): OpcionCotizacion {
  return {
    linea: parcial.tipo,
    moneda: 'MXN',
    url_compra: null,
    fuente: 'Motor',
    fue_elegida: true,
    ruta_captura: null,
    capturas: [],
    ...parcial,
  };
}

describe('construirCalculo', () => {
  const barato = oferta({ id: 'a', linea: 'Futura', costoGrupo: 520.456 });
  const caro = oferta({ id: 'b', linea: 'ETN', costoGrupo: 980 });
  const tramos = [tramo('Guadalajara', 'Zapopan')];
  const resultados = { 0: respuesta([barato, caro]) };

  it('conserva la recomendación del motor cuando no recibe selección', () => {
    const calculo = construirCalculo(tramos, resultados, 'solicitado');
    expect(calculo.tramos[0]).toMatchObject({
      costo: 520.46,
      moneda: 'MXN',
      url_compra: 'https://comprar.test/a',
      linea: 'Futura',
    });
  });

  it('usa la oferta seleccionada para el índice, no la primera', () => {
    const calculo = construirCalculo(tramos, resultados, 'solicitado', { 0: 'b' });
    expect(calculo.tramos[0]).toMatchObject({
      costo: 980,
      moneda: 'MXN',
      url_compra: 'https://comprar.test/b',
      linea: 'ETN',
    });
  });

  it('cae en la recomendación si el id seleccionado ya no existe', () => {
    const calculo = construirCalculo(tramos, resultados, 'solicitado', { 0: 'inexistente' });
    expect(calculo.tramos[0].linea).toBe('Futura');
  });
});

describe('leerCalculoDesdeDatos', () => {
  it('conserva costo, moneda, url_compra y linea de tramos y nodos', () => {
    const calculo = leerCalculoDesdeDatos({
      calculo: {
        generado_en: '2026-11-10T08:00:00.000Z',
        margen: 0.1,
        modo_transporte: 'solicitado',
        km_total: 120,
        horas_total: '3h 00m',
        tramos: [
          {
            de: 'Guadalajara',
            a: 'Zapopan',
            km: 120,
            duracion: '3h 00m',
            duracion_con_margen: '3h 18m',
            salida_fecha: null,
            salida_hora: null,
            llegada_fecha: null,
            llegada_hora: null,
            alcanza: true,
            casetas: [],
            costo: 980,
            moneda: 'MXN',
            url_compra: 'https://comprar.test/b',
            linea: 'ETN',
          },
        ],
        ruta: {
          puntos: [],
          nodos: [
            {
              titulo: '2. Zapopan',
              detalles: ['Llegada 14:00'],
              chips: ['120 km'],
              costo: 980,
              url_compra: 'https://comprar.test/b',
            },
          ],
          segmentos: [],
        },
      },
    });

    expect(calculo?.tramos[0]).toMatchObject({
      costo: 980,
      moneda: 'MXN',
      url_compra: 'https://comprar.test/b',
      linea: 'ETN',
    });
    expect(calculo?.ruta?.nodos[0]).toMatchObject({
      costo: 980,
      url_compra: 'https://comprar.test/b',
    });
  });
});

describe('construirOpcionesPropuesta', () => {
  it('incluye las opciones descartadas y marca solo la elegida', () => {
    const sinUrl = oferta({
      id: 'c',
      linea: 'Local',
      costoGrupo: 0,
      estimado: true,
      comprar: compra(''),
    });
    const opciones = construirOpcionesPropuesta(
      [tramo('Guadalajara', 'Zapopan')],
      { 0: respuesta([oferta({ id: 'a', linea: 'Futura', costoGrupo: 520 }), oferta({ id: 'b', linea: 'ETN', costoGrupo: 980 }), sinUrl]) },
      { 0: 'b' },
    );

    expect(opciones).toHaveLength(3);
    expect(opciones.filter((opcion) => opcion.fue_elegida)).toHaveLength(1);
    // Se conserva el orden en que el motor ofreció las alternativas.
    expect(opciones.map((opcion) => opcion.linea)).toEqual(['Futura', 'ETN', 'Local']);
    const elegida = opciones.find((opcion) => opcion.fue_elegida);
    expect(elegida).toMatchObject({ linea: 'ETN', precio: 980, url_compra: 'https://comprar.test/b' });
    expect(opciones.every((opcion) => opcion.datos?.tramo === 0)).toBe(true);
    expect(opciones[0].datos).toMatchObject({ tramo: 0, de: 'Guadalajara', a: 'Zapopan' });

    const estimada = opciones.find((opcion) => opcion.linea === 'Local');
    expect(estimada).toMatchObject({ precio: null, url_compra: null });
    expect(estimada?.fuente).toMatch(/estimado/i);
  });

  it('limita a 20 opciones por tramo sin perder la elegida', () => {
    const ofertas = Array.from({ length: 25 }, (_, i) =>
      oferta({ id: `o-${i}`, linea: `Linea ${i}`, costoGrupo: 100 + i }),
    );
    const opciones = construirOpcionesPropuesta(
      [tramo('Guadalajara', 'Zapopan')],
      { 0: respuesta(ofertas) },
      { 0: 'o-24' },
    );

    expect(opciones).toHaveLength(20);
    expect(opciones[0].linea).toBe('Linea 0');
    expect(opciones.filter((opcion) => opcion.fue_elegida).map((opcion) => opcion.linea)).toEqual(['Linea 24']);
  });

  it('agrega todas las alternativas de hotel cuando se marcó usar hotel', () => {
    const uno = hotel({ lugar: 'Zapopan', nombre: 'Hotel Uno', checkIn: '2026-11-10', checkOut: '2026-11-11' });
    const dos = hotel({
      lugar: 'Zapopan',
      nombre: 'Hotel Dos',
      checkIn: '2026-11-10',
      checkOut: '2026-11-11',
      precioTotal: 1450.555,
      link: 'https://hotel.test/dos',
    });
    const conHoteles = respuesta([oferta({ id: 'a', linea: 'Futura', costoGrupo: 520 })]);
    conHoteles.resultados[0].hotelesPropuestos = [uno, dos];

    const opciones = construirOpcionesPropuesta(
      [tramo('Guadalajara', 'Zapopan')],
      { 0: respuesta([oferta({ id: 'a', linea: 'Futura', costoGrupo: 520 })]) },
      {},
      { 0: conHoteles },
      { 0: true },
      { 0: claveHotel(dos) },
    );

    const hoteles = opciones.filter((opcion) => opcion.tipo === 'hotel');
    expect(hoteles).toHaveLength(2);
    expect(hoteles.filter((opcion) => opcion.fue_elegida)).toHaveLength(1);
    expect(hoteles.find((opcion) => opcion.fue_elegida)).toMatchObject({
      precio: 1450.56,
      url_compra: 'https://hotel.test/dos',
      datos: { tramo: 0, de: 'Guadalajara', a: 'Zapopan' },
    });
    expect(hoteles.every((opcion) => /estimado/i.test(opcion.fuente))).toBe(true);
  });

  it('persists auto components in datos without changing the selected price', () => {
    const auto = oferta({
      id: 'auto-nuevo',
      modo: 'auto',
      linea: 'Auto (cuota)',
      costoGrupo: 300,
      combustible: 180,
      casetasEstimadas: 120,
      fuente: 'OSRM + CNE (fixture)',
    });

    const opciones = construirOpcionesPropuesta(
      [tramo('Guadalajara', 'Zapopan')],
      { 0: respuesta([auto]) },
      { 0: 'auto-nuevo' },
    );

    expect(opciones).toHaveLength(1);
    expect(opciones[0].precio).toBe(300);
    expect(opciones[0].fue_elegida).toBe(true);
    expect(opciones[0].datos).toEqual({
      tramo: 0,
      de: 'Guadalajara',
      a: 'Zapopan',
      combustible: 180,
      casetas_estimadas: 120,
      source: 'OSRM + CNE (fixture)',
    });
  });
});

describe('resumenCostosRuta', () => {
  const calculo: CalculoViaje = {
    generado_en: '2026-11-10T08:00:00.000Z',
    margen: 0.1,
    modo_transporte: 'propio',
    km_total: 120,
    horas_total: null,
    tramos: [
      {
        de: 'Guadalajara',
        a: 'Zapopan',
        km: 120,
        duracion: null,
        duracion_con_margen: null,
        salida_fecha: null,
        salida_hora: null,
        llegada_fecha: null,
        llegada_hora: null,
        alcanza: null,
        casetas: [caseta({ costo: 72 })],
      },
    ],
  };
  const opciones = [
    opcionElegida({ tipo: 'autobus', precio: 500.25 }),
    opcionElegida({ tipo: 'hotel', precio: 1200 }),
    opcionElegida({ tipo: 'taxi', precio: 80.5 }),
    opcionElegida({ tipo: 'auto', precio: 300 }),
    opcionElegida({ tipo: 'vuelo', precio: 999, fue_elegida: false }),
    opcionElegida({ tipo: 'autobus', precio: 222, fue_elegida: false }),
  ];

  it('keeps legacy auto combined and never adds the SCT reference', () => {
    expect(resumenCostosRuta(calculo, opciones, 'propio')).toEqual({
      autobus: 500.25,
      avion: null,
      gasolina: 300,
      casetas: null,
      hospedaje: 1200,
      comida: null,
      taxi: 80.5,
      total: 2080.75,
    });
  });

  it('splits new auto 300 into fuel 180 and toll 120 without adding reference 72', () => {
    const autoNuevo = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
    });

    expect(resumenCostosRuta(calculo, [autoNuevo], 'propio')).toEqual({
      autobus: null,
      avion: null,
      gasolina: 180,
      casetas: 120,
      hospedaje: null,
      comida: null,
      taxi: null,
      total: 300,
    });
  });

  it('keeps rental and legacy auto combined when mixed with a new auto', () => {
    const seleccion = [
      opcionElegida({
        tipo: 'auto',
        precio: 300,
        datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
      }),
      opcionElegida({ tipo: 'auto', precio: 500 }),
      opcionElegida({ tipo: 'renta', precio: 900 }),
    ];

    const resumen = resumenCostosRuta(calculo, seleccion, 'propio');
    expect(resumen.gasolina).toBe(1580);
    expect(resumen.casetas).toBe(120);
    expect(resumen.total).toBe(1700);
  });

  it('falls back to the combined price when components do not reconcile', () => {
    const inconsistente = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 60, source: 'OSRM + CNE (fixture)' },
    });

    const resumen = resumenCostosRuta(calculo, [inconsistente], 'propio');
    expect(resumen.gasolina).toBe(300);
    expect(resumen.casetas).toBeNull();
    expect(resumen.total).toBe(300);
  });

  it('does not add reference tolls for requested transportation', () => {
    const resumen = resumenCostosRuta(calculo, opciones, 'solicitado');
    expect(resumen.casetas).toBeNull();
    expect(resumen.total).toBe(2080.75);
  });

  it('includes existing food cost so preview matches authorization', () => {
    const autoNuevo = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
    });

    const resumen = resumenCostosRuta(calculo, [autoNuevo], 'propio', 350);
    expect(resumen).toMatchObject({ gasolina: 180, casetas: 120, comida: 350, total: 650 });
  });

  it('leaves concepts null when nothing is selected instead of inventing zeros', () => {
    expect(resumenCostosRuta(calculo, [], 'solicitado')).toEqual({
      autobus: null,
      avion: null,
      gasolina: null,
      casetas: null,
      hospedaje: null,
      comida: null,
      taxi: null,
      total: null,
    });
  });
});

function destinoParaTramos(
  nombre: string,
  municipio: string,
  llegada: { fecha: string; hora: string },
  salida: { fecha: string; hora: string },
) {
  return {
    id: `dest-${nombre}`,
    punto: punto(nombre, municipio),
    debeEstarFecha: llegada.fecha,
    debeEstarHora: llegada.hora,
    saleFecha: salida.fecha,
    saleHora: salida.hora,
    hospedaje: {
      necesario: false,
      zona: 'actual' as const,
      fechaEntrada: '',
      fechaSalida: '',
      hotel: null,
    },
  };
}

function solicitudParaTramos(destinos: ReturnType<typeof destinoParaTramos>[]): Solicitud {
  return {
    id_solicitud: 1,
    id_usuario_solicitante: 7,
    periodo: '2026-11',
    gerencia: 'IMSS',
    estado: 'borrador',
    activo: true,
    fecha_creacion: '2026-11-01T08:00:00.000Z',
    fecha_modificacion: '2026-11-01T08:00:00.000Z',
    datos: {
      version: 'solicitud-v2',
      persona: { modo: 'mia', empleadoId: null, nombre: 'Viajero', motivo: 'Visita' },
      transporte: { modo: 'propio', compartir: false, acompanantes: [] },
      origen: {
        punto: punto('Origen', 'Guadalajara'),
        fechaSalida: '2026-11-10',
        horaSalida: '06:00',
      },
      destinos,
      retorno: {
        necesario: true,
        llegadaRequeridaFecha: '',
        llegadaRequeridaHora: '',
        destino: 'origen',
        punto: null,
      },
    },
    opciones: [],
    eventos: [],
  };
}

describe('construirTramos destination departure', () => {
  it('uses each explicit departure for the next leg and the return to origin', () => {
    const resultado = construirTramos(solicitudParaTramos([
      destinoParaTramos(
        'Centro Zapopan',
        'Zapopan',
        { fecha: '2026-11-10', hora: '10:00' },
        { fecha: '2026-11-10', hora: '16:30' },
      ),
      destinoParaTramos(
        'Centro Tlajomulco',
        'Tlajomulco',
        { fecha: '2026-11-11', hora: '09:00' },
        { fecha: '2026-11-11', hora: '15:45' },
      ),
    ]));

    expect(resultado.error).toBeNull();
    expect(resultado.tramos).toHaveLength(3);
    expect(resultado.tramos[1]).toMatchObject({
      desde: {
        fecha: '2026-11-10',
        hora: '16:30',
        nombre: 'Zapopan, Jalisco',
        explicita: true,
      },
      esRegreso: false,
    });
    expect(resultado.tramos[2]).toMatchObject({
      desde: {
        fecha: '2026-11-11',
        hora: '15:45',
        nombre: 'Tlajomulco, Jalisco',
        explicita: true,
      },
      hasta: {
        fecha: '2026-11-11',
        hora: '17:45',
        nombre: 'Regreso al origen',
      },
      esRegreso: true,
    });
  });

  it('retains the two-hour fallback for a legacy draft without departure', () => {
    const resultado = construirTramos(solicitudParaTramos([
      destinoParaTramos(
        'Centro Zapopan',
        'Zapopan',
        { fecha: '2026-11-10', hora: '23:30' },
        { fecha: '', hora: '' },
      ),
    ]));

    expect(resultado.error).toBeNull();
    expect(resultado.tramos).toHaveLength(2);
    expect(resultado.tramos[1]).toMatchObject({
      desde: {
        fecha: '2026-11-11',
        hora: '01:30',
        explicita: false,
      },
      hasta: {
        fecha: '2026-11-11',
        hora: '03:30',
        nombre: 'Regreso al origen',
      },
      esRegreso: true,
    });
  });
});
