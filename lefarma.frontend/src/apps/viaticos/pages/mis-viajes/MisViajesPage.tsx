import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Eye, MoreHorizontal, Pencil, Route, Send, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { solicitudesApi } from '../../services/solicitudes.api';
import { estadoTexto } from '../../types/aprobaciones.types';
import type { CalculoViaje, Solicitud } from '../../types/solicitud.types';
import { textoTotalElegidas, totalDeOpcionesElegidas } from '../aprobaciones/DetalleSolicitudModal';
import { ResumenViaje } from '../../components/ResumenViaje';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { contarPuntos, resumenDesdeDatos } from '../../services/resumenViaje';
import { horaAmPm, leerCalculoDesdeDatos } from '../../services/calculoViaje';
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

function tipoTransporte(solicitud: Solicitud): string {
  const datos = comoObjeto(solicitud.datos);
  const transporte = comoObjeto(datos?.transporte);
  return transporte?.modo === 'propio' ? 'Carro propio' : 'Solicitud de transporte';
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

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await solicitudesApi.misSolicitudes();
      if (res.data.success) setSolicitudes(res.data.data ?? []);
      else setError(res.data.message ?? 'No se pudieron cargar tus viajes.');
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudieron cargar tus viajes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

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
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
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
        accessorFn: (fila) => costoViaje(fila.solicitud) ?? 0,
        cell: ({ row }) => {
          const costo = costoViaje(row.original.solicitud);
          return <span className="text-sm font-medium">{costo !== null ? mxn(costo) : '—'}</span>;
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
                    {esBorrador ? (
                      <>
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
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        <DialogContent data-testid="detalle-viaje" className="sm:max-w-3xl">
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
 * Detalle del viaje: la ruta calculada (la que manda tras el envío) y, en
 * otra pestaña, la propuesta original del wizard.
 */
function VistaDetalle({ solicitud }: { solicitud: Solicitud }) {
  const resumen = resumenDesdeDatos(solicitud.datos);
  const calculo = leerCalculoDesdeDatos(solicitud.datos);
  if (!resumen) return <DetalleViajeLegado solicitud={solicitud} />;

  const propuesta = (
    <div className="space-y-4">
      <ResumenViaje {...resumen} />
      <p className="text-xs text-muted-foreground">
        Propuesta original del wizard: origen, destinos y horarios capturados al crear la solicitud.
      </p>
    </div>
  );

  if (!calculo) {
    return (
      <div className="space-y-4">
        {propuesta}
        {solicitud.opciones.length > 0 ? <DetalleOpciones solicitud={solicitud} /> : null}
      </div>
    );
  }

  return (
    <Tabs defaultValue="calculada" className="space-y-4">
      <TabsList>
        <TabsTrigger value="calculada">Ruta calculada</TabsTrigger>
        <TabsTrigger value="propuesta">Ruta propuesta</TabsTrigger>
      </TabsList>
      <TabsContent value="calculada" className="space-y-4">
        <RutaCalculada calculo={calculo} />
        {solicitud.opciones.length > 0 ? <DetalleOpciones solicitud={solicitud} /> : null}
      </TabsContent>
      <TabsContent value="propuesta">{propuesta}</TabsContent>
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
        <Badge variant="secondary" className="font-normal">
          {calculo.modo_transporte === 'propio' ? 'Carro propio' : 'Transporte solicitado'}
        </Badge>
      </div>
      <ol className="space-y-2">
        {calculo.tramos.map((tramo, i) => (
          <li key={`${tramo.de}-${tramo.a}-${i}`} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{i + 1}. {tramo.de} → {tramo.a}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {tramo.km != null ? (
                <Badge variant="outline" className="font-normal">
                  {tramo.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km
                </Badge>
              ) : null}
              {tramo.duracion ? <Badge variant="outline" className="font-normal">{tramo.duracion}</Badge> : null}
              {tramo.duracion_con_margen ? (
                <Badge variant="secondary" className="font-normal">{tramo.duracion_con_margen} con margen</Badge>
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
              {tramo.alcanza === false ? (
                <Badge variant="destructive" className="font-normal">No alcanza la hora</Badge>
              ) : null}
            </div>
            {tramo.casetas.length > 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Casetas: {tramo.casetas.map((caseta) => `${caseta.nombre} (km ${caseta.km})`).join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {calculo.generado_en ? (
        <p className="text-xs text-muted-foreground">
          Calculada el {new Date(calculo.generado_en).toLocaleString('es-MX')}.
        </p>
      ) : null}
    </div>
  );
}

function DetalleOpciones({ solicitud }: { solicitud: Solicitud }) {
  const total = totalDeOpcionesElegidas(solicitud.opciones);
  const elegidas = solicitud.opciones.filter((o) => o.fue_elegida);
  const descartadas = solicitud.opciones.filter((o) => !o.fue_elegida);
  return (
    <div className="space-y-2 text-sm">
      <p><strong>Transporte y hospedaje elegidos:</strong> {elegidas.length === 0 ? 'Sin opciones elegidas.' : elegidas.map((o) => o.linea).join(' · ')}</p>
      {descartadas.length > 0 ? (
        <p className="text-muted-foreground"><strong>Alternativas descartadas:</strong> {descartadas.map((o) => o.linea).join(' · ')}</p>
      ) : null}
      <p><strong>Desglose:</strong> {textoTotalElegidas(total)}</p>
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
