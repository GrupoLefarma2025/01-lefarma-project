import { Fragment, useEffect, useMemo, useCallback, useRef, useState } from 'react';

import { createPortal } from 'react-dom';
import {useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { API } from '@/services/api';
import type { ApiResponse } from '@/types/api.types';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FileText,
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  Paperclip,
  Eye,
  Download,
  Clock,
  XCircle,
  AlertTriangle,
  UserRound,
  MessageSquare,
  MoveRight,
  Send,
  RotateCcw,
  Receipt,
  Upload,
  Pencil,
} from 'lucide-react';
import type { Archivo, ArchivoListItem } from '@/types/archivo.types';
import { FileUploader } from '@/components/archivos/FileUploader';
import { FileViewer } from '@/components/archivos/FileViewer';
import { archivoService } from '@/services/archivoService';
import { toast } from 'sonner';
import type { OrdenCompraResponse, OrdenCompraPartidaResponse } from '@/types/ordenCompra.types';
import type { PartidaPendienteResponse, ComprobanteResponse } from '@/types/comprobante.types';
import { comprobanteService } from '@/services/comprobanteService';
import { SubirComprobanteModal } from '@/components/facturas/SubirComprobanteModal';
import { SubirComprobantePagoModal } from '@/components/facturas/SubirComprobantePagoModal';
import { FlujoOrdenPDF } from '@/components/ordenes/FlujoOrdenPDF';
import type { ProgresoPasoPDF, HistorialPDFItem, PasoPDFConfig } from '@/components/ordenes/FlujoOrdenPDF';

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

interface WorkflowHandlerConfig {
  idHandler: number;
  handlerKey: string;
  requerido: boolean;
  configuracionJson?: string | null;
  ordenEjecucion: number;
  activo: boolean;
  idWorkflowCampo?: number | null;
  campo?: WorkflowCampoConfig | null;
}

interface WorkflowAccionConfig {
  idAccion: number;
  nombreAccion: string;
  tipoAccion: string;
  handlers: WorkflowHandlerConfig[];
}

interface WorkflowCampoConfig {
  idWorkflowCampo: number;
  nombreTecnico: string;
  etiquetaUsuario: string;
  tipoControl: string; // 'Texto' | 'Numero' | 'Booleano' | 'Checkbox' | 'Selector' | 'Fecha' | 'Archivo'
  sourceCatalog?: string | null;
  propiedadEntidad?: string | null;
  validarFiscal?: boolean;
  activo: boolean;
}

interface WorkflowPasoConfig {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  descripcionAyuda?: string | null;
  esInicio: boolean;
  esFinal: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
  acciones: WorkflowAccionConfig[];
}

interface WorkflowConfigResponse {
  idWorkflow: number;
  codigoProceso: string;
  pasos: WorkflowPasoConfig[];
  campos: WorkflowCampoConfig[];
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

type CampoFormItem = { campo: WorkflowCampoConfig; requerido: boolean; inputKey: string };

function getCamposParaAccion(accionConfig: WorkflowAccionConfig | null): CampoFormItem[] {
  if (!accionConfig) return [];
  const result: CampoFormItem[] = [];
  const seen = new Set<string>();

  const handlers = [...(accionConfig.handlers || [])]
    .filter((h) => h.activo)
    .sort((a, b) => a.ordenEjecucion - b.ordenEjecucion);

  for (const handler of handlers) {
    try {
      // Field: input/selector/checkbox — requerido viene del handler (valida Y guarda)
      if (handler.handlerKey === 'Field' && handler.campo) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({ campo: handler.campo, requerido: handler.requerido, inputKey });
        }
      }

      // Document: campo tipo Archivo (comprobante_pago, comprobante_gasto/factura)
      if (handler.handlerKey === 'Document' && handler.campo) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({ campo: handler.campo, requerido: handler.requerido, inputKey });
        }
      }
    } catch {
      /* handler sin campo o JSON inválido */
    }
  }
  return result;
}
export default function AutorizacionesOC() {
  usePageTitle('Autorizaciones OC', 'Bandeja de firmas y detalle de autorización');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idOrdenParam = searchParams.get('idOrden') ? Number(searchParams.get('idOrden')) : null;

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [ordenes, setOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(idOrdenParam);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompraResponse | null>(null);
  const [acciones, setAcciones] = useState<AccionDisponibleResponse[]>([]);
  const [historial, setHistorial] = useState<HistorialWorkflowItemResponse[]>([]);
  const [pasosWorkflow, setPasosWorkflow] = useState<WorkflowPasoConfig[]>([]);
  const [workflowCampos, setWorkflowCampos] = useState<WorkflowCampoConfig[]>([]);
  const [accionesConfig, setAccionesConfig] = useState<Map<number, WorkflowAccionConfig>>(
    new Map()
  );
  const [expandedPasoId, setExpandedPasoId] = useState<number | null>(null);
  const [expandedPartidaId, setExpandedPartidaId] = useState<number | null>(null);
  const pasosContainerRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [isFirmarModalOpen, setIsFirmarModalOpen] = useState(false);
  const [isSubmittingFirma, setIsSubmittingFirma] = useState(false);
  const [accionSeleccionada, setAccionSeleccionada] = useState<AccionDisponibleResponse | null>(
    null
  );
  const [comentarioFirma, setComentarioFirma] = useState('');
  // Dynamic campo values for the action modal (key = inputKey from handler config)
  const [camposValues, setCamposValues] = useState<Record<string, unknown>>({});
  const [catalogos, setCatalogos] = useState<Record<string, { value: string; label: string }[]>>(
    {}
  );
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  // File upload for DocumentRequired handlers
  const [archivoSubidos, setArchivoSubidos] = useState<Record<string, Archivo[]>>({});
  // Free-form adjuntos for steps with permite_adjunto=true
  const [adjuntosLibres, setAdjuntosLibres] = useState<Archivo[]>([]);
  // Archivos adjuntos de la orden seleccionada
  const [archivosOrden, setArchivosOrden] = useState<ArchivoListItem[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [viewerArchivoId, setViewerArchivoId] = useState<number | null>(null);

  // Facturación tab state
  const [partidasPendientes, setPartidasPendientes] = useState<PartidaPendienteResponse[]>([]);
  const [loadingFacturacion, setLoadingFacturacion] = useState(false);
  const [isSubirComprobanteOpen, setIsSubirComprobanteOpen] = useState(false);
  const [isSubirComprobantePagoOpen, setIsSubirComprobantePagoOpen] = useState<string | null>(null);

  // Comprobantes subidos en el flujo de firma (clave = nombreTecnico del campo, valor = lista porque puede haber varios)
  const [comprobantesWorkflow, setComprobantesWorkflow] = useState<Record<string, import('@/types/comprobante.types').ComprobanteResponse[]>>({});

  const estados = useMemo(() => {
    const values = Array.from(new Set(ordenes.map((o) => o.estado))).sort();
    return ['all', ...values];
  }, [ordenes]);

  const getEstadoLabel = (estado: string) => ESTADO_LABEL[estado] || estado;
  const formatCurrency = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  const fetchOrdenes = useCallback(async () => {
    try {
      const res = await API.get<ApiResponse<OrdenCompraResponse[]>>('/ordenes');
      const data = res.data.data || [];
      setOrdenes(data);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar bandeja de órdenes');
    }
  }, []);

  const fetchDetalle = async (idOrden: number) => {
    try {
      setLoadingDetail(true);
      const [ordenRes, accionesRes, historialRes] = await Promise.all([
        API.get<ApiResponse<OrdenCompraResponse>>(`/ordenes/${idOrden}`),
        API.get<ApiResponse<AccionDisponibleResponse[]>>(`/ordenes/${idOrden}/acciones`).catch(
          () => ({ data: { data: [] } })
        ),
        API.get<ApiResponse<HistorialWorkflowItemResponse[]>>(
          `/ordenes/${idOrden}/historial-workflow`
        ).catch(() => ({ data: { data: [] } })),
      ]);

      setSelectedOrden(ordenRes.data.data || null);
      setAcciones((accionesRes as any).data?.data || []);
      setHistorial((historialRes as any).data?.data || []);

      // Cargar archivos adjuntos de la orden
      fetchArchivosOrden(idOrden);
      fetchPartidasPendientes(idOrden);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar detalle de orden');
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchArchivosOrden = async (idOrden: number) => {
    try {
      setLoadingArchivos(true);
      const archivos = await archivoService.getAll({
        entidadTipo: 'OrdenCompra',
        entidadId: idOrden,
        soloActivos: true,
      });
      setArchivosOrden(archivos);
    } catch {
      setArchivosOrden([]);
    } finally {
      setLoadingArchivos(false);
    }
  };

  const fetchPartidasPendientes = async (idOrden: number) => {
    try {
      setLoadingFacturacion(true);
      const data = await comprobanteService.getPartidasPendientes(idOrden);
      setPartidasPendientes(data);
    } catch {
      setPartidasPendientes([]);
    } finally {
      setLoadingFacturacion(false);
    }
  };

  const fetchPasosWorkflow = async () => {
    try {
      const listRes = await API.get<ApiResponse<WorkflowListItem[]>>('/config/workflows');
      const workflows = listRes.data.data || [];
      const workflowOc = workflows.find((w) => w.codigoProceso === 'ORDEN_COMPRA');
      if (!workflowOc) return;

      const detailRes = await API.get<ApiResponse<WorkflowConfigResponse>>(
        `/config/workflows/${workflowOc.idWorkflow}`
      );
      const data = detailRes.data.data;
      if (!data) return;

      const pasos = (data.pasos || []).slice().sort((a, b) => a.orden - b.orden);
      setPasosWorkflow(pasos);
      setWorkflowCampos((data.campos || []).filter((c) => c.activo));

      // Build idAccion → WorkflowAccionConfig map for fast lookup
      const map = new Map<number, WorkflowAccionConfig>();
      for (const paso of pasos) {
        for (const accion of paso.acciones || []) {
          map.set(accion.idAccion, accion);
        }
      }
      setAccionesConfig(map);
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
    setExpandedPasoId(selectedOrden.idPasoActual ?? null);
    setExpandedPartidaId(selectedOrden.partidas[0]?.idPartida ?? null);
  }, [selectedOrden]);

  const abrirModalFirma = (accion: AccionDisponibleResponse) => {
    setAccionSeleccionada(accion);
    setComentarioFirma('');

    // Pre-populate campos with existing values from the order
    const accionCfg = accionesConfig.get(accion.idAccion) ?? null;
    const campos = getCamposParaAccion(accionCfg);
    const initialValues: Record<string, unknown> = {};
    if (selectedOrden) {
      const ordenAny = selectedOrden as unknown as Record<string, unknown>;
      // Convert snake_case nombreTecnico to camelCase for lookup in the TS response object
      const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      for (const { campo, inputKey } of campos) {
        const existing =
          ordenAny[campo.nombreTecnico] ?? ordenAny[snakeToCamel(campo.nombreTecnico)];
        if (existing !== undefined && existing !== null) {
          initialValues[inputKey] = existing;
        } else if (campo.tipoControl === 'Booleano' || campo.tipoControl === 'Checkbox') {
          initialValues[inputKey] = false;
        }
      }
    }
    setCamposValues(initialValues);
    setArchivoSubidos({});
    setAdjuntosLibres([]);

    // Fetch catalogs for Selector campos that aren't already loaded
    const selectorCampos = campos.filter(
      (c) => c.campo.tipoControl === 'Selector' && c.campo.sourceCatalog
    );
    if (selectorCampos.length > 0) {
      setLoadingCatalogos(true);
      const fetches = selectorCampos
        .filter((c) => !catalogos[c.campo.sourceCatalog!])
        .map(async ({ campo }) => {
          try {
            const res = await API.get<ApiResponse<Record<string, unknown>[]>>(campo.sourceCatalog!);
            const items = res.data.data || [];
            const LABEL_KEYS = ['nombre', 'name', 'etiqueta', 'label', 'titulo'];
            const normalized = items
              .map((item) => {
                // Find numeric id field (e.g. idCentroCosto, idArea, id, ...)
                const idKey = Object.keys(item).find(
                  (k) => /^id/i.test(k) && typeof item[k] === 'number'
                );
                // Special case: if item has 'cuenta' field, combine with descripcion
                const labelValue =
                  'cuenta' in item
                    ? `${item['cuenta']}${'descripcion' in item ? ` — ${item['descripcion']}` : ''}`
                    : (() => {
                        const labelKey =
                          Object.keys(item).find((k) => LABEL_KEYS.includes(k.toLowerCase())) ??
                          Object.keys(item).find((k) => k.toLowerCase() === 'descripcion');
                        return labelKey ? String(item[labelKey]) : '';
                      })();
                return {
                  value: idKey ? String(item[idKey]) : '',
                  label: labelValue,
                };
              })
              .filter((i) => i.value && i.label);
            setCatalogos((prev) => ({ ...prev, [campo.sourceCatalog!]: normalized }));
          } catch {
            /* silencio: campo quedará como texto libre */
          }
        });
      Promise.all(fetches).finally(() => setLoadingCatalogos(false));
    }

    setIsFirmarModalOpen(true);
  };

  const cerrarModalFirma = () => {
    // Limpiar archivos de comprobante_pago que quedaron subidos pero la firma fue cancelada
    const archivosParaEliminar = Object.values(archivoSubidos).flat();
    if (archivosParaEliminar.length > 0) {
      archivosParaEliminar.forEach((a) => {
        archivoService.delete(a.id).catch(() => {
          // silencioso — el archivo queda huérfano pero no bloquea el flujo
        });
      });
    }
    setIsFirmarModalOpen(false);
    setAccionSeleccionada(null);
    setComentarioFirma('');
    setArchivoSubidos({});
    setAdjuntosLibres([]);
    setComprobantesWorkflow({});
  };

  const esRechazo = accionSeleccionada?.tipoAccion === 'RECHAZO';
  const esRetorno = accionSeleccionada?.tipoAccion === 'RETORNO';
  const colorAccion = esRechazo
    ? 'text-red-600'
    : esRetorno
      ? 'text-amber-600'
      : 'text-emerald-600';
  const bgAccion = esRechazo
    ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
    : esRetorno
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800';

  // Dynamic campos for the modal based on the selected action's handlers
  const accionConfig = accionSeleccionada
    ? (accionesConfig.get(accionSeleccionada.idAccion) ?? null)
    : null;
  const camposParaAccion = useMemo(
    () => getCamposParaAccion(accionConfig),
    [accionConfig, workflowCampos]
  );

  const enviarFirma = async () => {
    if (!selectedOrden || !accionSeleccionada) return;
    setIsSubmittingFirma(true);
    try {
      const datosAdicionales: Record<string, unknown> = {};

      // Validate required campos and build datosAdicionales dynamically
      for (const { campo, requerido, inputKey } of camposParaAccion) {
        if (campo.tipoControl === 'Archivo') {
          if (requerido) {
            const tieneArchivo = !!archivoSubidos[inputKey]?.length;
            const tieneComprobante = (comprobantesWorkflow[inputKey]?.length ?? 0) > 0;
            if (!tieneArchivo && !tieneComprobante) {
              toast.error(`Debes adjuntar: ${campo.etiquetaUsuario}`);
              setIsSubmittingFirma(false);
              return;
            }
          }
          continue; // archivos/comprobantes no van en datosAdicionales (ya están en BD)
        }
        const val = camposValues[inputKey];
        const isEmpty = val === undefined || val === null || val === '';
        if (requerido && isEmpty) {
          toast.error(`${campo.etiquetaUsuario} es obligatorio`);
          setIsSubmittingFirma(false);
          return;
        }
        if (!isEmpty) datosAdicionales[inputKey] = val;
      }

      // Add content type from last uploaded file (for SmartAudit)
      const archivosList = Object.values(archivoSubidos).flat();
      if (archivosList.length > 0) {
        datosAdicionales['archivoContentType'] = archivosList[0].tipoMime;
      }

      if ((esRechazo || esRetorno) && !comentarioFirma.trim()) {
        toast.error('Para rechazo o devolución el comentario es obligatorio');
        setIsSubmittingFirma(false);
        return;
      }

      // Validate requiereAdjunto from paso config
      if (currentPaso?.requiereAdjunto && adjuntosLibres.length === 0) {
        toast.error('Debes adjuntar al menos un documento para esta acción');
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

  const textoBotonConfirmar = accionSeleccionada
    ? `Confirmar ${accionSeleccionada.nombreAccion.toLowerCase()}`
    : 'Confirmar';

  const pasosMap = useMemo(
    () => new Map(pasosWorkflow.map((paso) => [paso.idPaso, paso])),
    [pasosWorkflow]
  );

  const currentPasoOrden = useMemo(() => {
    if (!selectedOrden?.idPasoActual) return null;
    return pasosMap.get(selectedOrden.idPasoActual)?.orden ?? null;
  }, [selectedOrden?.idPasoActual, pasosMap]);

  // Current paso config — has permiteAdjunto / requiereAdjunto
  const currentPaso = useMemo(
    () => (selectedOrden?.idPasoActual != null ? (pasosMap.get(selectedOrden.idPasoActual) ?? null) : null),
    [selectedOrden?.idPasoActual, pasosMap]
  );

  const getTipoEvento = (item: HistorialWorkflowItemResponse) => {
    const actionName = (item.nombreAccion || '').toLowerCase();
    if (actionName.includes('rechaz')) return 'rechazo';
    if (actionName.includes('devol') || actionName.includes('retorn')) return 'retorno';
    if (
      actionName.includes('autor') ||
      actionName.includes('enviar') ||
      actionName.includes('marcar')
    )
      return 'aprobacion';
    return 'otro';
  };

  const progresoPasos = useMemo(() => {
    if (!pasosWorkflow.length) return [];
    const pasoActualConfig = selectedOrden?.idPasoActual
      ? pasosMap.get(selectedOrden.idPasoActual)
      : null;
    const flujoFinalizado = Boolean(pasoActualConfig?.esFinal);
    const eventosPorPasoLocal = new Map<number, HistorialWorkflowItemResponse[]>();
    for (const item of historial) {
      const arr = eventosPorPasoLocal.get(item.idPaso) ?? [];
      arr.push(item);
      eventosPorPasoLocal.set(item.idPaso, arr);
    }

    return pasosWorkflow.map((paso) => {
      const eventosPaso = eventosPorPasoLocal.get(paso.idPaso) || [];
      const ultimoEvento = eventosPaso[eventosPaso.length - 1];
      const tipoUltimoEvento = ultimoEvento ? getTipoEvento(ultimoEvento) : null;
      const isActual = selectedOrden?.idPasoActual === paso.idPaso;
      const isRechazado = !isActual && tipoUltimoEvento === 'rechazo';
      const isDevuelto = !isActual && tipoUltimoEvento === 'retorno';
      const isCompletado = !isActual && tipoUltimoEvento === 'aprobacion';
      const isOmitido =
        !isActual &&
        !isCompletado &&
        !isRechazado &&
        !isDevuelto &&
        ((flujoFinalizado && paso.idPaso !== pasoActualConfig?.idPaso) ||
          (currentPasoOrden !== null && paso.orden < currentPasoOrden));
      return {
        ...paso,
        estadoVisual: isActual
          ? 'actual'
          : isRechazado
            ? 'rechazado'
            : isDevuelto
              ? 'devuelto'
              : isCompletado
                ? 'completado'
                : isOmitido
                  ? 'omitido'
                  : ('pendiente' as
                      | 'actual'
                      | 'completado'
                      | 'pendiente'
                      | 'omitido'
                      | 'rechazado'
                      | 'devuelto'),
      };
    });
  }, [pasosWorkflow, historial, selectedOrden?.idPasoActual, currentPasoOrden, pasosMap]);

  const historialOrdenado = useMemo(
    () =>
      [...historial].sort(
        (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
      ),
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
    const target = container.querySelector(
      `[data-paso-id="${selectedOrden.idPasoActual}"]`
    ) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedOrden?.idPasoActual, progresoPasos.length]);

  const renderNombreAccion = (item: HistorialWorkflowItemResponse) => {
    return item.nombreAccion || `Acción ${item.idAccion}`;
  };

  const getEventoIcon = (nombreAccion: string | null | undefined) => {
    const n = (nombreAccion || '').toLowerCase();
    if (n.includes('aprob') || n.includes('autoriza'))
      return { Icon: CheckCircle2, color: 'text-emerald-500' };
    if (n.includes('rechaz'))
      return { Icon: XCircle, color: 'text-red-500' };
    if (n.includes('devuelv') || n.includes('retorn'))
      return { Icon: RotateCcw, color: 'text-amber-500' };
    if (n.includes('envi') || n.includes('firma'))
      return { Icon: Send, color: 'text-blue-500' };
    return { Icon: ChevronRight, color: 'text-muted-foreground' };
  };

  const renderMovimientoEvento = (item: HistorialWorkflowItemResponse) => {
    if (!item.datosSnapshot) return null;
    try {
      const snapshot = JSON.parse(item.datosSnapshot) as {
        idPasoAnterior?: number | null;
        idPasoNuevo?: number | null;
      };
      const from = snapshot.idPasoAnterior
        ? pasosMap.get(snapshot.idPasoAnterior)?.nombrePaso
        : null;
      const to = snapshot.idPasoNuevo ? pasosMap.get(snapshot.idPasoNuevo)?.nombrePaso : null;
      if (!from && !to) return null;
      if (from && to && from !== to) return `De ${from} a ${to}`;
      return to ? `Permanece en ${to}` : null;
    } catch {
      return null;
    }
  };

  const filtered = useMemo(() => {
    return ordenes.filter((o) => {
      const matchEstado = estadoFilter === 'all' || o.estado === estadoFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q.length === 0 ||
        o.folio.toLowerCase().includes(q);
      return matchEstado && matchSearch;
    });
  }, [ordenes, estadoFilter, search]);

  const columns: ColumnDef<OrdenCompraResponse>[] = useMemo(() => [
    {
      accessorKey: 'folio',
      header: 'Folio',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.folio}</span>
          <span className="text-xs text-muted-foreground">Proveedor #{row.original.idProveedor || 'N/A'}</span>
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
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => { e.stopPropagation(); setSelectedId(row.original.idOrden); }}
          >
            <Eye className="h-3.5 w-3.5" />
            Revisar
          </Button>
          {row.original.estado === 'Creada' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={(e) => { e.stopPropagation(); navigate(`/ordenes/editar/${row.original.idOrden}`); }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros de Bandeja</CardTitle>
              <CardDescription>Filtra por estado o búsqueda rápida</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                {estados.map((e) => (
                  <option key={e} value={e}>
                    {e === 'all' ? 'Todos los estados' : getEstadoLabel(e)}
                  </option>
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
              searchableColumns: ['folio'],
              defaultSearchColumns: ['folio'],
            }}
            onRowClick={(row) => setSelectedId((row as OrdenCompraResponse).idOrden)}
            isRowSelected={(row) => (row as OrdenCompraResponse).idOrden === selectedId}
            height={460}
          />
        </div>

        <div className="space-y-4 xl:col-span-7">
          <Card className="xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-6.5rem)] xl:max-h-[calc(100vh-6.5rem)] xl:min-h-[680px] xl:flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Detalle de orden de compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 xl:min-h-0 xl:flex-1">
              {loadingDetail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando detalle...
                </div>
              )}

              {!loadingDetail && !selectedOrden && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">Aquí se mostrará el detalle de la orden</p>
                  <p className="text-xs opacity-70">Selecciona una orden de la lista para ver su información</p>
                </div>
              )}

              {!loadingDetail && selectedOrden && (
                <>
                  <Tabs defaultValue="detalle" className="xl:flex xl:h-full xl:min-h-0 xl:flex-col">
                    <div className="bg-muted/20 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{selectedOrden.folio}</p>
                          <p className="text-xs text-muted-foreground">
                            Proveedor ID: {selectedOrden.idProveedor || 'Sin dato'}
                          </p>
                        </div>
                        <Badge
                          variant={ESTADO_BADGE[selectedOrden.estado] || 'outline'}
                          className={ESTADO_BADGE_CLASS[selectedOrden.estado]}
                        >
                          {getEstadoLabel(selectedOrden.estado)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">Subtotal</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(selectedOrden.subtotal)}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">Total</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(selectedOrden.total)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <TabsList className="bg-muted/70 mt-3 grid h-10 w-full grid-cols-4 border p-1">
                      <TabsTrigger
                        value="detalle"
                        className="border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                      >
                        Detalle completo
                      </TabsTrigger>
                      <TabsTrigger
                        value="autorizar"
                        className="border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                      >
                        Firmar
                      </TabsTrigger>
                      <TabsTrigger
                        value="facturacion"
                        className="hidden border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                        onClick={() => selectedOrden && fetchPartidasPendientes(selectedOrden.idOrden)}
                      >
                        Facturación
                        {partidasPendientes.some((p) => p.estadoFacturacion < 2) && (
                          <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                            {partidasPendientes.filter((p) => p.estadoFacturacion < 2).length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="archivos"
                        className="border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                      >
                        Archivos
                        {archivosOrden.length > 0 && (
                          <span className="bg-primary-foreground/20 ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none data-[state=active]:bg-white/20">
                            {archivosOrden.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="detalle"
                      className="mt-3 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                    >
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">ID Proveedor</p>
                          <p className="font-medium">{selectedOrden.idProveedor || 'Sin dato'}</p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Fiscales</p>
                          <p className="font-medium">
                            {selectedOrden.sinDatosFiscales ? 'Sin datos fiscales' : 'Con datos fiscales'}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Solicitud</p>
                          <p className="font-medium">
                            {new Date(selectedOrden.fechaSolicitud).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Límite pago</p>
                          <p className="font-medium">
                            {new Date(selectedOrden.fechaLimitePago).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Centro costo</p>
                          <p className="font-medium">
                            {selectedOrden.centroCostoNombre ||
                              (selectedOrden.idCentroCosto
                                ? `#${selectedOrden.idCentroCosto}`
                                : 'Sin dato')}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Cuenta contable</p>
                          <p className="font-medium">
                            {selectedOrden.cuentaContableNumero
                              ? `${selectedOrden.cuentaContableNumero}${selectedOrden.cuentaContableDescripcion ? ` — ${selectedOrden.cuentaContableDescripcion}` : ''}`
                              : 'Sin dato'}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Comprobación pago</p>
                          <p className="font-medium">
                            {selectedOrden.requiereComprobacionPago ? 'Sí' : 'No'}
                          </p>
                        </div>
                        <div className="rounded-md border bg-background px-2 py-1.5">
                          <p className="text-muted-foreground">Comprobación gasto</p>
                          <p className="font-medium">
                            {selectedOrden.requiereComprobacionGasto ? 'Sí' : 'No'}
                          </p>
                        </div>
                      </div>

                      {selectedOrden.notaFormaPago && (
                        <div className="rounded-md border bg-background px-3 py-2 text-xs">
                          <p className="text-muted-foreground">Nota forma de pago</p>
                          <p className="mt-1">{selectedOrden.notaFormaPago}</p>
                        </div>
                      )}

                      {selectedOrden.notasGenerales && (
                        <div className="rounded-md border bg-background px-3 py-2 text-xs">
                          <p className="text-muted-foreground">Notas generales</p>
                          <p className="mt-1">{selectedOrden.notasGenerales}</p>
                        </div>
                      )}

                      <div className="rounded-lg border">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                          <p className="text-sm font-medium">Partidas</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedOrden.partidas.length} elemento(s)
                          </p>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-background">
                              <tr className="border-b text-muted-foreground">
                                <th className="w-8 px-2 py-2 text-center font-medium"></th>
                                <th className="px-3 py-2 text-left font-medium">#</th>
                                <th className="px-3 py-2 text-left font-medium">Descripción</th>
                                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                                <th className="px-3 py-2 text-right font-medium">P. Unitario</th>
                                <th className="px-3 py-2 text-right font-medium">IVA</th>
                                <th className="px-3 py-2 text-right font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedOrden.partidas.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-3 py-3 text-center text-muted-foreground"
                                  >
                                    Sin partidas registradas.
                                  </td>
                                </tr>
                              )}
                              {selectedOrden.partidas.map((partida) => {
                                const isExpanded = expandedPartidaId === partida.idPartida;
                                const subtotalPartida = partida.cantidad * partida.precioUnitario;
                                const totalImpuestos =
                                  (subtotalPartida * partida.porcentajeIva) / 100;
                                return (
                                  <Fragment key={partida.idPartida}>
                                    <tr
                                      className="hover:bg-muted/30 cursor-pointer border-b"
                                      onClick={() =>
                                        setExpandedPartidaId((prev) =>
                                          prev === partida.idPartida ? null : partida.idPartida
                                        )
                                      }
                                    >
                                      <td className="px-2 py-2 text-center">
                                        {isExpanded ? (
                                          <ChevronDown className="inline h-3.5 w-3.5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="inline h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                      </td>
                                      <td className="px-3 py-2">{partida.numeroPartida}</td>
                                      <td className="px-3 py-2">
                                        <p className="font-medium">{partida.descripcion}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Deducible: {partida.deducible ? 'Sí' : 'No'}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2 text-right">{partida.cantidad}</td>
                                      <td className="px-3 py-2 text-right">
                                        {formatCurrency(partida.precioUnitario)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {partida.porcentajeIva}%
                                      </td>
                                      <td className="px-3 py-2 text-right font-semibold">
                                        {formatCurrency(partida.total)}
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr
                                        key={`${partida.idPartida}-detail`}
                                        className="bg-muted/20 border-b"
                                      >
                                        <td colSpan={7} className="px-3 py-2">
                                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">
                                                Unidad de medida (ID)
                                              </p>
                                              <p className="font-medium">
                                                {partida.idUnidadMedida}
                                              </p>
                                            </div>
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">
                                                Subtotal partida
                                              </p>
                                              <p className="font-medium">
                                                {formatCurrency(subtotalPartida)}
                                              </p>
                                            </div>
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">Descuento</p>
                                              <p className="font-medium">
                                                {formatCurrency(partida.descuento)}
                                              </p>
                                            </div>
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">IVA calculado</p>
                                              <p className="font-medium">
                                                {formatCurrency(totalImpuestos)}
                                              </p>
                                            </div>
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">Retenciones</p>
                                              <p className="font-medium">
                                                {formatCurrency(partida.totalRetenciones)}
                                              </p>
                                            </div>
                                            <div className="rounded border bg-background px-2 py-1.5">
                                              <p className="text-muted-foreground">
                                                Otros impuestos
                                              </p>
                                              <p className="font-medium">
                                                {formatCurrency(partida.otrosImpuestos)}
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="autorizar"
                      className="mt-3 space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Flujo de pasos (inicio → fin)</p>
                          {selectedOrden && progresoPasos.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => window.print()}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Exportar PDF
                            </Button>
                          )}
                        </div>
                        {progresoPasos.length > 0 && (() => {
                          return (
                          <div
                            ref={pasosContainerRef}
                            className="relative max-h-[32rem] overflow-y-auto pr-1"
                          >
                            {/* Línea vertical fija — cubre toda la altura */}
                            <div className="absolute left-[1.1rem] top-4 bottom-4 w-0.5 rounded-full bg-border/60" />

                            <div className="space-y-2">
                            {progresoPasos.map((paso, index) => {
                              const isActual = paso.estadoVisual === 'actual';
                              const isCompletado = paso.estadoVisual === 'completado';
                              const isOmitido = paso.estadoVisual === 'omitido';
                              const isRechazado = paso.estadoVisual === 'rechazado';
                              const isDevuelto = paso.estadoVisual === 'devuelto';
                              const isPendiente = !isActual && !isCompletado && !isOmitido && !isRechazado && !isDevuelto;
                              const isExpanded = expandedPasoId === paso.idPaso;
                              const isActualRechazada = isActual && selectedOrden?.estado === 'Rechazada';
                              const isActualCancelada = isActual && selectedOrden?.estado === 'Cancelada';
                              const eventosPaso = eventosPorPaso.get(paso.idPaso) || [];
                              const ultimoEvento = eventosPaso[eventosPaso.length - 1];

                              // Dot visual
                              const dotBg = isCompletado
                                ? 'bg-emerald-500 border-emerald-500'
                                : isActual
                                  ? isActualRechazada
                                    ? 'bg-red-500 border-red-500'
                                    : isActualCancelada
                                      ? 'bg-zinc-400 border-zinc-400'
                                      : 'bg-blue-500 border-blue-500'
                                  : isRechazado
                                    ? 'bg-red-400 border-red-400'
                                    : isDevuelto
                                      ? 'bg-amber-400 border-amber-400'
                                      : 'bg-background border-border';

                              const DotIcon = isCompletado
                                ? CheckCircle2
                                : isRechazado || isActualRechazada
                                  ? XCircle
                                  : isDevuelto
                                    ? AlertTriangle
                                    : isPendiente || isOmitido
                                      ? Clock
                                      : null;

                              // Card border/bg
                              const cardClass = isActual
                                ? isActualRechazada
                                  ? 'border-l-red-400 bg-red-50/60 dark:bg-red-950/15'
                                  : isActualCancelada
                                    ? 'border-l-zinc-400 bg-zinc-50/60 dark:bg-zinc-900/30'
                                    : 'border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/15'
                                : isCompletado
                                  ? 'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10'
                                  : isRechazado
                                    ? 'border-l-red-300 bg-red-50/40 dark:bg-red-950/10'
                                    : isDevuelto
                                      ? 'border-l-amber-300 bg-amber-50/40 dark:bg-amber-950/10'
                                      : 'border-l-border/50 opacity-60';

                              return (
                                <div key={paso.idPaso} className="relative pl-10">
                                  {/* Dot */}
                                  <div className={`absolute left-3 top-3 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 ${dotBg}`}
                                    style={{ width: '1.1rem', height: '1.1rem', left: '0.55rem' }}
                                  >
                                    {isActual && !isActualRechazada && !isActualCancelada ? (
                                      <span className="relative flex h-full w-full">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
                                        <span className="relative inline-flex h-full w-full rounded-full bg-blue-500" />
                                      </span>
                                    ) : DotIcon ? (
                                      <DotIcon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                                    ) : null}
                                  </div>

                                  {/* Card */}
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    data-paso-id={paso.idPaso}
                                    onClick={() => setExpandedPasoId(prev => prev === paso.idPaso ? null : paso.idPaso)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedPasoId(prev => prev === paso.idPaso ? null : paso.idPaso); } }}
                                    className={`w-full cursor-default rounded-lg border border-l-4 p-3 text-left transition-all hover:shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-primary/40 ${cardClass} ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                                          {index + 1}
                                        </span>
                                        <span className="truncate text-sm font-medium">{paso.nombrePaso}</span>
                                      </div>
                                      <div className="flex flex-shrink-0 items-center gap-1.5">
                                        {isActual ? (
                                          <Badge variant={isActualRechazada ? 'destructive' : isActualCancelada ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                            {isActualRechazada ? 'Rechazada' : isActualCancelada ? 'Cancelada' : '● Actual'}
                                          </Badge>
                                        ) : isCompletado ? (
                                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500 hover:bg-emerald-500">✓ Completado</Badge>
                                        ) : isRechazado ? (
                                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Rechazado</Badge>
                                        ) : isDevuelto ? (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">Devuelto</Badge>
                                        ) : isOmitido ? (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 opacity-60">Omitido</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">En espera</Badge>
                                        )}
                                        {isExpanded
                                          ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                          : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        }
                                      </div>
                                    </div>

                                    {paso.descripcionAyuda && !isExpanded && (
                                      <p className="mt-1 ml-7 text-[11px] text-muted-foreground truncate">{paso.descripcionAyuda}</p>
                                    )}
                                    {eventosPaso.length > 0 && !isExpanded && (
                                      <p className="mt-1 ml-7 text-[11px] text-muted-foreground">
                                        {eventosPaso.length} evento(s) · {renderNombreAccion(ultimoEvento)} · {new Date(ultimoEvento.fechaEvento).toLocaleString('es-MX')}
                                      </p>
                                    )}

                                    {isExpanded && (
                                      <div className="mt-3 ml-1 space-y-3" onClick={e => e.stopPropagation()}>
                                        {paso.descripcionAyuda && (
                                          <p className="text-xs text-muted-foreground">{paso.descripcionAyuda}</p>
                                        )}

                                        {/* Historial de actividad */}
                                        <div>
                                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Historial de actividad
                                          </p>
                                          {eventosPaso.length === 0 ? (
                                            <p className="rounded border bg-background/80 p-2 text-xs text-muted-foreground">Sin actividad registrada en este paso.</p>
                                          ) : (
                                            <div className="space-y-2">
                                            {eventosPaso.map((item) => {
                                              let transFrom: string | null = null;
                                              let transTo: string | null = null;
                                              if (item.datosSnapshot) {
                                                try {
                                                  const snap = JSON.parse(item.datosSnapshot) as {
                                                    idPasoAnterior?: number | null;
                                                    idPasoNuevo?: number | null;
                                                  };
                                                  transFrom = snap.idPasoAnterior
                                                    ? (pasosMap.get(snap.idPasoAnterior)?.nombrePaso ?? null)
                                                    : null;
                                                  transTo = snap.idPasoNuevo
                                                    ? (pasosMap.get(snap.idPasoNuevo)?.nombrePaso ?? null)
                                                    : null;
                                                } catch { /* ignore */ }
                                              }
                                              const showTrans = (transFrom || transTo) && transFrom !== transTo;

                                              return (
                                                <div key={item.idEvento} className="overflow-hidden rounded-lg border bg-background/80 text-xs">
                                                  {/* Fila: acción + fecha */}
                                                  <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
                                                    <span className="font-semibold truncate">
                                                      {item.nombreAccion || `Acción ${item.idAccion}`}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                                                      {new Date(item.fechaEvento).toLocaleString('es-MX')}
                                                    </span>
                                                  </div>
                                                  {/* Cuerpo con etiquetas */}
                                                  <div className="space-y-1 px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                      <span className="w-20 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Realizado por</span>
                                                      <div className="flex items-center gap-1 text-foreground/80">
                                                        <UserRound className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                                        <span>{item.nombreUsuario || `Usuario ${item.idUsuario}`}</span>
                                                      </div>
                                                    </div>
                                                    {showTrans && (
                                                      <div className="flex items-center gap-2">
                                                        <span className="w-20 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Movimiento</span>
                                                        <div className="flex items-center gap-1 text-foreground/80">
                                                          <MoveRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                                          <span>
                                                            {transFrom && (
                                                              <><span className="text-foreground/60">{transFrom}</span><span className="mx-1 text-muted-foreground">→</span></>
                                                            )}
                                                            <span className="font-medium">{transTo}</span>
                                                          </span>
                                                        </div>
                                                      </div>
                                                    )}
                                                    {item.comentario && (
                                                      <div className="mt-2 rounded-md border border-border/60 bg-muted/60 px-3 py-2.5 shadow-sm">
                                                        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Comentario</p>
                                                        <p className="text-[11px] leading-relaxed text-foreground/90 italic">{item.comentario}</p>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                            </div>
                                          )}
                                        </div>

                                        {/* Acciones disponibles */}
                                        {isActual && (
                                          <div className="border-t border-border/50 pt-3">
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                              Acciones disponibles
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {acciones.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No hay acciones disponibles.</p>
                                              ) : (
                                                acciones.map((a) => (
                                                  <Button
                                                    key={a.idAccion}
                                                    size="sm"
                                                    variant={a.tipoAccion === 'RECHAZO' ? 'destructive' : 'default'}
                                                    onClick={(e) => { e.stopPropagation(); abrirModalFirma(a); }}
                                                  >
                                                    {a.nombreAccion}
                                                  </Button>
                                                ))
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    </TabsContent>

                    {/* Tab: Facturación */}
                    <TabsContent
                      value="facturacion"
                      className="mt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                    >
                      <div className="space-y-3">
                        {/* Header del tab */}
                        <div>
                          <h3 className="text-sm font-semibold">Comprobantes de pago</h3>
                          <p className="text-muted-foreground text-xs">
                            Partidas de la orden y su estado de facturación
                          </p>
                        </div>

                        {loadingFacturacion ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                          </div>
                        ) : partidasPendientes.length === 0 ? (
                          <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
                            <Receipt className="h-8 w-8 opacity-30" />
                            <p>No hay partidas con requisito de facturación</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {partidasPendientes.map((partida) => {
                              const pctFacturado =
                                partida.cantidad > 0
                                  ? Math.min(
                                      100,
                                      (partida.cantidadFacturada / partida.cantidad) * 100
                                    )
                                  : 0;
                              const estadoConfig = {
                                0: {
                                  label: 'Pendiente',
                                  className: 'bg-amber-100 text-amber-700 border-amber-200',
                                  barColor: 'bg-amber-400',
                                },
                                1: {
                                  label: 'Parcial',
                                  className: 'bg-blue-100 text-blue-700 border-blue-200',
                                  barColor: 'bg-blue-400',
                                },
                                2: {
                                  label: 'Completa',
                                  className: 'bg-green-100 text-green-700 border-green-200',
                                  barColor: 'bg-green-500',
                                },
                              }[partida.estadoFacturacion] ?? {
                                label: 'Desconocido',
                                className: 'bg-muted text-muted-foreground border-muted',
                                barColor: 'bg-muted',
                              };

                              return (
                                <div
                                  key={partida.idPartida}
                                  className="bg-card rounded-lg border p-3 shadow-sm"
                                >
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs font-mono">
                                          #{partida.numeroPartida}
                                        </span>
                                        <p className="truncate text-sm font-medium">
                                          {partida.descripcionPartida}
                                        </p>
                                      </div>
                                      <p className="text-muted-foreground mt-0.5 text-xs">
                                        {partida.folioOrden}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estadoConfig.className}`}
                                    >
                                      {estadoConfig.label}
                                    </span>
                                  </div>

                                  {/* Barra de progreso */}
                                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full transition-all ${estadoConfig.barColor}`}
                                      style={{ width: `${pctFacturado}%` }}
                                    />
                                  </div>

                                  {/* Cantidades */}
                                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                                    <span>
                                      {partida.cantidadFacturada} / {partida.cantidad} unidades
                                    </span>
                                    <span>
                                      ${partida.importeFacturado.toLocaleString('es-MX', { minimumFractionDigits: 2 })} /{' '}
                                      ${(partida.cantidad * partida.precioUnitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>

                                  {partida.cantidadPendiente > 0 && (
                                    <p className="mt-1 text-[10px] text-amber-600">
                                      Pendiente: {partida.cantidadPendiente} unidades · $
                                      {partida.importePendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </TabsContent>

                    {/* Tab: Archivos adjuntos */}
                    <TabsContent
                      value="archivos"
                      className="mt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                    >
                      {(() => {
                        // ── helpers locales ────────────────────────────────
                        const parseMetaArchivo = (meta: unknown): {
                          modulo?: string; origen?: string; tipo?: string; observaciones?: string;
                          paso?: string; nombrePaso?: string; nombreAccion?: string;
                          monto?: number; idComprobante?: number; subtipo?: string; archivo?: string;
                        } => {
                          if (!meta) return {};
                          if (typeof meta === 'string') {
                            try { return JSON.parse(meta); } catch { return { observaciones: meta }; }
                          }
                          if (typeof meta === 'object') return meta as ReturnType<typeof parseMetaArchivo>;
                          return {};
                        };

                        const fmtSize = (b: number) =>
                          b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

                        const EXT_BADGE: Record<string, string> = {
                          pdf:  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
                          xlsx: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                          xls:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                          docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                          doc:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                          png:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                          jpg:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                          jpeg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                          webp: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                          gif:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                        };

                        const TIPO_BADGE: Record<string, string> = {
                          comprobante:       'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                          comprobante_pago:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                          comprobante_gasto: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                          factura:           'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                          contrato:          'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
                          cotizacion:        'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
                          autorizacion:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                        };

                        const tipoBadgeClass = (tipo?: string) =>
                          tipo ? (TIPO_BADGE[tipo.toLowerCase()] ?? 'bg-primary/10 text-primary') : '';

                        // ── agrupar por paso/origen ───────────────────────
                        type Grupo = { paso: string | null; nombrePaso?: string; origen?: string; items: typeof archivosOrden };
                        const grupos: Grupo[] = [];
                        const pasoMap = new Map<string, typeof archivosOrden>();
                        const pasoNombreMap = new Map<string, string>();
                        const pasoOrigenMap = new Map<string, string>();

                        archivosOrden.forEach((a) => {
                          const { paso, nombrePaso, origen } = parseMetaArchivo(a.metadata);
                          // Archivos de creación van a un grupo especial '__creacion__'
                          const key = origen === 'creacion' ? '__creacion__' : (paso ?? '__general__');
                          if (!pasoMap.has(key)) pasoMap.set(key, []);
                          pasoMap.get(key)!.push(a);
                          if (nombrePaso && !pasoNombreMap.has(key)) pasoNombreMap.set(key, nombrePaso);
                          if (origen && !pasoOrigenMap.has(key)) pasoOrigenMap.set(key, origen);
                        });

                        // Orden: pasos numéricos → creación → general
                        const keys = Array.from(pasoMap.keys()).sort((a, b) => {
                          if (a === '__general__') return 1;
                          if (b === '__general__') return -1;
                          if (a === '__creacion__') return 1;
                          if (b === '__creacion__') return -1;
                          return Number(a) - Number(b);
                        });
                        keys.forEach((k) => grupos.push({
                          paso: k === '__general__' || k === '__creacion__' ? null : k,
                          nombrePaso: pasoNombreMap.get(k),
                          origen: pasoOrigenMap.get(k) ?? (k === '__creacion__' ? 'creacion' : undefined),
                          items: pasoMap.get(k)!,
                        }));

                        return (
                          <div className="space-y-2">
                            {/* Encabezado */}
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Documentos adjuntos
                                {archivosOrden.length > 0 && (
                                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] normal-case font-medium">
                                    {archivosOrden.length}
                                  </span>
                                )}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => fetchArchivosOrden(selectedOrden.idOrden)}
                                disabled={loadingArchivos}
                              >
                                {loadingArchivos ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                              </Button>
                            </div>

                            {/* Loading */}
                            {loadingArchivos ? (
                              <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                <span className="text-sm">Cargando archivos...</span>
                              </div>
                            ) : archivosOrden.length === 0 ? (
                              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
                                <Paperclip className="mb-2 h-8 w-8 opacity-30" />
                                <p className="text-sm">Sin archivos adjuntos</p>
                                <p className="mt-1 text-xs opacity-70">
                                  Los documentos subidos en el flujo aparecerán aquí
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {grupos.map(({ paso, nombrePaso, origen, items }) => (
                                  <div key={paso ?? origen ?? 'general'}>
                                    {/* Separador de grupo */}
                                    <div className="mb-1.5 flex items-center gap-2">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                                        {paso
                                          ? `Paso ${paso}`
                                          : origen === 'creacion'
                                          ? 'Creación de orden'
                                          : 'General'}
                                      </span>
                                      {nombrePaso && (
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          — {nombrePaso}
                                        </span>
                                      )}
                                      <div className="h-px flex-1 bg-border" />
                                      <span className="text-[10px] text-muted-foreground shrink-0">{items.length}</span>
                                    </div>

                                    {/* Archivos del grupo */}
                                    <div className="space-y-1">
                                       {items.map((archivo) => {
                                        const meta = parseMetaArchivo(archivo.metadata);
                                        const ext = archivo.extension?.toLowerCase().replace('.', '') ?? '';
                                        // Label: para comprobantes usar subtipo + tipo de archivo
                                        const esComprobante = meta.tipo === 'comprobante_pago' || meta.tipo === 'comprobante_gasto';
                                        let tipoLabel: string | undefined;
                                        if (esComprobante) {
                                          const subLabel = meta.subtipo ? meta.subtipo.toUpperCase() : '';
                                          const archLabel = meta.archivo === 'xml' ? 'XML' : meta.archivo === 'pdf' ? 'PDF' : '';
                                          tipoLabel = [subLabel, archLabel].filter(Boolean).join(' · ') || (meta.tipo === 'comprobante_pago' ? 'Pago' : 'Gasto');
                                        } else {
                                          tipoLabel = meta.observaciones ?? meta.tipo;
                                        }

                                        return (
                                          <div
                                            key={archivo.id}
                                            className="group flex items-start gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
                                          >
                                            {/* Badge extensión */}
                                            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${EXT_BADGE[ext] ?? 'bg-muted text-muted-foreground'}`}>
                                              {ext || '?'}
                                            </span>

                                            {/* Contenido */}
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                              <p className="truncate font-medium leading-tight" title={archivo.nombreOriginal}>
                                                {archivo.nombreOriginal}
                                              </p>
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                {tipoLabel && (
                                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tipoBadgeClass(meta.tipo)}`}>
                                                    {tipoLabel}
                                                  </span>
                                                )}
                                                {/* Monto del comprobante */}
                                                {esComprobante && meta.monto != null && (
                                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {(meta.monto as number).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                                  </span>
                                                )}
                                                <span className="text-muted-foreground">{fmtSize(archivo.tamanoBytes)}</span>
                                                <span className="text-muted-foreground/40">·</span>
                                                <span className="text-muted-foreground">
                                                  {new Date(archivo.fechaCreacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                              </div>
                                              {meta.nombreAccion && (
                                                <p className="text-[10px] text-muted-foreground/60 leading-tight">
                                                  {meta.nombreAccion}
                                                </p>
                                              )}
                                            </div>

                                            {/* Acciones */}
                                            <div className="flex shrink-0 items-center gap-0.5">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                title="Ver documento"
                                                onClick={() => setViewerArchivoId(archivo.id)}
                                              >
                                                <Eye className="h-3.5 w-3.5" />
                                              </Button>
                                              <a
                                                href={archivoService.getDownloadUrl(archivo.id)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Descargar"
                                              >
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                                  <Download className="h-3.5 w-3.5" />
                                                </Button>
                                              </a>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TabsContent>
                  </Tabs>
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
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={cerrarModalFirma} disabled={isSubmittingFirma}>
              Cancelar
            </Button>
            <Button
              onClick={enviarFirma}
              disabled={isSubmittingFirma}
              variant={esRechazo ? 'destructive' : 'default'}
            >
              {isSubmittingFirma && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {textoBotonConfirmar}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className={`rounded-md border p-3 ${bgAccion}`}>
            <p className={`text-sm font-semibold ${colorAccion}`}>{selectedOrden?.folio}</p>
            <p className="text-xs text-muted-foreground">
              Estado actual: {selectedOrden?.estado}{' '}
              {accionSeleccionada ? `• Acción: ${accionSeleccionada.nombreAccion}` : ''}
            </p>
            {(esRechazo || esRetorno) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Esta acción impacta el flujo y requiere justificación en el comentario.
              </p>
            )}
          </div>

          {/* Dynamic campos based on action handlers */}
          {camposParaAccion.length > 0 && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                Información requerida
                {loadingCatalogos && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </h4>
              {camposParaAccion.map(({ campo, requerido, inputKey }) => {
                const fieldId = `campo-${inputKey}`;
                const value = camposValues[inputKey];

                if (campo.tipoControl === 'Booleano' || campo.tipoControl === 'Checkbox') {
                  return (
                    <div key={inputKey} className="flex items-center gap-2">
                      <Checkbox
                        id={fieldId}
                        checked={Boolean(value)}
                        onCheckedChange={(v) =>
                          setCamposValues((prev) => ({ ...prev, [inputKey]: Boolean(v) }))
                        }
                      />
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                    </div>
                  );
                }

                if (campo.tipoControl === 'Selector' && campo.sourceCatalog) {
                  const options = catalogos[campo.sourceCatalog] || [];
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      {options.length > 0 ? (
                        <Select
                          value={String(value ?? '')}
                          onValueChange={(v) =>
                            setCamposValues((prev) => ({ ...prev, [inputKey]: v }))
                          }
                        >
                          <SelectTrigger id={fieldId}>
                            <SelectValue
                              placeholder={`Seleccionar ${campo.etiquetaUsuario.toLowerCase()}...`}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={fieldId}
                          value={String(value ?? '')}
                          onChange={(e) =>
                            setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                          }
                          placeholder={
                            loadingCatalogos ? 'Cargando opciones...' : campo.etiquetaUsuario
                          }
                          disabled={loadingCatalogos}
                        />
                      )}
                    </div>
                  );
                }

                if (campo.tipoControl === 'Numero') {
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <Input
                        id={fieldId}
                        type="number"
                        value={String(value ?? '')}
                        onChange={(e) =>
                          setCamposValues((prev) => ({
                            ...prev,
                            [inputKey]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                        placeholder={`Ingresa ${campo.etiquetaUsuario.toLowerCase()}`}
                      />
                    </div>
                  );
                }

                if (campo.tipoControl === 'Fecha') {
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <Input
                        id={fieldId}
                        type="date"
                        value={String(value ?? '')}
                        onChange={(e) =>
                          setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                        }
                      />
                    </div>
                  );
                }

                // Archivo (DocumentRequired) — inline uploader dentro del modal
                if (campo.tipoControl === 'Archivo') {

                  // ── comprobante_gasto → flujo CFDI con SubirComprobanteModal ──────
                  if (campo.nombreTecnico === 'comprobante_gasto') {
                    const comprobantesGasto = comprobantesWorkflow['comprobante_gasto'] ?? [];
                    return (
                      <div key={inputKey} className="space-y-1.5">
                        <Label>
                          {campo.etiquetaUsuario}
                          {requerido && <span className="ml-1 text-red-500">*</span>}
                        </Label>

                        {/* Lista de comprobantes ya registrados */}
                        {comprobantesGasto.length > 0 && (
                          <div className="space-y-1.5">
                            {comprobantesGasto.map((cg, idx) => (
                              <div key={cg.idComprobante} className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs dark:bg-green-950/20">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-green-700 dark:text-green-400 truncate">
                                    {cg.nombreEmisor ?? 'Factura CFDI'}
                                  </p>
                                  <p className="text-green-600/80 dark:text-green-500/80">
                                    {cg.uuidCfdi ? `UUID: ${cg.uuidCfdi.slice(0, 8)}…` : 'Sin UUID'}
                                    {' · '}
                                    ${cg.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  title="Quitar"
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() =>
                                    setComprobantesWorkflow((prev) => ({
                                      ...prev,
                                      comprobante_gasto: (prev['comprobante_gasto'] ?? []).filter((_, i) => i !== idx),
                                    }))
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Botón agregar */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 border-dashed"
                          onClick={() => setIsSubirComprobanteOpen(true)}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          {comprobantesGasto.length > 0 ? 'Agregar otra factura CFDI' : 'Subir Factura CFDI (XML + PDF)'}
                        </Button>
                      </div>
                    );
                  }

                  // ── comprobante_pago → modal SubirComprobantePagoModal ─────────
                  const comprobantesP = comprobantesWorkflow[inputKey] ?? [];
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>

                      {/* Lista de comprobantes ya registrados */}
                      {comprobantesP.length > 0 && (
                        <div className="space-y-1.5">
                          {comprobantesP.map((cp, idx) => (
                            <div key={cp.idComprobante} className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs dark:bg-green-950/20">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium text-green-700 dark:text-green-400">
                                  {cp.tipoComprobante?.toUpperCase()} — {
                                    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cp.total)
                                  }
                                </p>
                                {cp.referenciaPago && (
                                  <p className="text-muted-foreground">Ref: {cp.referenciaPago}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Quitar"
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() =>
                                  setComprobantesWorkflow((prev) => ({
                                    ...prev,
                                    [inputKey]: (prev[inputKey] ?? []).filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botón para agregar */}
                      <button
                        type="button"
                        onClick={() => setIsSubirComprobantePagoOpen(inputKey)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:border-primary hover:bg-muted/30"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                        <span>{comprobantesP.length > 0 ? 'Agregar otro pago' : 'Registrar comprobante de pago'}</span>
                      </button>
                    </div>
                  );
                }

                // Default: Texto
                return (
                  <div key={inputKey} className="space-y-1.5">
                    <Label htmlFor={fieldId}>
                      {campo.etiquetaUsuario}
                      {requerido && <span className="ml-1 text-red-500">*</span>}
                    </Label>
                    <Input
                      id={fieldId}
                      value={String(value ?? '')}
                      onChange={(e) =>
                        setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                      }
                      placeholder={`Ingresa ${campo.etiquetaUsuario.toLowerCase()}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="comentario-firma">
                Comentario
                {(esRechazo || esRetorno || currentPaso?.requiereComentario) && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </Label>
              {!esRechazo && !esRetorno && !currentPaso?.requiereComentario && (
                <span className="text-xs text-muted-foreground">Opcional</span>
              )}
            </div>
            <Textarea
              id="comentario-firma"
              value={comentarioFirma}
              onChange={(e) => setComentarioFirma(e.target.value)}
              placeholder={
                esRechazo
                  ? 'Explica el motivo del rechazo'
                  : esRetorno
                    ? 'Explica el motivo de la devolución'
                    : 'Escribe un comentario'
              }
              rows={4}
            />
            {(esRechazo || esRetorno) && (
              <p className="text-xs text-red-600">
                El comentario es obligatorio para esta acción.
              </p>
            )}
          </div>

          {/* Adjunto libre — visible when paso allows free attachments */}
          {currentPaso?.permiteAdjunto && selectedOrden && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Documentos adjuntos
                  {currentPaso.requiereAdjunto && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                  {adjuntosLibres.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({adjuntosLibres.length}/5)
                    </span>
                  )}
                </Label>
                {!currentPaso.requiereAdjunto && (
                  <span className="text-xs text-muted-foreground">Opcional</span>
                )}
              </div>

              {/* List of already-uploaded free adjuntos */}
              {adjuntosLibres.length > 0 && (
                <div className="space-y-1.5">
                  {adjuntosLibres.map((archivo) => (
                    <div
                      key={archivo.id}
                      className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-950/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                      <span className="flex-1 truncate text-green-800 dark:text-green-300">
                        {archivo.nombreOriginal}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdjuntosLibres((prev) => prev.filter((a) => a.id !== archivo.id))}
                        className="text-green-600 hover:text-red-500 dark:text-green-400 dark:hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Uploader — shown while under limit */}
              {adjuntosLibres.length < 5 && (
                <FileUploader
                  inline
                  open={true}
                  multiple
                  cantidadMaxima={5 - adjuntosLibres.length}
                  entidadTipo="OrdenCompra"
                  entidadId={selectedOrden.idOrden}
                  carpeta="ordenes-compra"
                  metadata={{
                    modulo: 'ordenes_compra',
                    origen: 'workflow',
                    tipo: 'adjunto_libre',
                    paso: selectedOrden.idPasoActual ?? undefined,
                    nombrePaso: currentPaso?.nombrePaso ?? undefined,
                    nombreAccion: accionSeleccionada?.nombreAccion ?? undefined,
                  }}
                  tiposPermitidos={['.pdf', '.xml', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']}
                  descripcion="Arrastra o selecciona documentos de soporte"
                  onUploadComplete={(nuevos) => {
                    if (nuevos.length > 0) {
                      setAdjuntosLibres((prev) => [...prev, ...nuevos].slice(0, 5));
                    }
                  }}
                  onClose={() => {}}
                />
              )}

              {adjuntosLibres.length >= 5 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Límite de 5 documentos alcanzado.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal CFDI gasto — fuera del modal de firma para evitar Dialog anidado ─────── */}
      {selectedOrden && (
        <SubirComprobanteModal
          open={isSubirComprobanteOpen}
          onClose={() => setIsSubirComprobanteOpen(false)}
          idEmpresa={selectedOrden.idEmpresa}
          idOrden={selectedOrden.idOrden}
          idPasoWorkflow={selectedOrden.idPasoActual ?? undefined}
          nombrePaso={
            selectedOrden.idPasoActual != null
              ? (pasosMap.get(selectedOrden.idPasoActual)?.nombrePaso ?? null)
              : null
          }
          nombreAccion={accionSeleccionada?.nombreAccion ?? null}
          partidasPendientes={partidasPendientes}
          onComprobanteSubido={(c) => {
            setComprobantesWorkflow((prev) => ({
              ...prev,
              comprobante_gasto: [...(prev['comprobante_gasto'] ?? []), c],
            }));
            setIsSubirComprobanteOpen(false);
            fetchPartidasPendientes(selectedOrden.idOrden);
          }}
        />
      )}

      {/* ── Modal comprobante pago — fuera del modal de firma para evitar Dialog anidado ─ */}
      {selectedOrden && isSubirComprobantePagoOpen && (
        <SubirComprobantePagoModal
          open={!!isSubirComprobantePagoOpen}
          onClose={() => setIsSubirComprobantePagoOpen(null)}
          idEmpresa={selectedOrden.idEmpresa}
          idOrden={selectedOrden.idOrden}
          idPasoWorkflow={selectedOrden.idPasoActual ?? null}
          nombrePaso={
            selectedOrden.idPasoActual != null
              ? (pasosMap.get(selectedOrden.idPasoActual)?.nombrePaso ?? null)
              : null
          }
          nombreAccion={accionSeleccionada?.nombreAccion ?? null}
          totalOrden={selectedOrden.total}
          folioOrden={selectedOrden.folio}
          totalPagado={(comprobantesWorkflow[isSubirComprobantePagoOpen] ?? []).reduce((sum, c) => sum + c.total, 0)}
          partidasPendientes={partidasPendientes}
          onComprobanteSubido={(c) => {
            const key = isSubirComprobantePagoOpen;
            setComprobantesWorkflow((prev) => ({
              ...prev,
              [key]: [...(prev[key] ?? []), c],
            }));
            setIsSubirComprobantePagoOpen(null);
            fetchPartidasPendientes(selectedOrden.idOrden);
            fetchArchivosOrden(selectedOrden.idOrden);
          }}
        />
      )}

      {/* FileViewer para previsualizar archivos adjuntos */}
      {viewerArchivoId !== null && (
        <FileViewer
          archivoId={viewerArchivoId}
          open={viewerArchivoId !== null}
          onClose={() => setViewerArchivoId(null)}
        />
      )}

      {/* ── PDF Print Document — mounted on body via portal, invisible on screen, visible on print ── */}
      {selectedOrden && progresoPasos.length > 0 && createPortal(
        <FlujoOrdenPDF
          orden={selectedOrden}
          progresoPasos={progresoPasos as ProgresoPasoPDF[]}
          eventosPorPaso={eventosPorPaso as Map<number, HistorialPDFItem[]>}
          pasosMap={pasosMap as Map<number, PasoPDFConfig>}
        />,
        document.body
      )}

    </div>
  );
}
