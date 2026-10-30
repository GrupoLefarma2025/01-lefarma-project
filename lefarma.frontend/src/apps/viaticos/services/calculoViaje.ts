import type {
  CostosRutaHotel,
  CostosRutaLugarInput,
  CostosRutaOferta,
  CostosRutaRequest,
  CostosRutaResponse,
  PuntoSeleccion,
} from '../types/costosRuta.types';
import type {
  CalculoViaje,
  OpcionCotizacion,
  ParadaCalculada,
  ResumenCostosRuta,
  Solicitud,
} from '../types/solicitud.types';
import { hidratarSolicitud } from './solicitudDraft';
import { casetasDeRuta } from './casetasRuta';

/** Margen que se suma al tiempo de recorrido para no llegar justo al límite. */
export const MARGEN_CARRO = 0.1;

export interface SalidaAproximada {
  fecha: string;
  hora: string;
  minutos: number;
}

export function duracionTexto(minutos: number): string {
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
}

/** Fecha con el nombre completo del día ("Miércoles, 21/10/2026"). */
export function fechaCorta(fecha: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const texto = new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Hora en 12 h con AM/PM ("11:07 AM"). */
export function horaAmPm(hora: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const [hh, mm] = hora.split(':').map(Number);
  const sufijo = hh < 12 ? 'AM' : 'PM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

/** Minutos del recorrido con el margen aplicado. */
export function minutosConMargen(duracion: string): number | null {
  const partes = duracion.match(/(\d+)h\s*(\d+)m/);
  if (!partes) return null;
  return Math.ceil((Number(partes[1]) * 60 + Number(partes[2])) * (1 + MARGEN_CARRO));
}

export function sumarMinutos(fecha: string, hora: string, minutos: number): { fecha: string; hora: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() + minutos);
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

/** Hora límite de salida para llegar a `fecha`/`hora` con el recorrido dado. */
export function salidaAproximada(fecha: string, hora: string, duracion: string): SalidaAproximada | null {
  const minutos = minutosConMargen(duracion);
  if (minutos === null || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const llegada = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(llegada.getTime())) return null;
  const salida = new Date(llegada.getTime() - minutos * 60_000);
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${salida.getFullYear()}-${dos(salida.getMonth() + 1)}-${dos(salida.getDate())}`,
    hora: `${dos(salida.getHours())}:${dos(salida.getMinutes())}`,
    minutos,
  };
}

function separarIso(iso: string | null | undefined): { fecha: string | null; hora: string | null } {
  if (!iso) return { fecha: null, hora: null };
  const [fecha, hora] = iso.split('T');
  return { fecha: fecha ?? null, hora: hora ? hora.slice(0, 5) : null };
}

/**
 * Lee el cálculo de la ruta guardado en `datos.calculo` (se escribe al
 * enviar). Devuelve `null` si la solicitud todavía no tiene cálculo.
 */
export function leerCalculoDesdeDatos(datos: unknown): CalculoViaje | null {
  return leerCalculo(datos, 'calculo');
}

/**
 * Lee la ruta que el concentrado autorizó. Puede ser la misma que eligió la
 * persona viajera o una nueva generada por el revisor; vive aparte en
 * `datos.calculo_autorizado` para no perder la ruta calculada original.
 */
export function leerCalculoAutorizadoDesdeDatos(datos: unknown): CalculoViaje | null {
  return leerCalculo(datos, 'calculo_autorizado');
}

function leerCalculo(datos: unknown, clave: 'calculo' | 'calculo_autorizado'): CalculoViaje | null {
  const raiz = typeof datos === 'object' && datos !== null && !Array.isArray(datos)
    ? (datos as Record<string, unknown>)
    : null;
  const bruto = raiz && typeof raiz[clave] === 'object' && raiz[clave] !== null && !Array.isArray(raiz[clave])
    ? (raiz[clave] as Record<string, unknown>)
    : null;
  if (!bruto || !Array.isArray(bruto.tramos)) return null;

  const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
  const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const tramos = bruto.tramos
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t) => ({
      de: texto(t.de) ?? 'Origen',
      a: texto(t.a) ?? 'Destino',
      km: numero(t.km),
      duracion: texto(t.duracion),
      duracion_con_margen: texto(t.duracion_con_margen),
      salida_fecha: texto(t.salida_fecha),
      salida_hora: texto(t.salida_hora),
      llegada_fecha: texto(t.llegada_fecha),
      llegada_hora: texto(t.llegada_hora),
      alcanza: typeof t.alcanza === 'boolean' ? t.alcanza : null,
      casetas: (Array.isArray(t.casetas) ? t.casetas : [])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map((c) => ({
          nombre: texto(c.nombre) ?? 'Caseta',
          km: numero(c.km) ?? 0,
          direccion: texto(c.direccion) ?? '',
          costo: numero(c.costo),
        })),
      costo: numero(t.costo),
      moneda: texto(t.moneda),
      url_compra: texto(t.url_compra),
      linea: texto(t.linea),
    }));

  const rutaBruta = typeof bruto.ruta === 'object' && bruto.ruta !== null && !Array.isArray(bruto.ruta)
    ? (bruto.ruta as Record<string, unknown>)
    : null;
  const tiposPunto = new Set(['origen', 'punto', 'hotel', 'regreso', 'terminal']);
  const ruta = rutaBruta
    ? {
        puntos: (Array.isArray(rutaBruta.puntos) ? rutaBruta.puntos : [])
          .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
          .map((p) => {
            const tipo = texto(p.tipo) ?? 'punto';
            return {
              lat: numero(p.lat) ?? 0,
              lng: numero(p.lng) ?? 0,
              nombre: texto(p.nombre) ?? 'Punto',
              tipo: (tiposPunto.has(tipo) ? tipo : 'punto') as ParadaCalculada['tipo'],
              detalle: texto(p.detalle) ?? undefined,
            };
          })
          .filter((p) => p.lat !== 0 || p.lng !== 0),
        nodos: (Array.isArray(rutaBruta.nodos) ? rutaBruta.nodos : [])
          .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
          .map((n) => ({
            titulo: texto(n.titulo) ?? 'Parada',
            detalles: (Array.isArray(n.detalles) ? n.detalles : [])
              .map((d) => texto(d))
              .filter((d): d is string => d !== null),
            chips: (Array.isArray(n.chips) ? n.chips : [])
              .map((c) => texto(c))
              .filter((c): c is string => c !== null),
            costo: numero(n.costo),
            url_compra: texto(n.url_compra),
          })),
        segmentos: (Array.isArray(rutaBruta.segmentos) ? rutaBruta.segmentos : [])
          .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
          .map((s) => {
            const tipo = texto(s.tipo) ?? 'carretera';
            const puntos = (Array.isArray(s.puntos) ? s.puntos : [])
              .filter((p): p is unknown[] => Array.isArray(p) && p.length >= 2)
              .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
              .filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
            return {
              tipo: (tipo === 'taxi' || tipo === 'transporte' ? tipo : 'carretera') as 'taxi' | 'transporte' | 'carretera',
              puntos,
            };
          })
          .filter((s) => s.puntos.length > 1),
      }
    : null;

  return {
    generado_en: texto(bruto.generado_en) ?? '',
    margen: numero(bruto.margen) ?? 0,
    modo_transporte: bruto.modo_transporte === 'propio' ? 'propio' : 'solicitado',
    km_total: numero(bruto.km_total),
    horas_total: texto(bruto.horas_total),
    tramos,
    ruta,
  };
}

const dosDecimales = (valor: number): number => Math.round(valor * 100) / 100;

/** Único punto que decide qué oferta representa un tramo en el cálculo. */
export function ofertaCalculada(
  respuesta: CostosRutaResponse | undefined,
  idSeleccionado?: string | null,
): CostosRutaOferta | undefined {
  const persona = respuesta?.resultados[0];
  const opciones = persona?.tramos.flatMap((t) => t.opciones) ?? [];
  if (opciones.length === 0) return undefined;
  if (idSeleccionado) {
    const elegida = opciones.find((opcion) => opcion.id === idSeleccionado);
    if (elegida) return elegida;
  }
  // En carro se toma la misma oferta que usa la ruta armada (la de cuota si
  // su costo coincide), para que km y tiempo cuadren con lo que se ve.
  const totalRuta = persona?.rutaArmada.totales.subtotalMagna ?? null;
  const ofertaAuto =
    opciones.find((o) => o.modo === 'auto' && totalRuta !== null && Math.abs(o.costoGrupo - totalRuta) < 1) ??
    opciones.find((o) => o.modo === 'auto');
  return ofertaAuto ?? opciones[0];
}

/** Clave estable de un hotel, la misma que usa la UI para marcarlo. */
export function claveHotel(hotel: { lugar: string; nombre?: string; checkIn: string; distanciaKm?: number }): string {
  return `${hotel.nombre ?? hotel.lugar}|${hotel.checkIn}|${hotel.distanciaKm ?? ''}`;
}

function precioOferta(oferta: CostosRutaOferta): number | null {
  if (typeof oferta.costoGrupo !== 'number' || !Number.isFinite(oferta.costoGrupo)) return null;
  // Un estimado sin costo no se convierte en $0: el backend solo admite
  // precio null cuando la fuente es estimada.
  if (oferta.estimado && oferta.costoGrupo <= 0) return null;
  return dosDecimales(oferta.costoGrupo);
}

function urlCompraValida(valor: string | null | undefined): string | null {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto === '' ? null : texto;
}

function fuenteConEstimado(fuente: string, estimado: boolean): string {
  if (!estimado) return fuente;
  return /estimad/i.test(fuente) ? fuente : `${fuente} (estimado)`;
}

/**
 * Modo del motor -> tipo que se guarda en `solicitud_opciones.tipo`. El CHECK
 * de la tabla solo acepta estos valores; guardar el modo crudo ('avion',
 * 'bus', 'uber') hacía fallar el envío con un error 500.
 */
const TIPO_OPCION: Record<string, string> = {
  avion: 'vuelo',
  bus: 'autobus',
  auto: 'auto',
  renta: 'renta',
  uber: 'taxi',
  taxi: 'taxi',
  publico: 'publico',
  metro: 'publico',
};

interface DatosOpcionPropuesta {
  tramo: number;
  de: string;
  a: string;
  [clave: string]: unknown;
}

function opcionDesdeOferta(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
  fueElegida: boolean,
): OpcionCotizacion {
  const capturas = oferta.capturas ?? (oferta.rutaCaptura ? [oferta.rutaCaptura] : []);
  const precio = precioOferta(oferta);
  // El backend solo admite precio null cuando la fuente declara que es
  // estimada; si el motor no trae costo, la fuente lo dice explícitamente.
  const estimado = oferta.estimado || precio === null;
  return {
    tipo: TIPO_OPCION[oferta.modo] ?? oferta.modo,
    linea: oferta.linea,
    precio,
    moneda: 'MXN',
    url_compra: urlCompraValida(oferta.comprar?.url),
    fuente: fuenteConEstimado(oferta.fuente?.trim() || 'Motor', estimado),
    fue_elegida: fueElegida,
    ruta_captura: capturas[0] ?? null,
    capturas,
    datos,
  };
}

function opcionDesdeHotel(
  hotel: CostosRutaHotel,
  datos: DatosOpcionPropuesta,
  fueElegida: boolean,
): OpcionCotizacion {
  const capturas = hotel.capturas ?? (hotel.rutaCaptura ? [hotel.rutaCaptura] : []);
  const precio = hotel.precioTotal ?? hotel.precioNoche ?? null;
  return {
    tipo: 'hotel',
    linea: `${hotel.nombre ?? hotel.lugar} (${hotel.checkIn} al ${hotel.checkOut})`,
    precio: typeof precio === 'number' && Number.isFinite(precio) ? dosDecimales(precio) : null,
    moneda: 'MXN',
    url_compra: urlCompraValida(hotel.link),
    fuente: fuenteConEstimado(hotel.fuente?.trim() || 'Hotel propuesto', true),
    fue_elegida: fueElegida,
    ruta_captura: capturas[0] ?? null,
    capturas,
    datos,
  };
}

/** Tope de opciones que se guardan por tramo para no inflar el payload. */
export const MAX_OPCIONES_POR_TRAMO = 20;

/**
 * Todas las opciones que el motor ofreció, no solo las elegidas. La marca
 * `fue_elegida` sigue la selección del wizard y los hoteles propuestos solo
 * entran cuando la persona marcó dormir en ese tramo.
 */
export function construirOpcionesPropuesta(
  tramos: TramoViaje[],
  resultados: Record<number, CostosRutaResponse>,
  seleccion: Record<number, string> = {},
  hotelResultados: Record<number, CostosRutaResponse> = {},
  usarHotel: Record<number, boolean> = {},
  hotelElegido: Record<number, string> = {},
): OpcionCotizacion[] {
  const opciones: OpcionCotizacion[] = [];

  tramos.forEach((tramo, indice) => {
    const datos: DatosOpcionPropuesta = { tramo: indice, de: tramo.desde.nombre, a: tramo.hasta.nombre };
    const idElegido = seleccion[indice] ?? null;
    const persona = resultados[indice]?.resultados[0];
    const ofertas = persona?.tramos.flatMap((t) => t.opciones) ?? [];
    const vistas = new Set<string>();
    const candidatas: OpcionCotizacion[] = [];

    for (const oferta of ofertas) {
      if (vistas.has(oferta.id)) continue;
      vistas.add(oferta.id);
      candidatas.push(opcionDesdeOferta(oferta, datos, idElegido !== null && oferta.id === idElegido));
    }

    if (usarHotel[indice] === true) {
      const clave = hotelElegido[indice] ?? null;
      const hoteles = hotelResultados[indice]?.resultados[0]?.hotelesPropuestos ?? [];
      for (const hotel of hoteles) {
        candidatas.push(opcionDesdeHotel(hotel, datos, clave !== null && claveHotel(hotel) === clave));
      }
    }

    // El tope no debe perder la decisión ni el hospedaje: se reservan primero
    // esos lugares y el recorte conserva el orden en que el motor ofreció.
    if (candidatas.length > MAX_OPCIONES_POR_TRAMO) {
      const mantener = new Set<number>();
      candidatas.forEach((opcion, posicion) => {
        if (opcion.fue_elegida && mantener.size < MAX_OPCIONES_POR_TRAMO) mantener.add(posicion);
      });
      candidatas.forEach((opcion, posicion) => {
        if (opcion.tipo === 'hotel' && !mantener.has(posicion) && mantener.size < MAX_OPCIONES_POR_TRAMO) {
          mantener.add(posicion);
        }
      });
      for (let posicion = 0; posicion < candidatas.length && mantener.size < MAX_OPCIONES_POR_TRAMO; posicion += 1) {
        if (!mantener.has(posicion)) mantener.add(posicion);
      }
      opciones.push(...candidatas.filter((_opcion, posicion) => mantener.has(posicion)));
    } else {
      opciones.push(...candidatas);
    }
  });

  return opciones;
}

/**
 * Resumen de costos de la versión calculada. Un concepto sin opciones elegidas
 * se queda en `null` (no aplica / no se conoce), nunca en cero inventado.
 */
export function resumenCostosRuta(
  calculo: CalculoViaje,
  opciones: OpcionCotizacion[],
  modoTransporte: 'propio' | 'solicitado',
): ResumenCostosRuta {
  const sumarElegidas = (filtro: (opcion: OpcionCotizacion) => boolean): number | null => {
    const precios = opciones
      .filter((opcion) => opcion.fue_elegida && filtro(opcion))
      .map((opcion) => opcion.precio)
      .filter((precio): precio is number => typeof precio === 'number' && Number.isFinite(precio));
    if (precios.length === 0) return null;
    return dosDecimales(precios.reduce((suma, precio) => suma + precio, 0));
  };

  const casetas = modoTransporte === 'propio'
    ? (() => {
        const costos = calculo.tramos
          .flatMap((tramo) => tramo.casetas)
          .map((caseta) => caseta.costo)
          .filter((costo): costo is number => typeof costo === 'number' && Number.isFinite(costo));
        return costos.length > 0 ? dosDecimales(costos.reduce((suma, costo) => suma + costo, 0)) : null;
      })()
    : null;

  const autobus = sumarElegidas((opcion) => opcion.tipo === 'autobus');
  const avion = sumarElegidas((opcion) => opcion.tipo === 'vuelo');
  const gasolina = sumarElegidas((opcion) => opcion.tipo === 'auto' || opcion.tipo === 'renta');
  const hospedaje = sumarElegidas((opcion) => opcion.tipo === 'hotel');
  const taxi = sumarElegidas((opcion) => opcion.tipo === 'taxi');
  const conceptos = [autobus, avion, gasolina, casetas, hospedaje, taxi];
  const total = conceptos.some((valor) => valor !== null)
    ? dosDecimales(conceptos.reduce<number>((suma, valor) => suma + (valor ?? 0), 0))
    : null;

  return { autobus, avion, gasolina, casetas, hospedaje, comida: null, taxi, total };
}

/**
 * Resumen de la ruta calculada por tramo: kilómetros, tiempos (con y sin
 * margen), hora de salida/llegada y las casetas de referencia. Es la ruta que
 * manda después del envío (se guarda en `datos.calculo`).
 *
 * `seleccion` fija la oferta de cada tramo por índice; sin ella se conserva la
 * recomendación del motor (la misma oferta que dibuja la ruta armada).
 */
export function construirCalculo(
  tramos: TramoViaje[],
  resultados: Record<number, CostosRutaResponse>,
  modoTransporte: 'propio' | 'solicitado',
  seleccion?: Record<number, string>,
): CalculoViaje {
  const calculados = tramos.map((tramo, indice) => {
    const respuesta = resultados[indice];
    const persona = respuesta?.resultados[0];
    const oferta = ofertaCalculada(respuesta, seleccion?.[indice] ?? null);
    const km = persona?.rutaArmada.totales.km ?? persona?.tramos[0]?.km ?? null;
    const duracion = oferta?.duracion ?? null;
    const minutos = duracion ? minutosConMargen(duracion) : null;

    const salidaDesde = tramo.desde.fecha && tramo.desde.hora
      ? { fecha: tramo.desde.fecha, hora: tramo.desde.hora }
      : null;
    const llegadaEstimada = salidaDesde && minutos !== null
      ? sumarMinutos(salidaDesde.fecha, salidaDesde.hora, minutos)
      : null;
    const limiteSalida = tramo.hasta.fecha && tramo.hasta.hora && duracion
      ? salidaAproximada(tramo.hasta.fecha, tramo.hasta.hora, duracion)
      : null;

    // Solo se tratan las horas como recorrido en carro cuando la oferta
    // elegida es efectivamente auto; elegir un camión debe respetar sus horas.
    const esCarro = modoTransporte === 'propio' && oferta?.modo === 'auto';
    const salida = esCarro
      ? (salidaDesde ?? (limiteSalida ? { fecha: limiteSalida.fecha, hora: limiteSalida.hora } : null))
      : separarIso(oferta?.salida);
    const llegada = esCarro
      ? (llegadaEstimada ?? separarIso(oferta?.llegada))
      : separarIso(oferta?.llegada);
    const alcanza = esCarro
      ? llegada !== null && tramo.hasta.fecha && tramo.hasta.hora
        ? `${llegada.fecha}T${llegada.hora}` <= `${tramo.hasta.fecha}T${tramo.hasta.hora}`
        : null
      : (oferta?.aTiempo ?? null);

    const casetasMotor = (persona?.casetas ?? [])
      .filter(
        (c) => c.deMunicipio === tramo.desde.punto.municipio && c.aMunicipio === tramo.hasta.punto.municipio,
      )
      .map((c) => ({
        nombre: c.nombre,
        km: c.km,
        direccion: c.direccion || c.carretera,
        costo: c.tarifa,
      }));

    return {
      de: tramo.desde.nombre,
      a: tramo.hasta.nombre,
      km,
      duracion,
      duracion_con_margen: minutos !== null ? duracionTexto(minutos) : null,
      salida_fecha: salida?.fecha ?? null,
      salida_hora: salida?.hora ?? null,
      llegada_fecha: llegada?.fecha ?? null,
      llegada_hora: llegada?.hora ?? null,
      alcanza,
      casetas: casetasMotor.length > 0 ? casetasMotor : casetasDeRuta(tramo.desde.nombre, tramo.hasta.nombre),
      costo: oferta ? precioOferta(oferta) : null,
      moneda: 'MXN',
      url_compra: oferta ? urlCompraValida(oferta.comprar?.url) : null,
      linea: oferta?.linea ?? null,
    };
  });

  const kmTotal = calculados.reduce((suma, t) => suma + (t.km ?? 0), 0);
  const minutosTotal = calculados.reduce(
    (suma, t) => suma + (t.duracion_con_margen ? minutosConMargen(t.duracion ?? '') ?? 0 : 0),
    0,
  );

  return {
    generado_en: new Date().toISOString(),
    margen: MARGEN_CARRO,
    modo_transporte: modoTransporte,
    km_total: calculados.some((t) => t.km !== null) ? Math.round(kmTotal * 10) / 10 : null,
    horas_total: minutosTotal > 0 ? duracionTexto(minutosTotal) : null,
    tramos: calculados,
  };
}

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const esHora = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

function sumarHoras(fecha: string, hora: string, horas: number): { fecha: string; hora: string } | null {
  if (!esFecha(fecha) || !esHora(hora)) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + horas);
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

function restarDias(fecha: string, dias: number): string {
  if (!esFecha(fecha)) return fecha;
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function nombreLugar(punto: PuntoSeleccion): string {
  const partes = [punto.municipio, punto.estado].filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return partes.length > 0 ? partes.join(', ') : punto.nombre;
}

export interface TramoViaje {
  desde: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string; explicita: boolean };
  hasta: { punto: PuntoSeleccion; fecha: string; hora: string; nombre: string };
  esRegreso: boolean;
}

/**
 * Divide el viaje en tramos: origen → destino 1 → … → regreso. Las salidas de
 * los destinos son opcionales: si faltan, se estima la salida 2 h después de la
 * llegada. El regreso usa como límite la salida del último destino + 2 h.
 */
export function construirTramos(solicitud: Solicitud): { tramos: TramoViaje[]; error: string | null } {
  const datos = hidratarSolicitud(solicitud.datos);
  if (!datos) return { tramos: [], error: 'La solicitud no tiene un snapshot reconocible.' };
  const origen = datos.origen.punto;
  if (!origen) return { tramos: [], error: 'El origen no tiene coordenadas.' };

  const destinos = datos.destinos.filter(
    (destino) => destino.punto && esFecha(destino.debeEstarFecha) && esHora(destino.debeEstarHora),
  );

  const tramos: TramoViaje[] = [];
  let desde = {
    punto: origen,
    fecha: datos.origen.fechaSalida,
    hora: datos.origen.horaSalida,
    nombre: nombreLugar(origen),
    explicita: Boolean(datos.origen.fechaSalida),
  };

  for (const destino of destinos) {
    if (!destino.punto) continue;
    tramos.push({
      desde,
      hasta: {
        punto: destino.punto,
        fecha: destino.debeEstarFecha,
        hora: destino.debeEstarHora,
        nombre: nombreLugar(destino.punto),
      },
      esRegreso: false,
    });
    const salida = destino.saleFecha && destino.saleHora
      ? { fecha: destino.saleFecha, hora: destino.saleHora }
      : sumarHoras(destino.debeEstarFecha, destino.debeEstarHora, 2);
    desde = {
      punto: destino.punto,
      fecha: salida?.fecha ?? '',
      hora: salida?.hora ?? '',
      nombre: nombreLugar(destino.punto),
      explicita: Boolean(destino.saleFecha),
    };
  }

  const regreso = datos.retorno.destino === 'origen' ? origen : datos.retorno.punto;
  if (regreso) {
    const limite = sumarHoras(desde.fecha, desde.hora, 2);
    tramos.push({
      desde,
      hasta: {
        punto: regreso,
        fecha: limite?.fecha ?? '',
        hora: limite?.hora ?? '',
        nombre: datos.retorno.destino === 'origen' ? 'Regreso al origen' : nombreLugar(regreso),
      },
      esRegreso: true,
    });
  }

  return tramos.length > 0
    ? { tramos, error: null }
    : { tramos: [], error: 'Agrega al menos un destino con fecha y hora de llegada.' };
}

function personaBase(solicitud: Solicitud): { nombre: string; carroPropio: boolean } {
  const datos = hidratarSolicitud(solicitud.datos);
  return {
    nombre: datos?.persona.nombre || 'Viajero',
    carroPropio: datos?.transporte.modo === 'propio',
  };
}

function requestConLugares(solicitud: Solicitud, lugares: CostosRutaLugarInput[], calcularHoteles: boolean): CostosRutaRequest {
  const { nombre, carroPropio } = personaBase(solicitud);
  return {
    opciones: {
      respetarHorarioLaboral: true,
      calcularHoteles,
      calcularViajesIntermedios: false,
      compartirViaje: false,
    },
    personas: [
      {
        nombre,
        carro_propio: carroPropio,
        gasolina: 'magna',
        draft: false,
        trabajo: { hora_entrada: '07:00', hora_salida: '18:30', primer_dia_laboral: 1, ultimo_dia_laboral: 5 },
        lugares,
      },
    ],
  };
}

/** Request del motor para un tramo normal o el regreso. */
export function construirRequestTramo(solicitud: Solicitud, tramo: TramoViaje): CostosRutaRequest {
  const salida: CostosRutaLugarInput = {
    orden: 1,
    tipo: 'salida',
    nombre: tramo.desde.nombre,
    latitud: tramo.desde.punto.latitud,
    longitud: tramo.desde.punto.longitud,
    municipio: tramo.desde.punto.municipio,
    estado: tramo.desde.punto.estado,
  };
  if (esFecha(tramo.desde.fecha) && esHora(tramo.desde.hora)) {
    salida.fecha_salida = tramo.desde.fecha;
    salida.hora_salida = tramo.desde.hora;
  }

  if (tramo.esRegreso) {
    return requestConLugares(solicitud, [
      salida,
      {
        orden: 2,
        tipo: 'punto',
        nombre: tramo.hasta.nombre,
        latitud: tramo.hasta.punto.latitud,
        longitud: tramo.hasta.punto.longitud,
        municipio: tramo.hasta.punto.municipio,
        estado: tramo.hasta.punto.estado,
        fecha_limite_llegada: tramo.hasta.fecha,
        hora_limite_llegada: tramo.hasta.hora,
      },
    ], false);
  }

  return requestConLugares(solicitud, [
    salida,
    {
      orden: 2,
      tipo: 'taller',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      municipio: tramo.hasta.punto.municipio,
      estado: tramo.hasta.punto.estado,
      fecha_inicio_actividad: tramo.hasta.fecha,
      hora_inicio_actividad: tramo.hasta.hora,
    },
  ], false);
}

/**
 * Request para la opción "salir el día anterior": origen → hotel (noche previa)
 * → primer destino. El motor propone hoteles cerca del destino.
 */
export function construirRequestHotel(solicitud: Solicitud, tramo: TramoViaje): CostosRutaRequest | null {
  const diaDestino = tramo.hasta.fecha;
  if (!esFecha(diaDestino) || !tramo.desde.punto) return null;
  const diaPrevio = restarDias(diaDestino, 1);
  const limite = sumarHoras(tramo.hasta.fecha, tramo.hasta.hora, -1);

  return requestConLugares(solicitud, [
    {
      orden: 1,
      tipo: 'salida',
      nombre: tramo.desde.nombre,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      municipio: tramo.desde.punto.municipio,
      estado: tramo.desde.punto.estado,
      fecha_salida: diaPrevio,
      hora_salida: '18:00',
    },
    {
      orden: 2,
      tipo: 'hotel',
      nombre: `Hotel cerca de ${tramo.hasta.nombre}`,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      municipio: tramo.hasta.punto.municipio,
      estado: tramo.hasta.punto.estado,
      fecha_llegada: diaPrevio,
      hora_llegada: '20:00',
      fecha_salida: limite?.fecha ?? diaDestino,
      hora_salida: limite?.hora ?? '06:00',
    },
    {
      orden: 3,
      tipo: 'taller',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      municipio: tramo.hasta.punto.municipio,
      estado: tramo.hasta.punto.estado,
      fecha_inicio_actividad: tramo.hasta.fecha,
      hora_inicio_actividad: tramo.hasta.hora,
    },
  ], true);
}

/**
 * Regreso con hotel: el viajero duerme en el último punto y regresa al día
 * siguiente. La ruta es último punto → hotel cercano → origen.
 */
export function construirRequestHotelRegreso(
  solicitud: Solicitud,
  tramo: TramoViaje,
): CostosRutaRequest | null {
  if (!tramo.esRegreso || !esFecha(tramo.desde.fecha) || !esHora(tramo.desde.hora)) return null;
  const diaHotel = tramo.desde.fecha;
  const diaSiguiente = sumarHoras(diaHotel, '12:00', 24)?.fecha ?? diaHotel;
  const checkIn = sumarHoras(diaHotel, tramo.desde.hora, 1);

  return requestConLugares(solicitud, [
    {
      orden: 1,
      tipo: 'salida',
      nombre: tramo.desde.nombre,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      municipio: tramo.desde.punto.municipio,
      estado: tramo.desde.punto.estado,
      fecha_salida: diaHotel,
      hora_salida: tramo.desde.hora,
    },
    {
      orden: 2,
      tipo: 'hotel',
      nombre: `Hotel cerca de ${tramo.desde.nombre}`,
      latitud: tramo.desde.punto.latitud,
      longitud: tramo.desde.punto.longitud,
      municipio: tramo.desde.punto.municipio,
      estado: tramo.desde.punto.estado,
      fecha_llegada: checkIn?.fecha ?? diaHotel,
      hora_llegada: checkIn?.hora ?? '20:00',
      fecha_salida: diaSiguiente,
      hora_salida: '06:00',
    },
    {
      orden: 3,
      tipo: 'punto',
      nombre: tramo.hasta.nombre,
      latitud: tramo.hasta.punto.latitud,
      longitud: tramo.hasta.punto.longitud,
      municipio: tramo.hasta.punto.municipio,
      estado: tramo.hasta.punto.estado,
      fecha_limite_llegada: diaSiguiente,
      hora_limite_llegada: '18:30',
    },
  ], true);
}
