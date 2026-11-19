import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Car, ChevronLeft, ChevronRight, Clock, Search } from 'lucide-react';
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
import { TablaOpciones } from './TablaOpciones';
import { ResumenRutaModal, type PuntoRutaResumen, type SegmentoRuta } from './ResumenRutaModal';
import type { NodoRutaTimeline } from './RutaViajeTimeline';
import { ModoTransporteBadge } from './ModoTransporteBadge';
import { DireccionTramo } from './DireccionTramo';
import {
  MARGEN_CARRO,
  claveHotel,
  comidaDesdeSnapshot,
  construirCalculo,
  construirOpcionesPropuesta,
  construirRequestHotel,
  construirRequestHotelRegreso,
  construirRequestTramo,
  construirTramos,
  duracionTexto,
  fechaCorta,
  horaAmPm,
  minutosConMargen,
  ofertaCalculada,
  resumenCostosRuta,
  salidaAproximada,
  sumarMinutos,
  type TramoViaje,
} from '../services/calculoViaje';
import { costosRutaApi } from '../services/costosRuta.api';
import { geocodificarReversa } from '../services/geocodificar.api';
import { hidratarSolicitud } from '../services/solicitudDraft';
import { solicitudesApi } from '../services/solicitudes.api';
import type {
  CostosRutaCasetaDisponibilidad,
  CostosRutaResponse,
  EstadoCasetasSct,
  PuntoSeleccion,
} from '../types/costosRuta.types';
import type { CalculoViaje, PropuestaRuta, Solicitud } from '../types/solicitud.types';

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
  const [enviando, setEnviando] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const buscadosRef = useRef<Set<number>>(new Set());
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
    setBuscando(null);
    setProgreso(0);
    setResolucion(null);
    buscadosRef.current.clear();
    sesionRef.current += 1;
  }, [open, solicitud?.id_solicitud]);

  const tramo: TramoViaje | undefined = tramos[paso];
  const resultadoActual = resultados[paso];
  const persona = resultadoActual?.resultados[0];
  const propuesta = resultadoActual?.propuestas[0];
  const esCarro = hidratado?.transporte.modo === 'propio';
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
    const id = seleccion[paso];
    if (!id || !persona) return null;
    return persona.tramos.flatMap((t) => t.opciones).find((o) => o.id === id) ?? null;
  }, [persona, seleccion, paso]);

  const incumple = ofertaElegida ? !ofertaElegida.aTiempo : false;
  const sugerirHotel = esCarro
    ? paso === 0
      ? salidaTemprana
      : tramo?.esRegreso
        ? llegaRegreso === false
        : llegaCarro === false
    : incumple;
  const hotelDelPaso = hotelResultados[paso];
  const hotelElegidoDelPaso = hotelElegido[paso];
  const usarHotelDelPaso = usarHotel[paso] === true;
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

    const ofertaDe = (indice: number) =>
      ofertaCalculada(resultados[indice], seleccion[indice] ?? null) ?? null;

    tramos.forEach((tramo, indice) => {
      const oferta = ofertaDe(indice);
      const origen: [number, number] = [tramo.desde.punto.latitud, tramo.desde.punto.longitud];
      const hotel = hotelElegidoDeTramo(indice);
      const conHotel = hotel?.latitud != null && hotel.longitud != null;
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
        const tOrigen: [number, number] | null = terminalOrigen ? [terminalOrigen.latitud, terminalOrigen.longitud] : null;
        const tDestino: [number, number] | null = terminalDestino ? [terminalDestino.latitud, terminalDestino.longitud] : null;
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
  }, [tramos, resultados, hotelResultados, hotelElegidoDeTramo, seleccion]);


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

  const llegadaRegreso = tramo?.esRegreso ? propuesta?.llegadaFinal ?? '' : '';
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
    const request = tramoHotel.esRegreso
      ? construirRequestHotelRegreso(solicitudActiva, tramoHotel)
      : construirRequestHotel(solicitudActiva, tramoHotel);
    if (!request) {
      toast.error('No se pudo preparar la búsqueda de hotel.');
      return;
    }
    const sesion = sesionRef.current;
    setBuscando(-1);
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

  async function enviar() {
    if (!solicitudActiva || !resultadoActual) return;
    const modoCalculo = esCarro ? 'propio' : 'solicitado';
    const opciones = construirOpcionesPropuesta(
      tramos,
      resultados,
      seleccion,
      hotelResultados,
      usarHotel,
      hotelElegido,
    );
    // Una sola versión coherente: el cálculo usa las mismas selecciones que
    // las opciones y el resumen, y conserva costo/enlace en la ruta.
    const calculo: CalculoViaje = {
      ...construirCalculo(tramos, resultados, modoCalculo, seleccion),
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
              ? `Paso ${paso + 1} de ${tramos.length}: ${paso === 0 ? 'Origen' : tramo.desde.nombre} → ${tramo.esRegreso ? 'Regreso' : tramo.hasta.nombre}`
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
                  desde={i === 0 ? 'Origen' : t.desde.nombre}
                  hasta={t.esRegreso ? 'Regreso' : t.hasta.nombre}
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
            </h3>

            <div data-testid="calculos-viaje-layout" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <div data-testid="calculos-viaje-schedule-column" className="min-w-0 space-y-3">
                <section aria-label="Horarios solicitados" className="space-y-2 text-sm">
                  {tramo.desde.explicita && fechaSalida ? (
                    <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {paso === 0 ? 'Salida del origen' : `Salida de ${tramo.desde.nombre}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {fechaSalida}
                        </span>
                        {horaSalidaAmPm ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                            {horaSalidaAmPm}
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
                      {fechaLlegada ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {fechaLlegada}
                        </span>
                      ) : null}
                      {horaLlegadaAmPm ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                          {horaLlegadaAmPm}
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
                {esCarro ? null : (
                  persona.tramos.map((subtramo, i) => (
                    <div key={`${subtramo.from}-${subtramo.to}-${i}`} className="space-y-1">
                      <p className="text-xs font-medium">{subtramo.from} → {subtramo.to}</p>
                      {subtramo.opciones.length > 0 ? (
                        <TablaOpciones
                          titulo={`Opciones ${subtramo.from} → ${subtramo.to}`}
                          ofertas={subtramo.opciones.slice(0, 8)}
                          opcionElegidaId={i === 0 ? seleccion[paso] ?? null : null}
                          onElegir={(oferta) => setSeleccion((s) => ({ ...s, [paso]: oferta.id }))}
                        />
                      ) : <p className="text-sm text-muted-foreground">Sin opciones para este subtramo.</p>}
                    </div>
                  ))
                )}

                {!esCarro && propuesta && propuesta.incumplimientos.length > 0 ? (
                  <div className="rounded-md bg-muted/30 p-2 text-xs">
                    <ul className="list-disc pl-4 text-amber-700">
                      {propuesta.incumplimientos.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}

                {tramo.esRegreso && regresoEnSabado ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    <p>El regreso cae en sábado; se procura regresar el viernes.</p>
                  </div>
                ) : null}

                {sugerirHotel ? (
                  <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                    <label className="flex items-center gap-2 text-sm text-amber-900">
                      <input
                        type="checkbox"
                        checked={usarHotelDelPaso}
                        onChange={(e) => {
                          const marcado = e.target.checked;
                          setUsarHotel((u) => ({ ...u, [paso]: marcado }));
                          if (marcado && !hotelDelPaso) void buscarHotel(paso);
                        }}
                      />
                      {tramo.esRegreso
                        ? `Dormir cerca de ${tramo.desde.nombre} y regresar al día siguiente`
                        : `Dormir cerca de ${tramo.hasta.nombre} y continuar al día siguiente`}
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
                              Buscando hospedaje cerca de{' '}
                              {tramo.esRegreso ? tramo.desde.nombre : tramo.hasta.nombre}.
                            </p>
                          </div>
                        </div>
                      ) : hotelDelPaso ? (
                        <div className="space-y-1">
                          {hotelesDelPaso.map((hotel) => (
                            <label key={claveHotel(hotel)} className="flex cursor-pointer items-start gap-2 rounded border bg-white p-2 text-xs">
                              <input
                                type="radio"
                                name={`hotel-${paso}`}
                                className="mt-0.5"
                                checked={hotelElegidoDelPaso === claveHotel(hotel)}
                                onChange={() => setHotelElegido((h) => ({ ...h, [paso]: claveHotel(hotel) }))}
                              />
                              <span className="flex-1">
                                <span className="font-medium">{hotel.nombre ?? hotel.lugar}</span>
                                <span className="text-muted-foreground"> · {hotel.ciudad} · {fechaCorta(hotel.checkIn) ?? hotel.checkIn} a {fechaCorta(hotel.checkOut) ?? hotel.checkOut} · {hotel.noches} noche(s)</span>
                                <span className="block text-muted-foreground">
                                  {hotel.distanciaKm !== undefined
                                    ? hotel.distanciaKm > 0
                                      ? `${hotel.distanciaKm.toFixed(1)} km del punto · `
                                      : 'En el punto · '
                                    : ''}
                                  {hotel.precioNoche
                                    ? `${mxn(hotel.precioNoche)}/noche (tabulador) · total ${mxn(hotel.precioTotal ?? hotel.precioNoche * hotel.noches)}`
                                    : hotel.motivo}
                                  {hotel.rating != null
                                    ? ` · ★${hotel.rating.toFixed(1)}${hotel.ratingCount ? ` (${hotel.ratingCount})` : ''}`
                                    : ''}
                                </span>
                              </span>
                              {hotel.link ? <a href={hotel.link} target="_blank" rel="noreferrer" className="underline">Ver</a> : null}
                            </label>
                          ))}
                          {hotelDelPaso.propuestas[0] ? (
                            <p className="text-xs text-muted-foreground">
                              Ruta con hotel: {fechaHoraAmPm(hotelDelPaso.propuestas[0].salidaOrigen)} → {fechaHoraAmPm(hotelDelPaso.propuestas[0].llegadaFinal)}.
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
          <Button type="button" variant="outline" onClick={() => { void buscarTramo(paso); }} disabled={buscando !== null}>
            <Search className="h-4 w-4" aria-hidden />
            {errores[paso] ? 'Reintentar' : resultadoActual ? 'Volver a buscar' : 'Buscar opciones'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Atrás
          </Button>
          {esUltimo ? (
            <Button type="button" className="gap-1.5" disabled={!resultadoActual || enviando} onClick={() => setResumenAbierto(true)}>
              Terminar
            </Button>
          ) : (
            <Button type="button" disabled={!resultadoActual} onClick={() => setPaso((p) => Math.min(tramos.length - 1, p + 1))}>
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
