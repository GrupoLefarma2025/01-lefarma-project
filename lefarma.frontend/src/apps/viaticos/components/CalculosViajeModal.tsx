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
import { ResumenRutaModal, type PuntoRutaResumen } from './ResumenRutaModal';
import {
  MARGEN_CARRO,
  construirCalculo,
  construirRequestHotel,
  construirRequestHotelRegreso,
  construirRequestTramo,
  construirTramos,
  duracionTexto,
  fechaCorta,
  horaAmPm,
  minutosConMargen,
  salidaAproximada,
  sumarMinutos,
  type TramoViaje,
} from '../services/calculoViaje';
import { costosRutaApi } from '../services/costosRuta.api';
import { casetasDeRuta } from '../services/casetasRuta';
import { hidratarSolicitud } from '../services/solicitudDraft';
import { solicitudesApi } from '../services/solicitudes.api';
import type { CostosRutaResponse } from '../types/costosRuta.types';
import type { OpcionCotizacion, Solicitud } from '../types/solicitud.types';

function mxn(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

function fechaHoraAmPm(valor: string): string {
  const [fecha, hora] = valor.split(' ');
  if (!fecha || !hora) return valor;
  return `${fecha} ${horaAmPm(hora) ?? hora}`;
}

function claveHotel(hotel: { lugar: string; nombre?: string; checkIn: string; distanciaKm?: number }): string {
  return `${hotel.nombre ?? hotel.lugar}|${hotel.checkIn}|${hotel.distanciaKm ?? ''}`;
}

export function CalculosViajeModal({
  solicitud,
  open,
  onOpenChange,
  onEnviado,
}: {
  solicitud: Solicitud | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviado: (id: number) => void;
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
    setBuscando(null);
    setProgreso(0);
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

  /** Ruta reconstruida: origen → hotel → punto → ... → regreso. */
  const puntosResumen = useMemo<PuntoRutaResumen[]>(() => {
    const puntos: PuntoRutaResumen[] = [];
    const vistas = new Set<string>();
    const agregar = (punto: PuntoRutaResumen) => {
      const clave = `${punto.lat.toFixed(4)},${punto.lng.toFixed(4)}`;
      if (vistas.has(clave)) return;
      vistas.add(clave);
      puntos.push(punto);
    };
    tramos.forEach((tramo, indice) => {
      agregar({
        lat: tramo.desde.punto.latitud,
        lng: tramo.desde.punto.longitud,
        nombre: tramo.desde.nombre,
        tipo: indice === 0 ? 'origen' : 'punto',
      });
      const hotel = hotelElegidoDeTramo(indice);
      if (hotel && hotel.latitud != null && hotel.longitud != null) {
        agregar({
          lat: hotel.latitud,
          lng: hotel.longitud,
          nombre: hotel.nombre ?? hotel.lugar,
          tipo: 'hotel',
        });
      }
      agregar({
        lat: tramo.hasta.punto.latitud,
        lng: tramo.hasta.punto.longitud,
        nombre: tramo.hasta.nombre,
        tipo: tramo.esRegreso ? 'regreso' : 'punto',
      });
    });
    return puntos;
  }, [tramos, hotelElegidoDeTramo]);

  const tramosResumen = useMemo<string[]>(
    () =>
      tramos.map((tramo, indice) => {
        const hotel = hotelElegidoDeTramo(indice);
        const base = `${tramo.desde.nombre} → ${tramo.hasta.nombre}`;
        return hotel ? `${base} (durmiendo en ${hotel.nombre ?? hotel.lugar})` : base;
      }),
    [tramos, hotelElegidoDeTramo],
  );

  /** Trazado de la carretera (no una línea recta) para el mapa del resumen. */
  const lineaResumen = useMemo<[number, number][]>(() => {
    const puntos: [number, number][] = [];
    const agregar = (lat: number, lng: number) => {
      const ultimo = puntos[puntos.length - 1];
      if (ultimo && Math.abs(ultimo[0] - lat) < 1e-6 && Math.abs(ultimo[1] - lng) < 1e-6) return;
      puntos.push([lat, lng]);
    };
    tramos.forEach((tramo, indice) => {
      const conHotel = hotelElegidoDeTramo(indice) !== null;
      const fuente = conHotel ? hotelResultados[indice] : resultados[indice];
      const tramosRuta = fuente?.resultados[0]?.rutaArmada.tramos ?? [];
      const hayTrazado = tramosRuta.some((t) => (t.grafica?.length ?? 0) > 1);
      if (hayTrazado) {
        for (const t of tramosRuta) {
          for (const p of t.grafica ?? []) agregar(p[0], p[1]);
        }
      } else {
        agregar(tramo.desde.punto.latitud, tramo.desde.punto.longitud);
        agregar(tramo.hasta.punto.latitud, tramo.hasta.punto.longitud);
      }
    });
    return puntos;
  }, [tramos, resultados, hotelResultados, hotelElegidoDeTramo]);


  useEffect(() => {
    if (!buscandoEste) {
      setProgreso(0);
      return;
    }
    setProgreso(8);
    const id = window.setInterval(() => {
      setProgreso((p) => Math.min(90, p + 3));
    }, 300);
    return () => window.clearInterval(id);
  }, [buscandoEste]);

  const llegadaRegreso = tramo?.esRegreso ? propuesta?.llegadaFinal ?? '' : '';
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
    const request = tramoHotel.esRegreso
      ? construirRequestHotelRegreso(solicitud, tramoHotel)
      : construirRequestHotel(solicitud, tramoHotel);
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
    if (!solicitud || !resultadoActual) return;
    const opciones: OpcionCotizacion[] = [];

    tramos.forEach((_tramo, i) => {
      const oferta = resultados[i]?.resultados[0]?.tramos[0]?.opciones.find((o) => o.id === seleccion[i]);
      if (!oferta?.comprar?.url) return;
      opciones.push({
        tipo: oferta.modo,
        linea: oferta.linea,
        precio: oferta.costoGrupo,
        moneda: 'MXN',
        url_compra: oferta.comprar.url,
        fuente: oferta.fuente,
        fue_elegida: true,
        ruta_captura: oferta.capturas?.[0] ?? oferta.rutaCaptura ?? null,
        capturas: oferta.capturas ?? (oferta.rutaCaptura ? [oferta.rutaCaptura] : []),
      });
    });

    for (const [indice, response] of Object.entries(hotelResultados)) {
      const clave = hotelElegido[Number(indice)];
      const hotel = response.resultados[0]?.hotelesPropuestos.find((h) => claveHotel(h) === clave);
      if (!hotel?.link) continue;
      opciones.push({
        tipo: 'hotel',
        linea: `${hotel.nombre ?? hotel.lugar} (${hotel.checkIn} al ${hotel.checkOut})`,
        precio: hotel.precioTotal ?? hotel.precioNoche ?? null,
        moneda: 'MXN',
        url_compra: hotel.link,
        fuente: `${hotel.fuente} (estimado)`,
        fue_elegida: true,
        ruta_captura: null,
        capturas: [],
      });
    }

    setEnviando(true);
    try {
      // La ruta calculada se guarda con la solicitud: es la que manda después
      // del envío (la propuesta del wizard queda como referencia).
      const calculo = construirCalculo(tramos, resultados, esCarro ? 'propio' : 'solicitado');
      const res = opciones.length > 0
        ? await solicitudesApi.guardarOpciones(solicitud.id_solicitud, opciones, calculo)
        : await solicitudesApi.enviar(solicitud.id_solicitud, calculo);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo enviar a concentrado.');
        return;
      }
      toast.success('Solicitud enviada a concentrado.');
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
            <Badge variant={esCarro ? 'secondary' : 'outline'}>
              {esCarro ? 'Carro propio' : 'Solicitud de transporte'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {tramo
              ? `Paso ${paso + 1} de ${tramos.length}: ${paso === 0 ? 'Origen' : tramo.desde.nombre} → ${tramo.esRegreso ? 'Regreso' : tramo.hasta.nombre}`
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
                {i === 0 ? 'Origen' : t.desde.nombre} → {t.esRegreso ? 'Regreso' : t.hasta.nombre}
              </button>
            ))}
          </div>
        ) : null}

        {tramo ? (
          <section className="space-y-3 rounded-b-lg border p-3">
            <h3 className="text-sm font-semibold">Tramo {paso + 1}: {tramo.desde.nombre} → {tramo.hasta.nombre}</h3>

            <div className="space-y-2 text-sm">
              {tramo.desde.explicita && fechaSalida ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {paso === 0 ? 'Salida del origen' : `Salida de ${tramo.desde.nombre}`}
                  </span>
                  <Badge variant="outline" className="gap-1 font-normal">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {fechaSalida}
                  </Badge>
                  {horaSalidaAmPm ? (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Clock className="h-3 w-3" aria-hidden />
                      {horaSalidaAmPm}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">
                  {tramo.esRegreso ? 'Regreso estimado' : `Llegada a ${tramo.hasta.nombre}`}
                </span>
                {fechaLlegada ? (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {fechaLlegada}
                  </Badge>
                ) : null}
                {horaLlegadaAmPm ? (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Clock className="h-3 w-3" aria-hidden />
                    {horaLlegadaAmPm}
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
                      buscando === -1 ? <p className="text-xs">Buscando hoteles…</p> : hotelDelPaso ? (
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
          puntos={puntosResumen}
          linea={lineaResumen}
          tramosTexto={tramosResumen}
          onEnviar={() => { void enviar(); }}
          enviando={enviando}
        />
      </DialogContent>
    </Dialog>
  );
}
