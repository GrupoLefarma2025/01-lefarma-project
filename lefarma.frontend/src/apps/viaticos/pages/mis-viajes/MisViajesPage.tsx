import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Clock, ExternalLink, Eye, MoreHorizontal, Pencil, RefreshCw, Route, Search, Send, Ticket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { folderTabTriggerClassName } from '@/components/ui/folder-tab';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { solicitudesApi } from '../../services/solicitudes.api';
import { evidenciasApi, type DatosViaje, type EvidenciasSolicitud } from '../../services/evidencias.api';
import { CeldaCaptura } from '../../components/celdasCotizacion';
import { estadoTexto, precioTexto } from '../../types/aprobaciones.types';
import type {
  CalculoViaje,
  DatosOpcion,
  OpcionCotizacion,
  PropuestaRuta,
  Solicitud,
  SolicitudOpcion,
} from '../../types/solicitud.types';
import { textoTotalElegidas, totalDeOpcionesElegidas } from '../aprobaciones/DetalleSolicitudModal';
import { ResumenViaje } from '../../components/ResumenViaje';
import { ModoTransporteBadge } from '../../components/ModoTransporteBadge';
import { RutaViajeTimeline, type NodoRutaTimeline } from '../../components/RutaViajeTimeline';
import {
  BotonVerMapa,
  RutaMapaDialog,
} from '../../components/RutaMapa';
import { BoletoViajeDialog, BotonVerBoleto } from '../../components/BoletoViajeDialog';
import { ComparadorRutas } from '../../components/ComparadorRutas';
import type { PuntoMapa, SegmentoMapa } from '../../components/rutaMapa.types';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { resumenDesdeDatos } from '../../services/resumenViaje';
import { horaAmPm, leerCalculoAutorizadoDesdeDatos, leerCalculoDesdeDatos } from '../../services/calculoViaje';
import {
  enRango,
  leerDatosViaje,
  mxn,
  rangoDelFiltro,
  type FilaViaje,
  type FiltroPeriodo,
  type TipoViaje,
} from './viajes.helpers';
import { FiltrosSolicitudes } from './FiltrosSolicitudes';
import { SolicitudesViajeTable } from './SolicitudesViajeTable';

/** Objeto JSON seguro: descarta arrays y primitivos. */
function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Pestaña visible de la lista; viaja en la URL para poder enlazarla. */
type Pestana = 'borradores' | 'enviadas';

export function MisViajesPage({ hoy = new Date() }: { hoy?: Date }) {
  usePageTitle('Mis viajes', 'Viáticos');
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const miId = useAuthStore((s) => s.user?.id);
  const miNombre = useAuthStore((s) => s.user?.nombre);
  const puedeVerTodas = usePermission({ require: 'viaticos.ver_todos' });

  const pestana: Pestana = parametros.get('pestana') === 'enviadas' ? 'enviadas' : 'borradores';

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('todo');
  const [tipo, setTipo] = useState<TipoViaje | 'todos'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [calculo, setCalculo] = useState<Solicitud | null>(null);

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // `todas` solo lo concede el servidor con viaticos.ver_todos; sin el
      // permiso la API responde 403 y se muestra el error.
      const res = await solicitudesApi.misSolicitudes(puedeVerTodas ? { todas: true } : undefined);
      if (res.data.success) setSolicitudes(res.data.data ?? []);
      else setError(res.data.message ?? 'No se pudieron cargar tus viajes.');
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudieron cargar tus viajes.');
    } finally {
      setCargando(false);
    }
  }, [puedeVerTodas]);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  // Referencia «hoy» en hora local; el rango siempre se muestra.
  const rango = rangoDelFiltro(periodo, hoy, desde, hasta);

  const filas = useMemo<{ borradores: FilaViaje[]; enviadas: FilaViaje[] }>(() => {
    const base = [...solicitudes]
      // El último creado primero (la API ya ordena; se refuerza aquí).
      .sort((a, b) =>
        b.fecha_creacion.localeCompare(a.fecha_creacion) || b.id_solicitud - a.id_solicitud,
      )
      .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
      .filter(({ resumen }) => (tipo === 'todos' ? true : resumen.tipoViaje === tipo))
      .filter(({ solicitud }) => enRango(solicitud.fecha_creacion, rango));
    return {
      borradores: base.filter(({ solicitud }) => solicitud.estado === 'borrador'),
      enviadas: base.filter(({ solicitud }) => solicitud.estado === 'enviada'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes, tipo, periodo, desde, hasta]);

  const verDetalle = useCallback(async (id: number) => {
    setViendoId(id);
    setDetalle(null);
    setCargandoDetalle(true);
    try {
      const res = await solicitudesApi.detalle(id);
      if (res.data.success && res.data.data) setDetalle(res.data.data);
      else toast.error(res.data.message ?? 'No se pudo cargar el detalle.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo cargar el detalle.');
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const eliminarBorrador = useCallback(async (solicitud: Solicitud) => {
    const etiqueta = solicitud.folio ?? `#${solicitud.id_solicitud}`;
    if (!window.confirm(`¿Eliminar el borrador ${etiqueta}?`)) return;
    setProcesandoId(solicitud.id_solicitud);
    try {
      const res = await solicitudesApi.eliminar(solicitud.id_solicitud);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo eliminar el borrador.');
        return;
      }
      toast.success(`Borrador ${etiqueta} eliminado.`);
      await cargarSolicitudes();
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo eliminar el borrador.');
    } finally {
      setProcesandoId(null);
    }
  }, [cargarSolicitudes]);

  // La tabla abre el detalle con un clic en la fila y, en la última columna,
  // muestra las acciones que permiten el estado y la propiedad de la solicitud.
  const accionesDe = useCallback(
    (fila: FilaViaje): ReactNode => {
      const solicitud = fila.solicitud;
      const esBorrador = solicitud.estado === 'borrador';
      const esMia = miId !== undefined && solicitud.id_usuario_solicitante === miId;
      const procesando = procesandoId === solicitud.id_solicitud;
      const etiqueta = solicitud.folio ?? `#${solicitud.id_solicitud}`;

      const verDetalleBoton = (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`Ver detalle ${etiqueta}`}
          onClick={() => { void verDetalle(solicitud.id_solicitud); }}
        >
          <Eye className="h-4 w-4" aria-hidden />
          Ver detalle
        </Button>
      );

      // Con viaticos.ver_todos aparecen borradores de otras personas: ahí solo
      // se consulta, no se envía, edita ni elimina.
      if (!esBorrador || !esMia) return verDetalleBoton;

      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Enviar a autorización"
                disabled={procesando}
                onClick={() => setCalculo(solicitud)}
              >
                <Send className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar a autorización</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => { void verDetalle(solicitud.id_solicitud); }}>
                <Eye className="mr-2 h-4 w-4" aria-hidden />
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/viaticos/solicitud/${solicitud.id_solicitud}`)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem disabled={procesando} onClick={() => { void eliminarBorrador(solicitud); }}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      );
    },
    [miId, procesandoId, verDetalle, eliminarBorrador, navigate],
  );

  // Cuántos filtros se apartan de lo que la página muestra por defecto, para
  // que el encabezado plegado diga de un vistazo si hay algo filtrado.
  const filtrosAplicados = [
    periodo !== 'todo',
    tipo !== 'todos',
    Boolean(desde),
    Boolean(hasta),
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {puedeVerTodas ? (
        <p className="text-xs text-muted-foreground">
          Ves las solicitudes de todos los usuarios. Los borradores de otras personas solo se pueden consultar.
        </p>
      ) : null}

      <FiltrosSolicitudes
        periodo={periodo}
        onPeriodo={setPeriodo}
        tipo={tipo}
        onTipo={setTipo}
        desde={desde}
        onDesde={setDesde}
        hasta={hasta}
        onHasta={setHasta}
        rango={rango}
        filtrosAplicados={filtrosAplicados}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Tabs
        value={pestana}
        onValueChange={(valor) => {
          const siguiente = new URLSearchParams(parametros);
          if (valor === 'enviadas') siguiente.set('pestana', 'enviadas');
          else siguiente.delete('pestana');
          setParametros(siguiente, { replace: true });
        }}
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 text-muted-foreground">
          <TabsTrigger value="borradores" className={folderTabTriggerClassName}>
            Borradores ({filas.borradores.length})
          </TabsTrigger>
          <TabsTrigger value="enviadas" className={folderTabTriggerClassName}>
            Enviadas ({filas.enviadas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="borradores" className="mt-4">
          <SolicitudesViajeTable
            filas={filas.borradores}
            cargando={cargando}
            titulo="Borradores"
            subtitulo={`Total: ${filas.borradores.length}`}
            tableId="mis-viajes-v4"
            miId={miId}
            miNombre={miNombre}
            onVerDetalle={(id) => { void verDetalle(id); }}
            onRefresh={() => { void cargarSolicitudes(); }}
            acciones={accionesDe}
          />
        </TabsContent>

        <TabsContent value="enviadas" className="mt-4">
          <SolicitudesViajeTable
            filas={filas.enviadas}
            cargando={cargando}
            titulo="Enviadas"
            subtitulo={`Total: ${filas.enviadas.length}`}
            tableId="mis-viajes-v4"
            miId={miId}
            miNombre={miNombre}
            onVerDetalle={(id) => { void verDetalle(id); }}
            onRefresh={() => { void cargarSolicitudes(); }}
            acciones={accionesDe}
          />
        </TabsContent>
      </Tabs>

      <CalculosViajeModal
        solicitud={calculo}
        open={calculo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCalculo(null);
        }}
        onEnviado={() => {
          void cargarSolicitudes();
          // Al enviar, la solicitud pasa a la cola de autorización: la persona
          // la sigue viendo en la pestaña Enviadas.
          navigate('/viaticos/mis-viajes?pestana=enviadas');
        }}
      />

      <Dialog
        open={viendoId !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setViendoId(null);
            setDetalle(null);
          }
        }}
      >
        <DialogContent data-testid="detalle-viaje" className="w-[90vw] max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>Detalle del viaje {detalle?.folio ?? (viendoId !== null ? `#${viendoId}` : '')}</DialogTitle>
            <DialogDescription>Resumen capturado en la solicitud y, si existe, la cotización.</DialogDescription>
          </DialogHeader>
          {cargandoDetalle ? <p role="status">Cargando detalle…</p> : null}
          {detalle ? <VistaDetalle solicitud={detalle} /> : null}
          <DialogFooter className="gap-2">
            {detalle?.estado === 'borrador' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const id = detalle.id_solicitud;
                  setViendoId(null);
                  setDetalle(null);
                  navigate(`/viaticos/solicitud/${id}`);
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setViendoId(null);
                setDetalle(null);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Paradas del diagrama para la ruta calculada. Los cálculos nuevos traen la
 * cadena completa (origen, terminal, vuelo o autobús, hotel, regreso); los
 * viejos solo traen los tramos y se arma un diagrama mínimo con ellos.
 */
/** Chips de un tramo: km, tiempos y horarios, sin repetir vacíos. */
function chipsDeTramo(tramo: CalculoViaje['tramos'][number]): string[] {
  return [
    tramo.km != null ? `${tramo.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : '',
    tramo.duracion ?? '',
    tramo.duracion_con_margen ? `${tramo.duracion_con_margen} con margen` : '',
  ].filter((chip) => chip !== '');
}

/** Costo y enlace de compra guardados con la ruta o con cada tramo. */
interface CostoRuta {
  costo: number | null;
  url_compra: string | null;
}

interface CostosCalculo {
  nodos: CostoRuta[];
  tramos: CostoRuta[];
}

const COSTO_VACIO: CostoRuta = { costo: null, url_compra: null };

function numeroONull(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function textoONull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function leerCostoRuta(valor: unknown): CostoRuta {
  const objeto = comoObjeto(valor);
  if (!objeto) return { ...COSTO_VACIO };
  return {
    costo: numeroONull(objeto.costo),
    url_compra: textoONull(objeto.url_compra),
  };
}

/**
 * `leerCalculoDesdeDatos` normaliza lo que pinta la ruta, pero no conserva el
 * costo ni el enlace de compra de cada parada. Se leen del snapshot crudo para
 * que el diagrama muestre el precio por tramo y "Ir a compra".
 */
function leerCostosCalculo(datos: unknown, clave: 'calculo' | 'calculo_autorizado'): CostosCalculo {
  const calculo = comoObjeto(comoObjeto(datos)?.[clave]);
  if (!calculo) return { nodos: [], tramos: [] };
  const ruta = comoObjeto(calculo.ruta);
  const nodosBrutos = ruta && Array.isArray(ruta.nodos) ? ruta.nodos : [];
  const tramosBrutos = Array.isArray(calculo.tramos) ? calculo.tramos : [];
  return {
    nodos: nodosBrutos.map(leerCostoRuta),
    tramos: tramosBrutos.map(leerCostoRuta),
  };
}

/** Opciones de la propuesta como opciones de solicitud, con id sintético negativo. */
function opcionesDePropuesta(opciones: OpcionCotizacion[]): SolicitudOpcion[] {
  return opciones.map((opcion, indice) => ({
    id_opcion: -(indice + 1),
    tipo: opcion.tipo,
    linea: opcion.linea,
    precio: opcion.precio,
    moneda: opcion.moneda ?? null,
    url_compra: opcion.url_compra ?? null,
    fuente: opcion.fuente,
    fue_elegida: opcion.fue_elegida,
    ruta_captura: opcion.ruta_captura ?? null,
    datos: opcion.datos ?? null,
  }));
}

/**
 * Opciones que el viajero tenía antes de autorizar. El concentrado las deja en
 * `datos.opciones_originales`; si no existen, las vigentes SON las originales.
 */
function leerOpcionesOriginales(datos: unknown): SolicitudOpcion[] | null {
  const bruto = comoObjeto(datos)?.opciones_originales;
  if (!Array.isArray(bruto)) return null;
  return bruto
    .map((item) => comoObjeto(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, indice) => ({
      id_opcion: numeroONull(item.id_opcion) ?? -(indice + 1),
      tipo: textoONull(item.tipo) ?? '',
      linea: textoONull(item.linea) ?? '',
      precio: numeroONull(item.precio),
      moneda: textoONull(item.moneda),
      url_compra: textoONull(item.url_compra),
      fuente: textoONull(item.fuente) ?? '',
      fue_elegida: item.fue_elegida === true,
      ruta_captura: textoONull(item.ruta_captura),
      datos: comoObjeto(item.datos) as DatosOpcion | null,
    }));
}

/** Precio y enlace de compra del tramo como líneas del diagrama. */
function nodosDesdeCalculo(
  calculo: CalculoViaje,
  opciones: SolicitudOpcion[] = [],
  costos?: CostosCalculo,
): NodoRutaTimeline[] {
  const opcionDeTramo = (numero: number | null): SolicitudOpcion | null => {
    if (numero === null) return null;
    return (
      opciones.find(
        (opcion) => opcion.fue_elegida && opcion.datos?.tramo === numero,
      ) ?? null
    );
  };

  // Lo guardado en la ruta manda; si falta, se completa con la opción elegida
  // cuyo `datos.tramo` corresponde a la parada numerada ("1. Destino").
  const costoDeTramo = (
    numero: number | null,
    guardado?: CostoRuta,
    tramo?: CalculoViaje['tramos'][number],
  ): CostoRuta => {
    const opcion = opcionDeTramo(numero);
    return {
      costo: tramo?.costo ?? guardado?.costo ?? opcion?.precio ?? null,
      url_compra: tramo?.url_compra ?? guardado?.url_compra ?? opcion?.url_compra ?? null,
    };
  };

  if (calculo.ruta?.nodos?.length) {
    return calculo.ruta.nodos.map((nodo, i) => {
      // Los cálculos viejos no guardaron chips: se toman del tramo que
      // corresponde a la parada numerada ("1. Destino" -> tramo 1).
      const numero = /^(\d+)\./.exec(nodo.titulo.trim());
      const numeroTramo = numero ? Number(numero[1]) : null;
      const tramo = numeroTramo !== null ? calculo.tramos[numeroTramo - 1] : undefined;
      const guardado = costos?.nodos[i];
      const base = costoDeTramo(numeroTramo, guardado, tramo);
      return {
        id: `ruta-${i}`,
        titulo: nodo.titulo,
        detalles: nodo.detalles,
        chips: nodo.chips && nodo.chips.length > 0
          ? nodo.chips
          : tramo ? chipsDeTramo(tramo) : undefined,
        costo: nodo.costo ?? base.costo,
        urlCompra: nodo.url_compra ?? base.url_compra,
      };
    });
  }
  const primera = calculo.tramos[0];
  return [
    { id: 'origen', titulo: 'Origen', detalles: [primera?.de ?? '—'] },
    ...calculo.tramos.map((tramo, i) => {
      const costo = costoDeTramo(i + 1, costos?.tramos[i], tramo);
      const fechas = [
        tramo.salida_fecha,
        tramo.salida_hora,
        'a',
        tramo.llegada_fecha,
        tramo.llegada_hora,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        id: `tramo-${i}`,
        titulo: `${i + 1}. ${tramo.a}`,
        detalles: fechas.trim() !== '' ? [fechas] : [],
        chips: chipsDeTramo(tramo),
        costo: costo.costo,
        urlCompra: costo.url_compra,
      };
    }),
  ];
}

/**
 * Paradas y trazo del mapa para la ruta calculada. Usa la cadena guardada al
 * enviar; si el cálculo es viejo y no la trae, une las paradas con rectas.
 */
function mapaDeCalculo(calculo: CalculoViaje | null): { puntos: PuntoMapa[]; segmentos: SegmentoMapa[] } {
  const puntos: PuntoMapa[] = (calculo?.ruta?.puntos ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    nombre: p.nombre,
    tipo: p.tipo,
  }));
  const guardados = calculo?.ruta?.segmentos ?? [];
  if (guardados.length > 0) return { puntos, segmentos: guardados };
  const segmentos: SegmentoMapa[] = puntos.slice(1).map((p, i) => ({
    tipo: 'carretera',
    puntos: [[puntos[i].lat, puntos[i].lng], [p.lat, p.lng]],
  }));
  return { puntos, segmentos };
}

/** Paradas y trazo del mapa para la propuesta original del wizard. */
function mapaDeInicial(resumen: NonNullable<ReturnType<typeof resumenDesdeDatos>>): {
  puntos: PuntoMapa[];
  segmentos: SegmentoMapa[];
} {
  type Punto = { latitud: number; longitud: number; nombre: string };
  const secuencia: [number, number][] = [];
  const puntos: PuntoMapa[] = [];
  const vistos = new Set<string>();
  const agregar = (punto: Punto | null | undefined, tipo: PuntoMapa['tipo'], nombre: string) => {
    if (!punto) return;
    const clave = `${punto.latitud.toFixed(4)},${punto.longitud.toFixed(4)}`;
    secuencia.push([punto.latitud, punto.longitud]);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    puntos.push({ lat: punto.latitud, lng: punto.longitud, nombre, tipo });
  };

  agregar(resumen.origen.punto, 'origen', 'Origen');
  resumen.destinos.forEach((destino, i) => {
    agregar(destino.punto, 'punto', destino.etiqueta?.trim() || destino.punto?.nombre || `Destino ${i + 1}`);
  });
  agregar(
    resumen.retorno.destino === 'origen' ? resumen.origen.punto : resumen.retorno.punto,
    'regreso',
    'Regreso',
  );

  const segmentos: SegmentoMapa[] = secuencia.slice(1).map((p, i) => ({
    tipo: 'carretera',
    puntos: [secuencia[i], p],
  }));
  return { puntos, segmentos };
}

/**
 * Detalle del viaje: la ruta calculada (la que manda tras el envío) y, en
 * otra pestaña, la propuesta original del wizard. La tercera pestaña muestra
 * la versión autorizada o la propuesta que el revisor está evaluando.
 */
export function VistaDetalle({
  solicitud,
  acciones,
  modoRevision = false,
  pestanaInicial,
  propuesta = null,
  onRecalcular,
}: {
  solicitud: Solicitud;
  /**
   * Acciones del revisor dentro del detalle (autorizar la ruta elegida o
   * generar una nueva). Mis viajes no las pasa: la persona viajera solo
   * consulta.
   */
  acciones?: ReactNode;
  /**
   * Vista de revisión (concentrado): habilita «Ruta autorizada» desde el
   * inicio usando la ruta original como propuesta mientras no haya recálculo.
   */
  modoRevision?: boolean;
  /** Pestaña activa al abrir; por defecto la ruta calculada. */
  pestanaInicial?: 'calculada' | 'inicial' | 'autorizada';
  /** Versión recalculada que el revisor evalúa antes de autorizar. */
  propuesta?: PropuestaRuta | null;
  /** Vuelve a calcular la ruta desde la revisión. */
  onRecalcular?: () => void;
}) {
  const resumen = resumenDesdeDatos(solicitud.datos);
  const calculo = leerCalculoDesdeDatos(solicitud.datos);
  // Solicitudes autorizadas antes de que existiera `calculo_autorizado`: la
  // ruta calculada ES la que se autorizó. Las nuevas traen su propia versión.
  const estaAutorizada =
    solicitud.estado === 'autorizada' || solicitud.estado === 'autorizada_con_ajustes';
  const calculoAutorizado =
    leerCalculoAutorizadoDesdeDatos(solicitud.datos) ?? (estaAutorizada ? calculo : null);

  // «Ruta autorizada» muestra, por prioridad: la propuesta en revisión, la
  // versión ya autorizada o, en una revisión sin recálculo, la ruta original.
  const versionAutorizada: {
    calculo: CalculoViaje;
    opciones: SolicitudOpcion[];
    claveDatos: 'calculo' | 'calculo_autorizado' | null;
    esPropuesta: boolean;
  } | null = propuesta
    ? {
        calculo: propuesta.calculo,
        opciones: opcionesDePropuesta(propuesta.opciones),
        claveDatos: null,
        esPropuesta: true,
      }
    : calculoAutorizado
      ? {
          calculo: calculoAutorizado,
          opciones: solicitud.opciones,
          claveDatos: 'calculo_autorizado',
          esPropuesta: false,
        }
      : modoRevision && calculo
        ? { calculo, opciones: solicitud.opciones, claveDatos: 'calculo', esPropuesta: false }
        : null;

  const costosAutorizados = versionAutorizada?.claveDatos
    ? leerCostosCalculo(solicitud.datos, versionAutorizada.claveDatos)
    : undefined;

  // Cotización original del viajero: el snapshot que deja el concentrado al
  // autorizar o, mientras no exista, las opciones vigentes.
  const snapshotOriginal = leerOpcionesOriginales(solicitud.datos);
  const opcionesOriginales = snapshotOriginal ?? solicitud.opciones;
  // En la revisión se muestra desde el inicio (aunque todavía no haya
  // recálculo) para que las opciones descartadas del viajero estén a la mano.
  const mostrarComparador =
    versionAutorizada !== null &&
    opcionesOriginales.length > 0 &&
    (propuesta !== null || snapshotOriginal !== null || modoRevision);

  const [mapaAbierto, setMapaAbierto] = useState<'calculada' | 'inicial' | 'autorizada' | null>(null);
  const [boletoAbierto, setBoletoAbierto] = useState(false);
  const mapaCalculado = mapaDeCalculo(calculo);
  const mapaAutorizado = mapaDeCalculo(versionAutorizada?.calculo ?? null);
  const mapaInicial = resumen ? mapaDeInicial(resumen) : { puntos: [], segmentos: [] };
  const tabInicial =
    pestanaInicial === undefined || (pestanaInicial === 'autorizada' && versionAutorizada === null)
      ? 'calculada'
      : pestanaInicial;
  const barraAcciones = acciones ? (
    <div
      data-testid="acciones-detalle"
      className="flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-muted/30 p-2"
    >
      {acciones}
    </div>
  ) : null;

  if (!resumen) {
    return (
      <div className="space-y-4">
        {barraAcciones}
        <DetalleViajeLegado solicitud={solicitud} />
      </div>
    );
  }

  const vistaInicial = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotonVerMapa onClick={() => setMapaAbierto('inicial')} />
      </div>
      <ResumenViaje {...resumen} />
    </div>
  );

  if (!calculo) {
    // Sin cálculo guardado: mismo marco de dos columnas, con lo que haya. El
    // revisor ve la misma pantalla aunque la solicitud no haya pasado por los
    // cálculos (o venga del flujo anterior).
    return (
      <div className="space-y-4">
        {barraAcciones}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">{vistaInicial}</div>
          <div className="space-y-3">
            {solicitud.opciones.length > 0 ? (
              <DetalleOpciones solicitud={solicitud} />
            ) : (
              <div className="rounded-lg border border-dashed bg-card p-3 text-sm shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
                <p className="text-xs text-muted-foreground">Cotización</p>
                <p className="text-muted-foreground">
                  Esta solicitud no tiene cotización ni cálculo registrados: se envió sin pasar por los cálculos.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue={tabInicial} className="space-y-4">
      {barraAcciones}
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 text-muted-foreground">
        <TabsTrigger value="calculada" className={folderTabTriggerClassName}>
          Ruta calculada
        </TabsTrigger>
        <TabsTrigger value="inicial" className={folderTabTriggerClassName}>
          Viaje inicial
        </TabsTrigger>
        <TabsTrigger value="autorizada" className={folderTabTriggerClassName} disabled={!versionAutorizada}>
          Ruta autorizada
        </TabsTrigger>
      </TabsList>
      <TabsContent value="calculada" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div data-testid="diagrama-ruta-calculada" className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Ruta del viaje</h3>
              <div className="flex flex-wrap items-center gap-2">
                {mapaCalculado.puntos.length > 0 ? (
                  <BotonVerMapa onClick={() => setMapaAbierto('calculada')} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Calculada sin coordenadas: vuelve a calcular para ver el mapa.
                  </span>
                )}
                <BotonVerBoleto onClick={() => setBoletoAbierto(true)} />
              </div>
            </div>
            <RutaViajeTimeline nodos={nodosDesdeCalculo(calculo)} />
          </div>

          <div className="space-y-3">
            {solicitud.opciones.length > 0 ? <DetalleOpciones solicitud={solicitud} /> : null}
            <CasetasRuta calculo={calculo} />
            {calculo.generado_en ? (
              <p className="text-xs text-muted-foreground">
                Calculada el {new Date(calculo.generado_en).toLocaleString('es-MX').replace(/\.$/, '')}.
              </p>
            ) : null}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="inicial" className="space-y-4">
        {vistaInicial}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Tramos del itinerario · distancia por carretera, tiempos y casetas
          </h3>
          <RutaCalculada calculo={calculo} />
        </div>
      </TabsContent>
      <TabsContent value="autorizada" className="space-y-4">
        {versionAutorizada ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div data-testid="diagrama-ruta-autorizada" className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">Ruta autorizada</h3>
                    {versionAutorizada.esPropuesta ? (
                      <Badge
                        data-testid="badge-propuesta"
                        variant="outline"
                        className="border-primary/40 bg-primary/10 font-normal text-primary"
                      >
                        Propuesta en revisión
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mapaAutorizado.puntos.length > 0 ? (
                      <BotonVerMapa onClick={() => setMapaAbierto('autorizada')} />
                    ) : null}
                    {onRecalcular ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        aria-label="Recalcular ruta"
                        onClick={onRecalcular}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        Recalcular ruta
                      </Button>
                    ) : null}
                  </div>
                </div>
                <RutaViajeTimeline
                  nodos={nodosDesdeCalculo(
                    versionAutorizada.calculo,
                    versionAutorizada.opciones,
                    costosAutorizados,
                  )}
                />
              </div>
              <div className="space-y-3">
                {versionAutorizada.opciones.length > 0 ? (
                  <div data-testid="opciones-ruta-autorizada">
                    <DetalleOpciones solicitud={solicitud} opcionesVista={versionAutorizada.opciones} />
                  </div>
                ) : null}
                <CasetasRuta calculo={versionAutorizada.calculo} />
              </div>
            </div>
            {mostrarComparador ? (
              <ComparadorRutas
                opcionesOriginales={opcionesOriginales}
                opcionesPropuestas={versionAutorizada.opciones}
                totalOriginal={totalDeOpcionesElegidas(opcionesOriginales).suma}
                totalPropuesto={totalDeOpcionesElegidas(versionAutorizada.opciones).suma}
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            La ruta autorizada aparece aquí cuando el concentrado autoriza el viaje.
          </p>
        )}
      </TabsContent>

      <RutaMapaDialog
        abierto={mapaAbierto === 'calculada'}
        onOpenChange={(abierto) => setMapaAbierto(abierto ? 'calculada' : null)}
        titulo="Ruta calculada"
        descripcion="La ruta que manda: terminales, hotel y taxis. Puedes mover el mapa y hacer zoom."
        puntos={mapaCalculado.puntos}
        segmentos={mapaCalculado.segmentos}
      />
      <RutaMapaDialog
        abierto={mapaAbierto === 'inicial'}
        onOpenChange={(abierto) => setMapaAbierto(abierto ? 'inicial' : null)}
        titulo="Viaje inicial"
        descripcion="Origen, destinos y regreso capturados en el wizard, sin hoteles ni terminales."
        puntos={mapaInicial.puntos}
        segmentos={mapaInicial.segmentos}
      />
      <RutaMapaDialog
        abierto={mapaAbierto === 'autorizada'}
        onOpenChange={(abierto) => setMapaAbierto(abierto ? 'autorizada' : null)}
        titulo="Ruta autorizada"
        descripcion="La versión que autorizó el concentrado, con terminales, hotel y taxis."
        puntos={mapaAutorizado.puntos}
        segmentos={mapaAutorizado.segmentos}
      />
      <BoletoViajeDialog
        abierto={boletoAbierto}
        onOpenChange={setBoletoAbierto}
        titulo="Boletos del viaje"
        opciones={solicitud.opciones.filter((o) => o.fue_elegida)}
      />
    </Tabs>
  );
}

/** Ruta calculada al enviar: kilómetros, tiempos, salida/llegada y casetas por tramo. */
function RutaCalculada({ calculo }: { calculo: CalculoViaje }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {calculo.km_total != null ? (
          <Badge variant="outline" className="gap-1 font-normal">
            <Route className="h-3 w-3" aria-hidden />
            {calculo.km_total.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
          </Badge>
        ) : null}
        {calculo.horas_total ? (
          <Badge variant="outline" className="gap-1 font-normal">
            <Clock className="h-3 w-3" aria-hidden />
            {calculo.horas_total} con margen
          </Badge>
        ) : null}
        <ModoTransporteBadge modo={calculo.modo_transporte === 'propio' ? 'propio' : 'solicitado'} />
      </div>
      <ol className="space-y-2">
        {calculo.tramos.map((tramo, i) => {
          const noAlcanza = tramo.alcanza === false;
          return (
            <li
              key={`${tramo.de}-${tramo.a}-${i}`}
              className={cn(
                'rounded-md border p-3 text-sm',
                noAlcanza && 'border-destructive/40 bg-destructive/5',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* La alerta va primero: es lo único que exige acción. */}
                {noAlcanza ? <Badge variant="destructive" className="font-normal">No alcanza la hora</Badge> : null}
                <p className="font-medium">{i + 1}. {tramo.de} → {tramo.a}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                {tramo.km != null ? (
                  <Badge variant="outline" className="font-normal">
                    {tramo.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
                  </Badge>
                ) : null}
                {tramo.duracion ? <Badge variant="outline" className="font-normal">{tramo.duracion}</Badge> : null}
                {tramo.duracion_con_margen ? (
                  <Badge
                    variant="outline"
                    className="font-normal text-muted-foreground"
                    title="Tiempo de recorrido más el margen para no llegar justo al límite"
                  >
                    {tramo.duracion_con_margen} con margen
                  </Badge>
                ) : null}
                {tramo.salida_hora ? (
                  <Badge variant="outline" className="font-normal">
                    Salida {horaAmPm(tramo.salida_hora) ?? tramo.salida_hora}
                  </Badge>
                ) : null}
                {tramo.llegada_hora ? (
                  <Badge variant="outline" className="font-normal">
                    Llegada {horaAmPm(tramo.llegada_hora) ?? tramo.llegada_hora}
                  </Badge>
                ) : null}
              </div>
              {tramo.casetas.length > 0 ? (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Casetas ({tramo.casetas.length}
                    {tramo.casetas.some((c) => c.costo != null)
                      ? ` · ${mxn(tramo.casetas.reduce((suma, c) => suma + (c.costo ?? 0), 0))}`
                      : ''}
                    )
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {tramo.casetas.map((caseta, j) => (
                      <li key={`${caseta.nombre}-${j}`}>
                        {caseta.nombre} · km {caseta.km}
                        {caseta.costo != null ? ` · ${mxn(caseta.costo)}` : ''}
                        {caseta.direccion ? ` · ${caseta.direccion}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Resumen corto de los datos que el agente extrajo de la pagina de compra. */
function DatosViajeTexto({ datos }: { datos: DatosViaje | null }) {
  if (!datos) return null;

  const horario =
    datos.salida && datos.llegada
      ? `${datos.salida} → ${datos.llegada}`
      : (datos.salida ?? datos.llegada ?? null);
  const duracion = datos.duracion_min != null ? `${datos.duracion_min} min` : null;
  const asientos =
    datos.asientos_disponibles != null ? `${datos.asientos_disponibles} asientos` : null;
  const precio =
    datos.precio != null ? `${datos.precio} ${datos.moneda ?? ''}`.trim() : null;
  const partes = [
    datos.transportista,
    datos.modo,
    horario,
    duracion,
    asientos,
    precio,
    datos.notas,
  ].filter((parte): parte is string => Boolean(parte));

  if (partes.length === 0) return null;
  return (
    <p className="max-w-md text-[11px] leading-snug text-muted-foreground">
      {partes.join(' · ')}
    </p>
  );
}

function DetalleOpciones({
  solicitud,
  opcionesVista,
}: {
  solicitud: Solicitud;
  /**
   * Opciones de la versión que se está mostrando. Sin esta prop se usan las de
   * la solicitud, que es el comportamiento de Mis viajes.
   */
  opcionesVista?: SolicitudOpcion[];
}) {
  const opciones = opcionesVista ?? solicitud.opciones;
  const total = totalDeOpcionesElegidas(opciones);
  const elegidas = opciones.filter((o) => o.fue_elegida);
  const descartadas = opciones.filter((o) => !o.fue_elegida);
  const [boleto, setBoleto] = useState<SolicitudOpcion | null>(null);
  const [subiendoCaptura, setSubiendoCaptura] = useState<number | null>(null);
  const [capturasRevision, setCapturasRevision] = useState<Record<number, number>>({});

  // Capturas y datos por opción: arrancan con lo que ya trae el detalle y se
  // refrescan con GET /evidencias al abrir y con POST /buscar.
  const [capturas, setCapturas] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(opciones.map((o) => [o.id_opcion, o.ruta_captura])),
  );
  const [datos, setDatos] = useState<Record<number, DatosViaje | null>>({});
  const [generando, setGenerando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [avisoCapturas, setAvisoCapturas] = useState<string | null>(null);
  const hayLinks = opciones.some((o) => Boolean(o.url_compra));

  const aplicarEvidencias = useCallback((resultado: EvidenciasSolicitud) => {
    setCapturas((previo) => {
      const siguiente = { ...previo };
      for (const evidencia of resultado.opciones) {
        if (evidencia.ruta_captura) siguiente[evidencia.id_opcion] = evidencia.ruta_captura;
      }
      return siguiente;
    });
    setDatos((previo) => {
      const siguiente = { ...previo };
      for (const evidencia of resultado.opciones) {
        if (evidencia.datos) siguiente[evidencia.id_opcion] = evidencia.datos;
      }
      return siguiente;
    });
  }, []);

  useEffect(() => {
    let vigente = true;
    evidenciasApi
      .obtener(solicitud.id_solicitud)
      .then(({ data }) => {
        if (vigente) aplicarEvidencias(data.data);
      })
      .catch(() => {
        /* silencioso: sin evidencias el detalle sigue mostrando la solicitud */
      });
    return () => {
      vigente = false;
    };
  }, [aplicarEvidencias, solicitud.id_solicitud]);

  async function generarCapturas() {
    setGenerando(true);
    setAvisoCapturas(null);
    try {
      const { data } = await evidenciasApi.generar(solicitud.id_solicitud);
      const resultado = data.data;
      aplicarEvidencias(resultado);
      const partes = [
        resultado.generadas > 0 ? `${resultado.generadas} nueva(s)` : null,
        resultado.reutilizadas > 0 ? `${resultado.reutilizadas} ya estaban` : null,
        resultado.fallidas > 0 ? `${resultado.fallidas} fallaron` : null,
      ].filter(Boolean);
      const resumen = partes.length > 0 ? `Capturas: ${partes.join(', ')}.` : 'Sin capturas nuevas.';
      const primerError = resultado.opciones.find(
        (o) => o.fue_elegida && o.error && o.error !== 'Sin captura.',
      )?.error;
      if (resultado.fallidas > 0) {
        toast.error(primerError ? `${resumen} ${primerError}` : resumen);
      } else {
        toast.success(resumen);
      }
      if (resultado.aviso) setAvisoCapturas(resultado.aviso);
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setGenerando(false);
    }
  }

  /** Sube un PNG tomado fuera del backend y lo asocia a la opción. */
  async function subirCaptura(opcion: SolicitudOpcion, archivo: File) {
    if (archivo.type !== 'image/png' && !archivo.name.toLowerCase().endsWith('.png')) {
      toast.error('La captura debe ser un archivo PNG.');
      return;
    }

    setSubiendoCaptura(opcion.id_opcion);
    try {
      const { data } = await evidenciasApi.subirCaptura(
        solicitud.id_solicitud,
        opcion.id_opcion,
        archivo,
      );
      aplicarEvidencias(data.data);
      setCapturasRevision((previo) => ({
        ...previo,
        [opcion.id_opcion]: (previo[opcion.id_opcion] ?? 0) + 1,
      }));
      toast.success('Captura subida.');
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setSubiendoCaptura(null);
    }
  }

  /**
   * Pide al agente buscar las opciones una por una: cada que termina una, se
   * pinta su captura y sus datos sin esperar a las demás.
   */
  async function buscarInformacion() {
    const pendientes = opciones.filter((o) => Boolean(o.url_compra));
    if (pendientes.length === 0) {
      toast.error('Ninguna opción tiene link de compra para que el agente la busque.');
      return;
    }

    setBuscando(true);
    setAvisoCapturas(null);
    setProgreso({ hechas: 0, total: pendientes.length });
    let conDatos = 0;
    let fallidas = 0;
    try {
      for (const opcion of pendientes) {
        try {
          const { data } = await evidenciasApi.buscar(
            solicitud.id_solicitud,
            opcion.id_opcion,
          );
          aplicarEvidencias(data.data);
          const evidencia = data.data.opciones.find(
            (e) => e.id_opcion === opcion.id_opcion,
          );
          if (evidencia?.datos) conDatos += 1;
        } catch {
          fallidas += 1;
        } finally {
          setProgreso((previo) =>
            previo ? { hechas: previo.hechas + 1, total: previo.total } : previo,
          );
        }
      }

      const partes = [
        conDatos > 0 ? `${conDatos} con datos` : null,
        fallidas > 0 ? `${fallidas} fallaron` : null,
      ].filter(Boolean);
      toast.success(
        partes.length > 0
          ? `Búsqueda: ${partes.join(', ')}.`
          : 'El agente no devolvió información nueva.',
      );
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setBuscando(false);
      setProgreso(null);
    }
  }

  /** Botón de boleto de un renglón: abre esa opción con captura y link. */
  const botonBoleto = (opcion: SolicitudOpcion) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={`Ver boleto de ${opcion.linea}`}
            onClick={() => setBoleto(opcion)}
          >
            <Ticket className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver boleto, URL y captura</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  /** Link de compra del renglón (sitio de la aerolínea / autobús). */
  const botonComprar = (opcion: SolicitudOpcion) => {
    if (!opcion.url_compra) return null;
    const esBusqueda =
      opcion.datos?.tipo_precio === 'estimado' ||
      opcion.datos?.tipo_precio === 'referencia_tabulador';
    const accion = esBusqueda ? 'Consultar precios' : 'Comprar boleto';
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <a
                href={opcion.url_compra}
                target="_blank"
                rel="noreferrer"
                aria-label={`${accion} de ${opcion.linea}`}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{esBusqueda ? 'Abrir búsqueda de precios' : 'Abrir sitio de compra'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /**
   * Un renglón del desglose. Este panel vive en una columna angosta (340 px en
   * escritorio y menos cuando la página se ve en una ventana chica), así que
   * cada opción se apila en dos líneas en vez de repartirse en cinco columnas:
   * antes el nombre del tramo quedaba en una columna de ~70 px, con una palabra
   * por renglón, y los precios se salían del marco.
   */
  const fila = (opcion: SolicitudOpcion) => (
    <li key={opcion.id_opcion} className="space-y-1.5 border-b border-border/60 py-2 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="leading-tight">{opcion.linea}</p>
          <DatosViajeTexto datos={datos[opcion.id_opcion] ?? null} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {botonBoleto(opcion)}
          {botonComprar(opcion)}
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <CeldaCaptura
          ruta={capturas[opcion.id_opcion] ?? opcion.ruta_captura ?? undefined}
          etiqueta={opcion.linea}
          onSubirCaptura={(archivo) => subirCaptura(opcion, archivo)}
          subiendo={subiendoCaptura === opcion.id_opcion}
          revision={capturasRevision[opcion.id_opcion] ?? 0}
        />
        <span className="whitespace-nowrap text-right tabular-nums">{precioTexto(opcion)}</span>
      </div>
    </li>
  );

  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-card p-3 text-sm shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Transporte y hospedaje elegidos</p>
        {hayLinks ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={generarCapturas}
              disabled={generando || buscando}
              aria-label="Generar capturas de pantalla de las opciones elegidas"
              title="Captura con Playwright las opciones elegidas; si alguna falla, el botón queda disponible para reintentar"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {generando ? 'Generando capturas…' : 'Generar capturas'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={buscarInformacion}
              disabled={buscando || generando}
              aria-label="Buscar opciones del viaje con el agente"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              {buscando
                ? `Buscando… ${progreso?.hechas ?? 0}/${progreso?.total ?? opciones.length}`
                : 'Buscar opciones'}
            </Button>
          </div>
        ) : null}
      </div>
      {avisoCapturas ? <p className="text-xs text-amber-700">{avisoCapturas}</p> : null}
      {elegidas.length === 0 ? (
        <p>Sin opciones elegidas.</p>
      ) : (
        <div>
          <ul>{elegidas.map(fila)}</ul>
          <div className="flex items-baseline justify-between gap-2 pt-2">
            <span className="text-xs text-muted-foreground">Desglose</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {textoTotalElegidas(total)}
            </span>
          </div>
        </div>
      )}
      {descartadas.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Alternativas descartadas ({descartadas.length})
          </summary>
          <ul className="mt-1 text-xs text-muted-foreground">{descartadas.map(fila)}</ul>
        </details>
      ) : null}

      <BoletoViajeDialog
        abierto={boleto !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setBoleto(null);
        }}
        titulo={`Boleto · ${boleto?.linea ?? ''}`}
        opciones={boleto ? [boleto] : []}
      />
    </div>
  );
}

/**
 * Casetas de toda la ruta en una tarjeta plegable: el total a la vista y la
 * lista de plazas solo si se pide.
 */
function CasetasRuta({ calculo }: { calculo: CalculoViaje }) {
  const conCasetas = calculo.tramos.filter((t) => t.casetas.length > 0);
  if (conCasetas.length === 0) return null;
  const plazas = conCasetas.flatMap((t) => t.casetas);
  const total = plazas.reduce((suma, caseta) => suma + (caseta.costo ?? 0), 0);
  const hayCosto = plazas.some((caseta) => caseta.costo != null);

  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
      <p className="text-xs text-muted-foreground">Casetas de la ruta</p>
      <p className="text-lg font-semibold">
        {plazas.length} plaza{plazas.length === 1 ? '' : 's'}
        {hayCosto ? ` · ${mxn(total)}` : ''}
      </p>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Ver plazas</summary>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {conCasetas.map((tramo, i) => (
            <li key={`${tramo.de}-${tramo.a}-${i}`}>
              <span className="font-medium text-foreground">{tramo.de} → {tramo.a}:</span>{' '}
              {tramo.casetas
                .map((caseta) => `${caseta.nombre} (km ${caseta.km}${caseta.costo != null ? `, ${mxn(caseta.costo)}` : ''})`)
                .join(' · ')}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Fallback para solicitudes del flujo anterior (datos que no son `solicitud-v2`). */
function DetalleViajeLegado({ solicitud }: { solicitud: Solicitud }) {
  const resumen = leerDatosViaje(solicitud.datos);
  return (
    <div className="space-y-2 text-sm">
      <p><strong>Itinerario:</strong> {resumen.destino ?? 'Destino por confirmar'}</p>
      <p><strong>Participantes:</strong> {resumen.beneficiarioNombre ?? 'Por confirmar'}</p>
      <p><strong>Estado:</strong> {estadoTexto(solicitud.estado)}</p>
      <DetalleOpciones solicitud={solicitud} />
    </div>
  );
}

export default MisViajesPage;
