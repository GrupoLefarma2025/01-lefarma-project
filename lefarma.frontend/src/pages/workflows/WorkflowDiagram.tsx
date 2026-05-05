import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { 
  Workflow as WorkflowIcon, 
  ArrowLeft, 
  Loader2,
  GitBranch,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Settings,
  Users,
  Bell,
  Filter,
  Wrench,
  Plus,
  Pencil,
  Trash2,
  Info,
  Mail,
  Clock,
  FlaskConical,
  MapPin,
  Zap,
  ListChecks,
  PenLine,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import type { Workflow, WorkflowPaso, WorkflowAccion, WorkflowAccionHandler, WorkflowCampo, WorkflowScopeType, WorkflowMapping, WorkflowEstado, WorkflowTipoAccion } from '@/types/workflow.types';
import { toApiError } from '@/utils/errors';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
  campos?: WorkflowCampo[];
}

interface CreatePasoPayload {
  nombrePaso: string;
  orden: number;
  idEstado: number | null;
  descripcionAyuda: string | null;
  esInicio: boolean;
  esFinal: boolean;
  activo: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
}

// Tipos de acciones para los colores
const ACTION_COLORS: Record<string, string> = {
  ENVIAR: '#10b981',     // green soft
  AUTORIZAR: '#008500',       // green
  RECHAZAR: '#ef4444',      // red
  DEVOLVER: '#f59e0b',      // amber
  CANCELAR: '#6b7280',      // gray
  ENVIAR_TESORERIA: '#3b82f6', // blue
  MARCAR_PAGADA: '#059669',    // teal
  CERRAR: '#64748b',           // slate
  NOTIFICACION: '#8b5cf6'      // violet
};

const HANDLER_LABELS: Record<string, string> = {
  RequiredFields:   'Campos requeridos',
  FieldUpdater:     'Actualizar campo',
  DocumentRequired: 'Documento requerido',
};

const HANDLER_DESCRIPTIONS: Record<string, string> = {
  RequiredFields:   'Obliga al usuario a completar ciertos campos antes de ejecutar la acción',
  FieldUpdater:     'Modifica automáticamente un campo de la orden al ejecutar la acción',
  DocumentRequired: 'Exige adjuntar un documento específico para continuar',
};

const HANDLER_CONFIGS: Record<string, { icon: any; color: string; borderColor: string }> = {
  RequiredFields:   { icon: ListChecks, color: 'bg-amber-500/10 text-amber-700', borderColor: 'border-amber-500/30' },
  FieldUpdater:     { icon: PenLine,   color: 'bg-blue-500/10 text-blue-700',   borderColor: 'border-blue-500/30' },
  DocumentRequired: { icon: FileText,  color: 'bg-purple-500/10 text-purple-700', borderColor: 'border-purple-500/30' },
};

export default function WorkflowDiagram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaso, setSelectedPaso] = useState<WorkflowPaso | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');
  const [workflowEstados, setWorkflowEstados] = useState<WorkflowEstado[]>([]);

  usePageTitle(workflow?.nombre || 'Diagrama de Workflow', 'Editor visual de flujo');

  useEffect(() => {
    if (id) {
      fetchWorkflow(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (viewMode === 'list') {
      setSelectedPaso(null);
    }
  }, [viewMode]);

  useEffect(() => {
    const fetchEstados = async () => {
      try {
        const res = await API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados');
        if (res.data?.success) {
          setWorkflowEstados(res.data.data || []);
        }
      } catch {
        setWorkflowEstados([]);
      }
    };
    fetchEstados();
  }, []);

  const fetchWorkflow = async (workflowId: number) => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<WorkflowWithDetails>>(
        `/config/workflows/${workflowId}`
      );
      if (response.data.success && response.data.data) {
        setWorkflow(response.data.data);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar el workflow');
      navigate('/workflows');
    } finally {
      setLoading(false);
    }
  };


  const renderDiagram = () => {
    if (!workflow || !workflow.pasos) return null;

    const sortedPasos = [...workflow.pasos].sort((a, b) => a.orden - b.orden);

    return (
      <div className="relative w-full h-full overflow-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {/* Timeline Container */}
          <div className="relative">
            {/* Línea vertical central */}
            <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/50 via-cyan-500/50 to-blue-500/50" />

            {/* Steps */}
            {sortedPasos.map((paso, index) => {
              const isLast = index === sortedPasos.length - 1;
              const acciones = paso.acciones || [];

              return (
                <div key={paso.idPaso} className="relative mb-8 last:mb-0">
                  {/* Dot on timeline */}
                  <div className="absolute left-12 -translate-x-1/2 mt-6">
                    <div className="h-8 w-8 rounded-full border-4 border-background bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20" />
                    <div className="absolute inset-0 h-8 w-8 rounded-full bg-blue-500 animate-ping opacity-20" />
                  </div>

                  {/* Content Card */}
                  <div className="ml-24">
                    <div
                      className={`group relative rounded-lg border transition-all cursor-pointer ${
                        selectedPaso?.idPaso === paso.idPaso
                          ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10'
                          : 'border-border bg-card hover:border-blue-500/50 hover:shadow-md'
                      }`}
                      onClick={() => setSelectedPaso(paso)}
                    >
                      {/* Step Header */}
                      <div className="p-4 border-b border-border/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                                {paso.orden}
                              </span>
                              <h3 className="font-semibold text-lg">{paso.nombrePaso}</h3>
                            </div>
                            {paso.idEstado && (
                              <p className="text-xs text-muted-foreground ml-8">
                                Estado: {workflowEstados.find(e => e.idEstado === paso.idEstado)?.nombre ?? `ID: ${paso.idEstado}`}
                              </p>
                            )}
                            {paso.descripcionAyuda && (
                              <p className="text-sm text-muted-foreground mt-2 ml-8">
                                {paso.descripcionAyuda}
                              </p>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex flex-col gap-1">
                            {paso.requiereFirma && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                                Firma
                              </Badge>
                            )}
                            {paso.requiereComentario && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                                Comentario
                              </Badge>
                            )}
                            {paso.requiereAdjunto && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                                Adjunto
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions List */}
                      {acciones.length > 0 && (
                        <div className="p-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Acciones Disponibles
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {acciones.map(accion => {
                              const destinoPaso = sortedPasos.find(p => p.idPaso === accion.idPasoDestino);
                              const color = ACTION_COLORS[accion.tipoAccionCodigo as keyof typeof ACTION_COLORS] || '#6b7280';
                              
                              return (
                                <div
                                  key={accion.idAccion}
                                  className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-background/50 hover:bg-accent/50 transition-colors"
                                >
                                  <div className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{accion.tipoAccionNombre}</p>
                                    {destinoPaso && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        → {destinoPaso.nombrePaso}
                                      </p>
                                    )}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-xs shrink-0"
                                    style={{ 
                                      borderColor: color + '40',
                                      color: color,
                                      backgroundColor: color + '10'
                                    }}
                                  >
                                    {accion.tipoAccionCodigo}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <WorkflowIcon className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Workflow no encontrado</p>
        <Button onClick={() => navigate('/workflows')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/workflows')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2 ring-1 ring-blue-500/20">
                <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{workflow.nombre}</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {workflow.codigoProceso}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={workflow.activo ? 'default' : 'secondary'}>
            {workflow.activo ? 'Activo' : 'Inactivo'}
          </Badge>
          <Badge variant="outline" className="font-mono">
            v{workflow.version}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <Button
          variant={viewMode === 'diagram' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('diagram')}
          className="gap-2"
        >
          <GitBranch className="h-4 w-4" />
          Diagrama
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('list')}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </Button>
      </div>

      {/* Content */}
      {viewMode === 'diagram' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
          {/* Main canvas */}
          <div className="lg:col-span-2 relative flex flex-col gap-4">
            {/* Legend - Simplified */}
            <div className="bg-card rounded-lg border border-border p-3 shrink-0">
              <div className="flex items-center gap-6 text-xs flex-wrap">
                <span className="text-muted-foreground font-semibold">Tipos de Acción:</span>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-green-500" />
                  <span>Autorización</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-red-500" />
                  <span>Rechazo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-amber-500" />
                  <span>Retorno</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-gray-500" />
                  <span>Cancelación</span>
                </div>
              </div>
            </div>

            {/* Diagram */}
            <div className="flex-1 overflow-hidden">
              {renderDiagram()}
            </div>
          </div>

          {/* Side panel - Sticky */}
          <div className="lg:sticky lg:top-4 lg:self-start bg-card rounded-lg border border-border p-4 overflow-auto max-h-[calc(100vh-280px)]">
            {selectedPaso ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between sticky top-0 bg-card pb-2 border-b border-border">
                  <h3 className="font-semibold">Detalles del Paso</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPaso(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Orden</label>
                    <p className="text-sm font-mono">{selectedPaso.orden}</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Nombre</label>
                    <p className="text-sm font-semibold">{selectedPaso.nombrePaso}</p>
                  </div>

                  {selectedPaso.idEstado && (
                    <div>
                      <label className="text-xs text-muted-foreground">Estado</label>
                      <p className="text-sm">{workflowEstados.find(e => e.idEstado === selectedPaso.idEstado)?.nombre ?? `ID: ${selectedPaso.idEstado}`}</p>
                    </div>
                  )}

                  {selectedPaso.descripcionAyuda && (
                    <div>
                      <label className="text-xs text-muted-foreground">Descripción</label>
                      <p className="text-sm">{selectedPaso.descripcionAyuda}</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-3">
                    <label className="text-xs text-muted-foreground mb-2 block">Requisitos</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {selectedPaso.requiereFirma ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-500" />
                        )}
                        <span>Requiere firma</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {selectedPaso.requiereComentario ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-500" />
                        )}
                        <span>Requiere comentario</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {selectedPaso.requiereAdjunto ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-500" />
                        )}
                        <span>Requiere adjunto</span>
                      </div>
                    </div>
                  </div>

                  {selectedPaso.acciones && selectedPaso.acciones.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <label className="text-xs text-muted-foreground mb-2 block">
                        Acciones ({selectedPaso.acciones.length})
                      </label>
                      <div className="space-y-2">
                        {selectedPaso.acciones.map(accion => (
                          <div
                            key={accion.idAccion}
                            className="flex items-center justify-between p-2 rounded border border-border text-sm"
                          >
                            <span>{accion.tipoAccionNombre}</span>
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: ACTION_COLORS[accion.tipoAccionCodigo as keyof typeof ACTION_COLORS],
                                color: ACTION_COLORS[accion.tipoAccionCodigo as keyof typeof ACTION_COLORS]
                              }}
                            >
                              {accion.tipoAccionCodigo}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <GitBranch className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Selecciona un paso del diagrama para ver sus detalles
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-280px)]">
          <WorkflowEditorModal
            workflow={workflow}
            open
            embedded
            onClose={() => setViewMode('diagram')}
            onSave={async () => {
              await fetchWorkflow(workflow.idWorkflow);
              toast.success('Cambios guardados correctamente');
            }}
            workflowEstados={workflowEstados}
          />
        </div>
      )}

    </div>
  );
}


interface WorkflowEditorModalProps {
  workflow: WorkflowWithDetails;
  open?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  workflowEstados?: WorkflowEstado[];
}

function WorkflowEditorModal({ workflow, open = false, embedded = false, onClose, onSave, workflowEstados = [] }: WorkflowEditorModalProps) {
  const [activeTab, setActiveTab] = useState('pasos');
  const [editingPaso, setEditingPaso] = useState<WorkflowPaso | null>(null);
  const [isCreatingPaso, setIsCreatingPaso] = useState(false);
  const [editingAccion, setEditingAccion] = useState<WorkflowAccion | null>(null);
  const [editingAccionHandler, setEditingAccionHandler] = useState<{ accion: WorkflowAccion; handler: WorkflowAccionHandler | null } | null>(null);
  const [editingCondicion, setEditingCondicion] = useState<any | null>(null);
  const [editingParticipante, setEditingParticipante] = useState<any | null>(null);
  const [editingNotificacion, setEditingNotificacion] = useState<any | null>(null);
  const [editingCanalTemplate, setEditingCanalTemplate] = useState<any | null>(null);
  const [canalTemplates, setCanalTemplates] = useState<any[]>([]);
  const [editingRecordatorio, setEditingRecordatorio] = useState<any | null>(null);
  const [recordatorios, setRecordatorios] = useState<any[]>([]);
  const [ejecutandoRecordatorios, setEjecutandoRecordatorios] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [tiposNotificacion, setTiposNotificacion] = useState<any[]>([]);
  const [tiposNotificacionLoaded, setTiposNotificacionLoaded] = useState(false);
  
  const [modalStates, setModalStates] = useState({
    stepForm: false,
    actionModal: false,
    handlerModal: false,
    condicionModal: false,
    participanteModal: false,
    notificacionModal: false,
    canalTemplateModal: false,
    recordatorioModal: false,
    plantillasModal: false,
    mappingModal: false,
  });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  // Scope types and mappings state (read-only scope types; mappings CRUD)
  const [scopeTypes, setScopeTypes] = useState<WorkflowScopeType[]>([]);
  const [mappings, setMappings] = useState<WorkflowMapping[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [editingMapping, setEditingMapping] = useState<WorkflowMapping | null>(null);
  const [mappingPayload, setMappingPayload] = useState<{
    idScopeType: number | null;
    scopeId?: number | null;
    idWorkflow: number;
    prioridadManual: number;
    activo: boolean;
    observaciones?: string | null;
  }>({ idScopeType: null, scopeId: null, idWorkflow: workflow.idWorkflow, prioridadManual: 100, activo: true, observaciones: '' });

  const loadScopeTypes = async () => {
    try {
      const res = await API.get<any>('/config/workflows/scope-types');
      setScopeTypes(res.data?.data ?? []);
    } catch (e) {
      // ignore
    }
  };

  const loadMappings = async () => {
    try {
      const res = await API.get<any>(`/config/workflows/mappings?codigoProceso=${workflow.codigoProceso}&idWorkflow=${workflow.idWorkflow}`);
      setMappings(res.data?.data ?? []);
    } catch { }
  };

  // Load catalogs dynamically when scope type selection changes in the mapping form
  useEffect(() => {
    const loadCatalogo = async () => {
      const id = mappingPayload.idScopeType;
      if (!id) return;
      const scopeCode = scopeTypes.find(s => s.idScopeType === Number(id))?.codigo.toUpperCase();

      setEmpresas([]); setSucursales([]); setAreas([]); setUsuarios([]); setProveedores([]);
      try {
        if (scopeCode === 'EMPRESA') {
          const res = await API.get('/catalogos/empresas');
          setEmpresas(res.data.data ?? []);
        } else if (scopeCode === 'SUCURSAL') {
          const res = await API.get('/catalogos/sucursales');
          setSucursales(res.data.data ?? []);
        } else if (scopeCode === 'AREA') {
          const res = await API.get('/catalogos/areas');
          setAreas(res.data.data ?? []);
        } else if (scopeCode === 'USUARIO') {
          const res = await API.get('/Admin/usuarios');
          setUsuarios(res.data.data ?? []);
        } else if (scopeCode === 'PROVEEDOR' || scopeCode === 'PROVEEDOR_ESPECIFICO') {
          const res = await API.get('/catalogos/proveedores');
          setProveedores(res.data.data ?? []);
        }
      } catch {}
    };
    loadCatalogo();
  }, [mappingPayload.idScopeType, scopeTypes]);

  useEffect(() => {
    if (!tiposNotificacionLoaded) {
      API.get<any>('/config/workflows/tipos-notificacion')
        .then(res => {
          setTiposNotificacion(res.data?.data ?? []);
          setTiposNotificacionLoaded(true);
        })
        .catch(() => setTiposNotificacionLoaded(true));
    }
  }, [tiposNotificacionLoaded]);

  const openCreateMapping = () => {
    setEditingMapping(null);
    setMappingPayload({ idScopeType: scopeTypes[0]?.idScopeType ?? null, scopeId: null, idWorkflow: workflow.idWorkflow, prioridadManual: 100, activo: true, observaciones: '' });
    toggleModal('mappingModal', true);
  };

  const handleEditMapping = (m: WorkflowMapping) => {
    setEditingMapping(m);
    setMappingPayload({ idScopeType: m.idScopeType ?? null, scopeId: m.scopeId ?? null, idWorkflow: m.idWorkflow, prioridadManual: m.prioridadManual, activo: m.activo, observaciones: m.observaciones ?? '' });
    toggleModal('mappingModal', true);
  };

  const handleSaveMapping = async () => {
    try {
      if (!mappingPayload.idScopeType) return toast.error('Selecciona un tipo de scope');
      if (editingMapping) {
        await API.put(`/config/workflows/mappings/${editingMapping.idMapping}`, mappingPayload);
        toast.success('Asignación actualizada');
      } else {
        await API.post('/config/workflows/mappings', { codigoProceso: workflow.codigoProceso, ...mappingPayload });
        toast.success('Asignación creada');
      }
      toggleModal('mappingModal', false);
      setEditingMapping(null);
      await loadMappings();
    } catch (error: unknown) {
      const err = toApiError(error);
        toast.error(err.message ?? 'Error al guardar asignación');
    }
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('¿Eliminar asignación?')) return;
    try {
      await API.delete(`/config/workflows/mappings/${id}`);
        toast.success('Asignación eliminada');
      await loadMappings();
    } catch (error: unknown) {
      const err = toApiError(error);
        toast.error(err.message ?? 'Error al eliminar asignación');
    }
  };

  const handleEditPaso = (paso: WorkflowPaso) => {
    setEditingPaso(paso);
    toggleModal('stepForm', true);
  };

  const handleAddPaso = () => {
    setIsCreatingPaso(true);
    setEditingPaso({
      idPaso: 0,
      idWorkflow: workflow.idWorkflow,
      orden: Math.max(0, ...workflow.pasos.map(p => p.orden)) + 10,
      nombrePaso: '',
      idEstado: undefined,
      descripcionAyuda: '',
      esInicio: false,
      esFinal: false,
      activo: true,
      requiereFirma: false,
      requiereComentario: false,
      requiereAdjunto: false,
      acciones: [],
      condiciones: [],
      participantes: []
    } as WorkflowPaso);
    toggleModal('stepForm', true);
  };

  const handleSavePaso = async (updatedPaso: WorkflowPaso) => {
    try {
      // Preparar el request para actualizar el paso
      const updateRequest = {
        nombrePaso: updatedPaso.nombrePaso,
        orden: updatedPaso.orden,
        idEstado: updatedPaso.idEstado ?? null,
        descripcionAyuda: updatedPaso.descripcionAyuda || null,
        esInicio: updatedPaso.esInicio,
        esFinal: updatedPaso.esFinal,
        activo: updatedPaso.activo,
        requiereFirma: updatedPaso.requiereFirma,
        requiereComentario: updatedPaso.requiereComentario,
        requiereAdjunto: updatedPaso.requiereAdjunto
      };

      const response = isCreatingPaso
        ? await API.post<ApiResponse<WorkflowPaso>>(
            `/config/workflows/${workflow.idWorkflow}/pasos`,
            updateRequest as CreatePasoPayload
          )
        : await API.put<ApiResponse<WorkflowPaso>>(
            `/config/workflows/${workflow.idWorkflow}/pasos/${updatedPaso.idPaso}`,
            updateRequest
          );

      if (response.data.success) {
        toggleModal('stepForm', false);
        setEditingPaso(null);
        setIsCreatingPaso(false);
        toast.success(isCreatingPaso ? 'Paso creado correctamente' : 'Paso actualizado correctamente');
        // Recargar el workflow completo para ver los cambios
        await onSave();
      } else {
        toast.error(isCreatingPaso ? 'Error al crear el paso' : 'Error al actualizar el paso');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? (isCreatingPaso ? 'Error al crear el paso' : 'Error al actualizar el paso'));
    }
  };

  const renderEditorContent = () => (
    <>
      {!embedded && (
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2 ring-1 ring-blue-500/20">
              <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span>Configuración del Workflow</span>
              <p className="text-sm font-normal text-muted-foreground font-mono mt-1">
                {workflow.codigoProceso}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
      )}

      <div className={embedded ? 'h-full overflow-hidden p-4' : 'flex-1 overflow-hidden px-6'}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="bg-muted/70 grid w-full grid-cols-8 h-10 border p-1 mb-4">
              <TabsTrigger value="pasos" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <GitBranch className="h-4 w-4" />
                Pasos
              </TabsTrigger>
              <TabsTrigger value="acciones" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Play className="h-4 w-4" />
                Acciones
              </TabsTrigger>
              <TabsTrigger value="condiciones" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Filter className="h-4 w-4" />
                Condiciones
              </TabsTrigger>
              <TabsTrigger value="handlers" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Wrench className="h-4 w-4" />
                Reglas
              </TabsTrigger>
              <TabsTrigger value="participantes" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Users className="h-4 w-4" />
                Participantes
              </TabsTrigger>
              <TabsTrigger value="notificaciones" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Bell className="h-4 w-4" />
                Notificaciones
              </TabsTrigger>
              <TabsTrigger value="recordatorios" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm" onClick={async () => {
                try {
                  const res = await API.get<any>(`/config/workflows/${workflow.idWorkflow}/recordatorios`);
                  setRecordatorios(res.data?.data ?? []);
                } catch { /* silencioso */ }
              }}>
                <Clock className="h-4 w-4" />
                Recordatorios
              </TabsTrigger>
              <TabsTrigger value="mappings" className="gap-2 border border-transparent text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm" onClick={async () => {
                try {
                 await Promise.all([loadScopeTypes(), loadMappings()]);
                } catch { }
              }}>
                <Zap className="h-4 w-4" />
                Asignaciones
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="pasos" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Gestiona los pasos del flujo de trabajo
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInactive(prev => !prev)}
                      >
                        {showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}
                      </Button>
                      <Button size="sm" className="gap-2" onClick={handleAddPaso}>
                        <Plus className="h-4 w-4" />
                        Agregar Paso
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {workflow.pasos
                      .filter((paso) => showInactive || paso.activo)
                      .map((paso) => (
                      <div
                        key={paso.idPaso}
                        className={`p-4 rounded-lg border transition-colors ${
                          paso.activo
                            ? 'border-border bg-card hover:bg-accent/50'
                            : 'border-border/60 bg-muted/40 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 rounded-md bg-muted px-2 py-1">
                              <span className="text-xs font-mono">{paso.orden}</span>
                            </div>
                            <div>
                              <h4 className="font-semibold">{paso.nombrePaso}</h4>
                              <div className="mt-1">
                                <Badge variant={paso.activo ? 'default' : 'secondary'} className="text-[10px]">
                                  {paso.activo ? 'Activo' : 'Inactivo'}
                                </Badge>
                              </div>
                              {paso.descripcionAyuda && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {paso.descripcionAyuda}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-3">
                                {paso.idEstado && (
                                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                                    Estado: {workflowEstados.find(e => e.idEstado === paso.idEstado)?.nombre ?? `ID: ${paso.idEstado}`}
                                  </Badge>
                                )}
                                {paso.requiereFirma && (
                                  <Badge variant="outline" className="text-xs">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Firma
                                  </Badge>
                                )}
                                {paso.requiereComentario && (
                                  <Badge variant="outline" className="text-xs">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Comentario
                                  </Badge>
                                )}
                                {paso.requiereAdjunto && (
                                  <Badge variant="outline" className="text-xs">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Adjunto
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  <Info className="mr-1 h-3 w-3" />
                                  {`${(paso.acciones || []).length} acciones`}
                                </Badge>
                                {(paso.condiciones?.length || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700">
                                    <Filter className="mr-1 h-3 w-3" />
                                    {`${paso.condiciones?.length || 0} condiciones`}
                                  </Badge>
                                )}
                                {(paso.participantes?.length || 0) > 0 && (
                                  <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-700">
                                    <Users className="mr-1 h-3 w-3" />
                                    {`${paso.participantes?.length || 0} participantes`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditPaso(paso)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={paso.activo ? 'text-destructive' : 'text-emerald-600'}
                              onClick={async () => {
                                const accion = paso.activo ? 'desactivar' : 'activar';
                                if (!confirm(`¿Deseas ${accion} este paso?`)) return;
                                try {
                                  await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${paso.idPaso}`, {
                                    nombrePaso: paso.nombrePaso,
                                    orden: paso.orden,
                                    idEstado: paso.idEstado ?? null,
                                    descripcionAyuda: paso.descripcionAyuda || null,
                                    esInicio: paso.esInicio,
                                    esFinal: paso.esFinal,
                                    activo: !paso.activo,
                                    requiereFirma: paso.requiereFirma,
                                    requiereComentario: paso.requiereComentario,
                                    requiereAdjunto: paso.requiereAdjunto
                                  });
                                  await onSave();
                                } catch (error: unknown) {
                                  const err = toApiError(error);
                                  toast.error(err.message ?? `No se pudo ${accion} el paso`);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="acciones" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Configura las transiciones entre pasos ({workflow.pasos.flatMap(p => p.acciones || []).length} acciones)
                    </p>
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={() => {
                        setEditingAccion(null);
                        toggleModal('actionModal', true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Acción
                    </Button>
                  </div>
                  
                  {/* Lista de acciones por paso */}
                  <div className="space-y-4">
                    {workflow.pasos.map(paso => {
                      const acciones = paso.acciones || [];
                      if (acciones.length === 0) return null;
                      
                      return (
                        <div key={paso.idPaso} className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs">
                              {paso.orden}
                            </span>
                            {paso.nombrePaso}
                          </h4>
                          
                          <div className="grid gap-2">
                            {acciones.map(accion => {
                              const destinoPaso = workflow.pasos.find(p => p.idPaso === accion.idPasoDestino);
                              const color = ACTION_COLORS[accion.tipoAccionCodigo as keyof typeof ACTION_COLORS] || '#6b7280';
                              
                              return (
                                <div
                                  key={accion.idAccion}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${accion.activo ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}
                                >
                                  <div className="h-10 w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{accion.tipoAccionNombre}</p>
                                     <p className="text-xs text-muted-foreground">
                                      {destinoPaso ? `→ ${destinoPaso.nombrePaso}` : 'Sin destino'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                      style={{ 
                                        borderColor: color + '40',
                                        color: color,
                                        backgroundColor: color + '10'
                                      }}
                                    >
                                      {accion.tipoAccionCodigo}
                                    </Badge>
                                    {!accion.activo && (
                                      <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setEditingAccion(accion);
                                        toggleModal('actionModal', true);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {workflow.pasos.flatMap(p => p.acciones || []).length === 0 && (
                      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                        <Play className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          No hay acciones configuradas
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Las acciones definen las transiciones entre pasos del workflow
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="condiciones" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Define reglas para routing dinámico ({workflow.pasos.reduce((acc, p) => acc + (p.condiciones?.length || 0), 0)} condiciones)
                    </p>
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={() => {
                        setEditingCondicion(null);
                        toggleModal('condicionModal', true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Condición
                    </Button>
                  </div>
                  
                  {workflow.pasos.some(p => p.condiciones && p.condiciones.length > 0) ? (
                    <div className="space-y-2">
                      {workflow.pasos.flatMap(paso => 
                        (paso.condiciones || []).map(condicion => (
                           <div key={condicion.idCondicion} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${condicion.activo !== false ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                  {paso.orden}
                                </span>
                                <span className="font-medium text-sm">{paso.nombrePaso}</span>
                                {condicion.activo === false && (
                                  <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Si {condicion.campoEvaluacion} {condicion.operador} {condicion.valorComparacion} → 
                                Paso {workflow.pasos.find(p => p.idPaso === condicion.idPasoSiCumple)?.orden}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingCondicion(condicion);
                                  toggleModal('condicionModal', true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm('¿Eliminar esta condición?')) {
                                    try {
                                      await API.delete(`/config/workflows/${workflow.idWorkflow}/pasos/${condicion.idPaso}/condiciones/${condicion.idCondicion}`);
                                      await onSave();
                                    } catch (error) {
                                      console.error('Error al eliminar condición:', error);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                      <Filter className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No hay condiciones configuradas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ejemplo: "Si Total {'>'} $100,000 → ir a Firma 5"
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="handlers" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Configura reglas automáticas por acción ({workflow.pasos.reduce((acc, p) => acc + (p.acciones || []).reduce((accA, a) => accA + (a.handlers?.length || 0), 0), 0)} reglas configuradas)
                    </p>
                  </div>

                  {workflow.pasos.some(p => (p.acciones || []).some(a => (a.handlers?.length || 0) > 0)) ? (
                    <div className="space-y-2">
                      {workflow.pasos.flatMap(paso =>
                        (paso.acciones || []).flatMap(accion =>
                          (accion.handlers || []).length === 0 ? [] : (accion.handlers || []).map(handler => {
                            const cfg = HANDLER_CONFIGS[handler.handlerKey];
                            const Icon = cfg?.icon || Wrench;
                            return (
                              <div key={handler.idHandler} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${handler.activo !== false ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                      {paso.orden}
                                    </span>
                                    <span className="font-medium text-sm font-semibold">{paso.nombrePaso}</span> -
                                    <span className="font-medium text-sm">{accion.tipoAccionNombre}</span>
                                    <Badge variant="outline" className="text-xs">{accion.tipoAccionCodigo}</Badge>
                                    {accion.enviaConcentrado && (
                                      <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/30">
                                        Envia concentrado
                                      </Badge>
                                    )}
                                    {handler.activo === false && (
                                      <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 ml-7">
                                    <Badge variant="outline" className={`text-xs ${cfg?.color || ''} ${cfg?.borderColor || ''}`} title={HANDLER_DESCRIPTIONS[handler.handlerKey]}>
                                      <Icon className="mr-1 h-3 w-3" />
                                      {HANDLER_LABELS[handler.handlerKey] ?? handler.handlerKey}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Orden: {handler.ordenEjecucion}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingAccionHandler({ accion, handler });
                                      toggleModal('handlerModal', true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={async () => {
                                      if (!confirm('¿Eliminar esta regla?')) return;
                                      try {
                                        await API.delete(`/config/workflows/${workflow.idWorkflow}/acciones/${accion.idAccion}/handlers/${handler.idHandler}`);
                                        toast.success('Regla eliminada');
                                        await onSave();
                                      } catch (error: unknown) {
                                        const err = toApiError(error);
                                        toast.error(err.message ?? 'No se pudo eliminar la regla');
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                      <Wrench className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Sin reglas configuradas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Agrega reglas automáticas (campos requeridos, actualizar campo, documento requerido) por acción
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="participantes" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Asigna roles y usuarios a cada paso ({workflow.pasos.reduce((acc, p) => acc + (p.participantes?.length || 0), 0)} asignaciones)
                    </p>
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={() => {
                        setEditingParticipante(null);
                        toggleModal('participanteModal', true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Participante
                    </Button>
                  </div>
                  
                  {workflow.pasos.some(p => p.participantes && p.participantes.length > 0) ? (
                    <div className="space-y-2">
                      {workflow.pasos.flatMap(paso => 
                        (paso.participantes || []).map(participante => (
                           <div key={participante.idParticipante} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${participante.activo !== false ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                  {paso.orden}
                                </span>
                                <span className="font-medium text-sm">{paso.nombrePaso}</span>
                                {participante.activo === false && (
                                  <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {participante.idRol
                                  ? `Rol ID: ${participante.idRol}`
                                  : `Usuario ID: ${participante.idUsuario}`}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingParticipante(participante);
                                  toggleModal('participanteModal', true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm('¿Eliminar este participante?')) {
                                    try {
                                      await API.delete(`/config/workflows/${workflow.idWorkflow}/pasos/${participante.idPaso}/participantes/${participante.idParticipante}`);
                                      await onSave();
                                    } catch (error) {
                                      console.error('Error al eliminar participante:', error);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No hay participantes asignados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Define quién puede actuar en cada paso del workflow
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notificaciones" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Configura alertas automáticas ({workflow.pasos.reduce((acc, p) => acc + (p.acciones || []).reduce((accA, a) => accA + (a.notificaciones?.length || 0), 0), 0)} notificaciones)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                          try {
                            const res = await API.get<any>(`/config/workflows/${workflow.idWorkflow}/canal-templates`);
                            setCanalTemplates(res.data?.data ?? []);
                          } catch { /* silencioso */ }
                          toggleModal('plantillasModal', true);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Plantillas
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditingNotificacion(null);
                          toggleModal('notificacionModal', true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Agregar Notificación
                      </Button>
                    </div>
                  </div>

                  {workflow.pasos.some(p => (p.acciones || []).some(a => a.notificaciones && a.notificaciones.length > 0)) ? (
                    <div className="space-y-2">
                      {workflow.pasos.flatMap(paso =>
                        (paso.acciones || []).flatMap(accion =>
                          (accion.notificaciones || []).map(notificacion => (
                              <div key={notificacion.idNotificacion} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${notificacion.activo !== false ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                      {paso.orden}
                                    </span>
                                    <span className="font-medium text-sm font-semibold">{paso.nombrePaso}</span> - 
                                    <span className="font-medium text-sm">{accion.tipoAccionNombre}</span>
                                    <Badge variant="outline" className="text-xs">{accion.tipoAccionCodigo}</Badge>
                                    {notificacion.activo === false && (
                                      <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 ml-7">
                                    {notificacion.idTipoNotificacion ? (
                                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
                                        <Zap className="mr-1 h-3 w-3" />
                                        {tiposNotificacion.find((t: any) => t.idTipo === notificacion.idTipoNotificacion)?.nombre || `Tipo #${notificacion.idTipoNotificacion}`}
                                      </Badge>
                                    ) : null}
                                    {/* In App always on */}
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                                      <Bell className="mr-1 h-3 w-3" />
                                      In App
                                    </Badge>
                                    {notificacion.enviarEmail && (
                                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-700 border-red-500/30">
                                        <Mail className="mr-1 h-3 w-3" />
                                        Email
                                      </Badge>
                                    )}
                                    {notificacion.enviarWhatsapp && (
                                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                                        WhatsApp
                                      </Badge>
                                    )}
                                    {notificacion.enviarTelegram && (
                                      <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-700 border-sky-500/30">
                                        Telegram
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 ml-7 mt-1">
                                    {notificacion.avisarAlCreador && (
                                      <Badge variant="outline" className="text-xs">
                                        <Users className="mr-1 h-3 w-3" />
                                        Creador
                                      </Badge>
                                    )}
                                    {notificacion.avisarAlSiguiente && (
                                      <Badge variant="outline" className="text-xs">
                                        <Users className="mr-1 h-3 w-3" />
                                        Siguiente
                                      </Badge>
                                    )}
                                    {notificacion.avisarAlAnterior && (
                                      <Badge variant="outline" className="text-xs">
                                        <Users className="mr-1 h-3 w-3" />
                                        Anterior
                                      </Badge>
                                    )}
                                    {notificacion.avisarAAutorizadoresPrevios && (
                                      <Badge variant="outline" className="text-xs">
                                        <Users className="mr-1 h-3 w-3" />
                                        Autorizadores previos
                                      </Badge>
                                    )}
                                    {!notificacion.avisarAlCreador && !notificacion.avisarAlSiguiente && !notificacion.avisarAlAnterior && !notificacion.avisarAAutorizadoresPrevios && (
                                      <span className="text-xs text-muted-foreground">Sin destinatario</span>
                                    )}
                                  </div>
                                </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingNotificacion(notificacion);
                                    toggleModal('notificacionModal', true);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm('¿Eliminar esta notificación?')) {
                                      try {
                                        await API.delete(`/config/workflows/${workflow.idWorkflow}/acciones/${accion.idAccion}/notificaciones/${notificacion.idNotificacion}`);
                                        await onSave();
                                      } catch (error) {
                                        console.error('Error al eliminar notificación:', error);
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                      <Bell className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No hay notificaciones configuradas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Email, WhatsApp, Telegram por acción
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="recordatorios" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Recordatorios automáticos para usuarios con pendientes ({recordatorios.length} configurados)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                          try {
                            const res = await API.get<any>(`/config/workflows/${workflow.idWorkflow}/canal-templates`);
                            setCanalTemplates(res.data?.data ?? []);
                          } catch { /* silencioso */ }
                          toggleModal('plantillasModal', true);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Plantillas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={ejecutandoRecordatorios}
                        title="Ejecutar todos los recordatorios ahora, independientemente del horario configurado"
                        onClick={async () => {
                          setEjecutandoRecordatorios(true);
                          try {
                            const res = await API.post<any>('/workflow/recordatorios/ejecutar');
                            const data = res.data?.data ?? res.data;
                            toast.success(data?.mensaje ?? 'Recordatorios ejecutados');
                          } catch {
                            toast.error('Error al ejecutar los recordatorios');
                          } finally {
                            setEjecutandoRecordatorios(false);
                          }
                        }}
                      >
                        {ejecutandoRecordatorios
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Zap className="h-4 w-4" />}
                        Ejecutar ahora
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditingRecordatorio(null);
                          toggleModal('recordatorioModal', true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Nuevo Recordatorio
                      </Button>
                    </div>
                  </div>

                  {recordatorios.length > 0 ? (
                    <div className="space-y-2">
                      {recordatorios.map((rec: any) => (
                        <div key={rec.idRecordatorio} className={`p-3 rounded-lg border transition-colors ${rec.activo ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm truncate">{rec.nombre}</span>
                                <Badge variant={rec.activo ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                  {rec.activo ? 'Activo' : 'Inactivo'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {rec.tipoTrigger === 'horario' ? `Horario ${rec.horaEnvio ?? ''}` :
                                   rec.tipoTrigger === 'recurrente' ? `Cada ${rec.intervaloHoras ?? '?'}h` :
                                   `Fecha: ${rec.fechaEspecifica ?? ''}`}
                                </Badge>
                                {rec.idPaso ? (
                                  <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-600">
                                    Paso #{rec.idPaso}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-purple-400/50 text-purple-600">
                                    Todos los pasos
                                  </Badge>
                                )}
                                {rec.enviarEmail && <Badge variant="outline" className="text-xs">Email</Badge>}
                                {rec.enviarWhatsapp && <Badge variant="outline" className="text-xs">WhatsApp</Badge>}
                                {rec.enviarTelegram && <Badge variant="outline" className="text-xs">Telegram</Badge>}
                                {rec.escalarAJerarquia && (
                                  <Badge variant="outline" className="text-xs border-amber-400/50 text-amber-600">
                                    Escalación {rec.diasParaEscalar}d
                                  </Badge>
                                )}
                              </div>
                              {rec.asuntoTemplate && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {rec.asuntoTemplate}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Probar ahora"
                                onClick={async () => {
                                  try {
                                    await API.post(`/config/workflows/${workflow.idWorkflow}/recordatorios/${rec.idRecordatorio}/test`);
                                    toast.success('Recordatorio de prueba enviado');
                                  } catch {
                                    toast.error('Error al probar el recordatorio');
                                  }
                                }}
                              >
                                <FlaskConical className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingRecordatorio(rec);
                                  toggleModal('recordatorioModal', true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={async () => {
                                  if (!confirm(`¿Eliminar recordatorio "${rec.nombre}"?`)) return;
                                  try {
                                    await API.delete(`/config/workflows/${workflow.idWorkflow}/recordatorios/${rec.idRecordatorio}`);
                                    setRecordatorios(prev => prev.filter(r => r.idRecordatorio !== rec.idRecordatorio));
                                    toast.success('Recordatorio eliminado');
                                  } catch {
                                    toast.error('Error al eliminar el recordatorio');
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No hay recordatorios configurados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Crea recordatorios para notificar automáticamente a usuarios con órdenes pendientes
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mappings" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Gestiona las asignaciones del flujo</p>
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={() => openCreateMapping()}
                    >
                      <Plus className="h-4 w-4" />
                      Nueva Asignación
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {mappings.length === 0 ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                        <Zap className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">No hay asignaciones configuradas</p>
                        <p className="text-xs text-muted-foreground">Asigna flujos por nivel y destino</p>
                      </div>
                    ) : (
                      mappings.map((m) => (
                        <div key={m.idMapping} className={`p-3 rounded-lg border transition-colors ${m.activo ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="mt-1 rounded-md bg-muted px-2 py-1">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{m.scopeNombre ?? 'Global'}</h4>
                                  <Badge variant="outline" className="text-[10px]">{m.scopeTypeNombre}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">Prioridad: {m.prioridadManual}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditMapping(m)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className={m.activo ? 'text-destructive' : 'text-emerald-600'} onClick={async () => {
                                const accion = m.activo ? 'desactivar' : 'activar';
                                if (!confirm(`¿Deseas ${accion} esta asignación?`)) return;
                                try {
                                  await API.put(`/config/workflows/mappings/${m.idMapping}`, { ...m, activo: !m.activo });
                                  toast.success('Asignación actualizada');
                                  await loadMappings();
                                } catch (err) {
                                  const e = toApiError(err as unknown);
                                  toast.error(e.message ?? 'Error al actualizar asignación');
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              </TabsContent>

            </div>
          </Tabs>
      </div>

      <div className={`${embedded ? 'px-4 pb-4' : 'px-6 py-4 border-t border-border'} flex items-center justify-end`}>
        {!embedded && (
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>
    </>
  );

   return (
      <>
    {embedded ? (
      <div className="bg-card rounded-lg border border-border h-full">
        {renderEditorContent()}
      </div>
    ) : (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[85vh] p-0">
          {renderEditorContent()}
        </DialogContent>
      </Dialog>
    )}

    {/* Step Edit Form */}
      {editingPaso && (
        <StepEditForm
          paso={editingPaso}
          open={modalStates.stepForm}
          onClose={() => {
            toggleModal('stepForm', false);
            setEditingPaso(null);
            setIsCreatingPaso(false);
          }}
          onSave={handleSavePaso}
          workflowEstados={workflowEstados}
        />
      )}
      
      {/* Action Edit Modal */}
      <ActionEditModal
        workflow={workflow}
        accion={editingAccion}
        open={modalStates.actionModal}
        setOpen={(open) => toggleModal('actionModal', open)}
        onSave={async () => {
          await onSave();
          toggleModal('actionModal', false);
          setEditingAccion(null);
        }}
      />

      <HandlerEditModal
        workflow={workflow}
        accion={editingAccionHandler?.accion || null}
        handler={editingAccionHandler?.handler || null}
        open={modalStates.handlerModal}
        setOpen={(open) => toggleModal('handlerModal', open)}
        onSave={async () => {
          await onSave();
          toggleModal('handlerModal', false);
          setEditingAccionHandler(null);
        }}
      />
      
      {/* Condicion Edit Modal */}
      <CondicionEditModal
        workflow={workflow}
        condicion={editingCondicion}
        open={modalStates.condicionModal}
        setOpen={(open) => toggleModal('condicionModal', open)}
        onSave={async () => {
          await onSave();
          toggleModal('condicionModal', false);
          setEditingCondicion(null);
        }}
      />
      
      {/* Participante Edit Modal */}
      <ParticipanteEditModal
        workflow={workflow}
        participante={editingParticipante}
        open={modalStates.participanteModal}
        setOpen={(open) => toggleModal('participanteModal', open)}
        onSave={async () => {
          await onSave();
          toggleModal('participanteModal', false);
          setEditingParticipante(null);
        }}
      />
      
      {/* Notificacion Edit Modal */}
      <NotificacionEditModal
        workflow={workflow}
        notificacion={editingNotificacion}
        open={modalStates.notificacionModal}
        setOpen={(open) => toggleModal('notificacionModal', open)}
        onSave={async () => {
          await onSave();
          toggleModal('notificacionModal', false);
          setEditingNotificacion(null);
        }}
      />

<Modal
  id="modal-mapping"
  open={modalStates.mappingModal}
  setOpen={(open) => toggleModal('mappingModal', open)}
  title={editingMapping ? 'Editar Asignación' : 'Nueva Asignación'}
  size="lg"
  footer={
    <div className="flex gap-2 justify-end pt-2">
      <Button 
        type="button" 
        variant="outline" 
        onClick={() => {
          toggleModal('mappingModal', false);
          setEditingMapping(null);
        }}
      >
        Cancelar
      </Button>
      <Button 
        type="submit" // Deberías añadir este state
        onClick={handleSaveMapping} 
        className="gap-2"
      >
        {editingMapping ? 'Actualizar' : 'Crear'} Asignación
      </Button>
      
      {editingMapping && (
        <Button
          type="button"
          variant="destructive"
          onClick={() => handleDeleteMapping(editingMapping.idMapping)}
        >
          Eliminar
        </Button>
      )}
    </div>
  }
>
  <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Selector de Nivel */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase">Nivel</Label>
          <Select 
            value={String(mappingPayload.idScopeType ?? '')} 
            onValueChange={(val) => setMappingPayload({ ...mappingPayload, idScopeType: Number(val), scopeId: 0 })}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona nivel" /></SelectTrigger>
            <SelectContent>
              {scopeTypes.map(st => <SelectItem key={st.idScopeType} value={String(st.idScopeType)}>{st.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Selector de Destino Dinámico */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase">Destino</Label>
          {(() => {
            const scope = scopeTypes.find(s => s.idScopeType === mappingPayload.idScopeType);
            const code = scope?.codigo?.toUpperCase() ?? '';
            
            if (!code || code === 'GLOBAL') return <Input value="Todo el Sistema" disabled className="bg-muted" />;
            return (
              <Select 
                value={String(mappingPayload.scopeId ?? '0')} 
                onValueChange={(val) => setMappingPayload({ ...mappingPayload, scopeId: Number(val) })}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {code === 'EMPRESA' && empresas.map(e => <SelectItem key={e.idEmpresa} value={String(e.idEmpresa)}>{e.nombre}</SelectItem>)}
                  {code === 'SUCURSAL' && sucursales.map(s => <SelectItem key={s.idSucursal} value={String(s.idSucursal)}>{s.nombre}</SelectItem>)}
                  {code === 'AREA' && areas.map(a => <SelectItem key={a.idArea} value={String(a.idArea)}>{a.nombre}</SelectItem>)}
                  {code === 'USUARIO' && usuarios.map(u => <SelectItem key={u.idUsuario} value={String(u.idUsuario)}>{u.nombreCompleto}</SelectItem>)}
                  {(code === 'PROVEEDOR' || code === 'PROVEEDOR_ESPECIFICO') && proveedores.map(p => <SelectItem key={p.idProveedor} value={String(p.idProveedor)}>{p.razonSocial}</SelectItem>)}
                </SelectContent>
              </Select>
            );
          })()}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Prioridad Manual</label>
          <Input type="number" value={String(mappingPayload.prioridadManual)} onChange={e => setMappingPayload({ ...mappingPayload, prioridadManual: Number(e.target.value) || 100 })} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="mappingActivo" checked={mappingPayload.activo} onCheckedChange={(v) => setMappingPayload({ ...mappingPayload, activo: !!v })} />
          <label className="text-xs">Activo</label>
        </div>
    </div>
    </div>
</Modal>



      {/* Plantillas Modal */}
      <Dialog open={modalStates.plantillasModal} onOpenChange={(open) => toggleModal('plantillasModal', open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Plantillas de canal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Layout HTML que envuelve el cuerpo de cada notificación por canal
              </p>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingCanalTemplate(null);
                  toggleModal('canalTemplateModal', true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nueva Plantilla
              </Button>
            </div>

            {canalTemplates.length > 0 ? (
              <div className="space-y-2">
                {canalTemplates.map(template => (
                  <div key={template.idTemplate} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xs font-semibold uppercase tracking-wide">
                          {template.codigoCanal}
                        </span>
                        <span className="font-medium text-sm">{template.nombre}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-sm">
                        {template.layoutHtml?.substring(0, 70)}…
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCanalTemplate(template);
                        toggleModal('canalTemplateModal', true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No hay plantillas configuradas</p>
                <p className="text-xs text-muted-foreground">
                  Crea una plantilla por canal para personalizar el layout de las notificaciones
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Canal Template Edit Modal */}
      <CanalTemplateEditModal
        workflow={workflow}
        template={editingCanalTemplate}
        open={modalStates.canalTemplateModal}
        setOpen={(open) => toggleModal('canalTemplateModal', open)}
        onSave={async (saved, isNew) => {
          if (isNew) {
            setCanalTemplates(prev => [...prev, saved]);
          } else {
            setCanalTemplates(prev => prev.map(t => t.idTemplate === saved.idTemplate ? saved : t));
          }
          toggleModal('canalTemplateModal', false);
          setEditingCanalTemplate(null);
        }}
      />
      {/* Recordatorio Edit Modal */}
      <RecordatorioEditModal
        workflow={workflow}
        recordatorio={editingRecordatorio}
        open={modalStates.recordatorioModal}
        setOpen={(open) => toggleModal('recordatorioModal', open)}
        onSave={async (saved, isNew) => {
          if (isNew) {
            setRecordatorios(prev => [...prev, saved]);
          } else {
            setRecordatorios(prev => prev.map(r => r.idRecordatorio === saved.idRecordatorio ? saved : r));
          }
          toggleModal('recordatorioModal', false);
          setEditingRecordatorio(null);
        }}
      />
    </>
  );
}

// ============================================================================
// StepEditForm Component
// ============================================================================

interface StepEditFormProps {
  paso: WorkflowPaso;
  open: boolean;
  onClose: () => void;
  onSave: (paso: WorkflowPaso) => Promise<void>;
  workflowEstados: WorkflowEstado[];
}

function StepEditForm({ paso, open, onClose, onSave, workflowEstados }: StepEditFormProps) {
  const [formData, setFormData] = useState<WorkflowPaso>(paso);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      ...paso,
      activo: paso.activo ?? true
    });
  }, [paso]);

  const handleChange = (field: keyof WorkflowPaso, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar el paso');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2 ring-1 ring-blue-500/20">
              <Pencil className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span>Editar Paso</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                Orden: {formData.orden}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Basic Information */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Información Básica
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordenPaso" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Orden del Paso *
                </Label>
                <Input
                  id="ordenPaso"
                  type="number"
                  value={formData.orden}
                  onChange={(e) => handleChange('orden', Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombrePaso" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre del Paso *
                </Label>
                <Input
                  id="nombrePaso"
                  value={formData.nombrePaso}
                  onChange={(e) => handleChange('nombrePaso', e.target.value)}
                  placeholder="ej. Revisión Gerencia General"
                  required
                  className="font-medium"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="idEstado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado del Workflow
                </Label>
                <Select
                  value={formData.idEstado ? String(formData.idEstado) : ''}
                  onValueChange={(val) => handleChange('idEstado', val ? Number(val) : undefined)}
                >
                  <SelectTrigger id="idEstado">
                    <SelectValue placeholder="Selecciona un estado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowEstados.map(est => (
                      <SelectItem key={est.idEstado} value={String(est.idEstado)}>
                        {est.nombre ?? est.codigo} (ID: {est.idEstado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Estado que se asignará a las órdenes cuando estén en este paso
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcionAyuda" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Descripción de Ayuda
              </Label>
              <Textarea
                id="descripcionAyuda"
                value={formData.descripcionAyuda || ''}
                onChange={(e) => handleChange('descripcionAyuda', e.target.value)}
                placeholder="Texto que guiará al usuario durante este paso..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Este texto aparecerá como ayuda contextual para el usuario
              </p>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Requisitos
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereFirma"
                  checked={formData.requiereFirma}
                  onCheckedChange={(checked) => handleChange('requiereFirma', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereFirma" className="cursor-pointer font-medium">
                    Requiere Firma Digital
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe proporcionar una firma electrónica
                  </p>
                </div>
                {formData.requiereFirma && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    Activo
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereComentario"
                  checked={formData.requiereComentario}
                  onCheckedChange={(checked) => handleChange('requiereComentario', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereComentario" className="cursor-pointer font-medium">
                    Requiere Comentario
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe agregar un comentario obligatorio
                  </p>
                </div>
                {formData.requiereComentario && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Activo
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereAdjunto"
                  checked={formData.requiereAdjunto}
                  onCheckedChange={(checked) => handleChange('requiereAdjunto', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereAdjunto" className="cursor-pointer font-medium">
                    Requiere Adjunto
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe subir archivos de respaldo
                  </p>
                </div>
                {formData.requiereAdjunto && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    Activo
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Flow Control */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Play className="h-4 w-4" />
              Control de Flujo
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="activoPaso"
                  checked={formData.activo}
                  onCheckedChange={(checked) => handleChange('activo', !!checked)}
                />
                <div>
                  <Label htmlFor="activoPaso" className="cursor-pointer font-medium">
                    Paso Activo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si está inactivo no se usará en ejecución del workflow
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="esInicio"
                  checked={formData.esInicio}
                  onCheckedChange={(checked) => handleChange('esInicio', checked)}
                />
                <div>
                  <Label htmlFor="esInicio" className="cursor-pointer font-medium">
                    Paso Inicial
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Primer paso del workflow
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="esFinal"
                  checked={formData.esFinal}
                  onCheckedChange={(checked) => handleChange('esFinal', checked)}
                />
                <div>
                  <Label htmlFor="esFinal" className="cursor-pointer font-medium">
                    Paso Final
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Último paso del workflow
                  </p>
                </div>
              </div>
            </div>

            {(formData.esInicio || formData.esFinal) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-xs">
                  {formData.esInicio && formData.esFinal
                    ? 'Este paso es tanto inicio como final (workflow de un solo paso)'
                    : formData.esInicio
                    ? 'Las órdenes comenzarán en este paso automáticamente'
                    : 'Las órdenes finalizarán al llegar a este paso'}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  Orden: {formData.orden}
                </Badge>
                <Badge variant={formData.activo ? 'default' : 'secondary'} className="text-xs">
                  {formData.activo ? 'Activo' : 'Inactivo'}
                </Badge>
                <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar Paso
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ActionEditModal Component
// ============================================================================

interface ActionEditModalProps {
  workflow: WorkflowWithDetails;
  accion: WorkflowAccion | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

function ActionEditModal({ workflow, accion, open, setOpen, onSave }: ActionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    idTipoAccion: 1,
    idPasoOrigen: 0,
    idPasoDestino: 0,
    enviaConcentrado: false,
    activo: true
  });
  const [tiposAccionList, setTiposAccionList] = useState<WorkflowTipoAccion[]>([]);

  useEffect(() => {
    if (accion) {
      // Encontrar el paso origen de esta acción
      const pasoOrigen = workflow.pasos.find(p => 
        p.acciones?.some(a => a.idAccion === accion.idAccion)
      );
      
      setFormData({
        idTipoAccion: accion.idTipoAccion,
        idPasoOrigen: pasoOrigen?.idPaso || 0,
        idPasoDestino: accion.idPasoDestino || 0,
        enviaConcentrado: accion.enviaConcentrado ?? false,
        activo: accion.activo ?? true
      });
    } else {
      setFormData({
        idTipoAccion: 1,
        idPasoOrigen: workflow.pasos[0]?.idPaso || 0,
        idPasoDestino: 0,
        enviaConcentrado: false,
        activo: true
      });
    }
  }, [accion, workflow.pasos, open]);

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const res = await API.get<ApiResponse<WorkflowTipoAccion[]>>('/config/workflows/tipos-accion');
        if (res.data?.success) {
          setTiposAccionList(res.data.data || []);
        }
      } catch {
        // silent fail
      }
    };
    loadTipos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idTipoAccion: formData.idTipoAccion,
        idPasoDestino: formData.idPasoDestino || null,
        enviaConcentrado: formData.enviaConcentrado,
        activo: formData.activo
      };
      if (accion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPasoOrigen}/acciones/${accion.idAccion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPasoOrigen}/acciones`, payload);
      }
      await onSave();
      toast.success(accion ? 'Acción actualizada' : 'Acción creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la acción');
    } finally {
      setIsSaving(false);
    }
  };

  const tiposAccion = tiposAccionList;

  return (
    <Modal
      id="modal-action"
      open={open}
      setOpen={setOpen}
      title={accion ? 'Editar Acción' : 'Nueva Acción'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {accion ? 'Actualizar' : 'Crear'} Acción
          </Button>
          {accion && (
            <Button
              type="button"
              variant={formData.activo ? 'destructive' : 'secondary'}
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPasoOrigen}/acciones/${accion.idAccion}`, {
                    idTipoAccion: formData.idTipoAccion,
                    idPasoDestino: formData.idPasoDestino || null,
                    enviaConcentrado: formData.enviaConcentrado,
                    activo: !formData.activo
                  });
                  toast.success(formData.activo ? 'Acción desactivada' : 'Acción activada');
                  await onSave();
                  setOpen(false);
                } catch (error: unknown) {
                  const err = toApiError(error);
                  toast.error(err.message ?? 'No se pudo cambiar estado de la acción');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {formData.activo ? 'Inactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Acción */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Acción *
          </Label>
          <Select
            value={String(formData.idTipoAccion)}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idTipoAccion: Number(value) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposAccion.map(tipo => (
                <SelectItem key={tipo.idTipoAccion} value={String(tipo.idTipoAccion)}>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6" style={{ backgroundColor: ACTION_COLORS[tipo.codigo || ''] || '#6b7280' }} />
                    <span>{tipo.codigo} - {tipo.nombre}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define el comportamiento semántico de la acción
          </p>
        </div>

        {/* Paso Origen */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso Origen *
          </Label>
          <Select
            value={formData.idPasoOrigen.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoOrigen: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso de origen" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El paso desde donde se puede ejecutar esta acción
          </p>
        </div>

        {/* Paso Destino */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso Destino *
          </Label>
          <Select
            value={formData.idPasoDestino.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoDestino: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso destino" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El paso al que se moverá la orden al ejecutar esta acción
          </p>
        </div>

        {/* Envia Concentrado */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="envia-concentrado"
            checked={formData.enviaConcentrado}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviaConcentrado: Boolean(checked) }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="envia-concentrado" className="text-sm font-medium cursor-pointer">
              Enviar a concentrado
            </Label>
            <p className="text-xs text-muted-foreground">
              Al ejecutar esta acción, se comunicará con el sistema externo de envío concentrado
            </p>
          </div>
        </div>

        {/* Preview */}
        {formData.idPasoOrigen > 0 && formData.idPasoDestino > 0 && (
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">VISTA PREVIA</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {workflow.pasos.find(p => p.idPaso === formData.idPasoOrigen)?.nombrePaso}
              </span>
              <div 
                className="h-0.5 flex-1" 
                style={{ backgroundColor: tiposAccion.find(t => t.idTipoAccion === formData.idTipoAccion)?.codigo ? ACTION_COLORS[tiposAccion.find(t => t.idTipoAccion === formData.idTipoAccion)!.codigo!] : '#6b7280' }}
              />
              <span className="font-mono text-xs px-2 py-1 rounded bg-background">
                {tiposAccion.find(t => t.idTipoAccion === formData.idTipoAccion)?.nombre}
              </span>
              <div 
                className="h-0.5 flex-1" 
                style={{ backgroundColor: tiposAccion.find(t => t.idTipoAccion === formData.idTipoAccion)?.codigo ? ACTION_COLORS[tiposAccion.find(t => t.idTipoAccion === formData.idTipoAccion)!.codigo!] : '#6b7280' }}
              />
              <span className="font-medium">
                {workflow.pasos.find(p => p.idPaso === formData.idPasoDestino)?.nombrePaso}
              </span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================================
// HandlerEditModal Component
// ============================================================================

interface HandlerEditModalProps {
  workflow: WorkflowWithDetails;
  accion: WorkflowAccion | null;
  handler: WorkflowAccionHandler | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

function HandlerEditModal({ workflow, accion, handler, open, setOpen, onSave }: HandlerEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [handlerKey, setHandlerKey] = useState('RequiredFields');
  const [ordenEjecucion, setOrdenEjecucion] = useState(1);
  const [activo, setActivo] = useState(true);

  // Smart UI state per handler type
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fuField, setFuField] = useState('');
  const [fuSource, setFuSource] = useState<'value' | 'input'>('value');
  const [fuValue, setFuValue] = useState('');
  const [fuInputKey, setFuInputKey] = useState('');
  const [documentLabel, setDocumentLabel] = useState('');

  const availableCampos = (workflow.campos || []).filter((c: WorkflowCampo) => c.activo);

  const handlerOptions = [
    { value: 'RequiredFields',   label: 'Campos requeridos' },
    { value: 'FieldUpdater',     label: 'Actualizar campo' },
    { value: 'DocumentRequired', label: 'Documento requerido' },
  ];

  const resetSmartState = () => {
    setSelectedFields([]);
    setFuField(''); setFuSource('value'); setFuValue(''); setFuInputKey('');
    setDocumentLabel('');
  };

  const parseExistingJson = (key: string, json: string) => {
    try {
      const p = JSON.parse(json);
      if (key === 'RequiredFields' && Array.isArray(p.fields)) setSelectedFields(p.fields);
      if (key === 'FieldUpdater' && p.field) {
        setFuField(p.field);
        setFuSource(p.source === 'input' ? 'input' : 'value');
        setFuValue(p.value !== undefined ? String(p.value) : '');
        setFuInputKey(p.inputKey || '');
      }
      if (key === 'DocumentRequired' && p.etiqueta) setDocumentLabel(p.etiqueta);
    } catch { /* json inválido, dejar defaults */ }
  };

  useEffect(() => {
    resetSmartState();
    if (handler) {
      setHandlerKey(handler.handlerKey);
      setOrdenEjecucion(handler.ordenEjecucion || 1);
      setActivo(handler.activo ?? true);
      if (handler.configuracionJson) parseExistingJson(handler.handlerKey, handler.configuracionJson);
    } else {
      setHandlerKey('RequiredFields');
      setOrdenEjecucion(1);
      setActivo(true);
    }
  }, [handler, open]);

  const handleTypeChange = (value: string) => {
    setHandlerKey(value);
    resetSmartState();
  };

  const computeJson = (key: string): string | null => {
    if (key === 'RequiredFields') {
      return selectedFields.length > 0 ? JSON.stringify({ fields: selectedFields }) : null;
    }
    if (key === 'FieldUpdater') {
      if (!fuField) return null;
      if (fuSource === 'input') {
        const obj: Record<string, string> = { field: fuField, source: 'input' };
        if (fuInputKey) obj.inputKey = fuInputKey;
        return JSON.stringify(obj);
      }
      let val: unknown = fuValue;
      if (fuValue === 'true') val = true;
      else if (fuValue === 'false') val = false;
      else if (fuValue !== '' && !isNaN(Number(fuValue))) val = Number(fuValue);
      return JSON.stringify({ field: fuField, value: val });
    }
    if (key === 'DocumentRequired') {
      return documentLabel ? JSON.stringify({ etiqueta: documentLabel }) : null;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accion) { toast.error('Selecciona una acción para configurar reglas'); return; }

    setIsSaving(true);
    try {
      const payload = {
        handlerKey,
        configuracionJson: computeJson(handlerKey),
        ordenEjecucion: Number(ordenEjecucion || 1),
        activo
      };
      if (handler) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/acciones/${accion.idAccion}/handlers/${handler.idHandler}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/acciones/${accion.idAccion}/handlers`, payload);
      }
      toast.success(handler ? 'Regla actualizada' : 'Regla creada');
      setOpen(false);
      await onSave();
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar la regla');
    } finally {
      setIsSaving(false);
    }
  };

  const jsonPreview = computeJson(handlerKey);

  const renderConfig = () => {
    if (handlerKey === 'RequiredFields') {
      return (
        <div className="space-y-2">
          <Label>Campos obligatorios</Label>
          {availableCampos.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No hay campos configurados en este workflow.
              <br />
              <span className="text-xs">Agrega campos en el tab "Campos" primero.</span>
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {availableCampos.map((campo: WorkflowCampo) => (
                <label
                  key={campo.idWorkflowCampo}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedFields.includes(campo.nombreTecnico)}
                    onCheckedChange={() =>
                      setSelectedFields(prev =>
                        prev.includes(campo.nombreTecnico)
                          ? prev.filter(f => f !== campo.nombreTecnico)
                          : [...prev, campo.nombreTecnico]
                      )
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{campo.etiquetaUsuario}</p>
                    <p className="text-xs text-muted-foreground font-mono">{campo.nombreTecnico}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{campo.tipoControl}</Badge>
                </label>
              ))}
            </div>
          )}
          {selectedFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedFields.length} campo{selectedFields.length !== 1 ? 's' : ''} seleccionado{selectedFields.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }

    if (handlerKey === 'FieldUpdater') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Campo a actualizar</Label>
            {availableCampos.length > 0 ? (
              <Select value={fuField} onValueChange={setFuField}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un campo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCampos.map((campo: WorkflowCampo) => (
                    <SelectItem key={campo.idWorkflowCampo} value={campo.nombreTecnico}>
                      {campo.etiquetaUsuario}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={fuField}
                onChange={e => setFuField(e.target.value)}
                placeholder="ej. requiereComprobacionPago"
                className="font-mono text-sm"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Origen del valor</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['value', 'input'] as const).map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setFuSource(src)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors text-left ${
                    fuSource === src
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {src === 'value' ? '📌 Valor fijo' : '✏️ Dato del usuario'}
                </button>
              ))}
            </div>
          </div>

          {fuSource === 'value' ? (
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={fuValue}
                onChange={e => setFuValue(e.target.value)}
                placeholder="true / false / 42 / texto"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Usa true/false para booleanos, número o texto libre</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>
                Clave en el payload del usuario{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={fuInputKey}
                onChange={e => setFuInputKey(e.target.value)}
                placeholder={fuField || 'misma clave que el campo'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío si la clave en el payload del usuario coincide con el nombre del campo
              </p>
            </div>
          )}
        </div>
      );
    }

    if (handlerKey === 'DocumentRequired') {
      return (
        <div className="space-y-2">
          <Label>Etiqueta del documento</Label>
          <Input
            value={documentLabel}
            onChange={e => setDocumentLabel(e.target.value)}
            placeholder="ej. Comprobante de Pago, Factura, Cotización..."
          />
          <p className="text-xs text-muted-foreground">
            El usuario verá este nombre al adjuntar el documento requerido
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      id="modal-handler"
      open={open}
      setOpen={setOpen}
      title={handler ? 'Editar regla' : 'Nueva regla'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {handler ? 'Actualizar' : 'Guardar'} regla
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {accion && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            Acción: <span className="font-semibold">{accion.tipoAccionNombre}</span> · {accion.tipoAccionCodigo}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de regla</Label>
            <Select value={handlerKey} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {handlerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Orden de ejecución</Label>
            <Input
              type="number"
              min={1}
              value={ordenEjecucion}
              onChange={e => setOrdenEjecucion(Number(e.target.value || 1))}
            />
          </div>
        </div>

        {/* Smart config per type */}
        {renderConfig()}

        {/* JSON preview */}
        {jsonPreview && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vista previa JSON
            </p>
            <pre className="rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(JSON.parse(jsonPreview), null, 2)}
            </pre>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="handler-activo"
            checked={activo}
            onCheckedChange={v => setActivo(Boolean(v))}
          />
          <Label htmlFor="handler-activo">Activa</Label>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// CondicionEditModal Component
// ============================================================================

interface CondicionEditModalProps {
  workflow: WorkflowWithDetails;
  condicion: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

function CondicionEditModal({ workflow, condicion, open, setOpen, onSave }: CondicionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    idPaso: 0,
    campoEvaluacion: '',
    operador: '>',
    valorComparacion: '',
    idPasoSiCumple: 0,
    activo: true
  });

  useEffect(() => {
    if (condicion) {
      setFormData({ ...condicion, activo: condicion.activo ?? true });
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        campoEvaluacion: '',
        operador: '>',
        valorComparacion: '',
        idPasoSiCumple: 0,
        activo: true
      });
    }
  }, [condicion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        campoEvaluacion: formData.campoEvaluacion,
        operador: formData.operador,
        valorComparacion: formData.valorComparacion,
        idPasoSiCumple: formData.idPasoSiCumple,
        activo: formData.activo
      };
      if (condicion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/condiciones/${condicion.idCondicion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/condiciones`, payload);
      }
      await onSave();
      toast.success(condicion ? 'Condición actualizada' : 'Condición creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la condición');
    } finally {
      setIsSaving(false);
    }
  };

  const operadores = [
    { value: '>', label: 'Mayor que (>)' },
    { value: '<', label: 'Menor que (<)' },
    { value: '=', label: 'Igual a (=)' },
    { value: '>=', label: 'Mayor o igual (>=)' },
    { value: '<=', label: 'Menor o igual (<=)' },
    { value: '!=', label: 'Diferente (!=)' },
    { value: 'IN', label: 'Está en (IN)' }
  ];

  return (
    <Modal
      id="modal-condicion"
      open={open}
      setOpen={setOpen}
      title={condicion ? 'Editar Condición' : 'Nueva Condición'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {condicion ? 'Actualizar' : 'Crear'} Condición
          </Button>
          {condicion && (
            <Button
              type="button"
              variant={formData.activo ? 'destructive' : 'secondary'}
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/condiciones/${condicion.idCondicion}`, {
                    campoEvaluacion: formData.campoEvaluacion,
                    operador: formData.operador,
                    valorComparacion: formData.valorComparacion,
                    idPasoSiCumple: formData.idPasoSiCumple,
                    activo: !formData.activo
                  });
                  toast.success(formData.activo ? 'Condición desactivada' : 'Condición activada');
                  await onSave();
                  setOpen(false);
                } catch (error: unknown) {
                  const err = toApiError(error);
                  toast.error(err.message ?? 'No se pudo cambiar estado de la condición');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {formData.activo ? 'Inactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paso donde aplica */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso donde aplica la condición *
          </Label>
          <Select
            value={formData.idPaso.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPaso: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Campo a Evaluar */}
        <div className="space-y-2">
          <Label htmlFor="campoEvaluacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Campo a Evaluar *
          </Label>
          <Input
            id="campoEvaluacion"
            value={formData.campoEvaluacion}
            onChange={(e) => setFormData(prev => ({ ...prev, campoEvaluacion: e.target.value }))}
            placeholder="ej. Total, IdEmpresa, TipoGasto"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Nombre del campo del modelo de datos a evaluar
          </p>
        </div>

        {/* Grid: Operador y Valor */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operador *
            </Label>
            <Select
              value={formData.operador}
              onValueChange={(value) => setFormData(prev => ({ ...prev, operador: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operadores.map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valorComparacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valor *
            </Label>
            <Input
              id="valorComparacion"
              value={formData.valorComparacion}
              onChange={(e) => setFormData(prev => ({ ...prev, valorComparacion: e.target.value }))}
              placeholder="ej. 100000, 5, 'VIATICOS'"
              required
              className="font-mono"
            />
          </div>
        </div>

        {/* Paso Destino si cumple */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ir a paso (si cumple) *
          </Label>
          <Select
            value={formData.idPasoSiCumple.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoSiCumple: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso destino" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {formData.idPaso > 0 && formData.campoEvaluacion && formData.idPasoSiCumple > 0 && (
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">REGLA</p>
            <p className="text-sm font-mono">
              Si <span className="text-blue-600 font-semibold">{formData.campoEvaluacion}</span>
              {' '}<span className="text-amber-600 font-semibold">{formData.operador}</span>{' '}
              <span className="text-green-600 font-semibold">{formData.valorComparacion}</span>
              {' '}→ ir a{' '}
              <span className="text-purple-600 font-semibold">
                {workflow.pasos.find(p => p.idPaso === formData.idPasoSiCumple)?.nombrePaso}
              </span>
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================================
// ParticipanteEditModal Component
// ============================================================================

interface ParticipanteEditModalProps {
  workflow: WorkflowWithDetails;
  participante: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

function ParticipanteEditModal({ workflow, participante, open, setOpen, onSave }: ParticipanteEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [tipoAsignacionUI, setTipoAsignacionUI] = useState<'rol' | 'usuario'>('rol');
  const [formData, setFormData] = useState({
    idPaso: 0,
    idRol: 0,
    idUsuario: 0,
    activo: true
  });

  useEffect(() => {
    if (participante) {
      setFormData({
        idPaso: participante.idPaso,
        idRol: participante.idRol || 0,
        idUsuario: participante.idUsuario || 0,
        activo: participante.activo ?? true
      });
      setTipoAsignacionUI(participante.idRol ? 'rol' : 'usuario');
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        idRol: 0,
        idUsuario: 0,
        activo: true
      });
      setTipoAsignacionUI('rol');
    }
  }, [participante, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idRol: tipoAsignacionUI === 'rol' ? (formData.idRol || null) : null,
        idUsuario: tipoAsignacionUI === 'usuario' ? (formData.idUsuario || null) : null,
        activo: formData.activo
      };
      if (participante) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/participantes/${participante.idParticipante}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/participantes`, payload);
      }
      await onSave();
      toast.success(participante ? 'Participante actualizado' : 'Participante agregado');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar el participante');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      id="modal-participante"
      open={open}
      setOpen={setOpen}
      title={participante ? 'Editar Participante' : 'Nuevo Participante'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {participante ? 'Actualizar' : 'Crear'} Participante
          </Button>
          {participante && (
            <Button
              type="button"
              variant={formData.activo ? 'destructive' : 'secondary'}
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/participantes/${participante.idParticipante}`, {
                    idRol: tipoAsignacionUI === 'rol' ? (formData.idRol || null) : null,
                    idUsuario: tipoAsignacionUI === 'usuario' ? (formData.idUsuario || null) : null,
                    activo: !formData.activo
                  });
                  toast.success(formData.activo ? 'Participante desactivado' : 'Participante activado');
                  await onSave();
                  setOpen(false);
                } catch (error: unknown) {
                  const err = toApiError(error);
                  toast.error(err.message ?? 'No se pudo cambiar estado del participante');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {formData.activo ? 'Inactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paso */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso del Workflow *
          </Label>
          <Select
            value={formData.idPaso.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPaso: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El paso donde actuará este participante
          </p>
        </div>

        {/* Tipo de Asignación */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Asignación *
          </Label>
          <Select
            value={tipoAsignacionUI}
            onValueChange={(value: 'rol' | 'usuario') => {
              setTipoAsignacionUI(value);
              setFormData(prev => ({
                ...prev,
                idRol: value === 'rol' ? prev.idRol : 0,
                idUsuario: value === 'usuario' ? prev.idUsuario : 0
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rol">Por Rol</SelectItem>
              <SelectItem value="usuario">Por Usuario Específico</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tipoAsignacionUI === 'rol' 
              ? 'Cualquier usuario con este rol podrá actuar'
              : 'Solo el usuario específico podrá actuar'}
          </p>
        </div>

        {/* Asignación según tipo */}
        {tipoAsignacionUI === 'rol' ? (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rol *
            </Label>
            <Select
              value={formData.idRol.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, idRol: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Gerente General</SelectItem>
                <SelectItem value="2">CxP (Cuentas por Pagar)</SelectItem>
                <SelectItem value="3">GAF (Gerencia Administrativa)</SelectItem>
                <SelectItem value="4">Dirección Corporativa</SelectItem>
                <SelectItem value="5">Compras</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usuario *
            </Label>
            <Select
              value={formData.idUsuario.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, idUsuario: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Juan Pérez (Gerente)</SelectItem>
                <SelectItem value="2">Polo González (CxP)</SelectItem>
                <SelectItem value="3">Diego Ramírez (GAF)</SelectItem>
                <SelectItem value="4">María López (Dirección)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs">
              Los participantes definen quién puede ver y actuar en cada paso del workflow. 
              Si no hay participantes asignados, cualquier usuario podrá actuar.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// NotificacionEditModal Component
// ============================================================================

interface NotificacionEditModalProps {
  workflow: WorkflowWithDetails;
  notificacion: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

function NotificacionEditModal({ workflow, notificacion, open, setOpen, onSave }: NotificacionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [tiposNotificacion, setTiposNotificacion] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    idAccion: 0,
    idPasoDestino: 0,
    idTipoNotificacion: 0,
    enviarEmail: true,
    enviarWhatsapp: false,
    enviarTelegram: false,
    avisarAlCreador: true,
    avisarAlSiguiente: true,
    avisarAlAnterior: false,
    avisarAAutorizadoresPrevios: false,
    incluirPartidas: false,
    activo: true,
    canales: [] as any[]
  });

  // Cargar tipos de notificación la primera vez
  useEffect(() => {
    API.get<any>('/config/workflows/tipos-notificacion')
      .then(res => setTiposNotificacion(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (notificacion) {
      // Cargar canales de la notificación
      const canales = notificacion.canales ?? [];
      setFormData({
        ...notificacion,
        idPasoDestino: notificacion.idPasoDestino || 0,
        idTipoNotificacion: notificacion.idTipoNotificacion || 0,
        activo: notificacion.activo ?? true,
        canales
      });
    } else {
      // Encontrar la primera acción disponible
      const primeraAccion = workflow.pasos.flatMap(p => p.acciones || [])[0];
      setFormData({
        idAccion: primeraAccion?.idAccion || 0,
        idPasoDestino: 0,
        idTipoNotificacion: 0,
        enviarEmail: true,
        enviarWhatsapp: false,
        enviarTelegram: false,
        avisarAlCreador: true,
        avisarAlSiguiente: true,
        avisarAlAnterior: false,
        avisarAAutorizadoresPrevios: false,
        incluirPartidas: false,
        activo: true,
        canales: [] as any[]
      });
    }
  }, [notificacion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idPasoDestino: formData.idPasoDestino || null,
        idTipoNotificacion: formData.idTipoNotificacion || null,
        enviarEmail: formData.enviarEmail,
        enviarWhatsapp: formData.enviarWhatsapp,
        enviarTelegram: formData.enviarTelegram,
        avisarAlCreador: formData.avisarAlCreador,
        avisarAlSiguiente: formData.avisarAlSiguiente,
        avisarAlAnterior: formData.avisarAlAnterior,
        avisarAAutorizadoresPrevios: formData.avisarAAutorizadoresPrevios,
        incluirPartidas: formData.incluirPartidas,
        activo: formData.activo,
        canales: formData.canales ?? []
      };
      if (notificacion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/acciones/${formData.idAccion}/notificaciones/${notificacion.idNotificacion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/acciones/${formData.idAccion}/notificaciones`, payload);
      }
      await onSave();
      toast.success(notificacion ? 'Notificación actualizada' : 'Notificación creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la notificación');
    } finally {
      setIsSaving(false);
    }
  };

  const todasLasAcciones = workflow.pasos.flatMap(p => {
    const paso = p;
    return (p.acciones || []).map(a => ({ ...a, paso }));
  });

  return (
    <Modal
      id="modal-notificacion"
      open={open}
      setOpen={setOpen}
      title={notificacion ? 'Editar Notificación' : 'Nueva Notificación'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {notificacion ? 'Actualizar' : 'Crear'} Notificación
          </Button>
          {notificacion && (
            <Button
              type="button"
              variant={formData.activo ? 'destructive' : 'secondary'}
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await API.put(`/config/workflows/${workflow.idWorkflow}/acciones/${formData.idAccion}/notificaciones/${notificacion.idNotificacion}`, {
                    idPasoDestino: formData.idPasoDestino || null,
                    idTipoNotificacion: formData.idTipoNotificacion || null,
                    enviarEmail: formData.enviarEmail,
                    enviarWhatsapp: formData.enviarWhatsapp,
                    enviarTelegram: formData.enviarTelegram,
                    avisarAlCreador: formData.avisarAlCreador,
                    avisarAlSiguiente: formData.avisarAlSiguiente,
                    avisarAlAnterior: formData.avisarAlAnterior,
                    avisarAAutorizadoresPrevios: formData.avisarAAutorizadoresPrevios,
                    incluirPartidas: formData.incluirPartidas,
                    activo: !formData.activo,
                  });
                  toast.success(formData.activo ? 'Notificación desactivada' : 'Notificación activada');
                  await onSave();
                  setOpen(false);
                } catch (error: unknown) {
                  const err = toApiError(error);
                  toast.error(err.message ?? 'No se pudo cambiar estado de la notificación');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {formData.activo ? 'Inactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Acción asociada */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acción que Dispara la Notificación *
          </Label>
          <Select
            value={formData.idAccion.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idAccion: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una acción" />
            </SelectTrigger>
            <SelectContent>
              {todasLasAcciones.map(({ idAccion, tipoAccionNombre, tipoAccionCodigo, paso }) => (
                <SelectItem key={idAccion} value={idAccion.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{paso.nombrePaso}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{tipoAccionNombre}</span>
                    <Badge variant="outline" className="text-xs">
                      {tipoAccionCodigo}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            La notificación se enviará cuando se ejecute esta acción
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso destino (opcional)
          </Label>
          <Select
            value={formData.idPasoDestino.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoDestino: parseInt(value, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un paso destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Genérica (cualquier destino)</SelectItem>
              {workflow.pasos.map(paso => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  [{paso.orden}] {paso.nombrePaso}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de Notificación */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Notificación
          </Label>
          <Select
            value={formData.idTipoNotificacion?.toString() || '0'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idTipoNotificacion: parseInt(value, 10) }))}
          >
            <SelectTrigger>
              <SelectValue>
                {formData.idTipoNotificacion && formData.idTipoNotificacion > 0 ? (
                  (() => {
                    const tipo = tiposNotificacion.find(t => t.idTipo === formData.idTipoNotificacion);
                    return tipo ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tipo.colorTema }}
                        />
                        <span>{tipo.icono} {tipo.nombre}</span>
                      </span>
                    ) : 'Sin tipo';
                  })()
                ) : (
                  <span className="text-muted-foreground">Sin tipo asignado</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">
                <span className="text-muted-foreground">Sin tipo asignado</span>
              </SelectItem>
              {tiposNotificacion.map(tipo => (
                <SelectItem key={tipo.idTipo} value={tipo.idTipo.toString()}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tipo.colorTema }}
                    />
                    <span>{tipo.icono} {tipo.nombre}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determina el color del encabezado y acento en el email
          </p>
        </div>

        {/* Canales */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Canales de Notificación
          </Label>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarEmail"
                checked={formData.enviarEmail}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarEmail: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarEmail" className="cursor-pointer font-medium">
                  📧 Email
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarWhatsapp"
                checked={formData.enviarWhatsapp}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarWhatsapp: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarWhatsapp" className="cursor-pointer font-medium">
                  💬 WhatsApp
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarTelegram"
                checked={formData.enviarTelegram}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarTelegram: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarTelegram" className="cursor-pointer font-medium">
                  ✈️ Telegram
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Destinatarios */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Destinatarios
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlCreador"
                checked={formData.avisarAlCreador}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlCreador: !!checked }))}
              />
              <Label htmlFor="avisarAlCreador" className="cursor-pointer text-xs">
                Creador
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlSiguiente"
                checked={formData.avisarAlSiguiente}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlSiguiente: !!checked }))}
              />
              <Label htmlFor="avisarAlSiguiente" className="cursor-pointer text-xs">
                Siguiente
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlAnterior"
                checked={formData.avisarAlAnterior}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlAnterior: !!checked }))}
              />
              <Label htmlFor="avisarAlAnterior" className="cursor-pointer text-xs">
                Anterior
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border col-span-3">
              <Checkbox
                id="avisarAAutorizadoresPrevios"
                checked={formData.avisarAAutorizadoresPrevios}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAAutorizadoresPrevios: !!checked }))}
              />
              <Label htmlFor="avisarAAutorizadoresPrevios" className="cursor-pointer text-xs">
                Autorizadores previos
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creador: quien inició la orden • Siguiente: quien recibirá la orden • Anterior: quien tenía la orden • Autorizadores previos: todos los que autorizaron pasos anteriores de esta orden
          </p>
        </div>

        {/* Templates por canal */}
        <CanalesTemplateEditor
          canales={formData.canales ?? []}
          enviarEmail={formData.enviarEmail}
          enviarWhatsapp={formData.enviarWhatsapp}
          enviarTelegram={formData.enviarTelegram}
          tipoNotificacion={tiposNotificacion.find((t: any) => t.idTipoNotificacion === formData.idTipoNotificacion)?.codigoTipo}
          bodyVars={['{{Folio}}', '{{Total}}', '{{Proveedor}}', '{{Comentario}}', '{{Accion}}', '{{NombreAnterior}}', '{{NombreSiguiente}}', '{{Solicitante}}', '{{Partidas}}']}
          tablaVarName={formData.incluirPartidas ? '{{Partidas}}' : undefined}
          showListadoRowHtml={!!formData.incluirPartidas}
          listadoRowHtmlLabel="Avanzado: fila HTML de partidas"
          listadoRowHtmlVars={['{{NumeroPartida}}', '{{Descripcion}}', '{{Cantidad}}', '{{PrecioUnitario}}', '{{Total}}']}
          listadoRowHtmlPlaceholder="Dejar vacío para usar la tabla por defecto"
          listadoRowHtmlExample={`<tr>\n  <td>{{NumeroPartida}}</td>\n  <td>{{Descripcion}}</td>\n  <td style="text-align:right">{{Cantidad}}</td>\n  <td style="text-align:right">{{PrecioUnitario}}</td>\n  <td style="text-align:right;font-weight:600">{{Total}}</td>\n</tr>`}
          onChange={(canales) => setFormData((prev: any) => ({ ...prev, canales }))}
        />

        {/* Opciones adicionales */}
        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluirPartidas"
                checked={formData.incluirPartidas}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, incluirPartidas: !!checked }))}
              />
              <Label htmlFor="incluirPartidas" className="cursor-pointer text-xs font-medium">
                Incluir tabla de partidas de la orden en la notificación — activa <code className="bg-blue-500/10 px-1 rounded">{'{{Partidas}}'}</code> y la sección de fila HTML
              </Label>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// CanalTemplateEditModal Component
// ============================================================================

interface CanalTemplateEditModalProps {
  workflow: WorkflowWithDetails;
  template: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (saved: any, isNew: boolean) => Promise<void>;
}

const CANAL_VARS: Record<string, string[]> = {
  email:    ['{{Contenido}}', '{{Folio}}', '{{Asunto}}', '{{UrlOrden}}', '{{Proveedor}}', '{{Total}}'],
  in_app:   ['{{Contenido}}'],
  telegram: ['{{Contenido}}', '{{Folio}}', '{{UrlOrden}}'],
  whatsapp: ['{{Contenido}}', '{{Folio}}'],
};

function CanalTemplateEditModal({ workflow, template, open, setOpen, onSave }: CanalTemplateEditModalProps) {
  const isNew = !template;
  const [formData, setFormData] = useState({ codigoCanal: '', nombre: '', layoutHtml: '', activo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({ codigoCanal: template.codigoCanal, nombre: template.nombre, layoutHtml: template.layoutHtml, activo: template.activo ?? true });
      } else {
        setFormData({ codigoCanal: '', nombre: '', layoutHtml: '{{Contenido}}', activo: true });
      }
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const res = await API.post<any>(
          `/config/workflows/${workflow.idWorkflow}/canal-templates`,
          { codigoCanal: formData.codigoCanal, nombre: formData.nombre, layoutHtml: formData.layoutHtml, activo: formData.activo }
        );
        toast.success('Plantilla de canal creada');
        await onSave(res.data?.data ?? formData, true);
      } else {
        const res = await API.put<any>(
          `/config/workflows/${workflow.idWorkflow}/canal-templates/${template.codigoCanal}`,
          { nombre: formData.nombre, layoutHtml: formData.layoutHtml, activo: formData.activo }
        );
        toast.success('Plantilla de canal guardada');
        await onSave(res.data?.data ?? { ...template, ...formData }, false);
      }
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      const msg = apiErr.message ?? (isNew ? 'Error al crear la plantilla' : 'Error al guardar la plantilla');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const vars = CANAL_VARS[formData.codigoCanal] ?? ['{{Contenido}}'];

  return (
    <Modal
      id="modal-canal-template"
      open={open}
      setOpen={setOpen}
      title={isNew ? 'Nueva Plantilla de Canal' : `Plantilla de Canal — ${template?.codigoCanal?.toUpperCase() ?? ''}`}
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="form-canal-template" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-canal-template" onSubmit={handleSubmit} className="space-y-4">
        {isNew && (
          <div>
            <Label htmlFor="ct-canal">Canal</Label>
            <select
              id="ct-canal"
              value={formData.codigoCanal}
              onChange={e => setFormData(p => ({ ...p, codigoCanal: e.target.value }))}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="" disabled>Selecciona un canal…</option>
              <option value="email">Email</option>
              <option value="in_app">In-App</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="ct-nombre">Nombre</Label>
          <Input
            id="ct-nombre"
            value={formData.nombre}
            onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="ct-layout">Layout HTML</Label>
            {vars.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Variables: {vars.map(v => <code key={v} className="mx-0.5 px-1 py-0.5 rounded bg-muted text-xs">{v}</code>)}
              </span>
            )}
          </div>
          <Textarea
            id="ct-layout"
            value={formData.layoutHtml}
            onChange={e => setFormData(p => ({ ...p, layoutHtml: e.target.value }))}
            rows={18}
            className="font-mono text-xs"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1 rounded">{'{{Contenido}}'}</code> será reemplazado por el cuerpo de la notificación ya interpolado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ct-activo"
            checked={formData.activo}
            onCheckedChange={v => setFormData(p => ({ ...p, activo: Boolean(v) }))}
          />
          <Label htmlFor="ct-activo">Activo</Label>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// RecordatorioEditModal Component
// ============================================================================

interface RecordatorioEditModalProps {
  workflow: WorkflowWithDetails;
  recordatorio: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (saved: any, isNew: boolean) => Promise<void>;
}

const REC_VARS = ['{{NombreResponsable}}', '{{CantidadPendientes}}', '{{DiasEspera}}', '{{ListadoPendientes}}', '{{Folios}}', '{{Folio}}', '{{Total}}'];

const CANAL_DEFAULTS: Record<string, { asunto: string; cuerpo: string }> = {
  email: {
    asunto: '',
    cuerpo: '<p>Hola <strong>{{NombreResponsable}}</strong>,</p>\n<p>Tienes <strong>{{CantidadPendientes}}</strong> orden(es) pendiente(s) de revisión. La más antigua lleva <strong>{{DiasEspera}}</strong> días esperando.</p>\n{{ListadoPendientes}}'
  },
  in_app: {
    asunto: '',
    cuerpo: 'Tienes {{CantidadPendientes}} OC pendiente(s): {{Folios}}'
  },
  whatsapp: {
    asunto: '',
    cuerpo: '⏰ *Recordatorio de órdenes*\nHola {{NombreResponsable}}, tienes {{CantidadPendientes}} orden(es) pendiente(s):\n{{Folios}}'
  },
  telegram: {
    asunto: '',
    cuerpo: '⏰ <b>Recordatorio</b>\nHola {{NombreResponsable}}, tienes <b>{{CantidadPendientes}}</b> orden(es) pendiente(s):\n{{Folios}}'
  }
};

const EMPTY_REC = {
  nombre: '',
  activo: true,
  idPaso: '',
  tipoTrigger: 'horario',
  horaEnvio: '09:00',
  diasSemana: '1,2,3,4,5',
  intervaloHoras: 24,
  fechaEspecifica: '',
  minOrdenesPendientes: '',
  minDiasEnPaso: '',
  montoMinimo: '',
  montoMaximo: '',
  escalarAJerarquia: false,
  diasParaEscalar: '',
  enviarAlResponsable: true,
  enviarEmail: true,
  enviarWhatsapp: false,
  enviarTelegram: false,
  canales: [] as any[]
};

function RecordatorioEditModal({ workflow, recordatorio, open, setOpen, onSave }: RecordatorioEditModalProps) {
  const isNew = !recordatorio;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(EMPTY_REC);

  useEffect(() => {
    if (recordatorio) {
      setFormData({
        ...EMPTY_REC,
        ...recordatorio,
        idPaso: recordatorio.idPaso ?? '',
        horaEnvio: recordatorio.horaEnvio ?? '09:00',
        diasSemana: recordatorio.diasSemana ?? '1,2,3,4,5',
        intervaloHoras: recordatorio.intervaloHoras ?? 24,
        fechaEspecifica: recordatorio.fechaEspecifica ?? '',
        minOrdenesPendientes: recordatorio.minOrdenesPendientes ?? '',
        minDiasEnPaso: recordatorio.minDiasEnPaso ?? '',
        montoMinimo: recordatorio.montoMinimo ?? '',
        montoMaximo: recordatorio.montoMaximo ?? '',
        diasParaEscalar: recordatorio.diasParaEscalar ?? '',
        canales: recordatorio.canales ?? [],
      });
    } else {
      setFormData(EMPTY_REC);
    }
  }, [recordatorio, open]);

  const set = (field: string, value: any) => setFormData((p: any) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        idPaso: formData.idPaso ? Number(formData.idPaso) : null,
        minOrdenesPendientes: formData.minOrdenesPendientes !== '' ? Number(formData.minOrdenesPendientes) : null,
        minDiasEnPaso: formData.minDiasEnPaso !== '' ? Number(formData.minDiasEnPaso) : null,
        montoMinimo: formData.montoMinimo !== '' ? Number(formData.montoMinimo) : null,
        montoMaximo: formData.montoMaximo !== '' ? Number(formData.montoMaximo) : null,
        diasParaEscalar: formData.diasParaEscalar !== '' ? Number(formData.diasParaEscalar) : null,
        intervaloHoras: formData.tipoTrigger === 'recurrente' ? Number(formData.intervaloHoras) : null,
        horaEnvio: formData.tipoTrigger === 'horario' ? formData.horaEnvio : null,
        diasSemana: formData.tipoTrigger === 'horario' ? formData.diasSemana : null,
        fechaEspecifica: formData.tipoTrigger === 'fecha_especifica' ? formData.fechaEspecifica || null : null,
      };

      if (isNew) {
        const res = await API.post<any>(`/config/workflows/${workflow.idWorkflow}/recordatorios`, payload);
        toast.success('Recordatorio creado');
        await onSave(res.data?.data ?? payload, true);
      } else {
        const res = await API.put<any>(`/config/workflows/${workflow.idWorkflow}/recordatorios/${recordatorio.idRecordatorio}`, payload);
        toast.success('Recordatorio guardado');
        await onSave(res.data?.data ?? { ...recordatorio, ...payload }, false);
      }
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.message ?? 'Error al guardar el recordatorio');
    } finally {
      setSaving(false);
    }
  };

  const pasos = workflow.pasos ?? [];

  return (
    <Modal
      id="modal-recordatorio"
      open={open}
      setOpen={setOpen}
      title={isNew ? 'Nuevo Recordatorio' : `Editar: ${recordatorio?.nombre ?? ''}`}
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="form-recordatorio" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-recordatorio" onSubmit={handleSubmit} className="space-y-5">

        {/* Identificación */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="rec-nombre">Nombre *</Label>
            <Input id="rec-nombre" value={formData.nombre} onChange={e => set('nombre', e.target.value)} required placeholder="Ej. Recordatorio diario pendientes" />
          </div>
          <div>
            <Label htmlFor="rec-paso">Paso específico</Label>
            <select
              id="rec-paso"
              value={formData.idPaso ?? ''}
              onChange={e => set('idPaso', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los pasos</option>
              {pasos.map(p => (
                <option key={p.idPaso} value={p.idPaso}>{p.nombrePaso}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="rec-activo" checked={formData.activo} onCheckedChange={v => set('activo', Boolean(v))} />
            <Label htmlFor="rec-activo">Activo</Label>
          </div>
        </div>

        {/* Trigger */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger de tiempo</p>
          <div>
            <Label>Tipo</Label>
            <select
              value={formData.tipoTrigger}
              onChange={e => set('tipoTrigger', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="horario">Horario (hora del día)</option>
              <option value="recurrente">Recurrente (cada N horas)</option>
              <option value="fecha_especifica">Fecha específica</option>
            </select>
          </div>
          {formData.tipoTrigger === 'horario' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rec-hora">Hora de envío</Label>
                <Input id="rec-hora" type="time" value={formData.horaEnvio} onChange={e => set('horaEnvio', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rec-dias">Días de la semana</Label>
                <Input id="rec-dias" value={formData.diasSemana} onChange={e => set('diasSemana', e.target.value)} placeholder="1,2,3,4,5 (lun-vie)" />
                <p className="text-xs text-muted-foreground mt-1">1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom</p>
              </div>
            </div>
          )}
          {formData.tipoTrigger === 'recurrente' && (
            <div>
              <Label htmlFor="rec-intervalo">Intervalo (horas)</Label>
              <Input id="rec-intervalo" type="number" min={1} value={formData.intervaloHoras} onChange={e => set('intervaloHoras', e.target.value)} />
            </div>
          )}
          {formData.tipoTrigger === 'fecha_especifica' && (
            <div>
              <Label htmlFor="rec-fecha">Fecha</Label>
              <Input id="rec-fecha" type="date" value={formData.fechaEspecifica} onChange={e => set('fechaEspecifica', e.target.value)} />
            </div>
          )}
        </div>

        {/* Condiciones */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condiciones de activación</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rec-minord">Mín. órdenes pendientes</Label>
              <Input id="rec-minord" type="number" min={1} value={formData.minOrdenesPendientes} onChange={e => set('minOrdenesPendientes', e.target.value)} placeholder="Sin mínimo" />
            </div>
            <div>
              <Label htmlFor="rec-mindias">Mín. días en paso</Label>
              <Input id="rec-mindias" type="number" min={1} value={formData.minDiasEnPaso} onChange={e => set('minDiasEnPaso', e.target.value)} placeholder="Sin mínimo" />
            </div>
            <div>
              <Label htmlFor="rec-montmin">Monto mínimo</Label>
              <Input id="rec-montmin" type="number" min={0} value={formData.montoMinimo} onChange={e => set('montoMinimo', e.target.value)} placeholder="Sin límite" />
            </div>
            <div>
              <Label htmlFor="rec-montmax">Monto máximo</Label>
              <Input id="rec-montmax" type="number" min={0} value={formData.montoMaximo} onChange={e => set('montoMaximo', e.target.value)} placeholder="Sin límite" />
            </div>
          </div>
        </div>

        {/* Destinatarios y canales */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinatarios y canales</p>
          <div className="flex items-center gap-2">
            <Checkbox id="rec-resp" checked={formData.enviarAlResponsable} onCheckedChange={v => set('enviarAlResponsable', Boolean(v))} />
            <Label htmlFor="rec-resp" className="cursor-pointer">Al responsable del paso</Label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-email" checked={formData.enviarEmail} onCheckedChange={v => set('enviarEmail', Boolean(v))} />
              <Label htmlFor="rec-email" className="cursor-pointer font-medium">📧 Email</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-wa" checked={formData.enviarWhatsapp} onCheckedChange={v => set('enviarWhatsapp', Boolean(v))} />
              <Label htmlFor="rec-wa" className="cursor-pointer font-medium">💬 WhatsApp</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-tg" checked={formData.enviarTelegram} onCheckedChange={v => set('enviarTelegram', Boolean(v))} />
              <Label htmlFor="rec-tg" className="cursor-pointer font-medium">✈️ Telegram</Label>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-4 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="rec-escalar" checked={formData.escalarAJerarquia} onCheckedChange={v => set('escalarAJerarquia', Boolean(v))} />
              <Label htmlFor="rec-escalar" className="cursor-pointer">Escalar a jerarquía si supera</Label>
            </div>
            {formData.escalarAJerarquia && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  value={formData.diasParaEscalar}
                  onChange={e => set('diasParaEscalar', e.target.value)}
                  className="w-20"
                  placeholder="días"
                />
                <span className="text-sm text-muted-foreground">días sin acción</span>
              </div>
            )}
          </div>
        </div>

        {/* Templates por canal */}
        <CanalesTemplateEditor
          canales={formData.canales ?? []}
          enviarEmail={formData.enviarEmail}
          enviarWhatsapp={formData.enviarWhatsapp}
          enviarTelegram={formData.enviarTelegram}
          bodyVars={REC_VARS}
          tablaVarName="{{ListadoPendientes}}"
          showListadoRowHtml={true}
          listadoRowHtmlExample={`<tr>\n  <td>{{Folio}}</td>\n  <td>{{Proveedor}}</td>\n  <td style="text-align:right">{{Total}}</td>\n  <td style="color:#6b7280">{{DiasEspera}} días</td>\n</tr>`}
          onChange={(canales) => set('canales', canales)}
        />

      </form>
    </Modal>
  );
}

// Sub-componente para editar templates por canal
function CanalesTemplateEditor({ canales, enviarEmail, enviarWhatsapp, enviarTelegram, showListadoRowHtml = false, listadoRowHtmlLabel, listadoRowHtmlVars, listadoRowHtmlPlaceholder, listadoRowHtmlExample, bodyVars, tablaVarName, tipoNotificacion, onChange }: {
  canales: any[];
  enviarEmail: boolean;
  enviarWhatsapp: boolean;
  enviarTelegram: boolean;
  showListadoRowHtml?: boolean;
  listadoRowHtmlLabel?: string;
  listadoRowHtmlVars?: string[];
  listadoRowHtmlPlaceholder?: string;
  listadoRowHtmlExample?: string;
  bodyVars?: string[];
  /** Variable name (e.g. '{{Partidas}}') — when set, shows a per-canal toggle that inserts/removes the var from the body template */
  tablaVarName?: string;
  tipoNotificacion?: string;
  onChange: (canales: any[]) => void;
}) {
  const canalesActivos = [
    { codigo: 'in_app', label: '🔔 In-App' },
    enviarEmail && { codigo: 'email', label: '✉️ Email' },
    enviarWhatsapp && { codigo: 'whatsapp', label: '💬 WhatsApp' },
    enviarTelegram && { codigo: 'telegram', label: '📨 Telegram' },
  ].filter(Boolean) as { codigo: string; label: string }[];

  const [tabActivo, setTabActivo] = useState(canalesActivos[0]?.codigo ?? 'in_app');
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [showPlantillaMenu, setShowPlantillaMenu] = useState<string | null>(null);

  const getCanalData = (codigo: string) =>
    canales.find(c => c.codigoCanal === codigo) ?? {
      codigoCanal: codigo,
      asuntoTemplate: CANAL_DEFAULTS[codigo]?.asunto ?? '',
      cuerpoTemplate: CANAL_DEFAULTS[codigo]?.cuerpo ?? '',
      listadoRowHtml: '',
      activo: true
    };

  const updateCanal = (codigo: string, field: string, value: any) => {
    const existing = canales.find(c => c.codigoCanal === codigo);
    if (existing) {
      onChange(canales.map(c => c.codigoCanal === codigo ? { ...c, [field]: value } : c));
    } else {
      const defaults = getCanalData(codigo);
      onChange([...canales, { ...defaults, [field]: value }]);
    }
  };

  const cargarPlantillas = async (canal: string) => {
    setLoadingPlantillas(true);
    try {
      const params = new URLSearchParams({ canal });
      if (tipoNotificacion) params.append('tipoNotificacion', tipoNotificacion);
      const res = await API.get<any>(`/config/workflows/plantillas-base?${params}`);
      setPlantillas(res.data?.data ?? []);
      setShowPlantillaMenu(canal);
    } catch {
      toast.error('No se pudieron cargar las plantillas');
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const aplicarPlantilla = (canal: string, plantilla: any) => {
    const existing = canales.find(c => c.codigoCanal === canal);
    const base = existing ?? getCanalData(canal);
    const updated = {
      ...base,
      asuntoTemplate: plantilla.asuntoTemplate ?? base.asuntoTemplate,
      cuerpoTemplate: plantilla.cuerpoTemplate ?? base.cuerpoTemplate,
      listadoRowHtml: plantilla.listadoRowHtml ?? base.listadoRowHtml ?? '',
    };
    if (existing) {
      onChange(canales.map(c => c.codigoCanal === canal ? updated : c));
    } else {
      onChange([...canales, updated]);
    }
    setShowPlantillaMenu(null);
  };

  useEffect(() => {
    if (!canalesActivos.find(c => c.codigo === tabActivo)) {
      setTabActivo(canalesActivos[0]?.codigo ?? 'in_app');
    }
  }, [enviarEmail, enviarWhatsapp, enviarTelegram]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plantillas por canal</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {canalesActivos.map(c => (
          <button
            key={c.codigo}
            type="button"
            onClick={() => setTabActivo(c.codigo)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors -mb-px border ${
              tabActivo === c.codigo
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {canalesActivos.map(c => {
        const data = getCanalData(c.codigo);
        return (
          <div key={c.codigo} className={tabActivo === c.codigo ? 'space-y-2' : 'hidden'}>
            {/* Botón cargar plantilla */}
            <div className="relative">
              <button
                type="button"
                onClick={() => showPlantillaMenu === c.codigo ? setShowPlantillaMenu(null) : cargarPlantillas(c.codigo)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                📋 {loadingPlantillas && showPlantillaMenu !== c.codigo ? 'Cargando...' : 'Cargar plantilla base'}
              </button>
              {showPlantillaMenu === c.codigo && (
                <div className="absolute z-10 top-6 left-0 bg-background border border-border rounded-lg shadow-lg p-2 min-w-[280px] space-y-1">
                  {plantillas.length === 0
                    ? <p className="text-xs text-muted-foreground px-2 py-1">Sin plantillas disponibles para este canal</p>
                    : plantillas.map(p => (
                        <button
                          key={p.idPlantilla}
                          type="button"
                          onClick={() => aplicarPlantilla(c.codigo, p)}
                          className="w-full text-left text-xs px-3 py-1.5 rounded hover:bg-muted"
                        >
                          <span className="font-medium">{p.nombre}</span>
                        </button>
                      ))
                  }
                  <button type="button" onClick={() => setShowPlantillaMenu(null)} className="w-full text-xs text-muted-foreground pt-1 border-t border-border mt-1 hover:text-foreground">
                    Cerrar
                  </button>
                </div>
              )}
            </div>

            {(c.codigo === 'email' || c.codigo === 'in_app') && (
              <div>
                <Label className="text-xs">{c.codigo === 'email' ? 'Asunto (opcional)' : 'Título / asunto (opcional)'}</Label>
                <Input
                  value={data.asuntoTemplate ?? ''}
                  onChange={e => updateCanal(c.codigo, 'asuntoTemplate', e.target.value)}
                  placeholder={c.codigo === 'email' ? 'Asunto del email...' : 'Título de la notificación...'}
                  className="text-xs"
                />
              </div>
            )}
            {tablaVarName && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                <Checkbox
                  id={`tabla-${c.codigo}`}
                  checked={(data.cuerpoTemplate ?? '').includes(tablaVarName)}
                  onCheckedChange={(checked) => {
                    const current = data.cuerpoTemplate ?? '';
                    const updated = checked
                      ? current.trimEnd() + (current ? '\n\n' : '') + tablaVarName
                      : current.replace(new RegExp(`\\n*${tablaVarName.replace(/[{}]/g, '\\$&')}\\n*`, 'g'), '\n').trimEnd();
                    updateCanal(c.codigo, 'cuerpoTemplate', updated);
                  }}
                />
                <Label htmlFor={`tabla-${c.codigo}`} className="cursor-pointer text-xs">
                  Incluir tabla en este canal — inserta <code className="bg-background border border-border px-1 rounded text-[10px]">{tablaVarName}</code> al final del cuerpo
                </Label>
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block">Cuerpo</Label>
              {bodyVars && bodyVars.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1 p-2 rounded-md bg-muted/50 border border-border/60">
                  <span className="text-[10px] text-muted-foreground self-center mr-0.5 shrink-0">Variables:</span>
                  {bodyVars.map(v => (
                    <code key={v} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] text-foreground/80">{v}</code>
                  ))}
                </div>
              )}
              <Textarea
                value={data.cuerpoTemplate}
                onChange={e => updateCanal(c.codigo, 'cuerpoTemplate', e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder={`Plantilla para ${c.label}...`}
              />
            </div>
            {showListadoRowHtml && (
              <details className="border border-border rounded p-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
                  {listadoRowHtmlLabel ?? 'Avanzado: fila HTML del listado'}
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1 p-1.5 rounded bg-muted/50 border border-border/60">
                    <span className="text-[10px] text-muted-foreground self-center mr-0.5 shrink-0">Vars:</span>
                    {(listadoRowHtmlVars ?? ['{{Folio}}', '{{Proveedor}}', '{{Total}}', '{{DiasEspera}}']).map(v => (
                      <code key={v} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] text-foreground/80">{v}</code>
                    ))}
                  </div>
                  <Textarea
                    value={data.listadoRowHtml ?? ''}
                    onChange={e => updateCanal(c.codigo, 'listadoRowHtml', e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={listadoRowHtmlPlaceholder ?? 'Dejar vacío para usar la fila por defecto'}
                  />
                  {listadoRowHtmlExample && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <span>💡</span> Ejemplo de fila
                      </p>
                      <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap break-all font-mono leading-relaxed select-all bg-background/80 rounded p-2 border border-border/60">{listadoRowHtmlExample}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
