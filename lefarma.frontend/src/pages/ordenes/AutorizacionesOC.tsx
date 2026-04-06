import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { API } from '@/services/api';
import type { ApiResponse } from '@/types/api.types';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Loader2, FileText, Search, RefreshCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { OrdenCompraResponse, OrdenCompraPartidaResponse } from '@/types/ordenCompra.types';


interface AccionDisponibleResponse {
  idAccion: number;
  nombreAccion: string;
  tipoAccion: string;
  claseEstetica: string;
}

interface HistorialWorkflowItemResponse {
  idEvento: number;
  idOrden: number;
  idPaso: number;
  nombrePaso?: string | null;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  datosSnapshot?: string | null;
  fechaEvento: string;
}

interface WorkflowListItem {
  idWorkflow: number;
  codigoProceso: string;
  nombre: string;
}

interface WorkflowPasoConfig {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  descripcionAyuda?: string | null;
  esInicio: boolean;
  esFinal: boolean;
}

interface WorkflowConfigResponse {
  idWorkflow: number;
  codigoProceso: string;
  pasos: WorkflowPasoConfig[];
}

const ESTADO_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Creada: 'outline',
  EnRevisionF2: 'secondary',
  EnRevisionF3: 'secondary',
  EnRevisionF4: 'secondary',
  EnRevisionF5: 'secondary',
  Autorizada: 'default',
  EnTesoreria: 'default',
  Pagada: 'default',
  EnComprobacion: 'outline',
  Cerrada: 'default',
  Rechazada: 'destructive',
  Cancelada: 'outline',
};

const ESTADO_LABEL: Record<string, string> = {
  Creada: 'Creada',
  EnRevisionF2: 'En revisión - Firma 2',
  EnRevisionF3: 'En revisión - Firma 3',
  EnRevisionF4: 'En revisión - Firma 4',
  EnRevisionF5: 'En revisión - Firma 5',
  Autorizada: 'Autorizada',
  EnTesoreria: 'En tesorería',
  Pagada: 'Pagada',
  EnComprobacion: 'En comprobación',
  Cerrada: 'Cerrada',
  Rechazada: 'Rechazada',
  Cancelada: 'Cancelada',
};

const ESTADO_BADGE_CLASS: Record<string, string> = {
  Creada: 'border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-900/40',
  EnRevisionF2: 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30',
  EnRevisionF3: 'border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30',
  EnRevisionF4: 'border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30',
  EnRevisionF5: 'border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-950/30',
  Autorizada: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30',
  EnTesoreria: 'border-cyan-300 text-cyan-700 bg-cyan-50 dark:bg-cyan-950/30',
  Pagada: 'border-teal-300 text-teal-700 bg-teal-50 dark:bg-teal-950/30',
  EnComprobacion: 'border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/30',
  Cerrada: 'border-green-400 text-green-800 bg-green-100 dark:bg-green-950/40',
  Rechazada: 'border-red-400 text-red-800 bg-red-100 dark:bg-red-950/40',
  Cancelada: 'border-zinc-400 text-zinc-700 bg-zinc-100 dark:bg-zinc-900/50',
};

export default function AutorizacionesOC() {
  usePageTitle('Autorizaciones OC', 'Bandeja de firmas y detalle de autorización');

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ordenes, setOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompraResponse | null>(null);
  const [acciones, setAcciones] = useState<AccionDisponibleResponse[]>([]);
  const [historial, setHistorial] = useState<HistorialWorkflowItemResponse[]>([]);
  const [pasosWorkflow, setPasosWorkflow] = useState<WorkflowPasoConfig[]>([]);
  const [expandedPasoId, setExpandedPasoId] = useState<number | null>(null);
  const [ocultarNoAplica, setOcultarNoAplica] = useState(false);
  const pasosContainerRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [isFirmarModalOpen, setIsFirmarModalOpen] = useState(false);
  const [isSubmittingFirma, setIsSubmittingFirma] = useState(false);
  const [accionSeleccionada, setAccionSeleccionada] = useState<AccionDisponibleResponse | null>(null);
  const [comentarioFirma, setComentarioFirma] = useState('');
  const [centroCosto, setCentroCosto] = useState('');
  const [cuentaContable, setCuentaContable] = useState('');
  const [requiereComprobacionPago, setRequiereComprobacionPago] = useState(true);
  const [requiereComprobacionGasto, setRequiereComprobacionGasto] = useState(true);

  const estados = useMemo(() => {
    const values = Array.from(new Set(ordenes.map(o => o.estado))).sort();
    return ['all', ...values];
  }, [ordenes]);

  const getEstadoLabel = (estado: string) => ESTADO_LABEL[estado] || estado;

  const fetchOrdenes = async () => {
    try {
      setLoading(true);
      const res = await API.get<ApiResponse<OrdenCompraResponse[]>>('/ordenes');
      const data = res.data.data || [];
      setOrdenes(data);
      if (data.length > 0 && selectedId == null) setSelectedId(data[0].idOrden);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar bandeja de órdenes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalle = async (idOrden: number) => {
    try {
      setLoadingDetail(true);
      const [ordenRes, accionesRes, historialRes] = await Promise.all([
        API.get<ApiResponse<OrdenCompraResponse>>(`/ordenes/${idOrden}`),
        API.get<ApiResponse<AccionDisponibleResponse[]>>(`/ordenes/${idOrden}/acciones`).catch(() => ({ data: { data: [] } })),
        API.get<ApiResponse<HistorialWorkflowItemResponse[]>>(`/ordenes/${idOrden}/historial-workflow`).catch(() => ({ data: { data: [] } })),
      ]);

      setSelectedOrden(ordenRes.data.data || null);
      setAcciones((accionesRes as any).data?.data || []);
      setHistorial((historialRes as any).data?.data || []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar detalle de orden');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchPasosWorkflow = async () => {
    try {
      const listRes = await API.get<ApiResponse<WorkflowListItem[]>>('/config/workflows');
      const workflows = listRes.data.data || [];
      const workflowOc = workflows.find(w => w.codigoProceso === 'ORDEN_COMPRA');
      if (!workflowOc) return;

      const detailRes = await API.get<ApiResponse<WorkflowConfigResponse>>(`/config/workflows/${workflowOc.idWorkflow}`);
      const pasos = (detailRes.data.data?.pasos || []).slice().sort((a, b) => a.orden - b.orden);
      setPasosWorkflow(pasos);
    } catch {
      setPasosWorkflow([]);
    }
  };

  useEffect(() => {
    fetchOrdenes();
    fetchPasosWorkflow();
  }, []);

  useEffect(() => {
    if (selectedId != null) fetchDetalle(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedOrden) return;
    setRequiereComprobacionPago(selectedOrden.requiereComprobacionPago);
    setRequiereComprobacionGasto(selectedOrden.requiereComprobacionGasto);
    setCentroCosto(selectedOrden.idCentroCosto ? String(selectedOrden.idCentroCosto) : '');
    setCuentaContable(selectedOrden.cuentaContable ? String(selectedOrden.cuentaContable) : '');
    setExpandedPasoId(selectedOrden.idPasoActual ?? null);
  }, [selectedOrden]);

  const abrirModalFirma = (accion: AccionDisponibleResponse) => {
    setAccionSeleccionada(accion);
    setComentarioFirma('');
    setIsFirmarModalOpen(true);
  };

  const cerrarModalFirma = () => {
    setIsFirmarModalOpen(false);
    setAccionSeleccionada(null);
    setComentarioFirma('');
  };

  const esFirma3 = selectedOrden?.idPasoActual === 3 || selectedOrden?.estado === 'EnRevisionF3';
  const esFirma4 = selectedOrden?.idPasoActual === 4 || selectedOrden?.estado === 'EnRevisionF4';
  const esRechazo = accionSeleccionada?.tipoAccion === 'RECHAZO';
  const esRetorno = accionSeleccionada?.tipoAccion === 'RETORNO';
  const colorAccion = esRechazo ? 'text-red-600' : esRetorno ? 'text-amber-600' : 'text-emerald-600';
  const bgAccion = esRechazo
    ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
    : esRetorno
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800';

  const enviarFirma = async () => {
    if (!selectedOrden || !accionSeleccionada) return;
    setIsSubmittingFirma(true);
    try {
      const datosAdicionales: Record<string, unknown> = {};

      if (esFirma3) {
        if (!centroCosto.trim()) {
          toast.error('Centro de costo requerido para Firma 3');
          setIsSubmittingFirma(false);
          return;
        }
        if (!cuentaContable.trim()) {
          toast.error('Cuenta contable requerida para Firma 3');
          setIsSubmittingFirma(false);
          return;
        }
        datosAdicionales.CentroCosto = Number(centroCosto);
        datosAdicionales.CuentaContable = cuentaContable.trim();
      }

      if (esFirma4) {
        datosAdicionales.RequiereComprobacionPago = requiereComprobacionPago;
        datosAdicionales.RequiereComprobacionGasto = requiereComprobacionGasto;
      }

      if ((esRechazo || esRetorno) && !comentarioFirma.trim()) {
        toast.error('Para rechazo o devolución el comentario es obligatorio');
        setIsSubmittingFirma(false);
        return;
      }

      await API.post(`/ordenes/${selectedOrden.idOrden}/firmar`, {
        idAccion: accionSeleccionada.idAccion,
        comentario: comentarioFirma || null,
        datosAdicionales: Object.keys(datosAdicionales).length > 0 ? datosAdicionales : null,
      });

      toast.success(`Acción "${accionSeleccionada.nombreAccion}" ejecutada correctamente`);
      cerrarModalFirma();
      await Promise.all([fetchOrdenes(), fetchDetalle(selectedOrden.idOrden)]);
    } catch (error: any) {
      toast.error(error?.message ?? 'No fue posible procesar la firma');
    } finally {
      setIsSubmittingFirma(false);
    }
  };

  const mostrarCamposFirma3 = esFirma3;
  const mostrarCamposFirma4 = esFirma4;
  const textoBotonConfirmar = accionSeleccionada
    ? `Confirmar ${accionSeleccionada.nombreAccion.toLowerCase()}`
    : 'Confirmar';

  const pasosMap = useMemo(
    () => new Map(pasosWorkflow.map(paso => [paso.idPaso, paso])),
    [pasosWorkflow]
  );

  const currentPasoOrden = useMemo(() => {
    if (!selectedOrden?.idPasoActual) return null;
    return pasosMap.get(selectedOrden.idPasoActual)?.orden ?? null;
  }, [selectedOrden?.idPasoActual, pasosMap]);

  const progresoPasos = useMemo(() => {
    if (!pasosWorkflow.length) return [];
    const pasosCompletados = new Set(historial.map(h => h.idPaso));
    const pasoActualConfig = selectedOrden?.idPasoActual ? pasosMap.get(selectedOrden.idPasoActual) : null;
    const flujoFinalizado = Boolean(pasoActualConfig?.esFinal);
    return pasosWorkflow.map(paso => {
      const isActual = selectedOrden?.idPasoActual === paso.idPaso;
      const isCompletado = !isActual && pasosCompletados.has(paso.idPaso);
      const isNoAplica = !isActual && !isCompletado && (
        (flujoFinalizado && paso.idPaso !== pasoActualConfig?.idPaso) ||
        (currentPasoOrden !== null && paso.orden < currentPasoOrden)
      );
      return {
        ...paso,
        estadoVisual: isActual
          ? 'actual'
          : isCompletado
            ? 'completado'
            : isNoAplica
              ? 'no_aplica'
              : 'pendiente' as 'actual' | 'completado' | 'pendiente' | 'no_aplica',
      };
    });
  }, [pasosWorkflow, historial, selectedOrden?.idPasoActual, currentPasoOrden, pasosMap]);

  const historialOrdenado = useMemo(
    () => [...historial].sort((a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()),
    [historial]
  );

  const eventosPorPaso = useMemo(() => {
    const map = new Map<number, HistorialWorkflowItemResponse[]>();
    for (const item of historialOrdenado) {
      const arr = map.get(item.idPaso) ?? [];
      arr.push(item);
      map.set(item.idPaso, arr);
    }
    return map;
  }, [historialOrdenado]);

  useEffect(() => {
    if (!selectedOrden?.idPasoActual) return;
    const container = pasosContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-paso-id="${selectedOrden.idPasoActual}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedOrden?.idPasoActual, progresoPasos.length]);

  const renderNombreAccion = (item: HistorialWorkflowItemResponse) => {
    const base = item.nombreAccion || `Acción ${item.idAccion}`;
    if (!item.datosSnapshot) return base;
    try {
      const snapshot = JSON.parse(item.datosSnapshot) as { idPasoAnterior?: number | null; idPasoNuevo?: number | null };
      const from = snapshot.idPasoAnterior ? pasosMap.get(snapshot.idPasoAnterior)?.nombrePaso : null;
      const to = snapshot.idPasoNuevo ? pasosMap.get(snapshot.idPasoNuevo)?.nombrePaso : null;
      if (from && to && from !== to) return `${base} · ${from} → ${to}`;
      return base;
    } catch {
      return base;
    }
  };

  const filtered = useMemo(() => {
    return ordenes.filter(o => {
      const matchEstado = estadoFilter === 'all' || o.estado === estadoFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q.length === 0 ||
        o.folio.toLowerCase().includes(q) ||
        o.razonSocialProveedor.toLowerCase().includes(q) ||
        (o.personaContacto || '').toLowerCase().includes(q);
      return matchEstado && matchSearch;
    });
  }, [ordenes, estadoFilter, search]);

  const columns: ColumnDef<OrdenCompraResponse>[] = [
    {
      accessorKey: 'folio',
      header: 'Folio',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.folio}</span>
          <span className="text-xs text-muted-foreground">{row.original.razonSocialProveedor}</span>
        </div>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Paso actual',
      cell: ({ row }) => (
        <Badge
          variant={ESTADO_BADGE[row.original.estado] || 'outline'}
          className={ESTADO_BADGE_CLASS[row.original.estado]}
        >
          {getEstadoLabel(row.original.estado)}
        </Badge>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Monto',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
        </span>
      ),
    },
    {
      accessorKey: 'fechaSolicitud',
      header: 'Fecha solicitud',
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.fechaSolicitud).toLocaleDateString('es-MX')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Acción',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedId(row.original.idOrden)}>
          Revisar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros de Bandeja</CardTitle>
              <CardDescription>Filtra por estado o búsqueda rápida</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative md:col-span-2">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por folio, proveedor o contacto"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
              >
                {estados.map(e => (
                  <option key={e} value={e}>{e === 'all' ? 'Todos los estados' : getEstadoLabel(e)}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={filtered}
            title="Órdenes pendientes para autorización"
            subtitle={`Total: ${filtered.length}`}
            pagination
            pageSize={10}
            globalFilter={false}
            showRefreshButton
            onRefresh={fetchOrdenes}
            filterConfig={{
              tableId: 'autorizaciones-oc',
              searchableColumns: ['folio', 'razonSocialProveedor', 'personaContacto'],
              defaultSearchColumns: ['folio'],
            }}
            onRowClick={(row) => setSelectedId((row as OrdenCompraResponse).idOrden)}
            height={460}
          />
        </div>

        <div className="xl:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Vista detalle de orden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingDetail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando detalle...
                </div>
              )}

              {!loadingDetail && !selectedOrden && (
                <p className="text-sm text-muted-foreground">Selecciona una orden para ver detalle.</p>
              )}

              {!loadingDetail && selectedOrden && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedOrden.folio}</p>
                      <p className="text-xs text-muted-foreground">{selectedOrden.razonSocialProveedor}</p>
                    </div>
                    <Badge
                      variant={ESTADO_BADGE[selectedOrden.estado] || 'outline'}
                      className={ESTADO_BADGE_CLASS[selectedOrden.estado]}
                    >
                      {getEstadoLabel(selectedOrden.estado)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Solicitud</p>
                      <p>{new Date(selectedOrden.fechaSolicitud).toLocaleDateString('es-MX')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Límite pago</p>
                      <p>{new Date(selectedOrden.fechaLimitePago).toLocaleDateString('es-MX')}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{selectedOrden.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Acciones disponibles</p>
                    <div className="flex flex-wrap gap-2">
                      {acciones.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No hay acciones disponibles para este usuario/paso.</p>
                      ) : acciones.map(a => (
                        <Button
                          key={a.idAccion}
                          size="sm"
                          variant={a.tipoAccion === 'RECHAZO' ? 'destructive' : 'default'}
                          onClick={() => abrirModalFirma(a)}
                        >
                          {a.nombreAccion}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <p className="text-sm font-medium">Flujo de pasos (inicio → fin)</p>
                    {progresoPasos.length > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Haz click en un paso para filtrar su historial</p>
                        <Button size="sm" variant="ghost" onClick={() => setOcultarNoAplica(v => !v)}>
                          {ocultarNoAplica ? 'Mostrar No aplica' : 'Ocultar No aplica'}
                        </Button>
                      </div>
                    )}
                    {progresoPasos.length > 0 && (
                      <div ref={pasosContainerRef} className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {progresoPasos
                          .filter(paso => !(ocultarNoAplica && paso.estadoVisual === 'no_aplica'))
                          .map((paso, index) => {
                          const isActual = paso.estadoVisual === 'actual';
                          const isCompletado = paso.estadoVisual === 'completado';
                          const isNoAplica = paso.estadoVisual === 'no_aplica';
                          const isExpanded = expandedPasoId === paso.idPaso;
                          const isActualRechazada = isActual && selectedOrden?.estado === 'Rechazada';
                          const isActualCancelada = isActual && selectedOrden?.estado === 'Cancelada';
                          const eventosPaso = eventosPorPaso.get(paso.idPaso) || [];
                          const ultimoEvento = eventosPaso[eventosPaso.length - 1];
                          const classes = isActual
                            ? isActualRechazada
                              ? 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
                              : isActualCancelada
                                ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-600'
                                : 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'
                            : isCompletado
                              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'
                              : isNoAplica
                                ? 'border-zinc-300 bg-zinc-100 dark:bg-zinc-900/40 dark:border-zinc-700 opacity-70'
                                : 'border-border/70 bg-muted/20 opacity-60';
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              key={paso.idPaso}
                              data-paso-id={paso.idPaso}
                              onClick={() => setExpandedPasoId(prev => (prev === paso.idPaso ? null : paso.idPaso))}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedPasoId(prev => (prev === paso.idPaso ? null : paso.idPaso)); }}
                              className={`w-full text-left rounded-md border p-3 transition cursor-pointer ${classes} ${isExpanded ? 'ring-2 ring-primary/40' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  <span className="text-xs font-semibold rounded-full border px-2 py-0.5">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm font-medium">{paso.nombrePaso}</span>
                                </div>
                                {isActual ? (
                                  <Badge variant={isActualRechazada ? 'destructive' : isActualCancelada ? 'outline' : 'secondary'}>
                                    {isActualRechazada ? 'Actual · Rechazada' : isActualCancelada ? 'Actual · Cancelada' : 'Actual'}
                                  </Badge>
                                ) : isCompletado ? (
                                  <Badge variant="default">Completado</Badge>
                                ) : isNoAplica ? (
                                  <Badge variant="outline">No aplica</Badge>
                                ) : (
                                  <Badge variant="outline">En espera</Badge>
                                )}
                              </div>
                              {paso.descripcionAyuda && (
                                <p className="text-xs text-muted-foreground mt-1">{paso.descripcionAyuda}</p>
                              )}
                              {eventosPaso.length > 0 && (
                                <p className="text-[11px] text-muted-foreground mt-2">
                                  {eventosPaso.length} evento(s) · Último: {renderNombreAccion(ultimoEvento)} ·{' '}
                                  {new Date(ultimoEvento.fechaEvento).toLocaleString('es-MX')}
                                </p>
                              )}
                              {isExpanded && (
                                <div className="mt-3 space-y-2">
                                  {eventosPaso.length === 0 && (
                                    <p className="text-xs text-muted-foreground rounded border bg-background p-2">
                                      Sin eventos en este paso.
                                    </p>
                                  )}
                                  {eventosPaso.map(item => (
                                    <div key={item.idEvento} className="rounded border bg-background p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-medium">{renderNombreAccion(item)}</p>
                                        <span className="text-[11px] text-muted-foreground">
                                          {new Date(item.fechaEvento).toLocaleString('es-MX')}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-1">
                                        {item.nombreUsuario || `Usuario ${item.idUsuario}`}
                                      </p>
                                      {item.comentario && (
                                        <p className="text-[11px] mt-1 rounded bg-muted/30 p-2">{item.comentario}</p>
                                      )}
                                    </div>
                                  ))}

                                  {isActual && (
                                    <div className="pt-2">
                                      <p className="text-xs font-semibold mb-2">Acciones en este paso</p>
                                      <div className="flex flex-wrap gap-2">
                                        {acciones.length === 0 ? (
                                          <p className="text-xs text-muted-foreground">No hay acciones disponibles para este usuario/paso.</p>
                                        ) : acciones.map(a => (
                                          <Button
                                            key={a.idAccion}
                                            size="sm"
                                            variant={a.tipoAccion === 'RECHAZO' ? 'destructive' : 'default'}
                                            onClick={(e) => { e.stopPropagation(); abrirModalFirma(a); }}
                                          >
                                            {a.nombreAccion}
                                          </Button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        id="modal-firmar-oc"
        open={isFirmarModalOpen}
        setOpen={(open) => {
          setIsFirmarModalOpen(open);
          if (!open) cerrarModalFirma();
        }}
        title={accionSeleccionada ? `${accionSeleccionada.nombreAccion} orden` : 'Procesar firma'}
        size="lg"
        footer={(
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={cerrarModalFirma} disabled={isSubmittingFirma}>
              Cancelar
            </Button>
            <Button
              onClick={enviarFirma}
              disabled={isSubmittingFirma}
              variant={esRechazo ? 'destructive' : 'default'}
            >
              {isSubmittingFirma && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {textoBotonConfirmar}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className={`rounded-md border p-3 ${bgAccion}`}>
            <p className={`text-sm font-semibold ${colorAccion}`}>{selectedOrden?.folio}</p>
            <p className="text-xs text-muted-foreground">
              Estado actual: {selectedOrden?.estado} {accionSeleccionada ? `• Acción: ${accionSeleccionada.nombreAccion}` : ''}
            </p>
            {(esRechazo || esRetorno) && (
              <p className="text-xs mt-2 text-muted-foreground">
                Esta acción impacta el flujo y requiere justificación en el comentario.
              </p>
            )}
          </div>

          {mostrarCamposFirma3 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Campos requeridos para Firma 3 (CxP)</h4>
              <div className="space-y-2">
                <Label htmlFor="cc">Centro de costo</Label>
                <Input
                  id="cc"
                  type="number"
                  value={centroCosto}
                  onChange={(e) => setCentroCosto(e.target.value)}
                  placeholder="Ej. 101"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuenta">Cuenta contable</Label>
                <Input
                  id="cuenta"
                  value={cuentaContable}
                  onChange={(e) => setCuentaContable(e.target.value)}
                  placeholder="Ej. 6001-02-001"
                />
              </div>
            </div>
          )}

          {mostrarCamposFirma4 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Validaciones de comprobación (Firma 4 - GAF)</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="check-comp-pago"
                  checked={requiereComprobacionPago}
                  onCheckedChange={(v) => setRequiereComprobacionPago(Boolean(v))}
                />
                <Label htmlFor="check-comp-pago">Requiere comprobación de pago</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="check-comp-gasto"
                  checked={requiereComprobacionGasto}
                  onCheckedChange={(v) => setRequiereComprobacionGasto(Boolean(v))}
                />
                <Label htmlFor="check-comp-gasto">Requiere comprobación de gasto</Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comentario-firma">Comentario</Label>
            <Textarea
              id="comentario-firma"
              value={comentarioFirma}
              onChange={(e) => setComentarioFirma(e.target.value)}
              placeholder={
                esRechazo
                  ? 'Motivo del rechazo (obligatorio)'
                  : esRetorno
                    ? 'Motivo de devolución/corrección (obligatorio)'
                    : 'Comentario de autorización (opcional)'
              }
              rows={4}
            />
            {(esRechazo || esRetorno) && (
              <p className="text-xs text-red-600">Comentario obligatorio para rechazo o devolución.</p>
            )}
            {!mostrarCamposFirma3 && !mostrarCamposFirma4 && !esRechazo && (
              <p className="text-xs text-muted-foreground">
                Esta acción no requiere campos adicionales para el estado actual ({selectedOrden?.estado}).
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

