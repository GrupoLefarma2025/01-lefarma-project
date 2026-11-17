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
  aplicarHotelesAlCalculo,
  claveHotel,
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
import { casetasDeRuta } from '../services/casetasRuta';
import { hidratarSolicitud } from '../services/solicitudDraft';
import { solicitudesApi } from '../services/solicitudes.api';
import { generarCapturasEnSegundoPlano } from '../services/evidencias.api';
import type { CostosRutaHotel, CostosRutaResponse } from '../types/costosRuta.types';
import type { CalculoViaje, PropuestaRuta, Solicitud } from '../types/solicitud.types';

function mxn(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function fechaHoraAmPm(valor: string): string {
  const [fecha, hora] = valor.split(' ');
  if (!fecha || !hora) return valor;
  return `${fecha} ${horaAmPm(hora) ?? hora}`;
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
  const buscadosRef = useRef<Set<number>>(new Set());
  const hotelesBuscadosRef = useRef<Set<number>>(new Set());
  const hotelRutaSeqRef = useRef<Record<number, number>>({});
  const sesionRef = useRef(0);

  const hidratado = useMemo(() => (solicitud ? hidratarSolicitud(solicitud.datos) : null), [solicitud]);
  const { tramos, error: errorTramos } = useMemo(
    () => (solicitud ? construirTramos(solicitud) : { tramos: [], error: 'Sin solicitud.' }),
    [solicitud],
  );

  useEffect(() => {
    if (open) return;
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
  const casetasSct = (resultadoActual?.resultados[0]?.casetas ?? []).filter(
    (c) =>
      tramo !== undefined
      && c.deMunicipio === tramo.desde.punto.municipio
      && c.aMunicipio === tramo.hasta.punto.municipio,
  );
  const casetasRuta = casetasSct.length > 0
    ? casetasSct.map((c) => ({
        nombre: c.nombre,
        km: c.km,
        direccion: c.direccion || c.carretera,
        costo: c.tarifa,
      }))
    : tramo
      ? casetasDeRuta(tramo.desde.nombre, tramo.hasta.nombre)
      : [];
  const fuenteCasetas = casetasSct.length > 0 ? 'SCT · Rutas Punto a Punto' : 'Referencia 2026';

  const totalCasetasTramo = casetasRuta.reduce((suma, plaza) => suma + (plaza.costo ?? 0), 0);
  const totalCasetasIda = useMemo(
    () =>
      Object.entries(resultados)
        .filter(([indice]) => Number(indice) !== paso)
        .reduce(
          (suma, [, respuesta]) =>
            suma + (respuesta.resultados[0]?.casetas ?? []).reduce((sub, c) => sub + (c.tarifa ?? 0), 0),
          0,
        ),
    [resultados, paso],
  );
  const totalIdaVuelta = totalCasetasTramo + totalCasetasIda;

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
        const tramoLargo = personaHotel?.tramos[posicion === 'antes' ? 0 : 1];
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
    if (!solicitud) return;
    const actual = tramos[indice];
    if (!actual) return;
    const sesion = sesionRef.current;
    setBuscando(indice);
    setErrores((e) => ({ ...e, [indice]: '' }));
    try {
      const res = await costosRutaApi.calcular(construirRequestTramo(solicitud, actual));
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
  }, [solicitud, tramos]);

  useEffect(() => {
    if (!open || !solicitud || !tramo) return;
    if (buscando !== null) return;
    if (buscadosRef.current.has(paso)) return;
    buscadosRef.current.add(paso);
    void buscarTramo(paso);
  }, [open, solicitud, tramo, paso, buscando, buscarTramo]);

  async function buscarHotel(indice: number) {
    const tramoHotel = tramos[indice];
    if (!solicitud || !tramoHotel) return;
    const posicion = esCarro
      ? (tramoHotel.esRegreso ? 'despues' : 'antes')
      : posicionHotel(indice);
    const request = posicion === 'antes'
      ? construirRequestHotel(solicitud, tramoHotel)
      : construirRequestHotelDespues(solicitud, tramoHotel);
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
    if (primero) void elegirHotel(paso, primero);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, esCarro, usarHotelDelPaso, hotelElegidoDelPaso, hotelDelPaso, hotelesDelPaso, buscando, buscandoRutaHotel, paso]);

  async function enviar() {
    if (!solicitud || !resultadoActual) return;
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
        })),
        segmentos: cadenaResumen.segmentos.map((s) => ({
          tipo: s.tipo,
          puntos: s.puntos,
        })),
      },
    };
    const resumen = resumenCostosRuta(calculo, opciones, modoCalculo);

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
        ? await solicitudesApi.guardarOpciones(solicitud.id_solicitud, opciones, calculo)
        : await solicitudesApi.enviar(solicitud.id_solicitud, calculo);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo enviar a concentrado.');
        return;
      }
      toast.success('Solicitud enviada a concentrado.');
      // Best-effort: captura las opciones elegidas sin retrasar el cierre del
      // modal. Si falla, el detalle conserva "Generar capturas" para reintentar.
      generarCapturasEnSegundoPlano(solicitud.id_solicitud);
      onEnviado(solicitud.id_solicitud);
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

            <div className="space-y-2 text-sm">
              {(tramo.desde.explicita || hotelRutaDelPaso) && fechaSalidaMostrar ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {paso === 0 ? 'Salida del origen' : `Salida de ${tramo.desde.nombre}`}
                  </span>
                  <Badge variant="outline" className="gap-1 font-normal">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {fechaSalidaMostrar}
                  </Badge>
                  {horaSalidaMostrar ? (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Clock className="h-3 w-3" aria-hidden />
                      {horaSalidaMostrar}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">
                  {tramo.esRegreso ? 'Regreso estimado' : `Llegada a ${tramo.hasta.nombre}`}
                </span>
                {fechaLlegadaMostrar ? (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {fechaLlegadaMostrar}
                  </Badge>
                ) : null}
                {horaLlegadaMostrar ? (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Clock className="h-3 w-3" aria-hidden />
                    {horaLlegadaMostrar}
                  </Badge>
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
                {esCarro ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Recorrido en carro</span>
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Car className="h-3 w-3" aria-hidden />
                        {persona.rutaArmada.totales.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
                      </Badge>
                      {ofertaCarro ? (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Clock className="h-3 w-3" aria-hidden />
                          {ofertaCarro.duracion} base
                        </Badge>
                      ) : null}
                      {minutosCarro !== null ? (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Clock className="h-3 w-3" aria-hidden />
                          +{Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(minutosCarro)}
                        </Badge>
                      ) : null}
                    </div>
                    {tramo.esRegreso ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
                        <p className="font-medium text-primary">Regreso</p>
                        <p>
                          Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                        </p>
                        {llegadaCarro ? (
                          <p>
                            Llegada estimada al origen: {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora}
                          </p>
                        ) : null}
                        <p className={llegaRegreso === false ? 'text-amber-700' : 'text-muted-foreground'}>
                          {llegaRegreso === false
                            ? 'No alcanzas a regresar dentro del límite; considera dormir en el último punto.'
                            : 'Sí alcanzas a regresar dentro del límite.'}
                        </p>
                        <p className="text-muted-foreground">
                          Incluye {Math.round(MARGEN_CARRO * 100)}% de margen: {ofertaCarro?.duracion} base + {Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(minutosCarro ?? 0)}.
                        </p>
                      </div>
                    ) : tramo.desde.explicita && tramo.desde.fecha && tramo.desde.hora ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
                        <p className="font-medium text-primary">
                          Salida de {tramo.desde.nombre}: {fechaCorta(tramo.desde.fecha) ?? tramo.desde.fecha} · {horaAmPm(tramo.desde.hora) ?? tramo.desde.hora}
                        </p>
                        {llegadaCarro ? (
                          <p className={llegaCarro === false ? 'text-amber-700' : 'text-muted-foreground'}>
                            Llegada estimada: {fechaCorta(llegadaCarro.fecha) ?? llegadaCarro.fecha} · {horaAmPm(llegadaCarro.hora) ?? llegadaCarro.hora} · {llegaCarro === false ? 'no alcanza la llegada requerida.' : 'alcanza la llegada requerida.'}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground">
                          Incluye {Math.round(MARGEN_CARRO * 100)}% de margen: {ofertaCarro?.duracion} base + {Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(minutosCarro ?? 0)}.
                        </p>
                      </div>
                    ) : salidaCarro ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
                        <p className="font-medium text-primary">
                          Salida aproximada: {fechaCorta(salidaCarro.fecha) ?? salidaCarro.fecha} · {horaAmPm(salidaCarro.hora) ?? salidaCarro.hora}
                        </p>
                        <p className="text-muted-foreground">
                          Para llegar el {fechaCorta(tramo.hasta.fecha) ?? tramo.hasta.fecha} a las {horaLlegadaAmPm ?? tramo.hasta.hora}.
                          {' '}Incluye {Math.round(MARGEN_CARRO * 100)}% de margen: {ofertaCarro?.duracion} base + {Math.round(MARGEN_CARRO * 100)}% = {duracionTexto(salidaCarro.minutos)}.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Casetas en la ruta</p>
                      {casetasRuta.length > 0 ? (
                        <table className="w-full max-w-3xl text-left text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="py-1 pr-2 font-medium">Caseta</th>
                              <th className="py-1 text-right font-medium">Km</th>
                              <th className="py-1 pl-3 font-medium">Dirección</th>
                              <th className="py-1 text-right font-medium">Tarifa auto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {casetasRuta.map((plaza) => (
                              <tr key={plaza.nombre} className="border-b border-border/50 last:border-0">
                                <td className="py-1 pr-2">{plaza.nombre}</td>
                                <td className="py-1 text-right tabular-nums">{plaza.km}</td>
                                <td className="py-1 pl-3 text-muted-foreground">{plaza.direccion}</td>
                                <td className="py-1 text-right tabular-nums">{plaza.costo != null ? mxn(plaza.costo) : 's/d'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t">
                              <td className="py-1 pr-2 font-medium" colSpan={3}>Total casetas del tramo</td>
                              <td className="py-1 text-right font-medium tabular-nums">{mxn(totalCasetasTramo)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin desglose de plazas para esta ruta.</p>
                      )}
                      {tramo.esRegreso && totalIdaVuelta > 0 ? (
                        <p className="text-xs font-medium">
                          Total de ida y vuelta: {mxn(totalIdaVuelta)} (el regreso cruza las mismas casetas en sentido inverso).
                        </p>
                      ) : null}
                      {fuenteCasetas !== 'SCT · Rutas Punto a Punto' ? (
                        <p className="text-[11px] text-muted-foreground">
                          Km y tarifas de referencia 2026; la ruta y las plazas pueden variar.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : buscandoRutaHotel === paso && usarHotelDelPaso ? (
                  <div role="status" aria-live="polite" className="rounded-md border bg-muted/20 p-3 text-xs">
                    <p className="font-medium">Ajustando la ruta con el hotel elegido…</p>
                    <p className="text-muted-foreground">
                      Se recalculan el tramo largo y el taxi local con las coordenadas del hotel.
                    </p>
                  </div>
                ) : hotelRutaDelPaso && tramoLargoHotel ? (
                  <>
                    {tramoLargoHotel.opciones.length > 0 ? (
                      <TablaOpciones
                        titulo={`Opciones ${tramoLargoHotel.from} → ${tramoLargoHotel.to}`}
                        ofertas={tramoLargoHotel.opciones.slice(0, 8)}
                        opcionElegidaId={seleccion[paso] ?? null}
                        onElegir={(oferta) => setSeleccion((s) => ({ ...s, [paso]: oferta.id }))}
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
                          {hotelesDelPaso.map((hotel) => (
                            <label key={claveHotel(hotel)} className="flex cursor-pointer items-start gap-2 rounded border bg-white p-2 text-xs">
                              <input
                                type="radio"
                                name={`hotel-${paso}`}
                                className="mt-0.5"
                                checked={hotelElegidoDelPaso === claveHotel(hotel)}
                                onChange={() => { void elegirHotel(paso, hotel); }}
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
                          ))}
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
