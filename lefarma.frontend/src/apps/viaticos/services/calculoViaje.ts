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

export const MARGEN_CARRO = 0.1;

export interface SalidaAproximada {
  fecha: string;
  hora: string;
  minutos: number;
}

export function duracionTexto(minutos: number): string {
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
}

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

export function horaAmPm(hora: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const [hh, mm] = hora.split(':').map(Number);
  const sufijo = hh < 12 ? 'AM' : 'PM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

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

export function leerCalculoDesdeDatos(datos: unknown): CalculoViaje | null {
  return leerCalculo(datos, 'calculo');
}

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
  const totalRuta = persona?.rutaArmada.totales.subtotalMagna ?? null;
  const ofertaAuto =
    opciones.find((o) => o.modo === 'auto' && totalRuta !== null && Math.abs(o.costoGrupo - totalRuta) < 1) ??
    opciones.find((o) => o.modo === 'auto');
  return ofertaAuto ?? opciones[0];
}

export function claveHotel(hotel: { lugar: string; nombre?: string; checkIn: string; distanciaKm?: number }): string {
  return `${hotel.nombre ?? hotel.lugar}|${hotel.checkIn}|${hotel.distanciaKm ?? ''}`;
}

function precioOferta(oferta: CostosRutaOferta): number | null {
  if (typeof oferta.costoGrupo !== 'number' || !Number.isFinite(oferta.costoGrupo)) return null;
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

export type PosicionHotel = 'antes' | 'despues';

export function posicionHotel(indice: number): PosicionHotel {
  return indice === 0 ? 'antes' : 'despues';
}

export interface HotelElegidoInput {
  nombre?: string;
  latitud?: number;
  longitud?: number;
}

export interface HotelRutaCalculo {
  posicion: PosicionHotel;
  respuesta: CostosRutaResponse;
  seleccionLarga: string | null;
  seleccionLocal: string | null;
}

export function hotelTieneCoordenadas(
  hotel: HotelElegidoInput | null | undefined,
): hotel is HotelElegidoInput & { latitud: number; longitud: number } {
  return (
    typeof hotel?.latitud === 'number'
    && typeof hotel.longitud === 'number'
    && Number.isFinite(hotel.latitud)
    && Number.isFinite(hotel.longitud)
    && (hotel.latitud !== 0 || hotel.longitud !== 0)
  );
}

export function distanciaKm(
  a: { latitud: number; longitud: number },
  b: { latitud: number; longitud: number },
): number {
  const rad = (valor: number) => (valor * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLng = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function ofertaLargaHotel(
  respuesta: CostosRutaResponse | null | undefined,
  posicion: PosicionHotel,
  seleccion: string | null,
): CostosRutaOferta | null {
  const tramo = respuesta?.resultados[0]?.tramos[posicion === 'antes' ? 0 : 1];
  if (!tramo) return null;
  return (
    tramo.opciones.find((oferta) => oferta.id === seleccion)
    ?? tramo.opciones.find((oferta) => oferta.aTiempo && !oferta.noTomable)
    ?? tramo.opciones[0]
    ?? null
  );
}

export function ofertaLocalHotel(
  respuesta: CostosRutaResponse | null | undefined,
  posicion: PosicionHotel,
  seleccion: string | null,
): CostosRutaOferta | null {
  const tramo = respuesta?.resultados[0]?.tramos[posicion === 'antes' ? 1 : 0];
  if (!tramo) return null;
  const elegida = tramo.opciones.find((oferta) => oferta.id === seleccion);
  if (elegida) return elegida;
  const taxis = tramo.opciones.filter(
    (oferta) => (oferta.modo === 'uber' || oferta.modo === 'taxi') && oferta.aTiempo && !oferta.noTomable,
  );
  const pool = taxis.length > 0
    ? taxis
    : tramo.opciones.filter((oferta) => oferta.modo === 'uber' || oferta.modo === 'taxi');
  return pool.reduce<CostosRutaOferta | null>(
    (mejor, oferta) => (mejor === null || oferta.costoGrupo < mejor.costoGrupo ? oferta : mejor),
    null,
  );
}

function opcionDesdeOferta(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
  fueElegida: boolean,
): OpcionCotizacion {
  const capturas = oferta.capturas ?? (oferta.rutaCaptura ? [oferta.rutaCaptura] : []);
  const precio = precioOferta(oferta);
  const estimado = oferta.estimado || precio === null;
  const fuente = fuenteConEstimado(oferta.fuente?.trim() || 'Motor', estimado);
  const combustible = oferta.combustible;
  const combustibleValido = oferta.modo === 'auto'
    && precio !== null
    && typeof combustible === 'number'
    && Number.isFinite(combustible)
    && combustible >= 0;

  return {
    tipo: TIPO_OPCION[oferta.modo] ?? oferta.modo,
    linea: oferta.linea,
    precio,
    moneda: 'MXN',
    url_compra: urlCompraValida(oferta.comprar?.url),
    fuente,
    fue_elegida: fueElegida,
    ruta_captura: capturas[0] ?? null,
    capturas,
    datos: {
      ...datos,
      tipo_precio: oferta.tipoPrecio ?? (estimado ? 'estimado' : 'cotizado'),
      proveedor: oferta.proveedor ?? oferta.comprar?.sitio ?? '',
      disponibilidad: oferta.disponibilidad ?? '',
      disponibilidad_detalle: oferta.disponibilidadDetalle ?? '',
      ...(combustibleValido
        ? {
            combustible: dosDecimales(combustible),
            source: oferta.fuente.trim() || 'Motor',
          }
        : {}),
    },
  };
}

function opcionDesdeHotel(
  hotel: CostosRutaHotel,
  datos: DatosOpcionPropuesta,
  fueElegida: boolean,
): OpcionCotizacion {
  const capturas = hotel.capturas ?? (hotel.rutaCaptura ? [hotel.rutaCaptura] : []);
  const precio = hotel.precioTotal ?? hotel.precioNoche ?? null;
  const estimado = hotel.tipoPrecio !== 'cotizado';
  return {
    tipo: 'hotel',
    linea: `${hotel.nombre ?? hotel.lugar} (${hotel.checkIn} al ${hotel.checkOut})`,
    precio: typeof precio === 'number' && Number.isFinite(precio) ? dosDecimales(precio) : null,
    moneda: 'MXN',
    url_compra: urlCompraValida(hotel.link),
    fuente: fuenteConEstimado(hotel.fuente?.trim() || 'Hotel propuesto', estimado),
    fue_elegida: fueElegida,
    ruta_captura: capturas[0] ?? null,
    capturas,
    datos: {
      ...datos,
      tipo_precio: hotel.tipoPrecio ?? 'estimado',
      proveedor: hotel.proveedor ?? hotel.fuente ?? '',
      disponibilidad: hotel.disponibilidad ?? '',
      disponibilidad_detalle: hotel.disponibilidadDetalle ?? '',
      distancia_km: hotel.distanciaKm ?? null,
      rating: hotel.rating ?? null,
      rating_count: hotel.ratingCount ?? null,
      habitaciones: hotel.habitaciones ?? 1,
      link_mapa: hotel.linkMapa ?? null,
      link_reserva: hotel.linkReserva ?? null,
    },
  };
}

function opcionDesdeTaxi(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
): OpcionCotizacion {
  const terminales = [oferta.terminalOrigen?.nombre, oferta.terminalDestino?.nombre]
    .filter((nombre): nombre is string => Boolean(nombre))
    .join(' · ');
  return {
    tipo: 'taxi',
    linea: terminales ? `Taxi punto ↔ terminal (${terminales})` : 'Taxi punto ↔ terminal',
    precio: dosDecimales(oferta.costoTaxi ?? 0),
    moneda: 'MXN',
    url_compra: null,
    fuente: 'Tarifa taxi punto↔terminal (estimado)',
    fue_elegida: true,
    ruta_captura: null,
    capturas: [],
    datos: {
      ...datos,
      tipo_precio: 'estimado',
      proveedor: 'Tarifa taxi',
      taxi: true,
      terminal_origen: oferta.terminalOrigen?.nombre ?? null,
      terminal_destino: oferta.terminalDestino?.nombre ?? null,
      minutos_taxi_origen: oferta.minutosTaxiOrigen ?? null,
      minutos_taxi_destino: oferta.minutosTaxiDestino ?? null,
    },
  };
}

function opcionDesdeTaxiMitad(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
  lado: 'origen' | 'destino',
  posicion: PosicionHotel,
): OpcionCotizacion {
  const esOrigen = lado === 'origen';
  const precio = esOrigen ? oferta.costoTaxiOrigen ?? 0 : oferta.costoTaxiDestino ?? 0;
  const terminal = esOrigen ? oferta.terminalOrigen?.nombre : oferta.terminalDestino?.nombre;
  const linea = esOrigen
    ? posicion === 'antes' ? 'Taxi punto ↔ terminal' : 'Taxi hotel ↔ terminal'
    : posicion === 'antes' ? 'Taxi terminal ↔ hotel' : `Taxi terminal ↔ ${oferta.a || 'destino'}`;
  const sentido = esOrigen
    ? posicion === 'antes' ? 'punto_terminal' : 'hotel_terminal'
    : posicion === 'antes' ? 'terminal_hotel' : 'terminal_punto';
  return {
    tipo: 'taxi',
    linea: terminal ? `${linea} (${terminal})` : linea,
    precio: dosDecimales(precio),
    moneda: 'MXN',
    url_compra: null,
    fuente: 'Tarifa taxi punto↔terminal (estimado)',
    fue_elegida: true,
    ruta_captura: null,
    capturas: [],
    datos: {
      ...datos,
      tipo_precio: 'estimado',
      proveedor: 'Tarifa taxi',
      taxi: true,
      sentido,
      terminal: terminal ?? null,
      terminal_origen: oferta.terminalOrigen?.nombre ?? null,
      terminal_destino: oferta.terminalDestino?.nombre ?? null,
      minutos_taxi_origen: oferta.minutosTaxiOrigen ?? null,
      minutos_taxi_destino: oferta.minutosTaxiDestino ?? null,
    },
  };
}

function opcionDesdeTaxiLocal(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
  posicion: PosicionHotel,
): OpcionCotizacion {
  const base = opcionDesdeOferta(oferta, datos, true);
  const linea = posicion === 'antes'
    ? `Taxi hotel ↔ ${datos.a}`
    : `Taxi ${datos.de} ↔ hotel`;
  return {
    ...base,
    tipo: 'taxi',
    linea: `${oferta.linea} · ${linea}`,
    datos: {
      ...base.datos,
      tipo_precio: oferta.tipoPrecio ?? 'estimado',
      proveedor: oferta.proveedor ?? oferta.fuente ?? 'Taxi local',
      taxi: true,
      sentido: posicion === 'antes' ? 'hotel_punto' : 'punto_hotel',
    },
  };
}

export const MAX_OPCIONES_POR_TRAMO = 20;

export function construirOpcionesPropuesta(
  tramos: TramoViaje[],
  resultados: Record<number, CostosRutaResponse>,
  seleccion: Record<number, string> = {},
  hotelResultados: Record<number, CostosRutaResponse> = {},
  usarHotel: Record<number, boolean> = {},
  hotelElegido: Record<number, string> = {},
  hotelRutas: Record<number, HotelRutaCalculo> = {},
  seleccionLocal: Record<number, string> = {},
): OpcionCotizacion[] {
  const opciones: OpcionCotizacion[] = [];

  tramos.forEach((tramo, indice) => {
    const datos: DatosOpcionPropuesta = { tramo: indice, de: tramo.desde.nombre, a: tramo.hasta.nombre };
    const posicion = hotelRutas[indice]?.posicion ?? posicionHotel(indice);
    const hotelRuta = hotelRutas[indice];
    const usaHotel = usarHotel[indice] === true && hotelRuta !== undefined;
    const persona = usaHotel
      ? hotelRuta?.respuesta.resultados[0]
      : resultados[indice]?.resultados[0];
    const largoIndex = posicion === 'antes' ? 0 : 1;
    const localIndex = posicion === 'antes' ? 1 : 0;
    const tramoLargo = usaHotel ? persona?.tramos[largoIndex] : null;
    const tramoLocal = usaHotel ? persona?.tramos[localIndex] : null;
    const datosLargo: DatosOpcionPropuesta = usaHotel
      ? {
          ...datos,
          subtramo: largoIndex,
          posicion,
          de: tramoLargo?.from ?? datos.de,
          a: tramoLargo?.to ?? datos.a,
        }
      : datos;
    const ofertas = usaHotel
      ? tramoLargo?.opciones ?? []
      : persona?.tramos.flatMap((t) => t.opciones) ?? [];
    const idElegido = seleccion[indice]
      ?? (usaHotel
        ? hotelRuta?.seleccionLarga ?? null
        : ofertaCalculada(resultados[indice], null)?.id ?? null);
    const vistas = new Set<string>();
    const candidatas: OpcionCotizacion[] = [];

    for (const oferta of ofertas) {
      if (vistas.has(oferta.id)) continue;
      vistas.add(oferta.id);
      candidatas.push(opcionDesdeOferta(oferta, datosLargo, idElegido !== null && oferta.id === idElegido));
    }

    if (usaHotel) {
      const larga = idElegido
        ? tramoLargo?.opciones.find((oferta) => oferta.id === idElegido) ?? null
        : null;
      const largaEsTransporte = larga?.modo === 'bus' || larga?.modo === 'avion';
      if (largaEsTransporte) {
        if (typeof larga!.costoTaxiOrigen === 'number' && typeof larga!.costoTaxiDestino === 'number') {
          candidatas.push(opcionDesdeTaxiMitad(larga!, datosLargo, 'origen', posicion));
          candidatas.push(opcionDesdeTaxiMitad(larga!, datosLargo, 'destino', posicion));
        } else if ((larga!.costoTaxi ?? 0) > 0) {
          candidatas.push(opcionDesdeTaxi(larga!, datosLargo));
        }

        const local = ofertaLocalHotel(
          hotelRuta!.respuesta,
          posicion,
          seleccionLocal[indice] ?? hotelRuta!.seleccionLocal ?? null,
        );
        if (local) {
          candidatas.push(opcionDesdeTaxiLocal(local, {
            ...datos,
            subtramo: localIndex,
            posicion,
            de: tramoLocal?.from ?? datos.de,
            a: tramoLocal?.to ?? datos.a,
          }, posicion));
        }
      }
    } else {
      const elegida = ofertas.find((oferta) => oferta.id === idElegido);
      if (
        elegida &&
        (elegida.modo === 'bus' || elegida.modo === 'avion') &&
        (elegida.costoTaxi ?? 0) > 0
      ) {
        candidatas.push(opcionDesdeTaxi(elegida, datos));
      }
    }

    if (usarHotel[indice] === true) {
      const clave = hotelElegido[indice] ?? null;
      const hoteles = hotelResultados[indice]?.resultados[0]?.hotelesPropuestos ?? [];
      const datosHotel: DatosOpcionPropuesta = hotelRuta
        ? { ...datos, posicion: hotelRuta.posicion }
        : datos;
      for (const hotel of hoteles) {
        candidatas.push(opcionDesdeHotel(
          hotel,
          datosHotel,
          clave !== null && claveHotel(hotel) === clave,
        ));
      }
    }

    if (candidatas.length > MAX_OPCIONES_POR_TRAMO) {
      const mantener = new Set<number>();
      candidatas.forEach((opcion, posicionOpcion) => {
        if (opcion.fue_elegida && mantener.size < MAX_OPCIONES_POR_TRAMO) mantener.add(posicionOpcion);
      });
      candidatas.forEach((opcion, posicionOpcion) => {
        if (
          (opcion.tipo === 'hotel' || opcion.tipo === 'taxi')
          && !mantener.has(posicionOpcion)
          && mantener.size < MAX_OPCIONES_POR_TRAMO
        ) {
          mantener.add(posicionOpcion);
        }
      });
      for (let posicionOpcion = 0; posicionOpcion < candidatas.length && mantener.size < MAX_OPCIONES_POR_TRAMO; posicionOpcion += 1) {
        if (!mantener.has(posicionOpcion)) mantener.add(posicionOpcion);
      }
      opciones.push(...candidatas.filter((_opcion, posicionOpcion) => mantener.has(posicionOpcion)));
    } else {
      opciones.push(...candidatas);
    }
  });

  return opciones;
}

export function comidaDesdeSnapshot(datos: unknown): number | null {
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return null;
  const comida = (datos as Record<string, unknown>).comida;
  return typeof comida === 'number' && Number.isFinite(comida) ? comida : null;
}

export function resumenCostosRuta(
  calculo: CalculoViaje,
  opciones: OpcionCotizacion[],
  modoTransporte: 'propio' | 'solicitado',
  comida: number | null = null,
): ResumenCostosRuta {
  void calculo;
  void modoTransporte;
  const sumarElegidas = (filtro: (opcion: OpcionCotizacion) => boolean): number | null => {
    const precios = opciones
      .filter((opcion) => opcion.fue_elegida && filtro(opcion))
      .map((opcion) => opcion.precio)
      .filter((precio): precio is number => typeof precio === 'number' && Number.isFinite(precio));
    if (precios.length === 0) return null;
    return dosDecimales(precios.reduce((suma, precio) => suma + precio, 0));
  };

  let gasolinaAcumulada = 0;
  let hayGasolina = false;
  for (const opcion of opciones) {
    if (!opcion.fue_elegida || (opcion.tipo !== 'auto' && opcion.tipo !== 'renta')) continue;
    if (typeof opcion.precio !== 'number' || !Number.isFinite(opcion.precio)) continue;
    gasolinaAcumulada += opcion.precio;
    hayGasolina = true;
  }

  const autobus = sumarElegidas((opcion) => opcion.tipo === 'autobus');
  const avion = sumarElegidas((opcion) => opcion.tipo === 'vuelo');
  const gasolina = hayGasolina ? dosDecimales(gasolinaAcumulada) : null;
  const casetas = null;
  const hospedaje = sumarElegidas((opcion) => opcion.tipo === 'hotel');
  const taxi = sumarElegidas((opcion) => opcion.tipo === 'taxi');
  const comidaConocida = typeof comida === 'number' && Number.isFinite(comida) ? dosDecimales(comida) : null;
  const conceptos = [autobus, avion, gasolina, casetas, hospedaje, comidaConocida, taxi];
  const total = conceptos.some((valor) => valor !== null)
    ? dosDecimales(conceptos.reduce<number>((suma, valor) => suma + (valor ?? 0), 0))
    : null;

  return { autobus, avion, gasolina, casetas, hospedaje, comida: comidaConocida, taxi, total };
}

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
      casetas: casetasMotor,
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

export function aplicarHotelesAlCalculo(
  calculo: CalculoViaje,
  hotelRutas: Record<number, HotelRutaCalculo>,
  seleccion: Record<number, string> = {},
  seleccionLocal: Record<number, string> = {},
): CalculoViaje {
  if (Object.keys(hotelRutas).length === 0) return calculo;

  const tramos = calculo.tramos.map((tramo, indice) => {
    const hotel = hotelRutas[indice];
    if (!hotel) return tramo;
    const persona = hotel.respuesta.resultados[0];
    const oferta = ofertaLargaHotel(
      hotel.respuesta,
      hotel.posicion,
      seleccion[indice] ?? hotel.seleccionLarga ?? null,
    );
    const local = ofertaLocalHotel(
      hotel.respuesta,
      hotel.posicion,
      seleccionLocal[indice] ?? hotel.seleccionLocal ?? null,
    );
    const salidaOferta = hotel.posicion === 'antes' ? oferta : local ?? oferta;
    const llegadaOferta = hotel.posicion === 'antes' ? local ?? oferta : oferta;
    const km = persona?.tramos.reduce((suma, t) => suma + (t.km ?? 0), 0) ?? tramo.km;
    const duracion = oferta?.duracion ?? tramo.duracion;
    const minutos = duracion ? minutosConMargen(duracion) : null;
    const salida = separarIso(salidaOferta?.salida);
    const llegada = separarIso(llegadaOferta?.llegada);
    const alcanza = oferta
      ? hotel.posicion === 'antes'
        ? oferta.aTiempo && (local?.aTiempo ?? true)
        : (local?.aTiempo ?? true) && oferta.aTiempo
      : tramo.alcanza;
    return {
      ...tramo,
      km,
      duracion,
      duracion_con_margen: minutos !== null ? duracionTexto(minutos) : tramo.duracion_con_margen,
      salida_fecha: salida?.fecha ?? tramo.salida_fecha,
      salida_hora: salida?.hora ?? tramo.salida_hora,
      llegada_fecha: llegada?.fecha ?? tramo.llegada_fecha,
      llegada_hora: llegada?.hora ?? tramo.llegada_hora,
      alcanza,
      costo: oferta ? precioOferta(oferta) : tramo.costo,
      moneda: oferta ? 'MXN' : tramo.moneda,
      url_compra: oferta ? urlCompraValida(oferta.comprar?.url) : tramo.url_compra,
      linea: oferta?.linea ?? tramo.linea,
    };
  });

  const kmTotal = tramos.reduce((suma, t) => suma + (t.km ?? 0), 0);
  const minutosTotal = tramos.reduce(
    (suma, t) => suma + (t.duracion_con_margen ? minutosConMargen(t.duracion ?? '') ?? 0 : 0),
    0,
  );

  return {
    ...calculo,
    km_total: tramos.some((t) => t.km !== null) ? Math.round(kmTotal * 10) / 10 : null,
    horas_total: minutosTotal > 0 ? duracionTexto(minutosTotal) : null,
    tramos,
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

function puntoHotel(
  punto: PuntoSeleccion,
  hotel: HotelElegidoInput | null | undefined,
  etiqueta: string,
): CostosRutaLugarInput {
  const conCoords = hotelTieneCoordenadas(hotel);
  return {
    orden: 2,
    tipo: 'hotel',
    nombre: hotel?.nombre?.trim() || etiqueta,
    latitud: conCoords ? hotel.latitud : punto.latitud,
    longitud: conCoords ? hotel.longitud : punto.longitud,
    municipio: punto.municipio,
    estado: punto.estado,
  };
}

export function construirRequestHotel(
  solicitud: Solicitud,
  tramo: TramoViaje,
  hotel?: HotelElegidoInput,
): CostosRutaRequest | null {
  const diaDestino = tramo.hasta.fecha;
  if (!esFecha(diaDestino) || !tramo.desde.punto) return null;
  const diaPrevio = restarDias(diaDestino, 1);
  const limite = sumarHoras(tramo.hasta.fecha, tramo.hasta.hora, -1);
  const hospedaje = puntoHotel(tramo.hasta.punto, hotel, `Hotel cerca de ${tramo.hasta.nombre}`);

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
      ...hospedaje,
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

export function construirRequestHotelDespues(
  solicitud: Solicitud,
  tramo: TramoViaje,
  hotel?: HotelElegidoInput,
): CostosRutaRequest | null {
  if (!esFecha(tramo.desde.fecha) || !esHora(tramo.desde.hora)) return null;
  if (!tramo.esRegreso && (!esFecha(tramo.hasta.fecha) || tramo.hasta.fecha <= tramo.desde.fecha)) {
    return null;
  }
  const diaHotel = tramo.desde.fecha;
  const diaSiguiente = sumarHoras(diaHotel, '12:00', 24)?.fecha ?? diaHotel;
  const diaDestino = esFecha(tramo.hasta.fecha) && tramo.hasta.fecha > diaHotel
    ? tramo.hasta.fecha
    : diaSiguiente;
  const checkInBase = sumarHoras(diaHotel, tramo.desde.hora, 1);
  const checkInHora = checkInBase?.fecha === diaHotel ? checkInBase.hora : '23:59';
  const hospedaje = puntoHotel(tramo.desde.punto, hotel, `Hotel cerca de ${tramo.desde.nombre}`);
  const destino: CostosRutaLugarInput = tramo.esRegreso
    ? {
        orden: 3,
        tipo: 'punto',
        nombre: tramo.hasta.nombre,
        latitud: tramo.hasta.punto.latitud,
        longitud: tramo.hasta.punto.longitud,
        municipio: tramo.hasta.punto.municipio,
        estado: tramo.hasta.punto.estado,
        fecha_limite_llegada: diaDestino,
        hora_limite_llegada: esHora(tramo.hasta.hora) ? tramo.hasta.hora : '18:30',
      }
    : {
        orden: 3,
        tipo: 'taller',
        nombre: tramo.hasta.nombre,
        latitud: tramo.hasta.punto.latitud,
        longitud: tramo.hasta.punto.longitud,
        municipio: tramo.hasta.punto.municipio,
        estado: tramo.hasta.punto.estado,
        fecha_inicio_actividad: tramo.hasta.fecha,
        hora_inicio_actividad: tramo.hasta.hora,
      };

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
      ...hospedaje,
      fecha_llegada: diaHotel,
      hora_llegada: checkInHora,
      fecha_salida: diaDestino,
      hora_salida: '06:30',
    },
    destino,
  ], true);
}
