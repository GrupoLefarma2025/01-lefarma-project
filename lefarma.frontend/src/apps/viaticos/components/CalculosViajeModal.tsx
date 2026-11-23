import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Car, ChevronLeft, ChevronRight, Clock, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { folderTabClassName } from '@/components/ui/folder-tab';
import { RutaLoader } from './RutaLoader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { ResumenRutaModal, type PuntoRutaResumen, type SegmentoRuta } from './ResumenRutaModal';
import { OpcionesTransporte, type TipoTransporte } from './OpcionesTransporte';
import type { NodoRutaTimeline } from './RutaViajeTimeline';
import { ModoTransporteBadge } from './ModoTransporteBadge';
import { DireccionTramo } from './DireccionTramo';
import {
  MARGEN_CARRO,
  aplicarHotelesAlCalculo,
  claveHotel,
  comidaDesdeSnapshot,
  construirCalculo,
  construirOpcionesPropuesta,
  construirRequestHotel,
  construirRequestHotelDespues,
  construirRequestTramo,
  construirTramos,
  distanciaKm,
  duracionTexto,
  fechaCorta,
  horaAmPm,
  hotelTieneCoordenadas,
  minutosConMargen,
  ofertaCalculada,
  ofertaLargaHotel,
  ofertaLocalHotel,
  posicionHotel,
  resumenCostosRuta,
  salidaAproximada,
  sumarMinutos,
  type HotelRutaCalculo,
  type TramoViaje,
} from '../services/calculoViaje';
import { costosRutaApi } from '../services/costosRuta.api';
import { geocodificarReversa } from '../services/geocodificar.api';
import { hidratarSolicitud } from '../services/solicitudDraft';
import { solicitudesApi } from '../services/solicitudes.api';
import { generarCapturasEnSegundoPlano } from '../services/evidencias.api';
import type {
  CostosRutaCasetaDisponibilidad,
  CostosRutaHotel,
  CostosRutaOferta,
  CostosRutaResponse,
  EstadoCasetasSct,
  PuntoSeleccion,
} from '../types/costosRuta.types';
import type { CalculoViaje, PrecioDetectadoDto, PropuestaRuta, Solicitud } from '../types/solicitud.types';

function mxn(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function fechaHoraAmPm(valor: string): string {
  const [fecha, hora] = valor.split(' ');
  if (!fecha || !hora) return valor;
  return `${fecha} ${horaAmPm(hora) ?? hora}`;
}

function disponibilidadDeTramo(
  respuesta: CostosRutaResponse | undefined,
  tramo: TramoViaje | undefined,
): CostosRutaCasetaDisponibilidad | null {
  if (!tramo) return null;
  return respuesta?.resultados[0]?.casetasDisponibilidad?.find(
    (item) => item.deMunicipio === tramo.desde.punto.municipio
      && item.aMunicipio === tramo.hasta.punto.municipio,
  ) ?? null;
}

function mensajeCasetasNoDisponible(estado: EstadoCasetasSct | undefined): string {
  switch (estado) {
    case 'destino_no_soportado':
      return 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.';
    case 'proveedor_no_disponible':
      return 'No fue posible consultar la SCT. Intenta nuevamente.';
    case 'respuesta_invalida':
    default:
      return 'No fue posible interpretar el desglose oficial de casetas.';
  }
}

const NOMBRES_PUNTO_GENERICO = new Set(['punto seleccionado en mapa', 'punto seleccionado en el mapa']);

type SnapshotConPuntos = Record<string, unknown> & {
  origen?: { punto?: PuntoSeleccion | null };
  destinos?: { punto?: PuntoSeleccion | null }[];
  retorno?: { destino?: string; punto?: PuntoSeleccion | null };
};

async function resolverPuntoGenerico(punto: PuntoSeleccion | null | undefined) {
  if (!punto || !NOMBRES_PUNTO_GENERICO.has(punto.nombre.trim().toLowerCase())) return punto;
  try {
    const resuelto = await geocodificarReversa(punto.latitud, punto.longitud);
    return resuelto
      ? { ...punto, ...resuelto, latitud: punto.latitud, longitud: punto.longitud }
      : punto;
  } catch {
    return punto;
  }
}

async function resolverPuntosGenericos(solicitud: Solicitud): Promise<Solicitud> {
  if (typeof solicitud.datos !== 'object' || solicitud.datos === null || Array.isArray(solicitud.datos)) {
    return solicitud;
  }
  const datos = solicitud.datos as SnapshotConPuntos;
  const destinosOriginales = Array.isArray(datos.destinos) ? datos.destinos : [];
  const retornoEsPersonalizado = datos.retorno?.destino === 'otro';
  const [origen, destinos, retorno] = await Promise.all([
    resolverPuntoGenerico(datos.origen?.punto),
    Promise.all(destinosOriginales.map((destino) => resolverPuntoGenerico(destino.punto))),
    resolverPuntoGenerico(retornoEsPersonalizado ? datos.retorno?.punto : null),
  ]);

  const cambioOrigen = origen !== datos.origen?.punto;
  const cambioDestino = destinos.some((punto, indice) => punto !== destinosOriginales[indice].punto);
  const cambioRetorno = retornoEsPersonalizado && retorno !== datos.retorno?.punto;
  if (!cambioOrigen && !cambioDestino && !cambioRetorno) return solicitud;

  return {
    ...solicitud,
    datos: {
      ...datos,
      ...(datos.origen ? { origen: { ...datos.origen, punto: origen } } : {}),
      ...(datos.destinos
        ? { destinos: destinosOriginales.map((destino, indice) => ({ ...destino, punto: destinos[indice] })) }
        : {}),
      ...(cambioRetorno && datos.retorno ? { retorno: { ...datos.retorno, punto: retorno } } : {}),
    },
  };
}

/** "10/12 08:00" o "2026-11-20T08:00" -> "08:00". */
function horaDeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = texto.match(/(\d{1,2}:\d{2})/);
  if (!match) return null;
  return match[1].padStart(5, '0');
}

/** Nombre legible para el PNG: folio, destino, línea y tipo. */
function nombreCapturaPreview(
  folio: string | null | undefined,
  idSolicitud: number,
  destino: string | null | undefined,
  linea: string | null | undefined,
  tipo: string,
): string {
  const limpiar = (valor: string | null | undefined) => (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return [folio || `VIA-${idSolicitud}`, limpiar(destino), limpiar(linea), tipo]
    .filter(Boolean)
    .join('-');
}

/** Reemplaza la hora (y opcionalmente el día) de "dd/MM HH:mm". */
function reemplazarHoraTexto(texto: string, hora: string | null, dias = 0): string {
  if (!hora) return texto;
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (!match) return texto.replace(/\d{1,2}:\d{2}/, hora);
  const fecha = new Date(2026, Number(match[2]) - 1, Number(match[1]) + dias);
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')} ${hora}`;
}

/** Reemplaza la hora (y opcionalmente el día) de una fecha ISO del motor. */
function reemplazarHoraIso(
  iso: string | null | undefined,
  hora: string | null,
  dias = 0,
): string | null {
  if (!iso || !hora) return iso ?? null;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return iso;
  const fecha = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}T${hora}:00`;
}

/** "Ciudad de México, Ciudad de México" -> "Ciudad de México". */
function nombreCorto(nombre: string): string {
  const [municipio, estado] = nombre.split(',').map((parte) => parte.trim());
  if (municipio && estado && municipio.toLowerCase() !== estado.toLowerCase()) {
    return `${municipio}, ${estado}`;
  }
  return municipio || nombre;
}

function sumarDiasIso(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00`);
  base.setDate(base.getDate() + dias);
  const anio = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, '0');
  const dia = String(base.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function duracionEntre(salida: string, llegada: string, dias: number): number | null {
  const salidaPartes = salida.split(':').map(Number);
  const llegadaPartes = llegada.split(':').map(Number);
  if (salidaPartes.length !== 2 || llegadaPartes.length !== 2) return null;
  const salidaMin = salidaPartes[0] * 60 + salidaPartes[1];
  const llegadaMin = llegadaPartes[0] * 60 + llegadaPartes[1];
  let diferencia = llegadaMin - salidaMin;
  if (diferencia < 0) diferencia += 24 * 60;
  return diferencia + Math.max(0, dias) * 24 * 60;
}

function minutosDeHora(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const partes = hora.split(':').map(Number);
  if (partes.length !== 2 || !Number.isFinite(partes[0]) || !Number.isFinite(partes[1])) return null;
  return partes[0] * 60 + partes[1];
}

/**
 * Convierte una oferta estimada en cotizada con el precio que devolvió la
 * vista previa. Conserva la proporción grupo/persona que traía el motor.
 */
function fusionarOferta(
  oferta: CostosRutaOferta,
  detectado: PrecioDetectadoDto,
  rutaCaptura: string | null,
): CostosRutaOferta {
  const precio = detectado.precio;
  const factor = oferta.costoPorPersona > 0 ? precio / oferta.costoPorPersona : 0;
  const costoGrupo = factor > 0 && oferta.costoGrupo > 0
    ? Math.round(oferta.costoGrupo * factor * 100) / 100
    : precio;
  const costoPorPersona = factor > 0
    ? Math.round(oferta.costoPorPersona * factor * 100) / 100
    : precio;
  const salida = detectado.salida ?? null;
  const llegada = detectado.llegada ?? null;
  const dias = detectado.dias_llegada ?? 0;
  return {
    ...oferta,
    precioTxt: `${mxn(precio)}${oferta.porPersona ? ' /persona' : ''}`,
    costoGrupo,
    costoPorPersona,
    estimado: false,
    tipoPrecio: 'cotizado',
    fuente: detectado.fuente ?? oferta.fuente,
    proveedor: detectado.fuente ?? oferta.proveedor,
    capturas: rutaCaptura ? [rutaCaptura] : oferta.capturas,
    rutaCaptura: rutaCaptura ?? oferta.rutaCaptura,
    linea: /estimad/i.test(oferta.linea) && detectado.linea ? detectado.linea : oferta.linea,
    salidaTxt: reemplazarHoraTexto(oferta.salidaTxt, salida),
    llegadaTxt: reemplazarHoraTexto(oferta.llegadaTxt, llegada, dias),
    salida: reemplazarHoraIso(oferta.salida, salida),
    llegada: reemplazarHoraIso(oferta.llegada, llegada, dias),
  };
}

/** Convierte un hotel de referencia/estimado en cotizado con el total real. */
function fusionarHotel(
  hotel: CostosRutaHotel,
  detectado: PrecioDetectadoDto,
  rutaCaptura: string | null,
): CostosRutaHotel {
  const noches = hotel.noches > 0 ? hotel.noches : (detectado.noches ?? 1);
  return {
    ...hotel,
    precioTotal: detectado.precio,
    precioNoche: Math.round((detectado.precio / Math.max(1, noches)) * 100) / 100,
    tipoPrecio: 'cotizado',
    fuente: detectado.fuente ?? hotel.fuente,
    proveedor: detectado.fuente ?? hotel.proveedor,
    capturas: rutaCaptura ? [rutaCaptura] : hotel.capturas,
    rutaCaptura: rutaCaptura ?? hotel.rutaCaptura,
  };
}

export function CalculosViajeModal({
  solicitud,
  open,
  onOpenChange,
  onEnviado,
  modo = 'enviar',
  onPropuesta,
}: {
  solicitud: Solicitud | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviado: (id: number) => void;
  /**
   * 'enviar' = flujo del viajero (borrador -> concentrado).
   * 'autorizar' = flujo del revisor: recalcula la misma solicitud y entrega la
   * propuesta al padre; la solicitud no cambia en el servidor desde aquí.
   */
  modo?: 'enviar' | 'autorizar';
  /** Versión calculada (cálculo + opciones + resumen) que el revisor confirma. */
  onPropuesta?: (propuesta: PropuestaRuta) => void;
  /**
   * @deprecated La propuesta se entrega con `onPropuesta` y la autorización se
   * registra en el concentrado; se conserva para no romper llamadas previas.
   */
  onAutorizado?: (id: number) => void;
}) {
  const [paso, setPaso] = useState(0);
  const [resultados, setResultados] = useState<Record<number, CostosRutaResponse>>({});
  const [buscando, setBuscando] = useState<number | null>(null);
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});
  const [usarHotel, setUsarHotel] = useState<Record<number, boolean>>({});
  const [hotelResultados, setHotelResultados] = useState<Record<number, CostosRutaResponse>>({});
  const [hotelElegido, setHotelElegido] = useState<Record<number, string>>({});
  const [hotelRutas, setHotelRutas] = useState<Record<number, HotelRutaCalculo>>({});
  const [seleccionLocal, setSeleccionLocal] = useState<Record<number, string>>({});
  const [buscandoRutaHotel, setBuscandoRutaHotel] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [precioEnCurso, setPrecioEnCurso] = useState<string | null>(null);
  const [avisoPrecio, setAvisoPrecio] = useState<Record<string, string>>({});
  const [hotelPrecioEnCurso, setHotelPrecioEnCurso] = useState<string | null>(null);
  const [avisoHotel, setAvisoHotel] = useState<Record<string, string>>({});
  const [cargandoVuelos, setCargandoVuelos] = useState<Record<number, boolean>>({});
  const [avisoVuelos, setAvisoVuelos] = useState<Record<number, string>>({});
  const abortPrecioRef = useRef<AbortController | null>(null);
  const abortHotelRef = useRef<AbortController | null>(null);
  const abortVuelosRef = useRef<AbortController | null>(null);
  const vuelosCargadosRef = useRef<Set<number>>(new Set());
  const buscadosRef = useRef<Set<number>>(new Set());
  const hotelesBuscadosRef = useRef<Set<number>>(new Set());
  const hotelRutaSeqRef = useRef<Record<number, number>>({});
  const sesionRef = useRef(0);
  const [resolucion, setResolucion] = useState<{ base: Solicitud; resuelta: Solicitud } | null>(null);

  const solicitudActiva = open && resolucion?.base === solicitud ? resolucion.resuelta : null;
  const solicitudVisible = solicitudActiva ?? solicitud;
  const hidratado = useMemo(
    () => (solicitudVisible ? hidratarSolicitud(solicitudVisible.datos) : null),
    [solicitudVisible],
  );
  const { tramos, error: errorTramos } = useMemo(
    () => (solicitudVisible ? construirTramos(solicitudVisible) : { tramos: [], error: 'Sin solicitud.' }),
    [solicitudVisible],
  );

  useEffect(() => {
    if (!open || !solicitud) return;
    let vigente = true;
    void resolverPuntosGenericos(solicitud).then((resuelta) => {
      if (vigente) setResolucion({ base: solicitud, resuelta });
    });
    return () => {
      vigente = false;
    };
  }, [open, solicitud]);

  useEffect(() => {
    setPaso(0);
    setResultados({});
    setErrores({});
    setSeleccion({});
    setUsarHotel({});
    setHotelResultados({});
    setHotelElegido({});
    setHotelRutas({});
    setSeleccionLocal({});
    setBuscandoRutaHotel(null);
    setBuscando(null);
    setProgreso(0);
    setResolucion(null);
    setPrecioEnCurso(null);
    setAvisoPrecio({});
    setHotelPrecioEnCurso(null);
    setAvisoHotel({});
    setCargandoVuelos({});
    setAvisoVuelos({});
    abortPrecioRef.current?.abort();
    abortHotelRef.current?.abort();
    abortVuelosRef.current?.abort();
    abortPrecioRef.current = null;
    abortHotelRef.current = null;
    abortVuelosRef.current = null;
    vuelosCargadosRef.current.clear();
    buscadosRef.current.clear();
    hotelesBuscadosRef.current.clear();
    hotelRutaSeqRef.current = {};
    sesionRef.current += 1;
  }, [open, solicitud?.id_solicitud]);

  // La ruta de Educación Médica puede traer hospedaje marcado por defecto
  // (varios días). El flag vive en el destino que se acaba de visitar, así que
  // enciende la noche DESPUÉS de ese destino (el tramo siguiente), no la noche
  // antes del mismo. El primer destino no se enciende por este flag.
  useEffect(() => {
    if (!open || !hidratado) return;
    const inicial: Record<number, boolean> = {};
    hidratado.destinos.forEach((destino, indice) => {
      if (destino.hospedaje.necesario && indice + 1 <= hidratado.destinos.length) {
        inicial[indice + 1] = true;
      }
    });
    setUsarHotel(inicial);
    setHotelResultados({});
    setHotelElegido({});
    setHotelRutas({});
    setSeleccionLocal({});
    hotelesBuscadosRef.current.clear();
    hotelRutaSeqRef.current = {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solicitud?.id_solicitud]);

  const tramo: TramoViaje | undefined = tramos[paso];
  const salidaReferencia = tramo?.desde.fecha && tramo?.desde.hora
    ? `${tramo.desde.fecha}T${tramo.desde.hora}`
    : null;
  const kmTramo = tramo ? distanciaKm(tramo.desde.punto, tramo.hasta.punto) : 0;
  const modoInicial: TipoTransporte = kmTramo >= 300 ? 'avion' : 'bus';
  const resultadoActual = resultados[paso];
  const persona = resultadoActual?.resultados[0];
  const propuesta = resultadoActual?.propuestas[0];
  const esCarro = hidratado?.transporte.modo === 'propio';
  const posicionDelPaso = posicionHotel(paso);
  const hotelRutaDelPaso = hotelRutas[paso];
  const propuestaActiva = hotelRutaDelPaso?.respuesta.propuestas[0] ?? propuesta;
  const personaHotel = hotelRutaDelPaso?.respuesta.resultados[0];
  const tramoLargoHotel = personaHotel?.tramos[posicionDelPaso === 'antes' ? 0 : 1];
  const tramoLocalHotel = personaHotel?.tramos[posicionDelPaso === 'antes' ? 1 : 0];
  const ofertaLargaActual = ofertaLargaHotel(
    hotelRutaDelPaso?.respuesta,
    posicionDelPaso,
    seleccion[paso] ?? hotelRutaDelPaso?.seleccionLarga ?? null,
  );
  const ofertaLocalActual = ofertaLocalHotel(
    hotelRutaDelPaso?.respuesta,
    posicionDelPaso,
    seleccionLocal[paso] ?? hotelRutaDelPaso?.seleccionLocal ?? null,
  );
  const esUltimo = paso === tramos.length - 1;
  const fechaSalida = tramo ? fechaCorta(tramo.desde.fecha) : null;
  const fechaLlegada = tramo ? fechaCorta(tramo.hasta.fecha) : null;
  const horaSalidaAmPm = tramo ? horaAmPm(tramo.desde.hora) : null;
  const horaLlegadaAmPm = tramo ? horaAmPm(tramo.hasta.hora) : null;

  const ofertaCarro = useMemo(() => {
    if (!esCarro || !persona) return null;
    const opciones = persona.tramos.flatMap((t) => t.opciones);
    const totalRuta = persona.rutaArmada.totales.subtotalMagna;
    return (
      opciones.find((o) => o.modo === 'auto' && Math.abs(o.costoGrupo - totalRuta) < 1) ??
      opciones.find((o) => o.modo === 'auto') ??
      null
    );
  }, [esCarro, persona]);

  const salidaCarro = tramo && ofertaCarro
    ? salidaAproximada(tramo.hasta.fecha, tramo.hasta.hora, ofertaCarro.duracion)
    : null;
  const minutosCarro = ofertaCarro ? minutosConMargen(ofertaCarro.duracion) : null;
  const llegadaCarro = tramo && minutosCarro !== null && tramo.desde.fecha && tramo.desde.hora
    ? sumarMinutos(tramo.desde.fecha, tramo.desde.hora, minutosCarro)
    : null;
  const llegaCarro = llegadaCarro && tramo
    ? `${llegadaCarro.fecha}T${llegadaCarro.hora}` <= `${tramo.hasta.fecha}T${tramo.hasta.hora}`
    : null;
  const llegaRegreso = tramo?.esRegreso && llegadaCarro
    ? `${llegadaCarro.fecha}T${llegadaCarro.hora}` <= `${tramo.hasta.fecha}T${tramo.hasta.hora}`
    : null;
  const disponibilidadActual = disponibilidadDeTramo(resultadoActual, tramo);
  const casetasSct = (resultadoActual?.resultados[0]?.casetas ?? []).filter(
    (c) =>
      tramo !== undefined
      && c.deMunicipio === tramo.desde.punto.municipio
      && c.aMunicipio === tramo.hasta.punto.municipio,
  );
  const casetasRuta = disponibilidadActual?.estado === 'disponible'
    ? casetasSct.map((c) => ({
        nombre: c.nombre,
        km: c.km,
        direccion: c.direccion || c.carretera,
        costo: c.tarifa,
      }))
    : [];
  const totalCasetasTramo = disponibilidadActual?.estado === 'disponible'
    ? disponibilidadActual.peajeTotal
    : null;
  const ofertaCostos = ofertaCalculada(resultadoActual, seleccion[paso] ?? null) ?? null;
  const totalIdaVuelta = useMemo(() => {
    if (!tramo?.esRegreso) return null;
    const totales = tramos.map((tramoViaje, indice) => {
      const disponibilidad = disponibilidadDeTramo(resultados[indice], tramoViaje);
      return disponibilidad?.estado === 'disponible' && typeof disponibilidad.peajeTotal === 'number'
        ? disponibilidad.peajeTotal
        : null;
    });
    return totales.every((total): total is number => total !== null)
      ? totales.reduce((suma, total) => suma + total, 0)
      : null;
  }, [resultados, tramo?.esRegreso, tramos]);

  const horaSalidaCarro = tramo?.desde.explicita && tramo.desde.hora
    ? tramo.desde.hora
    : salidaCarro?.hora ?? '';
  const salidaTemprana = esCarro && paso === 0
    && /^\d{2}:\d{2}$/.test(horaSalidaCarro) && horaSalidaCarro < '05:00';

  /**
   * Opción marcada por el viajero en este paso. Sin ella no se sugiere dormir:
   * la sugerencia depende de a qué hora llega el transporte que eligió, no de
   * la propuesta del motor (que solo es una recomendación inicial).
   */
  const ofertaElegida = useMemo(() => {
    if (hotelRutaDelPaso) {
      return ofertaLargaHotel(
        hotelRutaDelPaso.respuesta,
        posicionDelPaso,
        seleccion[paso] ?? hotelRutaDelPaso.seleccionLarga,
      );
    }
    const id = seleccion[paso];
    if (!id || !persona) return null;
    return persona.tramos.flatMap((t) => t.opciones).find((o) => o.id === id) ?? null;
  }, [hotelRutaDelPaso, posicionDelPaso, persona, seleccion, paso]);

  const incumple = ofertaElegida ? !ofertaElegida.aTiempo : false;
  const destinoHidratado =
    hidratado && hidratado.destinos.length > 0
      ? hidratado.destinos[Math.min(paso, hidratado.destinos.length - 1)]
      : null;
  // EM marca el destino que se acaba de visitar: la noche va DESPUÉS de ese
  // destino, es decir, en el tramo siguiente. En carro se conserva el
  // comportamiento anterior (la noche se busca cerca del destino del tramo).
  const destinoAnterior = hidratado && paso > 0 ? hidratado.destinos[paso - 1] : null;
  const hospedajeSugerido = esCarro
    ? destinoHidratado?.hospedaje.necesario === true
    : destinoAnterior?.hospedaje.necesario === true;
  const sugerirHotel =
    hospedajeSugerido ||
    (esCarro
      ? paso === 0
        ? salidaTemprana
        : tramo?.esRegreso
          ? llegaRegreso === false
          : llegaCarro === false
      : paso === 0 || tramo?.esRegreso
        ? incumple
        : false);
  // Si el destino se alcanza el mismo día y hay otro punto al día siguiente,
  // la noche se configura en el tramo siguiente (noche después). Sirve para
  // avisar que la estancia se captura más adelante; la casilla sigue
  // disponible en este tramo para no perder la captura de "noche antes".
  const siguienteTramo = tramos[paso + 1] ?? null;
  const hotelEnSiguienteTramo = !esCarro
    && paso === 0
    && Boolean(tramo)
    && Boolean(siguienteTramo)
    && tramo!.desde.fecha === tramo!.hasta.fecha
    && Boolean(tramo!.hasta.fecha && siguienteTramo!.hasta.fecha)
    && siguienteTramo!.hasta.fecha > tramo!.hasta.fecha;
  // En transporte solicitado el hotel se puede activar en cualquier tramo: la
  // etiqueta ya dice si es noche antes o después. En carro se mantiene la
  // sugerencia anterior para no alterar ese flujo.
  const mostrarHotel = !esCarro || sugerirHotel;
  const hotelDelPaso = hotelResultados[paso];
  const hotelElegidoDelPaso = hotelElegido[paso];
  const usarHotelDelPaso = usarHotel[paso] === true;
  // En carro se conserva la semántica anterior: noche antes del destino del
  // tramo (o después del último punto en el regreso). En transporte solicitado
  // manda la regla nueva: antes del primer destino, después de los demás.
  const posicionNoche = esCarro
    ? (tramo?.esRegreso ? 'despues' : 'antes')
    : posicionDelPaso;
  const puntoBusquedaHotel = posicionNoche === 'antes' ? tramo?.hasta : tramo?.desde;
  const buscarCercaDe = puntoBusquedaHotel?.nombre ?? 'el punto';
  const respuestaTerminal = hotelRutaDelPaso?.respuesta ?? hotelDelPaso;
  const ofertaTerminal = ofertaLargaHotel(
    respuestaTerminal,
    posicionNoche,
    seleccion[paso] ?? hotelRutaDelPaso?.seleccionLarga ?? null,
  );
  const terminalHotel = esCarro
    ? null
    : posicionNoche === 'antes'
      ? ofertaTerminal?.terminalDestino ?? null
      : ofertaTerminal?.terminalOrigen ?? null;
  const distanciaHotelTerminal = (hotel: CostosRutaHotel): number | null => {
    if (!terminalHotel || !hotelTieneCoordenadas(hotel)) return null;
    if (terminalHotel.latitud === 0 && terminalHotel.longitud === 0) return null;
    return distanciaKm(
      { latitud: hotel.latitud, longitud: hotel.longitud },
      { latitud: terminalHotel.latitud, longitud: terminalHotel.longitud },
    );
  };
  // La cabecera muestra las horas reales de la cadena con hotel (salida el día
  // anterior o llegada al día siguiente), no las del tramo directo.
  const ofertaSalidaCadena = hotelRutaDelPaso
    ? posicionNoche === 'antes'
      ? ofertaLargaActual
      : ofertaLocalActual ?? ofertaLargaActual
    : null;
  const ofertaLlegadaCadena = hotelRutaDelPaso
    ? posicionNoche === 'antes'
      ? ofertaLocalActual ?? ofertaLargaActual
      : ofertaLargaActual
    : null;
  const [fechaSalidaCadena, horaSalidaCadena] = (ofertaSalidaCadena?.salida ?? '').split('T');
  const [fechaLlegadaCadena, horaLlegadaCadena] = (ofertaLlegadaCadena?.llegada ?? '').split('T');
  const fechaSalidaMostrar = fechaSalidaCadena ? fechaCorta(fechaSalidaCadena) : fechaSalida;
  const horaSalidaMostrar = horaSalidaCadena ? horaAmPm(horaSalidaCadena.slice(0, 5)) : horaSalidaAmPm;
  const fechaLlegadaMostrar = fechaLlegadaCadena ? fechaCorta(fechaLlegadaCadena) : fechaLlegada;
  const horaLlegadaMostrar = horaLlegadaCadena ? horaAmPm(horaLlegadaCadena.slice(0, 5)) : horaLlegadaAmPm;
  const buscandoEste = buscando === paso || (!resultadoActual && !errores[paso]);

  const hotelesDelPaso = useMemo(() => {
    const lista = hotelDelPaso?.resultados[0]?.hotelesPropuestos ?? [];
    const esReferencia = (hotel: (typeof lista)[number]) => hotel.fuente.includes('tabulador');
    return [...lista].sort(
      (a, b) =>
        Number(esReferencia(a)) - Number(esReferencia(b)) ||
        (a.precioNoche ?? Number.POSITIVE_INFINITY) - (b.precioNoche ?? Number.POSITIVE_INFINITY) ||
        (a.distanciaKm ?? Number.POSITIVE_INFINITY) - (b.distanciaKm ?? Number.POSITIVE_INFINITY),
    );
  }, [hotelDelPaso]);

  /** Hotel elegido de un tramo (si el viajeroActivó la opción de dormir). */
  const hotelElegidoDeTramo = useMemo(
    () => (indice: number) => {
      const clave = hotelElegido[indice];
      if (!clave) return null;
      return (
        hotelResultados[indice]?.resultados[0]?.hotelesPropuestos.find((h) => claveHotel(h) === clave) ?? null
      );
    },
    [hotelElegido, hotelResultados],
  );

  /**
   * Cadena completa del resumen: origen → terminal → vuelo/bus → terminal →
   * hotel o punto → … → regreso. Si la oferta elegida no usa terminal (auto o
   * renta) se dibuja la carretera. Alimenta el mapa y el diagrama de ruta, que
   * usa el mismo diseño que el resumen del viaje.
   */
  const cadenaResumen = useMemo(() => {
    const puntos: PuntoRutaResumen[] = [];
    const segmentos: SegmentoRuta[] = [];
    const nodos: NodoRutaTimeline[] = [];
    const vistos = new Set<string>();
    let ultimaClave = '';
    let paradas = 0;
    let faseActual: 'ida' | 'regreso' = 'ida';

    const agregarPunto = (
      lat: number,
      lng: number,
      nombre: string,
      tipo: PuntoRutaResumen['tipo'],
      detalle?: string,
      chips?: string[],
      importes?: { costo?: number | null; urlCompra?: string | null },
    ) => {
      const clave = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      // Los marcadores del mapa no se repiten, pero el diagrama sí: un viaje
      // redondo vuelve al origen y el regreso tiene que verse como parada.
      if (!vistos.has(clave)) {
        vistos.add(clave);
        puntos.push({ lat, lng, nombre, tipo });
      }
      if (clave === ultimaClave) return;
      ultimaClave = clave;
      const titulo = tipo === 'origen'
        ? 'Origen'
        : tipo === 'regreso'
          ? 'Regreso'
          : tipo === 'punto'
            ? `${++paradas}. ${nombre}`
            : nombre;
      nodos.push({
        id: `${clave}-${tipo}-${nodos.length}`,
        titulo,
        detalles: [
          ...(detalle ? [detalle] : []),
          `${nombre} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        ],
        chips,
        costo: importes?.costo ?? null,
        urlCompra: importes?.urlCompra ?? null,
        fase: faseActual,
      });
    };
    const agregarSegmento = (
      tipo: SegmentoRuta['tipo'],
      de: [number, number],
      a: [number, number],
      etiqueta?: string,
    ) => {
      if (Math.abs(de[0] - a[0]) < 1e-6 && Math.abs(de[1] - a[1]) < 1e-6) return;
      segmentos.push({ tipo, puntos: [de, a], etiqueta });
    };
    // Un proveedor puede mandar la terminal con lat/lon en 0. Esa coordenada
    // no sirve para el mapa: se omite el nodo y el tramo se dibuja directo.
    const coordsTerminal = (
      terminal: { latitud: number; longitud: number } | null | undefined,
    ): [number, number] | null => (
      terminal && (terminal.latitud !== 0 || terminal.longitud !== 0)
        ? [terminal.latitud, terminal.longitud]
        : null
    );

    const ofertaDe = (indice: number) =>
      ofertaCalculada(resultados[indice], seleccion[indice] ?? null) ?? null;

    tramos.forEach((tramo, indice) => {
      faseActual = tramo.esRegreso ? 'regreso' : 'ida';
      const hotelRuta = !esCarro ? hotelRutas[indice] : undefined;
      const hotel = hotelElegidoDeTramo(indice);
      const origen: [number, number] = [tramo.desde.punto.latitud, tramo.desde.punto.longitud];

      // Cadena con hotel en transporte solicitado: el hotel es una parada, no
      // el destino. Noche antes = origen → terminal → hotel → hospital; noche
      // después = hospital → hotel → terminal → siguiente punto/regreso.
      if (hotelRuta && hotel) {
        const posicion = hotelRuta.posicion;
        const destino: [number, number] = [tramo.hasta.punto.latitud, tramo.hasta.punto.longitud];
        const personaHotel = hotelRuta.respuesta.resultados[0];
        const larga = ofertaLargaHotel(
          hotelRuta.respuesta,
          posicion,
          seleccion[indice] ?? hotelRuta.seleccionLarga,
        );
        const local = ofertaLocalHotel(
          hotelRuta.respuesta,
          posicion,
          seleccionLocal[indice] ?? hotelRuta.seleccionLocal,
        );
        const transporteLargo = larga?.modo === 'bus' || larga?.modo === 'avion';
        const puntoHotel: [number, number] = hotelTieneCoordenadas(hotel)
          ? [hotel.latitud, hotel.longitud]
          : posicion === 'antes'
            ? destino
            : origen;
        const nombreHotel = hotel.nombre ?? hotel.lugar;
        const kmHotel = personaHotel?.tramos.reduce((suma, t) => suma + (t.km ?? 0), 0) ?? null;
        const chipsHotel = [
          kmHotel != null ? `${kmHotel.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : '',
          `${hotel.noches} noche(s)`,
          hotel.checkIn && hotel.checkOut ? `${hotel.checkIn} → ${hotel.checkOut}` : '',
        ].filter((chip) => chip !== '');
        const importeHotel = {
          costo: hotel.precioTotal ?? hotel.precioNoche ?? null,
          urlCompra: hotel.link || null,
        };
        const importeLargo = larga
          ? { costo: larga.costoGrupo ?? null, urlCompra: larga.comprar?.url || null }
          : undefined;
        const importeLocal = local
          ? { costo: local.costoGrupo ?? null, urlCompra: local.comprar?.url || null }
          : undefined;
        const detalleHotel = `Noche ${posicion === 'antes' ? 'antes' : 'después'} de ${
          posicion === 'antes' ? tramo.hasta.nombre : tramo.desde.nombre
        }`;
        const tipoDestino = tramo.esRegreso ? 'regreso' : 'punto';

        agregarPunto(origen[0], origen[1], tramo.desde.nombre, indice === 0 ? 'origen' : 'punto');

        if (transporteLargo) {
          const tOrigen = coordsTerminal(larga?.terminalOrigen);
          const tDestino = coordsTerminal(larga?.terminalDestino);
          const detalleLargo = larga
            ? `${larga.modo === 'avion' ? 'Vuelo' : 'Autobús'} ${larga.linea} · ${larga.salidaTxt} a ${larga.llegadaTxt}`
            : 'Transporte con hotel';

          if (posicion === 'antes') {
            if (tOrigen) {
              agregarPunto(
                tOrigen[0],
                tOrigen[1],
                larga!.terminalOrigen!.nombre,
                'terminal',
                `En taxi desde ${tramo.desde.nombre}`,
              );
              agregarSegmento('taxi', origen, tOrigen, `Taxi a ${larga!.terminalOrigen!.nombre}`);
            }
            agregarSegmento(
              'transporte',
              tOrigen ?? origen,
              tDestino ?? puntoHotel,
              `${larga?.linea ?? 'Transporte'} · ${larga?.modo === 'avion' ? 'vuelo' : 'autobús'}`,
            );
            if (tDestino) {
              agregarPunto(
                tDestino[0],
                tDestino[1],
                larga!.terminalDestino!.nombre,
                'terminal',
                detalleLargo,
                undefined,
                importeLargo,
              );
              agregarSegmento('taxi', tDestino, puntoHotel, `Taxi a ${nombreHotel}`);
            }
            agregarPunto(
              puntoHotel[0],
              puntoHotel[1],
              nombreHotel,
              'hotel',
              detalleHotel,
              chipsHotel,
              importeHotel,
            );
            if (local) {
              agregarSegmento('taxi', puntoHotel, destino, `Taxi a ${tramo.hasta.nombre}`);
            }
            agregarPunto(
              destino[0],
              destino[1],
              tramo.hasta.nombre,
              tipoDestino,
              local
                ? `En taxi desde ${nombreHotel}`
                : `En ${larga?.modo === 'avion' ? 'vuelo' : 'autobús'} hasta ${nombreHotel}`,
              undefined,
              importeLocal ?? (tDestino ? undefined : importeLargo),
            );
          } else {
            agregarSegmento('taxi', origen, puntoHotel, `Taxi a ${nombreHotel}`);
            agregarPunto(
              puntoHotel[0],
              puntoHotel[1],
              nombreHotel,
              'hotel',
              detalleHotel,
              chipsHotel,
              importeHotel,
            );
            if (tOrigen) {
              agregarPunto(
                tOrigen[0],
                tOrigen[1],
                larga!.terminalOrigen!.nombre,
                'terminal',
                `En taxi desde ${nombreHotel}`,
              );
              agregarSegmento('taxi', puntoHotel, tOrigen, `Taxi a ${larga!.terminalOrigen!.nombre}`);
            }
            agregarSegmento(
              'transporte',
              tOrigen ?? puntoHotel,
              tDestino ?? destino,
              `${larga?.linea ?? 'Transporte'} · ${larga?.modo === 'avion' ? 'vuelo' : 'autobús'}`,
            );
            if (tDestino) {
              agregarPunto(
                tDestino[0],
                tDestino[1],
                larga!.terminalDestino!.nombre,
                'terminal',
                detalleLargo,
              );
              agregarSegmento('taxi', tDestino, destino, `Taxi a ${tramo.esRegreso ? 'casa' : tramo.hasta.nombre}`);
            }
            agregarPunto(
              destino[0],
              destino[1],
              tramo.hasta.nombre,
              tipoDestino,
              `En ${larga?.modo === 'avion' ? 'vuelo' : 'autobús'} desde ${nombreHotel}`,
              undefined,
              tDestino ? importeLargo : importeLargo ?? importeLocal,
            );
          }
        } else {
          // Auto o renta: el hotel es una parada en carretera y el vehículo
          // cubre el traslado local; no se agrega un taxi que no se paga.
          if (posicion === 'antes') {
            agregarSegmento('carretera', origen, puntoHotel, `Carretera a ${nombreHotel}`);
            agregarPunto(puntoHotel[0], puntoHotel[1], nombreHotel, 'hotel', detalleHotel, chipsHotel, importeHotel);
            agregarSegmento('carretera', puntoHotel, destino, `Carretera a ${tramo.hasta.nombre}`);
          } else {
            agregarSegmento('carretera', origen, puntoHotel, `Carretera a ${nombreHotel}`);
            agregarPunto(puntoHotel[0], puntoHotel[1], nombreHotel, 'hotel', detalleHotel, chipsHotel, importeHotel);
            agregarSegmento('carretera', puntoHotel, destino, `Carretera a ${tramo.esRegreso ? 'casa' : tramo.hasta.nombre}`);
          }
          agregarPunto(
            destino[0],
            destino[1],
            tramo.hasta.nombre,
            tipoDestino,
            `En carretera desde ${nombreHotel}`,
            undefined,
            importeLargo,
          );
        }
        return;
      }

      const oferta = ofertaDe(indice);
      const conHotel = hotelTieneCoordenadas(hotel) && (esCarro || hotelRuta !== undefined);
      const destino: [number, number] = conHotel
        ? [hotel!.latitud as number, hotel!.longitud as number]
        : [tramo.hasta.punto.latitud, tramo.hasta.punto.longitud];
      const destinoNombre = conHotel ? (hotel!.nombre ?? hotel!.lugar) : tramo.hasta.nombre;
      // El importe de la parada es el del hotel cuando se duerme ahí y el de la
      // oferta de transporte cuando solo se llega al punto.
      const importesDestino = conHotel && hotel
        ? { costo: hotel.precioTotal ?? hotel.precioNoche ?? null, urlCompra: hotel.link || null }
        : oferta
          ? { costo: oferta.costoGrupo ?? null, urlCompra: oferta.comprar?.url || null }
          : undefined;

      agregarPunto(origen[0], origen[1], tramo.desde.nombre, indice === 0 ? 'origen' : 'punto');

      const terminalOrigen = oferta?.terminalOrigen ?? null;
      const terminalDestino = oferta?.terminalDestino ?? null;
      const transporteLargo = oferta?.modo === 'bus' || oferta?.modo === 'avion';
      // Chips del tramo: lo que el revisor necesita ver sin abrir nada.
      const kmTramo = resultados[indice]?.resultados[0]?.rutaArmada.totales.km;
      const chipsTramo = [
        kmTramo != null ? `${kmTramo.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : '',
        oferta?.duracion ?? '',
        tramo.desde.fecha && tramo.desde.hora ? `Salida ${horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}` : '',
        tramo.hasta.fecha && tramo.hasta.hora ? `Llegada ${horaAmPm(tramo.hasta.hora) ?? tramo.hasta.hora}` : '',
      ].filter((chip) => chip !== '');
      // El taxi total de la oferta cubre las dos puntas: se reparte a la mitad
      // para no prometer un minuto exacto en cada tramo.
      const minutosTaxiPunta = oferta?.minutosTaxi && oferta.minutosTaxi > 0
        ? Math.max(1, Math.round(oferta.minutosTaxi / 2))
        : null;

      if (oferta && transporteLargo) {
        // Cadena del viaje largo: taxi a la terminal, vuelo/autobús y taxi al
        // punto. Si alguna terminal no está en el catálogo se usa el punto
        // capturado como extremo, para no dejar el tramo sin dibujar.
        const tOrigen = coordsTerminal(terminalOrigen);
        const tDestino = coordsTerminal(terminalDestino);
        if (tOrigen) {
          agregarPunto(
            tOrigen[0],
            tOrigen[1],
            terminalOrigen!.nombre,
            'terminal',
            `En taxi desde ${tramo.desde.nombre}${minutosTaxiPunta ? ` · ~${minutosTaxiPunta} min` : ''}`,
          );
          agregarSegmento('taxi', origen, tOrigen, `Taxi a ${terminalOrigen!.nombre}`);
        }
        const desdeLargo = tOrigen ?? origen;
        const hastaLargo = tDestino ?? destino;
        agregarSegmento('transporte', desdeLargo, hastaLargo, `${oferta.linea} · ${oferta.modo === 'avion' ? 'vuelo' : 'autobús'}`);
        const detalleLargo = `${oferta.modo === 'avion' ? 'Vuelo' : 'Autobús'} ${oferta.linea} · ${oferta.salidaTxt} a ${oferta.llegadaTxt}`;
        const nombreHasta = terminalDestino?.nombre ?? destinoNombre;
        if (tDestino) {
          agregarPunto(tDestino[0], tDestino[1], terminalDestino!.nombre, 'terminal', detalleLargo);
          agregarSegmento('taxi', tDestino, destino, `Taxi a ${destinoNombre}`);
        }
        agregarPunto(
          destino[0],
          destino[1],
          destinoNombre,
          conHotel ? 'hotel' : tramo.esRegreso ? 'regreso' : 'punto',
          tDestino
            ? `En taxi desde ${terminalDestino!.nombre}${minutosTaxiPunta ? ` · ~${minutosTaxiPunta} min` : ''}`
            : `${detalleLargo} hasta ${nombreHasta}`,
          chipsTramo,
          importesDestino,
        );
      } else {
        // Sin terminal: auto propio, renta o taxi de punta a punta.
        const fuente = conHotel ? hotelResultados[indice] : resultados[indice];
        const grafica = (fuente?.resultados[0]?.rutaArmada.tramos ?? [])
          .flatMap((t) => (t.grafica ?? []).map((p) => [p[0], p[1]] as [number, number]));
        if (grafica.length > 1) segmentos.push({ tipo: 'carretera', puntos: grafica });
        else agregarSegmento('carretera', origen, destino);
        agregarPunto(
          destino[0],
          destino[1],
          destinoNombre,
          conHotel ? 'hotel' : tramo.esRegreso ? 'regreso' : 'punto',
          `En carretera desde ${tramo.desde.nombre}${oferta ? ` · ${oferta.linea}` : ''}${conHotel ? ' · duerme ahí' : ''}`,
          chipsTramo,
          importesDestino,
        );
      }
    });

    return { puntos, segmentos, nodos };
  }, [tramos, resultados, hotelResultados, hotelElegidoDeTramo, hotelRutas, seleccion, seleccionLocal, esCarro]);


  useEffect(() => {
    if (!buscandoEste && buscando !== -1) {
      setProgreso(0);
      return;
    }
    setProgreso(8);
    const id = window.setInterval(() => {
      setProgreso((p) => Math.min(90, p + 3));
    }, 300);
    return () => window.clearInterval(id);
  }, [buscandoEste, buscando]);

  const llegadaRegreso = tramo?.esRegreso ? propuestaActiva?.llegadaFinal ?? '' : '';
  const diaMes = llegadaRegreso.split(' ')[0] ?? '';
  const [diaRegreso, mesRegreso] = diaMes.split('/').map(Number);
  const anioRegreso = Number(tramo?.hasta.fecha.slice(0, 4)) || new Date().getFullYear();
  const fechaRegreso = diaRegreso && mesRegreso ? new Date(anioRegreso, mesRegreso - 1, diaRegreso) : null;
  const regresoEnSabado = fechaRegreso?.getDay() === 6;

  const buscarTramo = useCallback(async (indice: number) => {
    if (!solicitudActiva) return;
    const actual = tramos[indice];
    if (!actual) return;
    const sesion = sesionRef.current;
    setBuscando(indice);
    setErrores((e) => ({ ...e, [indice]: '' }));
    try {
      const res = await costosRutaApi.calcular(construirRequestTramo(solicitudActiva, actual));
      if (sesion !== sesionRef.current) return;
      if (!res.data.success || !res.data.data) {
        setErrores((e) => ({ ...e, [indice]: res.data.message || 'No se pudo calcular el tramo.' }));
        return;
      }
      setResultados((r) => ({ ...r, [indice]: res.data.data! }));
    } catch (falla: unknown) {
      if (sesion !== sesionRef.current) return;
      setErrores((e) => ({ ...e, [indice]: toApiError(falla).message || 'No se pudo calcular el tramo.' }));
    } finally {
      if (sesion === sesionRef.current) setBuscando(null);
    }
  }, [solicitudActiva, tramos]);

  useEffect(() => {
    if (!open || !solicitudActiva || !tramo) return;
    if (buscando !== null) return;
    if (buscadosRef.current.has(paso)) return;
    buscadosRef.current.add(paso);
    void buscarTramo(paso);
  }, [open, solicitudActiva, tramo, paso, buscando, buscarTramo]);

  async function buscarHotel(indice: number) {
    const tramoHotel = tramos[indice];
    if (!solicitudActiva || !tramoHotel) return;
    const posicion = esCarro
      ? (tramoHotel.esRegreso ? 'despues' : 'antes')
      : posicionHotel(indice);
    const request = posicion === 'antes'
      ? construirRequestHotel(solicitudActiva, tramoHotel)
      : construirRequestHotelDespues(solicitudActiva, tramoHotel);
    if (!request) {
      toast.error(
        posicion === 'despues'
          ? 'La noche después requiere que el siguiente destino sea otro día.'
          : 'No se pudo preparar la búsqueda de hotel.',
      );
      return;
    }
    const sesion = sesionRef.current;
    setBuscando(-1);
    // Invalida cualquier recálculo de ruta anterior de este tramo.
    hotelRutaSeqRef.current[indice] = (hotelRutaSeqRef.current[indice] ?? 0) + 1;
    setBuscandoRutaHotel((actual) => (actual === indice ? null : actual));
    setHotelRutas((r) => {
      const copia = { ...r };
      delete copia[indice];
      return copia;
    });
    setSeleccionLocal((s) => {
      const copia = { ...s };
      delete copia[indice];
      return copia;
    });
    try {
      const res = await costosRutaApi.calcular(request);
      if (sesion !== sesionRef.current) return;
      if (!res.data.success || !res.data.data) {
        toast.error(res.data.message ?? 'No se pudieron buscar hoteles.');
        return;
      }
      setHotelResultados((r) => ({ ...r, [indice]: res.data.data! }));
    } catch (falla: unknown) {
      if (sesion !== sesionRef.current) return;
      toast.error(toApiError(falla).message || 'No se pudieron buscar hoteles.');
    } finally {
      if (sesion === sesionRef.current) setBuscando(null);
    }
  }

  /**
   * Elige el hotel y, en transporte solicitado, recalcula la cadena con sus
   * coordenadas reales. El resultado trae el tramo largo (hotel ↔ terminal) y
   * el local (hotel ↔ hospital), que antes se descartaban.
   */
  async function elegirHotel(indice: number, hotel: CostosRutaHotel) {
    const tramoHotel = tramos[indice];
    if (!solicitud || !tramoHotel) return;
    setHotelElegido((h) => ({ ...h, [indice]: claveHotel(hotel) }));
    if (esCarro) return;

    const posicion = posicionHotel(indice);
    const request = posicion === 'antes'
      ? construirRequestHotel(solicitud, tramoHotel, hotel)
      : construirRequestHotelDespues(solicitud, tramoHotel, hotel);
    if (!request) {
      toast.error('No se pudo recalcular la ruta con el hotel elegido.');
      return;
    }
    const sesion = sesionRef.current;
    const seq = (hotelRutaSeqRef.current[indice] ?? 0) + 1;
    hotelRutaSeqRef.current[indice] = seq;
    setBuscandoRutaHotel(indice);
    // Mientras llega la ruta nueva, no se muestra la cadena anterior con otro
    // hotel: mejor el aviso de cálculo que un mapa que no corresponde.
    setHotelRutas((r) => {
      const copia = { ...r };
      delete copia[indice];
      return copia;
    });
    try {
      const res = await costosRutaApi.calcular(request);
      if (sesion !== sesionRef.current || hotelRutaSeqRef.current[indice] !== seq) return;
      if (!res.data.success || !res.data.data) {
        toast.error(res.data.message ?? 'No se pudo recalcular la ruta con el hotel.');
        return;
      }
      const respuesta = res.data.data;
      const persona = respuesta.resultados[0];
      const opcionesLargas = persona?.tramos[posicion === 'antes' ? 0 : 1]?.opciones ?? [];
      // Se conserva el modo/linea que el viajero ya había elegido en el tramo
      // directo; si no existe, se toma la primera oferta viable.
      const anterior = resultados[indice]?.resultados[0]?.tramos
        .flatMap((t) => t.opciones)
        .find((oferta) => oferta.id === seleccion[indice]);
      const larga = (anterior
        ? opcionesLargas.find((oferta) => oferta.modo === anterior.modo && oferta.linea === anterior.linea)
        : null)
        ?? opcionesLargas.find((oferta) => oferta.aTiempo && !oferta.noTomable)
        ?? opcionesLargas[0]
        ?? null;
      const local = ofertaLocalHotel(respuesta, posicion, null);
      setHotelRutas((r) => ({
        ...r,
        [indice]: {
          posicion,
          respuesta,
          seleccionLarga: larga?.id ?? null,
          seleccionLocal: local?.id ?? null,
        },
      }));
      setSeleccion((s) => ({ ...s, [indice]: larga?.id ?? '' }));
      setSeleccionLocal((l) => ({ ...l, [indice]: local?.id ?? '' }));
      if (!larga) {
        toast.warning('El hotel quedó elegido, pero el motor no devolvió transporte para la ruta.');
      }
      if (!local) {
        toast.warning('El hotel quedó elegido, pero el motor no devolvió un taxi local; revisa el traslado.');
      }
    } catch (falla: unknown) {
      if (sesion !== sesionRef.current || hotelRutaSeqRef.current[indice] !== seq) return;
      toast.error(toApiError(falla).message || 'No se pudo recalcular la ruta con el hotel.');
    } finally {
      if (sesion === sesionRef.current && hotelRutaSeqRef.current[indice] === seq) {
        setBuscandoRutaHotel((actual) => (actual === indice ? null : actual));
      }
    }
  }

  useEffect(() => {
    if (!open || !solicitud || !tramo || !resultadoActual) return;
    if (!usarHotelDelPaso || hotelDelPaso || buscando !== null) return;
    if (hotelesBuscadosRef.current.has(paso)) return;
    hotelesBuscadosRef.current.add(paso);
    void buscarHotel(paso);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solicitud, tramo, paso, resultadoActual, usarHotelDelPaso, hotelDelPaso, buscando]);

  // Hotel activo por defecto: en cuanto llega el catálogo se elige el primer
  // hotel real con coordenadas (el orden ya deja la referencia al final), para
  // que la solicitud no salga con hospedaje activo pero sin costo.
  useEffect(() => {
    if (!open || esCarro || !usarHotelDelPaso || hotelElegidoDelPaso) return;
    if (!hotelDelPaso || buscando !== null || buscandoRutaHotel !== null) return;
    const primero = hotelesDelPaso.find((hotel) => hotelTieneCoordenadas(hotel)) ?? hotelesDelPaso[0];
    if (primero) {
      void elegirHotel(paso, primero);
      void detectarPrecioHotel(paso, primero);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, esCarro, usarHotelDelPaso, hotelElegidoDelPaso, hotelDelPaso, hotelesDelPaso, buscando, buscandoRutaHotel, paso]);

  /**
   * Vista previa al seleccionar una opción: no bloquea el guardado. Si tarda
   * más de 30 s se avisa, y a los 75 s el backend/axios corta y se deja el
   * estimado para que la cola lo confirme después de guardar.
   */
  async function detectarPrecioOferta(indice: number, oferta: CostosRutaOferta) {
    if (!solicitud) return;
    const tipo = oferta.modo === 'avion' ? 'vuelo' : oferta.modo === 'bus' ? 'autobus' : null;
    const url = oferta.comprar?.url;
    if (!tipo || !url || oferta.tipoPrecio === 'cotizado') return;

    abortPrecioRef.current?.abort();
    const controller = new AbortController();
    abortPrecioRef.current = controller;
    setPrecioEnCurso(oferta.id);
    setAvisoPrecio((previo) => {
      const copia = { ...previo };
      delete copia[oferta.id];
      return copia;
    });

    const avisoLento = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setAvisoPrecio((previo) => ({
        ...previo,
        [oferta.id]: 'Seguimos consultando; puedes guardar y se actualizará solo.',
      }));
    }, 30_000);

    try {
      const { data } = await solicitudesApi.detectarPrecioPreview(
        {
          tipo,
          linea: oferta.linea,
          url_compra: url,
          salida: horaDeTexto(oferta.salidaTxt) ?? horaDeTexto(oferta.salida ?? null),
          llegada: horaDeTexto(oferta.llegadaTxt) ?? horaDeTexto(oferta.llegada ?? null),
          capturar: false,
          nombre: nombreCapturaPreview(
            solicitud.folio,
            solicitud.id_solicitud,
            oferta.a ?? tramos[indice]?.hasta.nombre,
            oferta.linea,
            tipo,
          ),
          datos: {
            tramo: oferta.tramo ?? indice,
            minutos_taxi_destino: oferta.minutosTaxiDestino ?? oferta.minutosTaxi ?? 0,
            tipo_precio: oferta.tipoPrecio ?? 'estimado',
          },
          solicitud_datos: (solicitud.datos as Record<string, unknown> | null | undefined) ?? null,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const resultado = data.data;
      if (!data.success || !resultado?.detectado || !resultado.elegido) {
        const motivo = resultado?.motivo
          ?? data.message
          ?? 'No se pudo confirmar el precio; se usará el estimado.';
        setAvisoPrecio((previo) => ({ ...previo, [oferta.id]: motivo }));
        return;
      }

      setAvisoPrecio((previo) => {
        const copia = { ...previo };
        delete copia[oferta.id];
        return copia;
      });
      aplicarPrecioDetectado(oferta, resultado.elegido, resultado.ruta_captura ?? null);
    } catch (falla: unknown) {
      if (controller.signal.aborted) return;
      const mensaje = toApiError(falla).message
        || 'No se pudo confirmar el precio; se usará el estimado.';
      setAvisoPrecio((previo) => ({ ...previo, [oferta.id]: mensaje }));
    } finally {
      window.clearTimeout(avisoLento);
      if (abortPrecioRef.current === controller) {
        abortPrecioRef.current = null;
        setPrecioEnCurso(null);
      }
    }
  }

  /** Cambia el precio de la oferta en todos los tramos que la contengan. */
  function aplicarPrecioDetectado(
    oferta: CostosRutaOferta,
    detectado: PrecioDetectadoDto,
    rutaCaptura: string | null,
  ) {
    const actualizar = (respuesta: CostosRutaResponse): CostosRutaResponse => ({
      ...respuesta,
      resultados: respuesta.resultados.map((resultado) => ({
        ...resultado,
        tramos: resultado.tramos.map((tramo) => ({
          ...tramo,
          opciones: tramo.opciones.map((opcion) => (
            opcion.id === oferta.id ? fusionarOferta(opcion, detectado, rutaCaptura) : opcion
          )),
        })),
      })),
    });

    setResultados((previo) => Object.fromEntries(
      Object.entries(previo).map(([clave, respuesta]) => [clave, actualizar(respuesta)]),
    ));
    setHotelRutas((previo) => Object.fromEntries(
      Object.entries(previo).map(([clave, ruta]) => [
        clave,
        { ...ruta, respuesta: actualizar(ruta.respuesta) },
      ]),
    ));
  }

  function elegirOferta(indice: number, oferta: CostosRutaOferta) {
    setSeleccion((seleccionPrevia) => ({ ...seleccionPrevia, [indice]: oferta.id }));
    void detectarPrecioOferta(indice, oferta);
  }

  async function detectarPrecioHotel(indice: number, hotel: CostosRutaHotel) {
    if (!solicitud) return;
    const url = hotel.link;
    const nombre = (hotel.nombre ?? hotel.lugar ?? '').trim();
    if (!url
        || nombre.length < 3
        || nombre.toLowerCase().startsWith('hotel en ')
        || hotel.tipoPrecio === 'cotizado') {
      return;
    }

    abortHotelRef.current?.abort();
    const controller = new AbortController();
    abortHotelRef.current = controller;
    const clave = claveHotel(hotel);
    setHotelPrecioEnCurso(clave);
    setAvisoHotel((previo) => {
      const copia = { ...previo };
      delete copia[clave];
      return copia;
    });

    const avisoLento = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setAvisoHotel((previo) => ({
        ...previo,
        [clave]: 'Seguimos consultando; puedes guardar y se actualizará solo.',
      }));
    }, 30_000);

    try {
      const { data } = await solicitudesApi.detectarPrecioPreview(
        {
          tipo: 'hotel',
          linea: nombre,
          url_compra: url,
          capturar: false,
          nombre: nombreCapturaPreview(
            solicitud.folio,
            solicitud.id_solicitud,
            hotel.ciudad ?? tramos[indice]?.hasta.nombre,
            nombre,
            'hotel',
          ),
          datos: {
            tramo: indice,
            tipo_precio: hotel.tipoPrecio ?? 'estimado',
          },
          solicitud_datos: (solicitud.datos as Record<string, unknown> | null | undefined) ?? null,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const resultado = data.data;
      if (!data.success || !resultado?.detectado || !resultado.elegido) {
        const motivo = resultado?.motivo
          ?? data.message
          ?? 'No se pudo confirmar el precio del hotel; se usará la referencia.';
        setAvisoHotel((previo) => ({ ...previo, [clave]: motivo }));
        return;
      }

      setAvisoHotel((previo) => {
        const copia = { ...previo };
        delete copia[clave];
        return copia;
      });
      aplicarHotelDetectado(indice, hotel, resultado.elegido, resultado.ruta_captura ?? null);
    } catch (falla: unknown) {
      if (controller.signal.aborted) return;
      const mensaje = toApiError(falla).message
        || 'No se pudo confirmar el precio del hotel; se usará la referencia.';
      setAvisoHotel((previo) => ({ ...previo, [clave]: mensaje }));
    } finally {
      window.clearTimeout(avisoLento);
      if (abortHotelRef.current === controller) {
        abortHotelRef.current = null;
        setHotelPrecioEnCurso(null);
      }
    }
  }

  function aplicarHotelDetectado(
    indice: number,
    hotel: CostosRutaHotel,
    detectado: PrecioDetectadoDto,
    rutaCaptura: string | null,
  ) {
    const clave = claveHotel(hotel);
    setHotelResultados((previo) => {
      const respuesta = previo[indice];
      if (!respuesta) return previo;
      return {
        ...previo,
        [indice]: {
          ...respuesta,
          resultados: respuesta.resultados.map((resultado) => ({
            ...resultado,
            hotelesPropuestos: resultado.hotelesPropuestos.map((propuesto) => (
              claveHotel(propuesto) === clave
                ? fusionarHotel(propuesto, detectado, rutaCaptura)
                : propuesto
            )),
          })),
        },
      };
    });
  }

  function opcionesDelPaso(indice: number): CostosRutaOferta[] {
    const rutaHotel = hotelRutas[indice];
    if (rutaHotel) {
      const posicion = rutaHotel.posicion;
      return rutaHotel.respuesta.resultados[0]?.tramos[
        posicion === 'antes' ? 0 : 1
      ]?.opciones ?? [];
    }
    return resultados[indice]?.resultados[0]?.tramos.flatMap((tramo) => tramo.opciones) ?? [];
  }

  /**
   * Convierte una opción real de Kayak en la misma forma que usa el motor.
   * Conserva terminales y taxis de la oferta base; el precio y los horarios
   * son los detectados.
   */
  function mapearVueloReal(
    detectado: PrecioDetectadoDto,
    base: CostosRutaOferta,
    indice: number,
    tramoActual: TramoViaje,
    captura: string | null,
  ): CostosRutaOferta {
    const salida = detectado.salida ?? '';
    const llegada = detectado.llegada ?? '';
    const dias = detectado.dias_llegada ?? 0;
    const salidaIso = salida && tramoActual.desde.fecha
      ? `${tramoActual.desde.fecha}T${salida}:00`
      : base.salida ?? '';
    const fechaLlegada = tramoActual.desde.fecha
      ? sumarDiasIso(tramoActual.desde.fecha, dias)
      : (base.llegada?.slice(0, 10) ?? '');
    const llegadaIso = llegada && fechaLlegada
      ? `${fechaLlegada}T${llegada}:00`
      : base.llegada ?? '';
    const salidaTxt = salida && tramoActual.desde.fecha
      ? `${tramoActual.desde.fecha.slice(8, 10)}/${tramoActual.desde.fecha.slice(5, 7)} ${salida}`
      : base.salidaTxt;
    const llegadaTxt = llegada && fechaLlegada
      ? `${fechaLlegada.slice(8, 10)}/${fechaLlegada.slice(5, 7)} ${llegada}`
      : base.llegadaTxt;
    const minutosVuelo = duracionEntre(salida, llegada, dias) ?? detectado.duracion_min ?? 0;
    const antes = base.minutosAntes ?? 0;
    const despues = base.minutosDespues ?? 0;
    const puertaMin = minutosVuelo + antes + despues;
    const limite = tramoActual.hasta.fecha && tramoActual.hasta.hora
      ? new Date(`${tramoActual.hasta.fecha}T${tramoActual.hasta.hora}:00`)
      : null;
    const llegadaConTaxi = llegadaIso ? new Date(llegadaIso) : null;
    if (llegadaConTaxi && base.minutosTaxiDestino) {
      llegadaConTaxi.setMinutes(llegadaConTaxi.getMinutes() + base.minutosTaxiDestino);
    }
    const tarde = Boolean(limite && llegadaConTaxi && llegadaConTaxi > limite);
    const minutosTarde = tarde && limite && llegadaConTaxi
      ? Math.round((llegadaConTaxi.getTime() - limite.getTime()) / 60000)
      : 0;
    const salidaMin = minutosDeHora(salida);
    const origenMin = minutosDeHora(tramoActual.desde.hora);
    const salidaMasTemprana = origenMin === null
      ? null
      : origenMin + (base.minutosTaxiOrigen ?? 0) + (base.minutosAntes ?? 0);
    const saleAntes = salidaMin !== null
      && salidaMasTemprana !== null
      && salidaMin < salidaMasTemprana;
    const aerolinea = (detectado.linea || base.linea)
      .replace(/\s+\d{1,2}:\d{2}.*$/, '')
      .trim() || base.linea;

    return {
      ...base,
      id: `real-${indice}-${base.id}-${salida}-${llegada}`,
      modo: 'avion',
      linea: aerolinea,
      servicio: 'Real',
      salidaTxt,
      llegadaTxt,
      salida: salidaIso,
      llegada: llegadaIso,
      duracion: duracionTexto(puertaMin),
      puertaAPuertaH: Math.round((puertaMin / 60) * 100) / 100,
      precioTxt: `${mxn(detectado.precio)} MXN${base.porPersona ? ' /persona' : ''}`,
      porPersona: base.porPersona,
      costoGrupo: detectado.precio,
      costoPorPersona: detectado.precio,
      aTiempo: !tarde && !saleAntes,
      llegaTarde: tarde,
      minutosTarde,
      noTomable: saleAntes,
      badge: 'Real',
      nota: 'Precio real detectado en Kayak',
      fuente: detectado.fuente ?? 'kayak.com.mx',
      estimado: false,
      tipoPrecio: 'cotizado',
      proveedor: 'Kayak',
      disponibilidad: 'Precio real',
      disponibilidadDetalle: 'Detectado en Kayak',
      comprar: {
        ...base.comprar,
        url: detectado.url_compra ?? base.comprar.url,
        accion: base.comprar.accion || 'Comprar',
        fecha: tramoActual.desde.fecha || base.comprar.fecha,
      },
      rutaCaptura: captura ?? base.rutaCaptura,
      capturas: captura ? [captura] : base.capturas,
    };
  }

  function reemplazarOfertasVuelo(indice: number, sourceId: string, reales: CostosRutaOferta[]) {
    const actualizar = (respuesta: CostosRutaResponse): CostosRutaResponse => ({
      ...respuesta,
      resultados: respuesta.resultados.map((resultado) => ({
        ...resultado,
        tramos: resultado.tramos.map((tramo) => {
          if (!tramo.opciones.some((opcion) => opcion.id === sourceId)) return tramo;
          return {
            ...tramo,
            opciones: [
              ...tramo.opciones.filter((opcion) => opcion.modo !== 'avion'),
              ...reales,
            ],
          };
        }),
      })),
    });

    setResultados((previo) => Object.fromEntries(
      Object.entries(previo).map(([clave, respuesta]) => [clave, actualizar(respuesta)]),
    ));
    setHotelRutas((previo) => Object.fromEntries(
      Object.entries(previo).map(([clave, ruta]) => [
        clave,
        { ...ruta, respuesta: actualizar(ruta.respuesta) },
      ]),
    ));
  }

  /**
   * Pide a Kayak la lista real de vuelos del tramo. Una sola consulta por
   * tramo; el tab de avión muestra "Confirmando…" hasta que llega.
   */
  async function cargarVuelosReales(indice: number) {
    if (!solicitud || vuelosCargadosRef.current.has(indice) || cargandoVuelos[indice]) return;
    const tramoActual = tramos[indice];
    if (!tramoActual) return;
    const opciones = opcionesDelPaso(indice);
    const base = opciones.find((oferta) => oferta.modo === 'avion' && oferta.comprar?.url);
    if (!base?.comprar?.url) return;

    abortVuelosRef.current?.abort();
    const controller = new AbortController();
    abortVuelosRef.current = controller;
    setCargandoVuelos((previo) => ({ ...previo, [indice]: true }));
    setAvisoVuelos((previo) => {
      const copia = { ...previo };
      delete copia[indice];
      return copia;
    });

    try {
      const { data } = await solicitudesApi.detectarPrecioPreview(
        {
          tipo: 'vuelo',
          linea: base.linea,
          url_compra: base.comprar.url,
          salida: horaDeTexto(base.salidaTxt) ?? horaDeTexto(base.salida ?? null),
          llegada: horaDeTexto(base.llegadaTxt) ?? horaDeTexto(base.llegada ?? null),
          capturar: false,
          nombre: nombreCapturaPreview(
            solicitud.folio,
            solicitud.id_solicitud,
            base.a ?? tramoActual.hasta.nombre,
            base.linea,
            'vuelos',
          ),
          datos: {
            tramo: base.tramo ?? indice,
            minutos_taxi_destino: base.minutosTaxiDestino ?? base.minutosTaxi ?? 0,
            tipo_precio: base.tipoPrecio ?? 'estimado',
          },
          solicitud_datos: (solicitud.datos as Record<string, unknown> | null | undefined) ?? null,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const resultado = data.data;
      const realesDto = (resultado?.opciones ?? []).filter((opcion) => !opcion.patrocinado);
      // Aunque no haya un vuelo "elegido" a tiempo, la consulta puede traer
      // opciones reales (tarde). Se muestran para que el usuario decida; solo
      // se exige que haya captura de evidencia.
      if (!data.success || realesDto.length === 0) {
        const motivo = resultado?.motivo
          ?? data.message
          ?? 'No se pudo consultar Kayak; se usan precios estimados.';
        setAvisoVuelos((previo) => ({ ...previo, [indice]: motivo }));
        vuelosCargadosRef.current.add(indice);
        return;
      }

      const reales = realesDto.map((detectado) => (
        mapearVueloReal(detectado, base, indice, tramoActual, resultado.ruta_captura ?? null)
      ));
      reemplazarOfertasVuelo(indice, base.id, reales);
      vuelosCargadosRef.current.add(indice);
      setSeleccion((previo) => {
        const elegido = previo[indice];
        const eraVueloBase = Boolean(elegido) && opciones.some(
          (oferta) => oferta.id === elegido && oferta.modo === 'avion',
        );
        if (!eraVueloBase) return previo;
        const copia = { ...previo };
        delete copia[indice];
        return copia;
      });
    } catch (falla: unknown) {
      if (controller.signal.aborted) return;
      const mensaje = toApiError(falla).message
        || 'No se pudo consultar Kayak; se usan precios estimados.';
      setAvisoVuelos((previo) => ({ ...previo, [indice]: mensaje }));
      vuelosCargadosRef.current.add(indice);
    } finally {
      if (abortVuelosRef.current === controller) {
        abortVuelosRef.current = null;
        setCargandoVuelos((previo) => ({ ...previo, [indice]: false }));
      }
    }
  }

  function reintentarVuelos(indice: number) {
    vuelosCargadosRef.current.delete(indice);
    abortVuelosRef.current?.abort();
    abortVuelosRef.current = null;
    setCargandoVuelos((previo) => ({ ...previo, [indice]: false }));
    void cargarVuelosReales(indice);
  }

  async function enviar() {
    if (!solicitudActiva || !resultadoActual) return;

    // Si una vista previa sigue en curso, se cancela: el guardado no espera y
    // la cola del backend confirmará el precio de la opción persistida.
    abortPrecioRef.current?.abort();
    abortHotelRef.current?.abort();
    abortVuelosRef.current?.abort();
    abortPrecioRef.current = null;
    abortHotelRef.current = null;
    abortVuelosRef.current = null;
    setPrecioEnCurso(null);
    setHotelPrecioEnCurso(null);
    setCargandoVuelos((previo) => ({ ...previo, [paso]: false }));

    if (!esCarro) {
      for (let indice = 0; indice < tramos.length; indice += 1) {
        if (usarHotel[indice] !== true) continue;
        if (!hotelElegido[indice]) {
          toast.error('Elige un hotel para el tramo que tiene hospedaje activo.');
          return;
        }
        const hotelesDisponibles = hotelResultados[indice]?.resultados[0]?.hotelesPropuestos ?? [];
        if (!hotelesDisponibles.some((hotel) => claveHotel(hotel) === hotelElegido[indice])) {
          toast.error('El hotel elegido ya no está disponible; vuelve a elegirlo.');
          return;
        }
        if (!hotelRutas[indice]) {
          toast.error('Termina de calcular la ruta con el hotel elegido.');
          return;
        }
        if (!seleccion[indice]) {
          toast.error('Elige el transporte del tramo con hotel.');
          return;
        }
        const rutaHotel = hotelRutas[indice];
        const tramoLargo = rutaHotel.respuesta.resultados[0]?.tramos[
          rutaHotel.posicion === 'antes' ? 0 : 1
        ];
        const larga = tramoLargo?.opciones.find((oferta) => oferta.id === seleccion[indice]) ?? null;
        if (!larga) {
          toast.error('La oferta elegida del tramo con hotel ya no está disponible; elige otra.');
          return;
        }
        if (larga.modo === 'bus' || larga.modo === 'avion') {
          const local = ofertaLocalHotel(
            rutaHotel.respuesta,
            rutaHotel.posicion,
            seleccionLocal[indice] ?? rutaHotel.seleccionLocal,
          );
          if (!local) {
            toast.error('El motor no devolvió taxi local para el hotel; cambia de hotel o desactiva el hospedaje.');
            return;
          }
        }
      }
    }

    const modoCalculo = esCarro ? 'propio' : 'solicitado';
    const opciones = construirOpcionesPropuesta(
      tramos,
      resultados,
      seleccion,
      hotelResultados,
      usarHotel,
      hotelElegido,
      hotelRutas,
      seleccionLocal,
    );
    const calculoBase = construirCalculo(tramos, resultados, modoCalculo, seleccion);
    // Una sola versión coherente: el cálculo usa las mismas selecciones que
    // las opciones y el resumen, y conserva costo/enlace en la ruta. En carro
    // se conserva el cálculo anterior; la cadena con hotel es para bus/avión.
    const calculo: CalculoViaje = {
      ...(esCarro ? calculoBase : aplicarHotelesAlCalculo(calculoBase, hotelRutas, seleccion, seleccionLocal)),
      ruta: {
        puntos: cadenaResumen.puntos.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          nombre: p.nombre,
          tipo: p.tipo,
          detalle: p.detalle,
        })),
        nodos: cadenaResumen.nodos.map((n) => ({
          titulo: n.titulo,
          detalles: n.detalles.map((d) => String(d)),
          chips: n.chips ?? [],
          costo: n.costo ?? null,
          url_compra: n.urlCompra ?? null,
          fase: n.fase,
        })),
        segmentos: cadenaResumen.segmentos.map((s) => ({
          tipo: s.tipo,
          puntos: s.puntos,
        })),
      },
    };
    const resumen = resumenCostosRuta(
      calculo,
      opciones,
      modoCalculo,
      comidaDesdeSnapshot(solicitudActiva.datos),
    );

    if (modo === 'autorizar') {
      // El concentrado registra la autorización con esta propuesta; aquí no se
      // toca la solicitud del servidor.
      onPropuesta?.({ calculo, opciones, resumen });
      onOpenChange(false);
      return;
    }

    setEnviando(true);
    try {
      // La ruta calculada se guarda con la solicitud: es la que manda después
      // del envío (la propuesta del wizard queda como referencia). Se incluye
      // la cadena revisada (terminales, hoteles y taxis) para que el detalle
      // pueda mostrar la evolución sin recalcular.
      const res = opciones.length > 0
        ? await solicitudesApi.guardarOpciones(solicitudActiva.id_solicitud, opciones, calculo)
        : await solicitudesApi.enviar(solicitudActiva.id_solicitud, calculo);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo enviar a concentrado.');
        return;
      }
      toast.success('Solicitud enviada a concentrado.');
      // Best-effort: captura las opciones elegidas sin retrasar el cierre del
      // modal. Si falla, el detalle conserva "Generar capturas" para reintentar.
      generarCapturasEnSegundoPlano(solicitudActiva.id_solicitud);
      onEnviado(solicitudActiva.id_solicitud);
      onOpenChange(false);
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo enviar a concentrado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Cálculos del viaje {solicitud?.folio ?? (solicitud ? `#${solicitud.id_solicitud}` : '')}</span>
            <ModoTransporteBadge modo={esCarro ? 'propio' : 'solicitado'} />
          </DialogTitle>
          <DialogDescription>
            {tramo
              ? `Paso ${paso + 1} de ${tramos.length}. Elige el transporte y revisa el precio antes de enviar.`
              : modo === 'autorizar'
                ? 'Calcula cada tramo y revisa esta nueva versión antes de autorizarla.'
                : 'Calcula cada tramo y envía la solicitud al concentrado.'}
          </DialogDescription>
        </DialogHeader>

        {errorTramos ? <p role="alert" className="text-sm text-destructive">{errorTramos}</p> : null}

        {tramos.length > 0 ? (
          <div role="tablist" aria-label="Tramos del viaje" className="flex flex-wrap items-end gap-1">
            {tramos.map((t, i) => (
              <button
                key={`${t.desde.nombre}-${t.hasta.nombre}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === paso}
                onClick={() => setPaso(i)}
                className={folderTabClassName(i === paso)}
              >
                <DireccionTramo
                  compacto
                  desde={i === 0 ? 'Origen' : nombreCorto(t.desde.nombre)}
                  hasta={t.esRegreso ? 'Regreso' : nombreCorto(t.hasta.nombre)}
                />
              </button>
            ))}
          </div>
        ) : null}

        {tramo ? (
          <section className="space-y-3 rounded-b-lg border p-3">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="text-muted-foreground">Tramo {paso + 1}:</span>
              <DireccionTramo desde={tramo.desde.nombre} hasta={tramo.hasta.nombre} />
              <Badge variant="outline" className="rounded-full">
                {tramo.esRegreso ? 'Regreso' : 'Ida'}
              </Badge>
            </h3>

            <div data-testid="calculos-viaje-layout" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <div data-testid="calculos-viaje-schedule-column" className="min-w-0 space-y-3">
                <section aria-label="Horarios solicitados" className="space-y-2 text-sm">
                  {(tramo.desde.explicita || hotelRutaDelPaso) && fechaSalidaMostrar ? (
                    <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {paso === 0 ? 'Salida del origen' : `Salida de ${tramo.desde.nombre}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {fechaSalidaMostrar}
                        </span>
                        {horaSalidaMostrar ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                            {horaSalidaMostrar}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {tramo.esRegreso ? 'Regreso estimado' : `Llegada a ${tramo.hasta.nombre}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
                      {fechaLlegadaMostrar ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {fechaLlegadaMostrar}
                        </span>
                      ) : null}
                      {horaLlegadaMostrar ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {horaLlegadaMostrar}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </section>

                {resultadoActual && persona && !buscandoEste && esCarro ? (
                  <>
                    {tramo.esRegreso ? (
                      <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Llegada estimada al origen
                            </p>
                            {llegadaCarro ? (
                              <p className="break-words text-xl font-semibold leading-tight text-foreground">
                                {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
                              </p>
                            ) : null}
                            <p className="break-words text-sm text-foreground">
                              Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                            </p>
                          </div>
                          {llegaRegreso !== null ? (
                            <Badge
                              variant="outline"
                              className={llegaRegreso
                                ? 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug border-primary/30 bg-primary/10 text-primary'
                                : 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-amber-700'}
                            >
                              {llegaRegreso ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
                        </p>
                      </section>
                    ) : tramo.desde.explicita && tramo.desde.fecha && tramo.desde.hora ? (
                      <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Llegada estimada
                            </p>
                            {llegadaCarro ? (
                              <p className="break-words text-xl font-semibold leading-tight text-foreground">
                                {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
                              </p>
                            ) : null}
                            <p className="break-words text-sm text-foreground">
                              Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                            </p>
                          </div>
                          {llegaCarro !== null ? (
                            <Badge
                              variant="outline"
                              className={llegaCarro
                                ? 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug border-primary/30 bg-primary/10 text-primary'
                                : 'h-auto max-w-full whitespace-normal text-center text-xs font-semibold leading-snug text-amber-700'}
                            >
                              {llegaCarro ? 'Llega a tiempo' : 'No alcanza la llegada requerida'}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Duración ajustada: {duracionTexto(minutosCarro ?? 0)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
                        </p>
                      </section>
                    ) : salidaCarro ? (
                      <section aria-label="Resumen calculado del viaje" className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Salida aproximada
                            </p>
                            <p className="break-words text-xl font-semibold leading-tight text-foreground">
                              {fechaCorta(salidaCarro.fecha) ?? salidaCarro.fecha} · {horaAmPm(salidaCarro.hora) ?? salidaCarro.hora}
                            </p>
                            <p className="break-words text-sm text-foreground">
                              Llegada requerida: {fechaCorta(tramo.hasta.fecha) ?? tramo.hasta.fecha} · {horaLlegadaAmPm ?? tramo.hasta.hora}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Duración ajustada: {duracionTexto(salidaCarro.minutos)} · Incluye {Math.round(MARGEN_CARRO * 100)}% de margen.
                        </p>
                      </section>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div data-testid="calculos-viaje-cost-column" className="min-w-0 space-y-3">
                {resultadoActual && persona && !buscandoEste && esCarro ? (
                  <>
                    <section aria-label="Distancia y duración del tramo" className="text-sm">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Car className="h-4 w-4 text-muted-foreground" aria-hidden />
                        Recorrido en carro
                      </h4>
                      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Distancia</dt>
                          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                            {persona.rutaArmada.totales.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
                          </dd>
                        </div>
                        {ofertaCarro ? (
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Duración base</dt>
                            <dd className="mt-0.5 text-sm font-semibold text-foreground">{ofertaCarro.duracion} base</dd>
                          </div>
                        ) : null}
                        {minutosCarro !== null ? (
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Margen</dt>
                            <dd className="mt-0.5 text-sm font-semibold text-foreground">
                              +{Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(minutosCarro)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    <section aria-label="Detalle de casetas SCT" className="space-y-2 border-t pt-3">
                      <h4 className="text-sm font-semibold text-foreground">Casetas en la ruta</h4>
                      {ofertaCostos?.modo === 'auto'
                        && typeof ofertaCostos.combustible === 'number'
                        && typeof ofertaCostos.casetasEstimadas === 'number' ? (
                          <div className="border-b pb-3">
                            <p className="text-sm leading-relaxed text-foreground">
                              Estimación de <span className="font-medium">{ofertaCostos.linea}</span>: combustible{' '}
                              <span className="font-semibold tabular-nums">{mxn(ofertaCostos.combustible)}</span> + casetas estimadas{' '}
                              <span className="font-semibold tabular-nums">{mxn(ofertaCostos.casetasEstimadas)}</span> ={' '}
                              <span className="font-semibold tabular-nums">{mxn(ofertaCostos.costoGrupo)}</span>.
                            </p>
                            <p role="note" aria-label="Fuente de la estimación del auto" className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                              Fuente de la estimación: <span className="font-medium text-foreground">{ofertaCostos.fuente}</span>. Ya está incluida en el precio seleccionado.
                            </p>
                          </div>
                        ) : null}
                      {disponibilidadActual?.estado === 'disponible' ? (
                        <>
                          {casetasRuta.length > 0 ? (
                            <table className="w-full table-fixed text-left text-sm">
                              <thead>
                                <tr className="border-b border-border/70 text-xs text-muted-foreground">
                                  <th className="w-[34%] py-2 pr-2 align-bottom font-medium">Caseta</th>
                                  <th className="w-[14%] px-1 py-2 text-right align-bottom font-medium">Km</th>
                                  <th className="w-[28%] px-2 py-2 align-bottom font-medium">Dirección</th>
                                  <th className="w-[24%] py-2 pl-2 text-right align-bottom font-medium">Tarifa auto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {casetasRuta.map((plaza) => (
                                  <tr key={`${plaza.nombre}-${plaza.km}`} className="border-b border-border/70 last:border-0">
                                    <td className="break-words py-2.5 pr-2 align-top text-foreground">{plaza.nombre}</td>
                                    <td className="px-1 py-2.5 text-right align-top tabular-nums text-foreground">{plaza.km}</td>
                                    <td className="break-words px-2 py-2.5 align-top text-foreground">{plaza.direccion}</td>
                                    <td className="py-2.5 pl-2 text-right align-top font-medium tabular-nums text-foreground">
                                      {plaza.costo != null ? mxn(plaza.costo) : 's/d'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {totalCasetasTramo !== null ? (
                                <tfoot>
                                  <tr className="border-t-2 border-border/70 bg-muted/30">
                                    <td className="py-2.5 pr-2 font-semibold text-foreground" colSpan={3}>Total casetas del tramo</td>
                                    <td className="py-2.5 pl-2 text-right font-semibold tabular-nums text-foreground">{mxn(totalCasetasTramo)}</td>
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          ) : (
                            <p className="text-sm leading-relaxed text-foreground">La SCT no reporta plazas de cobro para este tramo.</p>
                          )}
                          <p role="note" aria-label="Fuente oficial SCT" className="break-words text-xs leading-relaxed text-muted-foreground">
                            Fuente oficial: <span className="font-medium text-foreground">{disponibilidadActual.fuente}</span>. Referencia: {disponibilidadActual.kmTotal?.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km · {disponibilidadActual.tiempoTotal}. No se suma al precio seleccionado.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed text-foreground">{mensajeCasetasNoDisponible(disponibilidadActual?.estado)}</p>
                      )}
                      {tramo.esRegreso && totalIdaVuelta !== null ? (
                        <p className="text-sm font-semibold leading-relaxed text-foreground">
                          Total oficial SCT de ida y vuelta: {mxn(totalIdaVuelta)}. Incluye solo tramos con resultado oficial.
                        </p>
                      ) : null}
                      {tramo.esRegreso && totalIdaVuelta === null ? (
                        <p className="text-sm leading-relaxed text-foreground">
                          No hay un total oficial de ida y vuelta: falta detalle oficial en al menos un tramo.
                        </p>
                      ) : null}
                    </section>
                  </>
                ) : null}
              </div>
            </div>

            {buscandoEste ? (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row">
                <RutaLoader className="h-28 w-28 shrink-0" />
                <div className="w-full flex-1 space-y-2 text-center sm:text-left">
                  <p className="text-sm font-medium">Buscando y optimizando la ruta…</p>
                  <Progress value={progreso} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {tramo.esRegreso
                      ? 'Calculando kilómetros, tiempos y costos del regreso.'
                      : `Calculando kilómetros, tiempos y costos para llegar a las ${horaLlegadaAmPm ?? tramo.hasta.hora}.`}
                  </p>
                </div>
              </div>
            ) : (
              errores[paso] ? <p role="alert" className="text-sm text-destructive">{errores[paso]}</p> : null
            )}

            {resultadoActual && persona && !buscandoEste ? (
              <div className="space-y-3">
                {esCarro ? null : buscandoRutaHotel === paso && usarHotelDelPaso ? (
                  <div role="status" aria-live="polite" className="rounded-md border bg-muted/20 p-3 text-xs">
                    <p className="font-medium">Ajustando la ruta con el hotel elegido…</p>
                    <p className="text-muted-foreground">
                      Se recalculan el tramo largo y el taxi local con las coordenadas del hotel.
                    </p>
                  </div>
                ) : hotelRutaDelPaso && tramoLargoHotel ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      Opciones {tramoLargoHotel.from} → {tramoLargoHotel.to}
                    </p>
                    {tramoLargoHotel.opciones.length > 0 ? (
                      <OpcionesTransporte
                        key={`hotel-${paso}`}
                        ofertas={tramoLargoHotel.opciones}
                        opcionElegidaId={seleccion[paso] ?? null}
                        onElegir={(oferta) => elegirOferta(paso, oferta)}
                        modoInicial={modoInicial}
                        salidaReferencia={salidaReferencia}
                        cargando={cargandoVuelos[paso] ?? false}
                        aviso={avisoVuelos[paso] ?? null}
                        precioEnCursoId={precioEnCurso}
                        avisoPrecio={avisoPrecio}
                        onSolicitarReales={(tipo) => {
                          if (tipo === 'avion') void cargarVuelosReales(paso);
                        }}
                        onReintentar={() => reintentarVuelos(paso)}
                      />
                    ) : <p className="text-sm text-muted-foreground">Sin opciones para la ruta con hotel.</p>}

                    {(() => {
                      const esTransporte = ofertaLargaActual?.modo === 'bus' || ofertaLargaActual?.modo === 'avion';
                      if (!esTransporte) {
                        return (
                          <p className="text-xs text-muted-foreground">
                            El auto o la renta cubren el traslado local; no se agrega un taxi.
                          </p>
                        );
                      }
                      const taxis = tramoLocalHotel.opciones.filter(
                        (oferta) => oferta.modo === 'uber' || oferta.modo === 'taxi',
                      );
                      const localElegido = ofertaLocalActual;
                      return (
                        <div className="space-y-2 rounded-md border bg-muted/20 p-2 text-xs">
                          <p className="font-medium">
                            Traslado local {posicionNoche === 'antes' ? `hotel ↔ ${tramo.hasta.nombre}` : `${tramo.desde.nombre} ↔ hotel`}
                          </p>
                          <p className="text-muted-foreground">
                            El diagrama pide taxi. Se usa el más barato por defecto; puedes cambiarlo.
                          </p>
                          {taxis.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-8 rounded-md border bg-background px-2 text-xs"
                                aria-label="Taxi local del hotel"
                                value={seleccionLocal[paso] ?? hotelRutaDelPaso.seleccionLocal ?? ''}
                                onChange={(e) => setSeleccionLocal((s) => ({ ...s, [paso]: e.target.value }))}
                              >
                                {taxis.map((oferta) => (
                                  <option key={oferta.id} value={oferta.id}>
                                    {oferta.linea} · {mxn(oferta.costoGrupo)} · {oferta.duracion}
                                  </option>
                                ))}
                              </select>
                              {localElegido ? (
                                <span className="text-muted-foreground">
                                  {localElegido.precioTxt} · {localElegido.duracion}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-amber-700">
                              El motor no devolvió una opción de taxi/Uber para el traslado local.
                            </p>
                          )}
                          {localElegido && !localElegido.aTiempo ? (
                            <p className="text-amber-700">
                              El taxi local no alcanza la hora del hospital; revisa el hotel o el horario.
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <OpcionesTransporte
                    key={`tramo-${paso}`}
                    ofertas={opcionesDelPaso(paso)}
                    opcionElegidaId={seleccion[paso] ?? null}
                    onElegir={(oferta) => elegirOferta(paso, oferta)}
                    modoInicial={modoInicial}
                    salidaReferencia={salidaReferencia}
                    cargando={cargandoVuelos[paso] ?? false}
                    aviso={avisoVuelos[paso] ?? null}
                    precioEnCursoId={precioEnCurso}
                    avisoPrecio={avisoPrecio}
                    onSolicitarReales={(tipo) => {
                      if (tipo === 'avion') void cargarVuelosReales(paso);
                    }}
                    onReintentar={() => reintentarVuelos(paso)}
                  />
                )}

                {!esCarro && propuestaActiva && propuestaActiva.incumplimientos.length > 0 ? (
                  <div className="rounded-md bg-muted/30 p-2 text-xs">
                    <ul className="list-disc pl-4 text-amber-700">
                      {propuestaActiva.incumplimientos.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}

                {tramo.esRegreso && regresoEnSabado ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    <p>El regreso cae en sábado; se procura regresar el viernes.</p>
                  </div>
                ) : null}

                {hotelEnSiguienteTramo ? (
                  <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                    La estancia de esta noche se configura en el siguiente tramo:
                    {' '}
                    del {fechaCorta(tramo?.hasta.fecha ?? '') ?? 'día de llegada'}
                    {' '}al {fechaCorta(siguienteTramo?.hasta.fecha ?? '') ?? 'día siguiente'}.
                  </p>
                ) : null}
                {mostrarHotel ? (
                  <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                    <label className="flex items-center gap-2 text-sm text-amber-900">
                      <input
                        type="checkbox"
                        checked={usarHotelDelPaso}
                        onChange={(e) => {
                          const marcado = e.target.checked;
                          setUsarHotel((u) => ({ ...u, [paso]: marcado }));
                          if (!marcado) {
                            hotelRutaSeqRef.current[paso] = (hotelRutaSeqRef.current[paso] ?? 0) + 1;
                            setBuscandoRutaHotel((actual) => (actual === paso ? null : actual));
                            setHotelElegido((h) => {
                              const copia = { ...h };
                              delete copia[paso];
                              return copia;
                            });
                            setHotelRutas((r) => {
                              const copia = { ...r };
                              delete copia[paso];
                              return copia;
                            });
                            setSeleccionLocal((l) => {
                              const copia = { ...l };
                              delete copia[paso];
                              return copia;
                            });
                            setSeleccion((s) => {
                              const copia = { ...s };
                              delete copia[paso];
                              return copia;
                            });
                          } else if (!hotelDelPaso) {
                            void buscarHotel(paso);
                          }
                        }}
                      />
                      {esCarro
                        ? tramo.esRegreso
                          ? `Dormir cerca de ${tramo.desde.nombre} y regresar al día siguiente`
                          : `Dormir cerca de ${tramo.hasta.nombre} y continuar al día siguiente`
                        : posicionNoche === 'antes'
                          ? `Noche antes: dormir cerca de ${tramo.hasta.nombre} y llegar al día siguiente`
                          : tramo.esRegreso
                            ? `Noche después: dormir cerca de ${tramo.desde.nombre} y regresar al día siguiente`
                            : `Noche después: dormir cerca de ${tramo.desde.nombre} y continuar a ${tramo.hasta.nombre} al día siguiente`}
                    </label>
                    {usarHotelDelPaso ? (
                      buscando === -1 ? (
                        <div
                          role="status"
                          aria-live="polite"
                          className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row"
                        >
                          <RutaLoader className="h-28 w-28 shrink-0" />
                          <div className="w-full flex-1 space-y-2 text-center sm:text-left">
                            <p className="text-sm font-medium">Buscando hoteles…</p>
                            <Progress value={progreso} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">
                              Buscando hospedaje cerca de {buscarCercaDe}.
                            </p>
                          </div>
                        </div>
                      ) : hotelDelPaso ? (
                        <div className="space-y-1">
                          {hotelesDelPaso.map((hotel) => {
                            const claveHotelActual = claveHotel(hotel);
                            return (
                            <label key={claveHotelActual} className="flex cursor-pointer items-start gap-2 rounded border bg-white p-2 text-xs">
                              <input
                                type="radio"
                                name={`hotel-${paso}`}
                                className="mt-0.5"
                                checked={hotelElegidoDelPaso === claveHotelActual}
                                onChange={() => {
                                  void elegirHotel(paso, hotel);
                                  void detectarPrecioHotel(paso, hotel);
                                }}
                              />
                              <span className="flex-1">
                                <span className="font-medium">{hotel.nombre ?? hotel.lugar}</span>
                                <span className="text-muted-foreground"> · {hotel.ciudad} · {fechaCorta(hotel.checkIn) ?? hotel.checkIn} a {fechaCorta(hotel.checkOut) ?? hotel.checkOut} · {hotel.noches} noche(s)</span>
                                <span className="block text-muted-foreground">
                                  {!hotelTieneCoordenadas(hotel)
                                    ? 'Referencia de precio sin ubicación exacta · '
                                    : hotel.distanciaKm !== undefined
                                      ? hotel.distanciaKm > 0
                                        ? `${hotel.distanciaKm.toFixed(1)} km de ${buscarCercaDe} · `
                                        : `En ${buscarCercaDe} · `
                                      : ''}
                                  {(() => {
                                    const distanciaTerminal = distanciaHotelTerminal(hotel);
                                    return distanciaTerminal !== null && terminalHotel
                                      ? `${distanciaTerminal.toFixed(1)} km de ${terminalHotel.nombre} · `
                                      : '';
                                  })()}
                                  {hotel.precioNoche
                                    ? `${mxn(hotel.precioNoche)}/noche (${hotel.tipoPrecio === 'referencia_tabulador' ? 'referencia tabulador' : 'cotizado'}) · total ${mxn(hotel.precioTotal ?? hotel.precioNoche * hotel.noches)}`
                                    : hotel.motivo}
                                  {hotel.rating != null
                                    ? ` · ★${hotel.rating.toFixed(1)}${hotel.ratingCount ? ` (${hotel.ratingCount})` : ''}`
                                    : ''}
                                  {hotel.disponibilidad ? ` · ${hotel.disponibilidad}` : ''}
                                </span>
                                {hotelPrecioEnCurso === claveHotelActual ? (
                                  <span role="status" className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                    Confirmando precio real…
                                  </span>
                                ) : null}
                                {avisoHotel[claveHotelActual] ? (
                                  <span className="mt-1 block text-[11px] text-amber-700">
                                    {avisoHotel[claveHotelActual]}
                                  </span>
                                ) : null}
                              </span>
                              <span className="flex gap-2">
                                {hotel.link ? (
                                  <a href={hotel.link} target="_blank" rel="noreferrer" className="underline" title={hotel.disponibilidadDetalle ?? undefined}>
                                    {hotel.tipoPrecio === 'referencia_tabulador' ? 'Ver precios' : 'Ver'}
                                  </a>
                                ) : null}
                                {hotel.linkMapa ? <a href={hotel.linkMapa} target="_blank" rel="noreferrer" className="underline">Mapa</a> : null}
                                {hotel.linkReserva ? (
                                  <a
                                    href={hotel.linkReserva}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                    title="Respaldo de reserva; no se captura en esta fase"
                                  >
                                    Booking
                                  </a>
                                ) : null}
                              </span>
                            </label>
                            );
                          })}
                          {(() => {
                            const esTransporte = ofertaLargaActual?.modo === 'bus' || ofertaLargaActual?.modo === 'avion';
                            if (!esTransporte) return null;
                            const inicioRuta = posicionNoche === 'antes'
                              ? ofertaLargaActual?.salidaTxt
                              : ofertaLocalActual?.salidaTxt;
                            const finRuta = posicionNoche === 'antes'
                              ? ofertaLocalActual?.llegadaTxt
                              : ofertaLargaActual?.llegadaTxt;
                            return inicioRuta && finRuta ? (
                              <p className="text-xs text-muted-foreground">
                                Ruta con hotel: {fechaHoraAmPm(inicioRuta)} → {fechaHoraAmPm(finRuta)}.
                              </p>
                            ) : null;
                          })()}
                          {buscandoRutaHotel === paso ? (
                            <p role="status" className="text-xs text-muted-foreground">
                              Calculando la ruta con el hotel elegido…
                            </p>
                          ) : null}
                        </div>
                      ) : <p className="text-xs">Sin hoteles propuestos.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => { void buscarTramo(paso); }} disabled={buscando !== null || buscandoRutaHotel !== null}>
            <Search className="h-4 w-4" aria-hidden />
            {errores[paso] ? 'Reintentar' : resultadoActual ? 'Volver a buscar' : 'Buscar opciones'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0 || buscandoRutaHotel !== null}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Atrás
          </Button>
          {esUltimo ? (
            <Button
              type="button"
              className="gap-1.5"
              disabled={!resultadoActual || enviando || buscandoRutaHotel !== null || (usarHotelDelPaso && !esCarro && !hotelRutaDelPaso)}
              onClick={() => setResumenAbierto(true)}
            >
              Terminar
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!resultadoActual || buscandoRutaHotel !== null || (usarHotelDelPaso && !esCarro && !hotelRutaDelPaso)}
              onClick={() => setPaso((p) => Math.min(tramos.length - 1, p + 1))}
            >
              Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </DialogFooter>

        <ResumenRutaModal
          open={resumenAbierto}
          onOpenChange={setResumenAbierto}
          puntos={cadenaResumen.puntos}
          segmentos={cadenaResumen.segmentos}
          nodos={cadenaResumen.nodos}
          onEnviar={() => { void enviar(); }}
          enviando={enviando}
          textoAccion={modo === 'autorizar' ? 'Usar esta ruta' : 'Enviar a concentrado'}
          textoEnviando={modo === 'autorizar' ? 'Aplicando…' : 'Enviando…'}
        />
      </DialogContent>
    </Dialog>
  );
}
