import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, BedDouble, Bus, CalendarDays, Camera, CarFront, ChevronDown, Clock, ExternalLink, Eye, MapPin, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, Plane, RefreshCw, Route, Send, ShieldCheck, Sparkles, Ticket, Trash2, Upload, Wallet, type LucideIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import {
  esOpcionCotizada,
  estadoTexto,
  importeFormateado,
  precioReferenciaOpcion,
  SIN_PRECIO,
} from '../../types/aprobaciones.types';
import type {
  CalculoViaje,
  DatosOpcion,
  PropuestaRuta,
  PropuestaVersion,
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
import { PrecioRealDialog } from '../../components/PrecioRealDialog';
import { ComparadorRutas } from '../../components/ComparadorRutas';
import { GrupoRutaCollapsible } from '../../components/GrupoRutaCollapsible';
import type { PuntoMapa, SegmentoMapa } from '../../components/rutaMapa.types';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { resumenDesdeDatos } from '../../services/resumenViaje';
import { nombreCortoOpcion } from '../../utils/nombresOpciones';
import { horaAmPm, leerCalculoAutorizadoDesdeDatos, leerCalculoDesdeDatos } from '../../services/calculoViaje';
import {
  enRango,
  leerDatosViaje,
  mxn,
  opcionesDePropuesta,
  rangoDelFiltro,
  type FilaViaje,
  type FiltroPeriodo,
  type TipoViaje,
} from './viajes.helpers';
import { FiltrosSolicitudes } from './FiltrosSolicitudes';
import { SolicitudesViajeTable } from './SolicitudesViajeTable';

const tabRevisionTriggerClassName = cn(
  'gap-1.5 rounded-lg border-0 px-1.5 text-xs font-semibold leading-tight text-muted-foreground transition-colors sm:px-3 sm:text-sm',
  'whitespace-normal sm:whitespace-nowrap',
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
  'disabled:opacity-50',
);

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

type Pestana = 'borradores' | 'enviadas';
type PestanaRevision = 'comparar' | 'calculada' | 'inicial' | 'autorizada';

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

  const cargarSolicitudes = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError(null);
    try {
      const res = await solicitudesApi.misSolicitudes(puedeVerTodas ? { todas: true } : undefined);
      if (res.data.success) setSolicitudes(res.data.data ?? []);
      else if (!silencioso) setError(res.data.message ?? 'No se pudieron cargar tus viajes.');
    } catch (falla: unknown) {
      if (!silencioso) setError(toApiError(falla).message || 'No se pudieron cargar tus viajes.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [puedeVerTodas]);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  const actualizarDetalle = useCallback((actualizada: Solicitud) => {
    setDetalle(actualizada);
  }, []);

  const hayDeteccionEnCurso = useMemo(
    () =>
      solicitudes.some((s) =>
        s.opciones.some(
          (o) =>
            o.fue_elegida
            && (o.datos?.deteccion_estado === 'pendiente'
              || o.datos?.deteccion_estado === 'en_proceso'),
        ),
      ),
    [solicitudes],
  );

  useEffect(() => {
    if (!hayDeteccionEnCurso) return;
    const intervalo = window.setInterval(() => {
      void cargarSolicitudes(true);
    }, 8000);
    return () => window.clearInterval(intervalo);
  }, [hayDeteccionEnCurso, cargarSolicitudes]);

  const rango = rangoDelFiltro(periodo, hoy, desde, hasta);

  const filas = useMemo<{ borradores: FilaViaje[]; enviadas: FilaViaje[] }>(() => {
    const base = [...solicitudes]
      .sort((a, b) =>
        b.fecha_creacion.localeCompare(a.fecha_creacion) || b.id_solicitud - a.id_solicitud,
      )
      .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
      .filter(({ resumen }) => (tipo === 'todos' ? true : resumen.tipoViaje === tipo))
      .filter(({ solicitud }) => enRango(solicitud.fecha_creacion, rango));
    return {
      borradores: base.filter(({ solicitud }) => solicitud.estado === 'borrador'),
      enviadas: base.filter(
        ({ solicitud }) =>
          solicitud.estado === 'enviada' ||
          solicitud.estado === 'autorizada' ||
          solicitud.estado === 'autorizada_con_ajustes',
      ),
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
          data-track="viaticos.mis-viajes.ver-detalle"
          aria-label={`Ver detalle ${etiqueta}`}
          onClick={() => { void verDetalle(solicitud.id_solicitud); }}
        >
          <Eye className="h-4 w-4" aria-hidden />
          Ver detalle
        </Button>
      );

      if (!esBorrador || !esMia) return verDetalleBoton;

      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-track="viaticos.mis-viajes.enviar"
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-track="viaticos.mis-viajes.mas-acciones"
                aria-label="Más acciones"
              >
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
          {detalle ? (
            <>
              <AvisoRechazo solicitud={detalle} />
              <VistaDetalle
                solicitud={detalle}
                onSolicitudActualizada={actualizarDetalle}
              />
            </>
          ) : null}
          <DialogFooter className="gap-2">
            {detalle?.estado === 'borrador' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-track="viaticos.mis-viajes.detalle.editar"
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

function motivoDeRechazoVigente(solicitud: Solicitud): { motivo: string; fecha: string } | null {
  if (solicitud.estado !== 'borrador') return null;
  const eventos = solicitud.eventos ?? [];
  for (let indice = eventos.length - 1; indice >= 0; indice -= 1) {
    const evento = eventos[indice];
    if (evento.tipo === 'rechazada') {
      const motivo = typeof evento.payload?.motivo === 'string' ? evento.payload.motivo.trim() : '';
      return motivo === '' ? null : { motivo, fecha: evento.fecha_creacion };
    }
    if (evento.tipo === 'enviada' || evento.tipo === 'autorizada') return null;
  }
  return null;
}

function AvisoRechazo({ solicitud }: { solicitud: Solicitud }) {
  const aviso = motivoDeRechazoVigente(solicitud);
  if (aviso === null) return null;
  const fecha = new Date(aviso.fecha).toLocaleString('es-MX').replace(/\.$/, '');
  return (
    <div
      data-testid="aviso-rechazo"
      className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium text-destructive">Rechazada el {fecha}</p>
        <p className="text-muted-foreground">{aviso.motivo}</p>
      </div>
    </div>
  );
}

function chipsDeTramo(tramo: CalculoViaje['tramos'][number]): string[] {
  return [
    tramo.km != null ? `${tramo.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : '',
    tramo.duracion ?? '',
    tramo.duracion_con_margen ? `${tramo.duracion_con_margen} con margen` : '',
  ].filter((chip) => chip !== '');
}

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

function fasesDeRuta(calculo: CalculoViaje): Array<'ida' | 'regreso'> {
  const nodos = calculo.ruta?.nodos ?? [];
  if (nodos.length === 0) return [];
  const regreso = nodos.findIndex((nodo) => /^regreso$/i.test(nodo.titulo.trim()));
  if (regreso < 0) return nodos.map(() => 'ida');
  const ultimaParada = nodos.reduce(
    (ultimo, nodo, i) => (/^\d+\./.test(nodo.titulo.trim()) ? i : ultimo),
    -1,
  );
  const inicio = ultimaParada >= 0 && ultimaParada < regreso ? ultimaParada + 1 : regreso;
  return nodos.map((nodo, i) => nodo.fase ?? (i >= inicio ? 'regreso' : 'ida'));
}

function enriquecerConTaxis(
  nodos: NodoRutaTimeline[],
  opciones: SolicitudOpcion[],
): NodoRutaTimeline[] {
  const taxis = opciones.filter(
    (opcion) =>
      opcion.fue_elegida
      && (opcion.tipo ?? '').trim().toLowerCase() === 'taxi'
      && typeof opcion.precio === 'number',
  );
  if (taxis.length === 0) return nodos;

  const copia = nodos.map((nodo) => ({
    ...nodo,
    chips: nodo.chips ? [...nodo.chips] : [],
  }));

  for (const taxi of taxis) {
    const tramo = typeof taxi.datos?.tramo === 'number' ? taxi.datos.tramo : null;
    const de = typeof taxi.datos?.de === 'string' ? taxi.datos.de : '';
    let indice = de
      ? copia.findIndex((nodo) =>
          nodo.detalles.some(
            (linea) => typeof linea === 'string' && /En taxi/i.test(linea) && linea.includes(de),
          ),
        )
      : -1;
    if (indice < 0) {
      const fase = tramo !== null && tramo > 0 ? 'regreso' : 'ida';
      indice = copia.findIndex(
        (nodo) =>
          nodo.fase === fase
          && nodo.detalles.some((linea) => typeof linea === 'string' && /En taxi/i.test(linea)),
      );
    }
    if (indice < 0) continue;

    const chip = `Taxi ${mxn(taxi.precio as number)}`;
    if (!copia[indice].chips?.some((actual) => actual.startsWith('Taxi '))) {
      copia[indice].chips = [...(copia[indice].chips ?? []), chip];
    }
  }

  return copia;
}

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
    const fases = fasesDeRuta(calculo);
    const nodos = calculo.ruta.nodos.map((nodo, i) => {
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
        fase: nodo.fase ?? fases[i],
      };
    });
    return enriquecerConTaxis(nodos, opciones);
  }
  const primera = calculo.tramos[0];
  const nodos = [
    { id: 'origen', titulo: 'Origen', detalles: [primera?.de ?? '—'], fase: 'ida' as const },
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
      const esRegreso = calculo.tramos.length > 1
        && i === calculo.tramos.length - 1
        && /regreso|origen/i.test(tramo.a);
      return {
        id: `tramo-${i}`,
        titulo: `${i + 1}. ${tramo.a}`,
        detalles: fechas.trim() !== '' ? [fechas] : [],
        chips: chipsDeTramo(tramo),
        costo: costo.costo,
        urlCompra: costo.url_compra,
        fase: esRegreso ? ('regreso' as const) : ('ida' as const),
      };
    }),
  ];
  return enriquecerConTaxis(nodos, opciones);
}

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

function MetricaRuta({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: LucideIcon;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icono className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {etiqueta}
        </p>
        <p className="truncate text-sm font-semibold text-slate-800">{valor}</p>
      </div>
    </div>
  );
}

function MetricasRuta({
  calculo,
  resumen,
  opciones,
}: {
  calculo: CalculoViaje;
  resumen: NonNullable<ReturnType<typeof resumenDesdeDatos>>;
  opciones: SolicitudOpcion[];
}) {
  const total = totalDeOpcionesElegidas(opciones);
  const etiquetaTotal = total.suma === null
    ? 'Total elegido'
    : total.totalCotizado === null
      ? 'Total estimado'
      : total.totalEstimado === null
        ? 'Total cotizado'
        : 'Total mixto';
  const fechas = [resumen.rango.inicio, resumen.rango.fin]
    .filter((fecha): fecha is string => Boolean(fecha))
    .filter((fecha, indice, lista) => lista.indexOf(fecha) === indice)
    .map((fecha) =>
      new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    )
    .join(' al ');

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MetricaRuta
        icono={Route}
        etiqueta="Distancia"
        valor={calculo.km_total != null
          ? `${calculo.km_total.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
          : '—'}
      />
      <MetricaRuta icono={Clock} etiqueta="Duración" valor={calculo.horas_total ?? '—'} />
      <MetricaRuta icono={CalendarDays} etiqueta="Fechas" valor={fechas || '—'} />
      <MetricaRuta
        icono={Wallet}
        etiqueta={etiquetaTotal}
        valor={total.suma !== null ? mxn(total.suma) : 'Sin total'}
      />
    </div>
  );
}

function RutaPorFases({ nodos }: { nodos: NodoRutaTimeline[] }) {
  const ida = nodos.filter((nodo) => nodo.fase !== 'regreso');
  const regreso = nodos.filter((nodo) => nodo.fase === 'regreso');
  if (ida.length === 0 || regreso.length === 0) {
    return <RutaViajeTimeline nodos={nodos} mostrarFase={false} compacto />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="rounded-xl border border-primary/15 bg-primary/[0.02] p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-primary">Ida</h4>
        </div>
        <RutaViajeTimeline nodos={ida} mostrarFase={false} compacto />
      </section>
      <section className="rounded-xl border border-sky-200/70 bg-sky-50/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Regreso
          </h4>
        </div>
        <RutaViajeTimeline nodos={regreso} mostrarFase={false} compacto />
      </section>
    </div>
  );
}

function DesgloseColapsado({
  total,
  onAbrir,
}: {
  total: number | null;
  onAbrir: () => void;
}) {
  return (
    <aside className="hidden min-h-[320px] flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-card p-2 shadow-sm lg:flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onAbrir}
        aria-label="Mostrar desglose"
        title="Mostrar desglose"
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden />
      </Button>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
        Desglose
      </span>
      {total !== null ? (
        <span className="mt-auto w-full pb-1 text-center text-[10px] font-semibold tabular-nums text-slate-700">
          {mxn(total)}
        </span>
      ) : null}
    </aside>
  );
}

export function VistaDetalle({
  solicitud,
  acciones,
  modoRevision = false,
  pestanaInicial,
  propuesta = null,
  versiones = null,
  pestanasVisibles,
  onRecalcular,
  onSolicitudActualizada,
}: {
  solicitud: Solicitud;
  acciones?: ReactNode;
  modoRevision?: boolean;
  pestanaInicial?: PestanaRevision;
  propuesta?: PropuestaRuta | null;
  versiones?: PropuestaVersion[] | null;
  pestanasVisibles?: PestanaRevision[];
  onRecalcular?: () => void;
  onSolicitudActualizada?: (solicitud: Solicitud) => void;
}) {
  const resumen = resumenDesdeDatos(solicitud.datos);
  const calculo = leerCalculoDesdeDatos(solicitud.datos);
  const estaAutorizada =
    solicitud.estado === 'autorizada' || solicitud.estado === 'autorizada_con_ajustes';
  const calculoAutorizado =
    leerCalculoAutorizadoDesdeDatos(solicitud.datos) ?? (estaAutorizada ? calculo : null);
  const versionVigente = versiones !== null && versiones.length > 0
    ? versiones[versiones.length - 1]
    : null;

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
    : versionVigente
      ? {
          calculo: versionVigente.calculo,
          opciones: opcionesDePropuesta(versionVigente.opciones),
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

  const snapshotOriginal = leerOpcionesOriginales(solicitud.datos);
  const opcionesOriginales = snapshotOriginal ?? solicitud.opciones;
  const mostrarComparador =
    versionAutorizada !== null &&
    opcionesOriginales.length > 0 &&
    (propuesta !== null || versionVigente !== null || snapshotOriginal !== null || modoRevision);

  const [versionSeleccionada, setVersionSeleccionada] = useState<number | 'inicial' | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState<
    'calculada' | 'inicial' | 'autorizada' | 'comparada' | 'version' | null
  >(null);
  const [boletoAbierto, setBoletoAbierto] = useState(false);
  const mapaCalculado = mapaDeCalculo(calculo);
  const mapaAutorizado = mapaDeCalculo(versionAutorizada?.calculo ?? null);
  const mapaInicial = resumen ? mapaDeInicial(resumen) : { puntos: [], segmentos: [] };
  const versionEnVista =
    versionVigente === null || versionSeleccionada === 'inicial'
      ? null
      : versiones?.find((version) => version.numero === versionSeleccionada) ?? versionVigente;
  const rutaInicialElegida = versionSeleccionada === 'inicial';
  const opcionesVersion = versionEnVista ? opcionesDePropuesta(versionEnVista.opciones) : [];
  const opcionesBoleto = (
    versionVigente && !rutaInicialElegida ? opcionesVersion : solicitud.opciones
  ).filter((opcion) => opcion.fue_elegida);
  const mapaVersion = mapaDeCalculo(versionEnVista?.calculo ?? null);
  const tabsRevision: PestanaRevision[] =
    pestanasVisibles ?? ['comparar', 'calculada', 'inicial', 'autorizada'];
  const etiquetaComparar = versionVigente
    ? `Inicial vs propuesta ${versionVigente.numero}`
    : 'Inicial vs calculada';
  const etiquetaRuta = versionVigente
    ? `Ruta (propuesta ${versionVigente.numero})`
    : 'Ruta calculada';
  const tabPreferida =
    pestanaInicial ??
    (modoRevision ? 'comparar' : estaAutorizada && calculoAutorizado !== null ? 'autorizada' : 'calculada');
  const tabInicial: PestanaRevision =
    (modoRevision && !tabsRevision.includes(tabPreferida)) ||
    (tabPreferida === 'autorizada' && versionAutorizada === null) ||
    (tabPreferida === 'comparar' && !modoRevision)
      ? 'calculada'
      : tabPreferida;
  const [tabActiva, setTabActiva] = useState<PestanaRevision>(tabInicial);
  const [desgloseAbierto, setDesgloseAbierto] = useState(true);
  const tienePanelLateral = tabActiva !== 'inicial' && tabActiva !== 'comparar';
  const accionesDetalle = acciones ? (
    <div data-testid="acciones-detalle" className="flex flex-wrap items-center justify-end gap-2">
      {acciones}
    </div>
  ) : null;
  const barraAcciones = accionesDetalle ? (
    <div className="rounded-xl border border-slate-200/80 bg-muted/20 p-2">
      {accionesDetalle}
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
    return (
      <div className="space-y-4">
        {barraAcciones}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">{vistaInicial}</div>
          <div className="space-y-3">
            {solicitud.opciones.length > 0 ? (
              <DetalleOpciones
                solicitud={solicitud}
                onSolicitudActualizada={onSolicitudActualizada}
              />
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

  const panelCalculada = (
    <div className={cn('space-y-3', !desgloseAbierto && 'lg:hidden')}>
      {solicitud.opciones.length > 0 ? (
        <DetalleOpciones
          solicitud={solicitud}
          opcionesVista={solicitud.opciones}
          onSolicitudActualizada={onSolicitudActualizada}
          onCerrar={() => setDesgloseAbierto(false)}
        />
      ) : null}
      <CasetasRuta calculo={calculo} />
      {calculo.generado_en ? (
        <p className="text-xs text-muted-foreground">
          Calculada el {new Date(calculo.generado_en).toLocaleString('es-MX').replace(/\.$/, '')}.
        </p>
      ) : null}
    </div>
  );

  const panelAutorizada = versionAutorizada ? (
    <div className={cn('space-y-3', !desgloseAbierto && 'lg:hidden')}>
      {versionAutorizada.opciones.length > 0 ? (
        <div data-testid="opciones-ruta-autorizada">
          <DetalleOpciones
            solicitud={solicitud}
            opcionesVista={versionAutorizada.opciones}
            onCerrar={() => setDesgloseAbierto(false)}
          />
        </div>
      ) : null}
      <CasetasRuta calculo={versionAutorizada.calculo} />
    </div>
  ) : null;

  const rielCalculada = !desgloseAbierto ? (
    <DesgloseColapsado
      total={totalDeOpcionesElegidas(solicitud.opciones).suma}
      onAbrir={() => setDesgloseAbierto(true)}
    />
  ) : null;

  const rielAutorizada = versionAutorizada && !desgloseAbierto ? (
    <DesgloseColapsado
      total={totalDeOpcionesElegidas(versionAutorizada.opciones).suma}
      onAbrir={() => setDesgloseAbierto(true)}
    />
  ) : null;

  const gridRuta = cn(
    'grid items-start gap-4',
    desgloseAbierto
      ? 'lg:grid-cols-[minmax(0,1fr)_400px]'
      : 'lg:grid-cols-[minmax(0,1fr)_56px]',
  );

  const botonMostrarDesglose = !desgloseAbierto ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden h-7 gap-1.5 rounded-lg px-2 text-xs lg:inline-flex"
      onClick={() => setDesgloseAbierto(true)}
    >
      <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
      Desglose
    </Button>
  ) : null;

  return (
    <Tabs
      value={tabActiva}
      onValueChange={(valor) => setTabActiva(valor as PestanaRevision)}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList
          className={cn(
            'grid h-auto min-h-11 w-full gap-1 rounded-xl bg-muted/60 p-1',
            !modoRevision && 'max-w-2xl grid-cols-3',
            modoRevision && tabsRevision.length === 2 && 'max-w-2xl grid-cols-2',
            modoRevision && tabsRevision.length === 3 && 'max-w-2xl grid-cols-3',
            modoRevision && tabsRevision.length === 4 && 'max-w-3xl grid-cols-4',
          )}
        >
          {modoRevision && tabsRevision.includes('comparar') ? (
            <TabsTrigger value="comparar" className={tabRevisionTriggerClassName}>
              <Sparkles className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
              {etiquetaComparar}
            </TabsTrigger>
          ) : null}
          {tabsRevision.includes('calculada') ? (
            <TabsTrigger value="calculada" className={tabRevisionTriggerClassName}>
              <Route className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
              {etiquetaRuta}
            </TabsTrigger>
          ) : null}
          {!modoRevision || tabsRevision.includes('inicial') ? (
            <TabsTrigger value="inicial" className={tabRevisionTriggerClassName}>
              <MapPin className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
              Viaje inicial
            </TabsTrigger>
          ) : null}
          {!modoRevision || tabsRevision.includes('autorizada') ? (
            <TabsTrigger
              value="autorizada"
              className={tabRevisionTriggerClassName}
              disabled={!versionAutorizada}
              title={!versionAutorizada
                ? 'La ruta autorizada aparece cuando el concentrado autoriza el viaje.'
                : undefined}
            >
              <ShieldCheck className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
              Ruta autorizada
            </TabsTrigger>
          ) : null}
        </TabsList>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {accionesDetalle}
          {tienePanelLateral ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-8 gap-1.5 rounded-lg px-2.5 text-xs lg:inline-flex"
              onClick={() => setDesgloseAbierto((abierto) => !abierto)}
              aria-expanded={desgloseAbierto}
              aria-label={desgloseAbierto ? 'Ocultar desglose' : 'Mostrar desglose'}
            >
              {desgloseAbierto ? (
                <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
              )}
              {desgloseAbierto ? 'Ocultar desglose' : 'Mostrar desglose'}
            </Button>
          ) : null}
        </div>
      </div>
      {modoRevision ? (
        <TabsContent value="comparar" className="space-y-4">
          {versionAutorizada && resumen ? (
            <>
              <p className="text-sm text-muted-foreground">
                {versionAutorizada.esPropuesta
                  ? 'Compara lo que pidió el solicitante con la ruta propuesta. Si no te sirve, recalcula el viaje o edita los costos antes de autorizar.'
                  : 'Compara lo que pidió el solicitante con la ruta que se calculó para el viaje.'}
              </p>
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-border">
                <div data-testid="comparacion-viaje-inicial" className="min-w-0 space-y-3 lg:pr-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Lo que pidió el solicitante
                      </p>
                      <h3 className="text-base font-semibold">Viaje inicial</h3>
                    </div>
                    {mapaInicial.puntos.length > 0 ? (
                      <BotonVerMapa onClick={() => setMapaAbierto('inicial')} />
                    ) : null}
                  </div>
                  <ResumenViaje {...resumen} />
                </div>

                <div data-testid="comparacion-ruta-calculada" className="min-w-0 space-y-3 lg:pl-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {versionAutorizada.esPropuesta
                          ? 'La ruta que vas a autorizar'
                          : 'Cómo se calculó el viaje'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">
                          {versionAutorizada.esPropuesta ? 'Ruta propuesta' : 'Ruta calculada'}
                        </h3>
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
                    </div>
                    {mapaAutorizado.puntos.length > 0 ? (
                      <BotonVerMapa onClick={() => setMapaAbierto('comparada')} />
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
                    <MetricasRuta
                      calculo={versionAutorizada.calculo}
                      resumen={resumen}
                      opciones={versionAutorizada.opciones}
                    />
                    <div className="mt-3">
                      <RutaPorFases
                        nodos={nodosDesdeCalculo(
                          versionAutorizada.calculo,
                          versionAutorizada.opciones,
                          costosAutorizados,
                        )}
                      />
                    </div>
                  </div>

                  {versionAutorizada.opciones.length > 0 ? (
                    <div data-testid="opciones-comparacion">
                      <DetalleOpciones
                        solicitud={solicitud}
                        opcionesVista={versionAutorizada.opciones}
                        onSolicitudActualizada={onSolicitudActualizada}
                      />
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
              El viaje no tiene una ruta calculada con la que comparar; aquí está lo que pidió el
              solicitante.
            </p>
          )}
        </TabsContent>
      ) : null}
      <TabsContent value="calculada" className="space-y-4">
        {versionVigente ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Versión
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      aria-label="Elegir la versión de la ruta"
                    >
                      {rutaInicialElegida
                        ? 'Ruta inicial'
                        : `Propuesta ${versionEnVista?.numero ?? versionVigente.numero}`}
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setVersionSeleccionada('inicial')}>
                      Ruta inicial
                    </DropdownMenuItem>
                    {versiones?.map((version) => (
                      <DropdownMenuItem
                        key={version.numero}
                        onClick={() => setVersionSeleccionada(version.numero)}
                      >
                        Propuesta {version.numero}
                        {version.numero === versionVigente.numero ? ' (actual)' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {rutaInicialElegida
                ? mapaInicial.puntos.length > 0
                  ? <BotonVerMapa onClick={() => setMapaAbierto('inicial')} />
                  : null
                : mapaVersion.puntos.length > 0
                  ? <BotonVerMapa onClick={() => setMapaAbierto('version')} />
                  : null}
            </div>

            {rutaInicialElegida ? (
              vistaInicial
            ) : versionEnVista ? (
              <>
                <MetricasRuta
                  calculo={versionEnVista.calculo}
                  resumen={resumen}
                  opciones={opcionesVersion}
                />
                <div className={gridRuta}>
                  <div
                    data-testid="diagrama-ruta-propuesta"
                    className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">Ruta del viaje</h3>
                        <p className="text-xs text-muted-foreground">
                          Propuesta {versionEnVista.numero}: itinerario completo con paradas,
                          costos y enlaces.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {botonMostrarDesglose}
                        <BotonVerBoleto onClick={() => setBoletoAbierto(true)} />
                      </div>
                    </div>
                    <RutaPorFases
                      nodos={nodosDesdeCalculo(versionEnVista.calculo, opcionesVersion)}
                    />
                  </div>
                  <div className={cn('space-y-3', !desgloseAbierto && 'lg:hidden')}>
                    {opcionesVersion.length > 0 ? (
                      <DetalleOpciones
                        solicitud={solicitud}
                        opcionesVista={opcionesVersion}
                        onSolicitudActualizada={onSolicitudActualizada}
                        onCerrar={() => setDesgloseAbierto(false)}
                      />
                    ) : null}
                    <CasetasRuta calculo={versionEnVista.calculo} />
                    {versionEnVista.creado_en ? (
                      <p className="text-xs text-muted-foreground">
                        Guardada el{' '}
                        {new Date(versionEnVista.creado_en).toLocaleString('es-MX').replace(/\.$/, '')}.
                      </p>
                    ) : null}
                  </div>
                  {!desgloseAbierto ? (
                    <DesgloseColapsado
                      total={totalDeOpcionesElegidas(opcionesVersion).suma}
                      onAbrir={() => setDesgloseAbierto(true)}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <MetricasRuta calculo={calculo} resumen={resumen} opciones={solicitud.opciones} />
            <div className={gridRuta}>
              <div
                data-testid="diagrama-ruta-calculada"
                className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Ruta del viaje</h3>
                    <p className="text-xs text-muted-foreground">
                      Itinerario completo con paradas, costos y enlaces.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {botonMostrarDesglose}
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
                <RutaPorFases nodos={nodosDesdeCalculo(calculo, solicitud.opciones)} />
              </div>
              {panelCalculada}
              {rielCalculada}
            </div>
          </>
        )}
      </TabsContent>
      <TabsContent value="inicial" className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">{vistaInicial}</div>
          <section className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
            <h3 className="font-semibold">Tramos del itinerario</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Distancia por carretera, tiempos y casetas.
            </p>
            <RutaCalculada calculo={calculo} />
          </section>
        </div>
      </TabsContent>
      <TabsContent value="autorizada" className="space-y-4">
        {versionAutorizada ? (
          <>
            <MetricasRuta
              calculo={versionAutorizada.calculo}
              resumen={resumen}
              opciones={versionAutorizada.opciones}
            />
            <div className={gridRuta}>
              <div
                data-testid="diagrama-ruta-autorizada"
                className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
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
                    <p className="text-xs text-muted-foreground">
                      {versionAutorizada.esPropuesta
                        ? 'Propuesta recalculada que se autorizará si la confirmas.'
                        : estaAutorizada
                          ? 'Versión aprobada por el concentrado, con terminales, hotel y taxis.'
                          : 'Ruta original que se autorizará si la confirmas.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {botonMostrarDesglose}
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
                <RutaPorFases
                  nodos={nodosDesdeCalculo(
                    versionAutorizada.calculo,
                    versionAutorizada.opciones,
                    costosAutorizados,
                  )}
                />
              </div>
              {panelAutorizada}
              {rielAutorizada}
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
      <RutaMapaDialog
        abierto={mapaAbierto === 'comparada'}
        onOpenChange={(abierto) => setMapaAbierto(abierto ? 'comparada' : null)}
        titulo={versionAutorizada?.esPropuesta ? 'Ruta propuesta' : 'Ruta calculada'}
        descripcion={
          versionAutorizada?.esPropuesta
            ? 'La ruta que estás evaluando, con terminales, hotel y taxis.'
            : 'La ruta calculada del viaje, con terminales, hotel y taxis.'
        }
        puntos={mapaAutorizado.puntos}
        segmentos={mapaAutorizado.segmentos}
      />
      <RutaMapaDialog
        abierto={mapaAbierto === 'version'}
        onOpenChange={(abierto) => setMapaAbierto(abierto ? 'version' : null)}
        titulo={
          versionEnVista ? `Propuesta ${versionEnVista.numero}` : 'Ruta de la propuesta'
        }
        descripcion="La ruta de esta propuesta, con terminales, hotel y taxis."
        puntos={mapaVersion.puntos}
        segmentos={mapaVersion.segmentos}
      />
      <BoletoViajeDialog
        abierto={boletoAbierto}
        onOpenChange={setBoletoAbierto}
        titulo="Boletos del viaje"
        opciones={opcionesBoleto}
      />
    </Tabs>
  );
}

function RutaCalculada({ calculo }: { calculo: CalculoViaje }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {calculo.km_total != null ? (
          <span className="inline-flex items-center gap-1">
            <Route className="h-3.5 w-3.5" aria-hidden />
            {calculo.km_total.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
          </span>
        ) : null}
        {calculo.horas_total ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {calculo.horas_total} con margen
          </span>
        ) : null}
        <ModoTransporteBadge modo={calculo.modo_transporte === 'propio' ? 'propio' : 'solicitado'} />
      </div>
      <ol className="space-y-2">
        {calculo.tramos.map((tramo, i) => {
          const noAlcanza = tramo.alcanza === false;
          const tiempos = [
            tramo.km != null
              ? `${tramo.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
              : '',
            tramo.duracion ?? '',
            tramo.duracion_con_margen ? `${tramo.duracion_con_margen} con margen` : '',
          ].filter((parte) => parte !== '').join(' · ');
          const horario = [
            tramo.salida_hora
              ? `Salida ${horaAmPm(tramo.salida_hora) ?? tramo.salida_hora}`
              : '',
            tramo.llegada_hora
              ? `Llegada ${horaAmPm(tramo.llegada_hora) ?? tramo.llegada_hora}`
              : '',
          ].filter((parte) => parte !== '').join(' · ');
          return (
            <li
              key={`${tramo.de}-${tramo.a}-${i}`}
              className={cn(
                'rounded-xl border bg-card p-3 text-sm',
                noAlcanza && 'border-destructive/40 bg-destructive/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    <span className="text-muted-foreground">{i + 1}.</span> {tramo.de}
                    <span className="mx-1 text-muted-foreground">→</span>
                    {tramo.a}
                  </p>
                  {tiempos ? (
                    <p className="mt-1 text-xs text-muted-foreground">{tiempos}</p>
                  ) : null}
                  {horario ? (
                    <p className="text-xs text-muted-foreground">{horario}</p>
                  ) : null}
                </div>
                {noAlcanza ? (
                  <Badge variant="destructive" className="shrink-0">
                    No alcanza
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
  const texto = partes.join(' · ');
  return (
    <p
      className="mt-0.5 line-clamp-2 max-w-full break-words text-[10px] leading-snug text-muted-foreground"
      title={texto}
    >
      {texto}
    </p>
  );
}

const ICONO_TIPO: Record<string, LucideIcon> = {
  vuelo: Plane,
  avion: Plane,
  autobus: Bus,
  hotel: BedDouble,
  renta: CarFront,
  auto: CarFront,
};

function iconoDeTipo(tipo: string): LucideIcon {
  return ICONO_TIPO[(tipo ?? '').trim().toLowerCase()] ?? Ticket;
}

function precioDesglose(opcion: SolicitudOpcion): string {
  if (esOpcionCotizada(opcion) && opcion.precio !== null) {
    return importeFormateado(opcion.precio, opcion.moneda);
  }
  const referencia = precioReferenciaOpcion(opcion);
  return referencia === null ? SIN_PRECIO : importeFormateado(referencia, opcion.moneda);
}

function BotonSubirCaptura({
  etiqueta,
  subiendo,
  onSubir,
}: {
  etiqueta: string;
  subiendo: boolean;
  onSubir: (archivo: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6 shrink-0 border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            aria-label={`Subir captura de ${etiqueta}`}
          >
            {subiendo ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Subir captura (PNG)</TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,.png"
        className="hidden"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          evento.target.value = '';
          if (archivo) void onSubir(archivo);
        }}
      />
    </TooltipProvider>
  );
}

interface GrupoOpcionesRuta {
  clave: string;
  etiqueta: string;
  detalle: string | null;
  tramo: number;
}

function grupoOpcionRuta(opcion: SolicitudOpcion): GrupoOpcionesRuta {
  const de = typeof opcion.datos?.de === 'string' ? opcion.datos.de : '';
  const a = typeof opcion.datos?.a === 'string' ? opcion.datos.a : '';
  const tramo = typeof opcion.datos?.tramo === 'number' ? opcion.datos.tramo : 99;
  const detalle = de && a ? `${de} → ${a}` : null;

  if (tramo === 99) {
    return { clave: 'sin-tramo', etiqueta: 'Boletos', detalle, tramo };
  }
  if (tramo === 0) {
    return { clave: 'tramo-0', etiqueta: 'Ida', detalle, tramo };
  }
  if (/regreso|origen/i.test(a)) {
    return { clave: `tramo-${tramo}`, etiqueta: 'Regreso', detalle, tramo };
  }
  return { clave: `tramo-${tramo}`, etiqueta: `Destino ${tramo + 1}`, detalle, tramo };
}

function agruparOpcionesRuta(
  opciones: SolicitudOpcion[],
): Array<GrupoOpcionesRuta & { opciones: SolicitudOpcion[] }> {
  const mapa = new Map<string, GrupoOpcionesRuta & { opciones: SolicitudOpcion[] }>();
  for (const opcion of opciones) {
    const grupo = grupoOpcionRuta(opcion);
    const existente = mapa.get(grupo.clave);
    if (existente) {
      existente.opciones.push(opcion);
    } else {
      mapa.set(grupo.clave, { ...grupo, opciones: [opcion] });
    }
  }
  return [...mapa.values()].sort((a, b) => a.tramo - b.tramo);
}

function estiloGrupoRuta(etiqueta: string): { punto: string; texto: string } {
  if (etiqueta === 'Regreso') return { punto: 'bg-sky-500', texto: 'text-sky-700' };
  if (etiqueta.startsWith('Destino')) return { punto: 'bg-violet-500', texto: 'text-violet-700' };
  if (etiqueta === 'Boletos') return { punto: 'bg-slate-400', texto: 'text-slate-600' };
  return { punto: 'bg-primary', texto: 'text-primary' };
}

function esDeteccionAplicable(opcion: SolicitudOpcion): boolean {
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  if (!opcion.fue_elegida || !opcion.url_compra) return false;
  if (tipo !== 'vuelo' && tipo !== 'avion' && tipo !== 'autobus' && tipo !== 'hotel') return false;
  if (tipo === 'hotel' && /^hotel en /i.test(opcion.linea)) return false;
  return !esOpcionCotizada(opcion);
}

function esCapturaAutomaticaAplicable(opcion: SolicitudOpcion): boolean {
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  if (!opcion.url_compra) return false;
  if (tipo !== 'vuelo' && tipo !== 'avion' && tipo !== 'autobus' && tipo !== 'hotel') return false;
  if (tipo === 'hotel' && /^hotel en /i.test(opcion.linea)) return false;
  return true;
}

function EstadoDeteccion({ opcion }: { opcion: SolicitudOpcion }) {
  if (!opcion.fue_elegida) return null;
  const estado = opcion.datos?.deteccion_estado;
  if (estado === 'pendiente' || estado === 'en_proceso') {
    return (
      <p role="status" className="text-[10px] leading-snug text-muted-foreground">
        Buscando precio real…
      </p>
    );
  }
  if (estado === 'sin_opcion' || estado === 'error') {
    return (
      <p className="text-[10px] leading-snug text-amber-700">
        {opcion.datos?.deteccion_mensaje
          ?? 'No se pudo detectar el precio; puedes capturarlo manualmente.'}
      </p>
    );
  }
  return null;
}

function DetalleOpciones({
  solicitud,
  opcionesVista,
  onSolicitudActualizada,
  onCerrar,
}: {
  solicitud: Solicitud;
  opcionesVista?: SolicitudOpcion[];
  onSolicitudActualizada?: (solicitud: Solicitud) => void;
  onCerrar?: () => void;
}) {
  const opciones = opcionesVista ?? solicitud.opciones;
  const puedeCapturarPrecio =
    onSolicitudActualizada !== undefined
    && (solicitud.estado === 'borrador' || solicitud.estado === 'enviada');
  const total = totalDeOpcionesElegidas(opciones);
  const elegidas = opciones.filter((o) => o.fue_elegida);
  const descartadas = opciones.filter((o) => !o.fue_elegida);
  const [boleto, setBoleto] = useState<SolicitudOpcion | null>(null);
  const [precioReal, setPrecioReal] = useState<SolicitudOpcion | null>(null);
  const [detectando, setDetectando] = useState<number | null>(null);
  const [avisoDeteccion, setAvisoDeteccion] = useState<string | null>(null);
  const [subiendoCaptura, setSubiendoCaptura] = useState<number | null>(null);
  const [capturando, setCapturando] = useState<number | null>(null);
  const [capturaAReemplazar, setCapturaAReemplazar] = useState<SolicitudOpcion | null>(null);
  const [capturasRevision, setCapturasRevision] = useState<Record<number, number>>({});

  const [capturas, setCapturas] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(opciones.map((o) => [o.id_opcion, o.ruta_captura])),
  );
  const [datos, setDatos] = useState<Record<number, DatosViaje | null>>({});

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
      });
    return () => {
      vigente = false;
    };
  }, [aplicarEvidencias, solicitud.id_solicitud]);

  const hayDeteccionPendiente = opciones.some(
    (o) =>
      o.fue_elegida
      && (o.datos?.deteccion_estado === 'pendiente' || o.datos?.deteccion_estado === 'en_proceso'),
  );

  useEffect(() => {
    if (!hayDeteccionPendiente || !onSolicitudActualizada) return;
    let vigente = true;
    let intentos = 0;
    const intervalo = window.setInterval(async () => {
      intentos += 1;
      try {
        const { data } = await solicitudesApi.detalle(solicitud.id_solicitud);
        if (vigente && data.success && data.data) onSolicitudActualizada(data.data);
      } catch {
      }
      if (intentos >= 72) window.clearInterval(intervalo);
    }, 5000);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
    };
  }, [hayDeteccionPendiente, onSolicitudActualizada, solicitud.id_solicitud]);

  async function generarCaptura(opcion: SolicitudOpcion, reemplazar: boolean) {
    setCapturando(opcion.id_opcion);
    try {
      const { data } = await evidenciasApi.generar(
        solicitud.id_solicitud,
        reemplazar,
        opcion.id_opcion,
      );
      const resultado = data.data;
      aplicarEvidencias(resultado);
      const nuevaCaptura = resultado.opciones.find(
        (evidencia) => evidencia.id_opcion === opcion.id_opcion,
      )?.ruta_captura;
      if (nuevaCaptura) {
        setBoleto((actual) =>
          actual?.id_opcion === opcion.id_opcion
            ? { ...actual, ruta_captura: nuevaCaptura }
            : actual,
        );
      }
      setCapturasRevision((previo) => ({
        ...previo,
        [opcion.id_opcion]: (previo[opcion.id_opcion] ?? 0) + 1,
      }));

      const error = resultado.opciones.find(
        (evidencia) => evidencia.id_opcion === opcion.id_opcion,
      )?.error;
      if (resultado.fallidas > 0) {
        toast.error(error ?? 'No se pudo generar la captura.');
      } else {
        toast.success(reemplazar ? 'Captura reemplazada.' : 'Captura generada.');
      }
    } catch (error) {
      toast.error(toApiError(error).message);
    } finally {
      setCapturando(null);
    }
  }

  function solicitarCaptura(opcion: SolicitudOpcion) {
    const captura = capturas[opcion.id_opcion] ?? opcion.ruta_captura;
    if (captura) {
      setCapturaAReemplazar(opcion);
      return;
    }
    void generarCaptura(opcion, false);
  }

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

  async function detectarPrecio(opcion: SolicitudOpcion) {
    if (detectando !== null) return;
    setDetectando(opcion.id_opcion);
    setAvisoDeteccion(null);
    try {
      const { data } = await solicitudesApi.detectarPrecio(
        solicitud.id_solicitud,
        opcion.id_opcion,
      );
      const resultado = data.data;
      if (!data.success || !resultado) {
        toast.error(data.message ?? 'No se pudo detectar el precio.');
        return;
      }
      if (!resultado.aplicado) {
        const motivo =
          resultado.motivo
          ?? data.message
          ?? 'No se encontró un precio que llegue a tiempo.';
        const detectados = resultado.opciones
          .slice(0, 3)
          .map((opcion) => `${opcion.linea} ${mxn(opcion.precio)}`)
          .join(' · ');
        const aviso = detectados ? `${motivo} Detectados: ${detectados}.` : motivo;
        setAvisoDeteccion(aviso);
        toast.warning(aviso);
        return;
      }
      toast.success(resultado.mensaje ?? 'Precio detectado y aplicado.');
      const detalle = await solicitudesApi.detalle(solicitud.id_solicitud);
      if (detalle.data.success && detalle.data.data) {
        onSolicitudActualizada?.(detalle.data.data);
      }
    } catch (error) {
      toast.error(toApiError(error).message || 'No se pudo detectar el precio.');
    } finally {
      setDetectando(null);
    }
  }

  const botonCaptura = (opcion: SolicitudOpcion) => {
    const captura = capturas[opcion.id_opcion] ?? opcion.ruta_captura;
    if (captura || !esCapturaAutomaticaAplicable(opcion)) return null;
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6 shrink-0 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => solicitarCaptura(opcion)}
              disabled={capturando === opcion.id_opcion}
              aria-label={`Generar captura de ${opcion.linea}`}
            >
              {capturando === opcion.id_opcion ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generar captura de esta opción</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const botonBoleto = (opcion: SolicitudOpcion) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-6 w-6 shrink-0 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
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
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-6 w-6 shrink-0 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
            >
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

  const tarjeta = (opcion: SolicitudOpcion) => {
    const Icono = iconoDeTipo(opcion.tipo);
    const captura = capturas[opcion.id_opcion] ?? opcion.ruta_captura ?? undefined;
    const nombre = nombreCortoOpcion(opcion);
    return (
      <li
        key={opcion.id_opcion}
        className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-start gap-1.5 text-[13px] font-medium">
              <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span
                className="line-clamp-2 min-w-0 break-words"
                title={nombre !== opcion.linea ? opcion.linea : undefined}
              >
                {nombre}
              </span>
            </p>
            {opcion.fuente ? (
              <p
                className="mt-0.5 line-clamp-1 break-words text-[10px] italic text-muted-foreground"
                title={opcion.fuente}
              >
                {opcion.fuente}
              </p>
            ) : null}
            <DatosViajeTexto datos={datos[opcion.id_opcion] ?? null} />
            <EstadoDeteccion opcion={opcion} />
          </div>
          <span className="max-w-[40%] shrink-0 break-words text-right text-[13px] font-semibold tabular-nums">
            {precioDesglose(opcion)}
          </span>
        </div>

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CeldaCaptura
              ruta={captura}
              etiqueta={opcion.linea}
              revision={capturasRevision[opcion.id_opcion] ?? 0}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {botonCaptura(opcion)}
            <BotonSubirCaptura
              etiqueta={opcion.linea}
              subiendo={subiendoCaptura === opcion.id_opcion}
              onSubir={(archivo) => subirCaptura(opcion, archivo)}
            />
            {botonBoleto(opcion)}
            {botonComprar(opcion)}
          </div>
        </div>

        {puedeCapturarPrecio && esDeteccionAplicable(opcion) ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[11px]"
              onClick={() => void detectarPrecio(opcion)}
              disabled={detectando !== null}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {detectando === opcion.id_opcion ? 'Detectando…' : 'Detectar precio'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-lg px-2 text-[11px]"
              onClick={() => setPrecioReal(opcion)}
              disabled={detectando !== null}
            >
              Capturar precio
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  const gruposElegidas = agruparOpcionesRuta(elegidas);
  const gruposAlternativas = agruparOpcionesRuta(descartadas).map((grupo) => ({
    ...grupo,
    opciones: [...grupo.opciones].sort(
      (a, b) => (a.precio ?? Number.POSITIVE_INFINITY) - (b.precio ?? Number.POSITIVE_INFINITY),
    ),
  }));

  const filaAlternativa = (opcion: SolicitudOpcion) => {
    const Icono = iconoDeTipo(opcion.tipo);
    const nombre = nombreCortoOpcion(opcion);
    return (
      <li
        key={opcion.id_opcion}
        className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5"
      >
        <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="line-clamp-1 min-w-0 break-words text-[11px] font-medium"
              title={nombre !== opcion.linea ? opcion.linea : undefined}
            >
              {nombre}
            </span>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums">
              {precioDesglose(opcion)}
            </span>
          </div>
          {opcion.fuente ? (
            <p className="line-clamp-1 text-[10px] text-muted-foreground" title={opcion.fuente}>
              {opcion.fuente}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {botonCaptura(opcion)}
          <BotonSubirCaptura
            etiqueta={opcion.linea}
            subiendo={subiendoCaptura === opcion.id_opcion}
            onSubir={(archivo) => subirCaptura(opcion, archivo)}
          />
          {botonBoleto(opcion)}
          {botonComprar(opcion)}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Desglose
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {elegidas.length === 1 ? '1 opción elegida' : `${elegidas.length} opciones elegidas`}
            {descartadas.length > 0
              ? ` · ${descartadas.length} alternativa${descartadas.length === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="min-w-0 text-right">
            {total.suma !== null ? (
              <>
                <p className="text-xl font-semibold tracking-tight tabular-nums">
                  {mxn(total.suma)}
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  {total.totalCotizado !== null && total.totalEstimado !== null
                    ? `Incluye cotizado ${mxn(total.totalCotizado)} + estimado ${mxn(total.totalEstimado)}`
                    : total.totalCotizado !== null
                      ? `Cotizado ${mxn(total.totalCotizado)}`
                      : total.totalEstimado !== null
                        ? `Estimado ${mxn(total.totalEstimado)}`
                        : ''}
                </p>
              </>
            ) : (
              <p className="max-w-[200px] text-right text-[11px] leading-snug text-muted-foreground">
                {textoTotalElegidas(total)}
              </p>
            )}
          </div>
          {onCerrar ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-1 -mt-1 hidden h-7 w-7 lg:inline-flex"
              onClick={onCerrar}
              aria-label="Ocultar desglose"
              title="Ocultar desglose"
            >
              <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">Transporte y hospedaje elegidos</p>
      {detectando !== null ? (
        <p role="status" className="text-xs text-muted-foreground">
          Buscando el precio real en la fuente… puede tardar hasta 2 minutos. Si
          el sitio bloquea, se intenta el respaldo Firecrawl.
        </p>
      ) : null}
      {avisoDeteccion ? <p className="text-xs text-amber-700">{avisoDeteccion}</p> : null}
      {elegidas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-muted-foreground">
          Sin opciones elegidas.
        </p>
      ) : elegidas.length === 1 ? (
        <ul className="space-y-2">{tarjeta(elegidas[0])}</ul>
      ) : (
        <div className="space-y-2">
          {gruposElegidas.map((grupo, indice) => {
            const estilo = estiloGrupoRuta(grupo.etiqueta);
            return (
              <GrupoRutaCollapsible
                key={grupo.clave}
                etiqueta={grupo.etiqueta}
                detalle={grupo.detalle}
                punto={estilo.punto}
                texto={estilo.texto}
                count={grupo.opciones.length}
                inicialmenteAbierto={indice === 0}
                className="border-0 bg-transparent"
                contenidoClassName="p-0 pt-2"
              >
                <ul className="space-y-2">
                  {grupo.opciones.map((opcion) => tarjeta(opcion))}
                </ul>
              </GrupoRutaCollapsible>
            );
          })}
        </div>
      )}
      {descartadas.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Alternativas descartadas ({descartadas.length})
          </summary>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {gruposAlternativas.map((grupo, indice) => {
              const estilo = estiloGrupoRuta(grupo.etiqueta);
              return (
                <GrupoRutaCollapsible
                  key={grupo.clave}
                  etiqueta={grupo.etiqueta}
                  detalle={grupo.detalle}
                  punto={estilo.punto}
                  texto={estilo.texto}
                  count={grupo.opciones.length}
                  inicialmenteAbierto={indice === 0}
                  className="border-0 bg-transparent"
                  contenidoClassName="border-0 p-0 pt-1"
                >
                  <ul className="space-y-1">
                    {grupo.opciones.map((opcion) => filaAlternativa(opcion))}
                  </ul>
                </GrupoRutaCollapsible>
              );
            })}
          </div>
        </details>
      ) : null}

      <BoletoViajeDialog
        abierto={boleto !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setBoleto(null);
        }}
        titulo={`Boleto · ${boleto ? nombreCortoOpcion(boleto) : ''}`}
        opciones={boleto ? [boleto] : []}
        onSolicitarCaptura={
          boleto && esCapturaAutomaticaAplicable(boleto) ? solicitarCaptura : undefined
        }
        capturandoId={capturando}
      />

      <AlertDialog
        open={capturaAReemplazar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCapturaAReemplazar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemplazar captura</AlertDialogTitle>
            <AlertDialogDescription>
              Ya existe una captura de {capturaAReemplazar?.linea ?? 'esta opción'}.
              Se reemplazará por una nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const opcion = capturaAReemplazar;
                setCapturaAReemplazar(null);
                if (opcion) void generarCaptura(opcion, true);
              }}
            >
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {precioReal ? (
        <PrecioRealDialog
          abierto
          onOpenChange={(abierto) => {
            if (!abierto) setPrecioReal(null);
          }}
          solicitudId={solicitud.id_solicitud}
          opcion={precioReal}
          datosAgente={datos[precioReal.id_opcion] ?? null}
          onGuardado={(actualizada) => {
            setPrecioReal(null);
            onSolicitudActualizada?.(actualizada);
          }}
        />
      ) : null}
    </div>
  );
}

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
