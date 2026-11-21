import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Bus, CalendarDays, Camera, CarFront, Clock, ExternalLink, Eye, MapPin, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, Plane, RefreshCw, Route, Send, ShieldCheck, Sparkles, Ticket, Trash2, Upload, Wallet, type LucideIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
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
import { PrecioRealDialog } from '../../components/PrecioRealDialog';
import { ComparadorRutas } from '../../components/ComparadorRutas';
import { GrupoRutaCollapsible } from '../../components/GrupoRutaCollapsible';
import type { PuntoMapa, SegmentoMapa } from '../../components/rutaMapa.types';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { contarPuntos, resumenDesdeDatos } from '../../services/resumenViaje';
import { nombreCortoOpcion } from '../../utils/nombresOpciones';
import { horaAmPm, leerCalculoAutorizadoDesdeDatos, leerCalculoDesdeDatos } from '../../services/calculoViaje';
import {
  ETIQUETA_PERIODO,
  clasificarRelacion,
  enRango,
  leerDatosViaje,
  rangoDelFiltro,
  type FiltroPeriodo,
  type ResumenViaje as ResumenDatos,
  type TipoViaje,
} from './viajes.helpers';

const TIPOS_VIAJE: { id: TipoViaje | 'todos'; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'solicitado', etiqueta: 'Transporte solicitado' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
];

/**
 * Pestañas del detalle con el estado activo en color primario, igual que los
 * catálogos y workflows. El detalle es de consulta: la pestaña activa debe
 * leerse de un vistazo, no como una carpeta gris.
 */
const tabRevisionTriggerClassName = cn(
  'gap-1.5 rounded-lg border-0 px-1.5 text-xs font-semibold leading-tight text-muted-foreground transition-colors sm:px-3 sm:text-sm',
  'whitespace-normal sm:whitespace-nowrap',
  'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
  'disabled:opacity-50',
);

interface FilaViaje {
  solicitud: Solicitud;
  resumen: ResumenDatos;
}

function nombreCreadorDe(solicitud: Solicitud, miId?: number, miNombre?: string): string {
  const nombre = solicitud.nombre_creador?.trim();
  if (nombre) return nombre;
  const idCreador = solicitud.id_usuario_creacion ?? solicitud.id_usuario_solicitante;
  if (miId !== undefined && idCreador === miId && miNombre?.trim()) return miNombre;
  return `Usuario #${idCreador}`;
}

/** Fecha larga al estilo de la bandeja de CxP: "23 de octubre de 2026". */
function fechaLarga(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return Number.isNaN(d.getTime())
    ? fecha
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Mismo lenguaje de color por estado que la bandeja de órdenes de CxP. */
const COLOR_POR_ESTADO: Record<string, string> = {
  borrador: '#64748b',
  enviada: '#2563eb',
  autorizada: '#16a34a',
  autorizada_con_ajustes: '#d97706',
  rechazada: '#dc2626',
};

function colorEstado(estado: string): string {
  return COLOR_POR_ESTADO[estado] ?? '#64748b';
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Personas del viaje: la persona viajera + acompañantes. */
function personasInvolucradas(solicitud: Solicitud): number {
  const datos = comoObjeto(solicitud.datos);
  const transporte = comoObjeto(datos?.transporte);
  const acompanantes = Array.isArray(transporte?.acompanantes) ? transporte!.acompanantes.length : 0;
  return 1 + acompanantes;
}

function modoTransporte(solicitud: Solicitud): 'propio' | 'solicitado' {
  const datos = comoObjeto(solicitud.datos);
  const transporte = comoObjeto(datos?.transporte);
  return transporte?.modo === 'propio' ? 'propio' : 'solicitado';
}

function tipoTransporte(solicitud: Solicitud): string {
  return modoTransporte(solicitud) === 'propio' ? 'Carro propio' : 'Solicitud de transporte';
}

/** Costo conocido del viaje: total del snapshot o comidas + extras + opciones elegidas. */
function costoViaje(solicitud: Solicitud): number | null {
  const datos = comoObjeto(solicitud.datos);
  const totalSnapshot = Number(datos?.total);
  if (Number.isFinite(totalSnapshot) && totalSnapshot > 0) return totalSnapshot;

  const gastos = comoObjeto(datos?.gastos);
  const comidas = Number(gastos?.comidas) || 0;
  const extras = (Array.isArray(gastos?.extras) ? gastos!.extras : []).reduce<number>((suma, extra) => {
    const obj = comoObjeto(extra);
    const monto = obj ? Number(obj.monto) : Number(extra);
    return suma + (Number.isFinite(monto) ? monto : 0);
  }, 0);
  const elegidas = solicitud.opciones
    .filter((opcion) => opcion.fue_elegida)
    .reduce((suma, opcion) => suma + (opcion.precio ?? 0), 0);

  const total = comidas + extras + elegidas;
  return total > 0 ? total : null;
}

function mxn(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function MisViajesPage({ hoy = new Date() }: { hoy?: Date }) {
  usePageTitle('Mis viajes', 'Viáticos');
  const navigate = useNavigate();
  const miId = useAuthStore((s) => s.user?.id);
  const miNombre = useAuthStore((s) => s.user?.nombre);

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
      const res = await solicitudesApi.misSolicitudes();
      if (res.data.success) setSolicitudes(res.data.data ?? []);
      else if (!silencioso) setError(res.data.message ?? 'No se pudieron cargar tus viajes.');
    } catch (falla: unknown) {
      if (!silencioso) setError(toApiError(falla).message || 'No se pudieron cargar tus viajes.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  const actualizarDetalle = useCallback((actualizada: Solicitud) => {
    setDetalle(actualizada);
  }, []);

  // Fase 2: mientras el backend busca el precio real de alguna opción, la
  // lista se refresca sola para que el total deje de ser estimado sin que el
  // usuario recargue ni pulse nada.
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

  // Referencia «hoy» en hora local; el rango siempre se muestra.
  const rango = rangoDelFiltro(periodo, hoy, desde, hasta);

  const filas = useMemo<FilaViaje[]>(
    () =>
      [...solicitudes]
        // El último creado primero (la API ya ordena; se refuerza aquí).
        .sort((a, b) =>
          b.fecha_creacion.localeCompare(a.fecha_creacion) || b.id_solicitud - a.id_solicitud,
        )
        .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
        .filter(({ resumen }) => (tipo === 'todos' ? true : resumen.tipoViaje === tipo))
        .filter(({ solicitud }) => enRango(solicitud.fecha_creacion, rango)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solicitudes, tipo, periodo, desde, hasta],
  );

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

  const columnas = useMemo<ColumnDef<FilaViaje>[]>(
    () => [
      {
        id: 'viaje',
        header: 'Viaje',
        accessorFn: (fila) => fila.solicitud.folio ?? fila.solicitud.id_solicitud,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.solicitud.folio ?? `#${row.original.solicitud.id_solicitud}`}</span>
            <span className="text-xs text-muted-foreground">{fechaLarga(row.original.solicitud.fecha_creacion)}</span>
          </div>
        ),
      },
      {
        id: 'destino',
        header: 'Destino',
        accessorFn: (fila) => fila.resumen.destino ?? '',
        cell: ({ row }) => {
          const distintivos = clasificarRelacion(row.original.solicitud, row.original.resumen, miId, miNombre);
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium">{row.original.resumen.destino ?? 'Destino por confirmar'}</span>
              {distintivos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {distintivos.map((d) => (
                    <Badge key={d.clave} variant="outline" className="text-[10px]">{d.texto}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'lugares',
        header: () => <div className="text-center">Lugares a visitar</div>,
        accessorFn: (fila) => fila.solicitud.num_puntos ?? contarPuntos(fila.solicitud.datos),
        cell: ({ getValue }) => (
          <div className="text-center">
            <span className="text-sm font-medium">{getValue<number>()}</span>
          </div>
        ),
      },
      {
        id: 'transporte',
        header: 'Transporte',
        accessorFn: (fila) => tipoTransporte(fila.solicitud),
        cell: ({ row }) => <ModoTransporteBadge modo={modoTransporte(row.original.solicitud)} />,
      },
      {
        id: 'personas',
        header: () => <div className="text-center">Personas involucradas</div>,
        accessorFn: (fila) => personasInvolucradas(fila.solicitud),
        cell: ({ getValue }) => (
          <div className="text-center">
            <span className="text-sm font-medium">{getValue<number>()}</span>
          </div>
        ),
      },
      {
        id: 'costo',
        header: 'Costo del viaje',
        accessorFn: (fila) => fila.solicitud.total ?? costoViaje(fila.solicitud) ?? 0,
        cell: ({ row }) => {
          const solicitud = row.original.solicitud;
          const tieneSplit =
            solicitud.total_cotizado !== undefined || solicitud.total_estimado !== undefined;
          const cotizado = tieneSplit ? solicitud.total_cotizado ?? null : costoViaje(solicitud);
          const referencia = solicitud.total_estimado ?? null;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {cotizado !== null ? mxn(cotizado) : tieneSplit ? 'Por cotizar' : '—'}
              </span>
              {typeof referencia === 'number' && referencia > 0 ? (
                <span className="text-[11px] text-muted-foreground">ref. {mxn(referencia)}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'solicitante',
        header: 'Solicitante',
        accessorFn: (fila) => `${fila.solicitud.persona_solicitante ?? ''} ${fila.solicitud.persona_viajera ?? ''}`.trim(),
        cell: ({ row }) => {
          const solicitante = row.original.solicitud.persona_solicitante?.trim()
            || nombreCreadorDe(row.original.solicitud, miId, miNombre);
          const viajero = row.original.solicitud.persona_viajera?.trim() || solicitante;
          if (solicitante === viajero) {
            return <Badge variant="secondary" className="font-normal">{solicitante}</Badge>;
          }
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <span>
                <span className="text-muted-foreground">Creador: </span>
                <span className="font-medium">{solicitante}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Viajero: </span>
                <span className="font-medium">{viajero}</span>
              </span>
            </div>
          );
        },
      },
      {
        id: 'creadaPor',
        header: 'Creada por',
        accessorFn: (fila) => nombreCreadorDe(fila.solicitud, miId, miNombre),
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (fila) => estadoTexto(fila.solicitud.estado),
        cell: ({ row }) => {
          const estado = row.original.solicitud.estado;
          const color = colorEstado(estado);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              style={{ borderColor: color, color, backgroundColor: `${color}15` }}
            >
              {estadoTexto(estado)}
            </span>
          );
        },
      },
      {
        id: 'acciones',
        header: () => <div className="text-right">Acción</div>,
        enableSorting: false,
        cell: ({ row }) => {
          const solicitud = row.original.solicitud;
          const esBorrador = solicitud.estado === 'borrador';
          const procesando = procesandoId === solicitud.id_solicitud;
          return (
            <TooltipProvider delayDuration={150}>
              <div className="flex items-center justify-end gap-1">
                {esBorrador ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Enviar a concentrado"
                        disabled={procesando}
                        onClick={(evento) => {
                          evento.stopPropagation();
                          setCalculo(solicitud);
                        }}
                      >
                        <Send className="h-4 w-4" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar a concentrado</TooltipContent>
                  </Tooltip>
                ) : null}

                {esBorrador ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Más acciones"
                        onClick={(evento) => evento.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44"
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          void verDetalle(solicitud.id_solicitud);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" aria-hidden />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/viaticos/solicitud/${solicitud.id_solicitud}`)}
                      >
                        <Pencil className="mr-2 h-4 w-4" aria-hidden />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={procesando}
                        onClick={() => {
                          void eliminarBorrador(solicitud);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  // Sin acciones extra no hay menú: se muestra el botón completo.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    aria-label={`Ver detalle ${solicitud.folio ?? `#${solicitud.id_solicitud}`}`}
                    onClick={(evento) => {
                      evento.stopPropagation();
                      void verDetalle(solicitud.id_solicitud);
                    }}
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Ver detalle
                  </Button>
                )}
              </div>
            </TooltipProvider>
          );
        },
      },
    ],
    [miId, miNombre, verDetalle, eliminarBorrador, navigate, procesandoId],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="filtro-periodo">Periodo</Label>
              <select id="filtro-periodo" aria-label="Periodo" className="h-10 w-full rounded-md border bg-background px-3" value={periodo} onChange={(e) => setPeriodo(e.target.value as FiltroPeriodo)}>
                {(Object.keys(ETIQUETA_PERIODO) as FiltroPeriodo[]).map((p) => (
                  <option key={p} value={p}>{ETIQUETA_PERIODO[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filtro-tipo">Tipo de viaje</Label>
              <select id="filtro-tipo" aria-label="Tipo de viaje" className="h-10 w-full rounded-md border bg-background px-3" value={tipo} onChange={(e) => setTipo(e.target.value as TipoViaje | 'todos')}>
                {TIPOS_VIAJE.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </div>
            {periodo === 'personalizado' ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="filtro-desde">Desde</Label>
                  <Input id="filtro-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filtro-hasta">Hasta</Label>
                  <Input id="filtro-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </>
            ) : null}
          </div>
          {rango ? (
            <p data-testid="rango-visible" className="text-xs text-muted-foreground">
              Mostrando por fecha de creación (provisional): {rango.inicio} al {rango.fin}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <DataTable
        columns={columnas}
        data={filas}
        title="Mis viajes"
        subtitle={`Total: ${filas.length}`}
        pagination
        pageSize={10}
        height={460}
        loading={cargando}
        showRefreshButton
        onRefresh={() => { void cargarSolicitudes(); }}
        filterConfig={{
          tableId: 'mis-viajes-v4',
          searchableColumns: ['destino', 'estado'],
          defaultSearchColumns: ['destino'],
          defaultVisibleColumns: ['viaje', 'destino', 'transporte', 'lugares', 'personas', 'costo', 'solicitante', 'estado', 'acciones'],
        }}
        rowTestId={(fila) => `viaje-${fila.solicitud.id_solicitud}`}
        onRowClick={(fila) => { void verDetalle(fila.solicitud.id_solicitud); }}
      />

      <CalculosViajeModal
        solicitud={calculo}
        open={calculo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCalculo(null);
        }}
        onEnviado={() => {
          void cargarSolicitudes();
          navigate('/viaticos/concentrado');
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
            <VistaDetalle
              solicitud={detalle}
              onSolicitudActualizada={actualizarDetalle}
            />
          ) : null}
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

/**
 * Fase de cada parada guardada. Los cálculos nuevos traen `fase`; los viejos
 * solo tienen el título "Regreso" y una parada numerada. En ese caso el regreso
 * empieza en la parada siguiente a la última visita.
 */
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

/** Suma el taxi elegido a la parada de su tramo (ida o regreso). */
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
    const fases = fasesDeRuta(calculo);
    const nodos = calculo.ruta.nodos.map((nodo, i) => {
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

/** Tarjeta de una métrica del resumen de ruta. */
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

/** Métricas de la ruta que llenan el ancho del panel central. */
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

/**
 * La ruta en dos columnas cuando hay regreso: usa el ancho del panel central y
 * separa visualmente la ida del regreso. Sin regreso se queda en una columna.
 */
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

/** Riel del desglose cuando el revisor lo colapsa en escritorio. */
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
  onSolicitudActualizada,
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
  /** Refresca la solicitud después de capturar un precio real. */
  onSolicitudActualizada?: (solicitud: Solicitud) => void;
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
  const [tabActiva, setTabActiva] = useState<'calculada' | 'inicial' | 'autorizada'>(tabInicial);
  const [desgloseAbierto, setDesgloseAbierto] = useState(true);
  const tienePanelLateral = tabActiva !== 'inicial';
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
    // Sin cálculo guardado: mismo marco de dos columnas, con lo que haya. El
    // revisor ve la misma pantalla aunque la solicitud no haya pasado por los
    // cálculos (o venga del flujo anterior).
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
      onValueChange={(valor) => setTabActiva(valor as 'calculada' | 'inicial' | 'autorizada')}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="grid h-auto min-h-11 w-full max-w-2xl grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="calculada" className={tabRevisionTriggerClassName}>
            <Route className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
            Ruta calculada
          </TabsTrigger>
          <TabsTrigger value="inicial" className={tabRevisionTriggerClassName}>
            <MapPin className="hidden h-3.5 w-3.5 sm:inline" aria-hidden />
            Viaje inicial
          </TabsTrigger>
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
      <TabsContent value="calculada" className="space-y-4">
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

/** Icono del tipo de opción; lo desconocido usa el boleto genérico. */
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

/** Importe limpio para el desglose: el badge/fuente ya indica si es estimado. */
function precioDesglose(opcion: SolicitudOpcion): string {
  if (esOpcionCotizada(opcion) && opcion.precio !== null) {
    return importeFormateado(opcion.precio, opcion.moneda);
  }
  const referencia = precioReferenciaOpcion(opcion);
  return referencia === null ? SIN_PRECIO : importeFormateado(referencia, opcion.moneda);
}

/** Subida manual de un PNG: icono compacto junto a boleto/enlace. */
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

/** Agrupa por tramo/destino para que varios destinos no queden en una lista plana. */
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

/** Opción elegida que la detección automática puede cotizar (vuelo, autobús u hotel). */
function esDeteccionAplicable(opcion: SolicitudOpcion): boolean {
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  if (!opcion.fue_elegida || !opcion.url_compra) return false;
  if (tipo !== 'vuelo' && tipo !== 'avion' && tipo !== 'autobus' && tipo !== 'hotel') return false;
  if (tipo === 'hotel' && /^hotel en /i.test(opcion.linea)) return false;
  return !esOpcionCotizada(opcion);
}

/**
 * Tipos con una tarjeta concreta en el sitio (vuelo, autobús, hotel). Taxi y
 * renta solo tienen una página de búsqueda: para esos queda la carga manual.
 */
function esCapturaAutomaticaAplicable(opcion: SolicitudOpcion): boolean {
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  if (!opcion.url_compra) return false;
  if (tipo !== 'vuelo' && tipo !== 'avion' && tipo !== 'autobus' && tipo !== 'hotel') return false;
  if (tipo === 'hotel' && /^hotel en /i.test(opcion.linea)) return false;
  return true;
}

/** Estado visible de la detección automática de precio de una opción. */
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
  /**
   * Opciones de la versión que se está mostrando. Sin esta prop se usan las de
   * la solicitud, que es el comportamiento de Mis viajes.
   */
  opcionesVista?: SolicitudOpcion[];
  /** Refresca la solicitud después de capturar el precio real de un vuelo. */
  onSolicitudActualizada?: (solicitud: Solicitud) => void;
  /** Colapsa el panel de desglose en escritorio. */
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

  // Capturas y datos por opción: arrancan con lo que ya trae el detalle y se
  // refrescan con GET /evidencias al abrir y con POST /capturas.
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
        /* silencioso: sin evidencias el detalle sigue mostrando la solicitud */
      });
    return () => {
      vigente = false;
    };
  }, [aplicarEvidencias, solicitud.id_solicitud]);

  // Fase 2: al guardar la cotización, el backend encola la detección. Aquí se
  // refresca el detalle mientras haya opciones pendientes, sin clics.
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
        /* el siguiente intento vuelve a consultar */
      }
      if (intentos >= 72) window.clearInterval(intervalo);
    }, 5000);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
    };
  }, [hayDeteccionPendiente, onSolicitudActualizada, solicitud.id_solicitud]);

  /** Genera o reemplaza la captura de una sola opción. */
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

  /** Sin captura genera directo; con captura pide confirmación antes de pisarla. */
  function solicitarCaptura(opcion: SolicitudOpcion) {
    const captura = capturas[opcion.id_opcion] ?? opcion.ruta_captura;
    if (captura) {
      setCapturaAReemplazar(opcion);
      return;
    }
    void generarCaptura(opcion, false);
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
   * Detección bajo demanda: Playwright local y, si el sitio bloquea, Firecrawl.
   * El backend elige la opción más barata que cumpla el horario y la aplica con
   * su captura. Es el respaldo manual de la detección automática al guardar.
   */
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

  /** Cámara solo cuando falta captura; reemplazar se hace desde el boleto. */
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

  /** Botón de boleto de un renglón: abre esa opción con captura y link. */
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
