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
  Zap
} from 'lucide-react';
import { ACTION_COLORS, HANDLER_LABELS, HANDLER_DESCRIPTIONS, HANDLER_CONFIGS } from '@/components/workflows/constants';
import { HandlerEditModal } from '@/components/workflows/HandlerEditModal';
import { CondicionEditModal } from '@/components/workflows/CondicionEditModal';
import { NotificacionEditModal } from '@/components/workflows/NotificacionEditModal';
import { PlantillasEditModal } from '@/components/workflows/PlantillasEditModal';
import { TemplateEditModal } from '@/components/workflows/TemplateEditModal';
import { RecordatorioEditModal } from '@/components/workflows/RecordatorioEditModal';
import { StepEditForm } from '@/components/workflows/StepEditForm';
import { ActionEditModal } from '@/components/workflows/ActionEditModal';
import { ParticipanteEditModal } from '@/components/workflows/ParticipanteEditModal';
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
import { useWorkflowCatalogs } from '@/hooks/useWorkflowCatalogs';
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

export default function WorkflowDiagram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaso, setSelectedPaso] = useState<WorkflowPaso | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');
  const catalogs = useWorkflowCatalogs();

  usePageTitle(workflow?.nombre || 'Diagrama de Workflow', 'Editor visual de flujo');

  useEffect(() => {
    if (id) {
      fetchWorkflow(parseInt(id));
      catalogs.loadEstados();
    }
  }, [id]);

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
                                Estado: {catalogs.estados.find(e => e.idEstado === paso.idEstado)?.nombre ?? `ID: ${paso.idEstado}`}
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
                      <p className="text-sm">{catalogs.estados.find(e => e.idEstado === selectedPaso.idEstado)?.nombre ?? `ID: ${selectedPaso.idEstado}`}</p>
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
            workflowEstados={catalogs.estados}
            catalogs={catalogs}
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
  catalogs: any;
}

function WorkflowEditorModal({ workflow, open = false, embedded = false, onClose, onSave, workflowEstados = [], catalogs }: WorkflowEditorModalProps) {
  const [activeTab, setActiveTab] = useState('pasos');
  const [editingPaso, setEditingPaso] = useState<WorkflowPaso | null>(null);
  const [isCreatingPaso, setIsCreatingPaso] = useState(false);
  const [editingAccion, setEditingAccion] = useState<WorkflowAccion | null>(null);
  const [editingAccionHandler, setEditingAccionHandler] = useState<{ accion: WorkflowAccion | null; handler: WorkflowAccionHandler | null } | null>(null);
  const [editingCondicion, setEditingCondicion] = useState<any | null>(null);
  const [editingParticipante, setEditingParticipante] = useState<any | null>(null);
  const [editingNotificacion, setEditingNotificacion] = useState<any | null>(null);
  const [editingCanalTemplate, setEditingCanalTemplate] = useState<any | null>(null);
  const [canalTemplates, setCanalTemplates] = useState<any[]>([]);
  const [editingRecordatorio, setEditingRecordatorio] = useState<any | null>(null);
  const [recordatorios, setRecordatorios] = useState<any[]>([]);
  const [ejecutandoRecordatorios, setEjecutandoRecordatorios] = useState(false);


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
    if (activeTab === 'participantes') {
      catalogs.loadRoles();
      catalogs.loadUsuarios();
    }
    if (activeTab === 'notificaciones') {
      catalogs.loadTiposNotificacion();
    }
  }, [activeTab]);

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
                      <Button size="sm" className="gap-2" onClick={handleAddPaso}>
                        <Plus className="h-4 w-4" />
                        Agregar Paso
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {workflow.pasos.map((paso) => (
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
                                    <Badge variant={accion.activo ? 'default' : 'secondary'} className="text-[10px]">
                                      {accion.activo ? 'Activa' : 'Inactiva'}
                                    </Badge>
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
                                <Badge variant={condicion.activo !== false ? 'default' : 'secondary'} className="text-[10px]">
                                  {condicion.activo !== false ? 'Activa' : 'Inactiva'}
                                </Badge>
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
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setEditingAccionHandler({ accion: null, handler: null });
                        toggleModal('handlerModal', true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Regla
                    </Button>
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
                                    <Badge variant={handler.activo !== false ? 'default' : 'secondary'} className="text-[10px]">
                                      {handler.activo !== false ? 'Activo' : 'Inactivo'}
                                    </Badge>
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
                        (paso.participantes || []).map(participante => {
                          const esRol = !!participante.idRol;
                          const nombre = esRol
                            ? (catalogs.roles.find((r: any) => r.idRol === participante.idRol)?.nombreRol ?? `Rol #${participante.idRol}`)
                            : (catalogs.usuarios.find((u: any) => u.idUsuario === participante.idUsuario)?.nombreCompleto ?? `Usuario #${participante.idUsuario}`);
                          return (
                            <div key={participante.idParticipante} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${participante.activo !== false ? 'border-border bg-card hover:bg-accent/50' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-base">{nombre}</span>
                                  <Badge variant="outline" className={`text-xs ${esRol ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'}`}>
                                    {esRol ? 'Rol' : 'Usuario'}
                                  </Badge>
                                  <Badge variant={participante.activo !== false ? 'default' : 'secondary'} className="text-[10px]">
                                    {participante.activo !== false ? 'Activo' : 'Inactivo'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                    {paso.orden}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{paso.nombrePaso}</span>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
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
                              </div>
                            </div>
                          );
                        })
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
                            const res = await API.get<any>(`/config/workflows/canal-templates`);
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
                                    <Badge variant={notificacion.activo !== false ? 'default' : 'secondary'} className="text-[10px]">
                                      {notificacion.activo !== false ? 'Activa' : 'Inactiva'}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 ml-7">
                                    {notificacion.idTipoNotificacion ? (
                                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
                                        <Zap className="mr-1 h-3 w-3" />
                                        {catalogs.tiposNotificacion.find((t: any) => t.idTipo === notificacion.idTipoNotificacion)?.nombre || `Tipo #${notificacion.idTipoNotificacion}`}
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
                            const res = await API.get<any>(`/config/workflows/canal-templates`);
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
          workflowEstados={catalogs.estados}
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
        key={editingAccionHandler ? `h-${editingAccionHandler.handler?.idHandler ?? 'new'}-${editingAccionHandler.accion?.idAccion ?? 'na'}` : 'h-closed'}
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
        key={editingParticipante ? `p-${editingParticipante.idParticipante}` : 'p-closed'}
        workflow={workflow}
        participante={editingParticipante}
        roles={catalogs.roles}
        usuarios={catalogs.usuarios}
        open={modalStates.participanteModal}
        setOpen={(open: boolean) => toggleModal('participanteModal', open)}
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
      {/* Template Edit Modal */}
      <TemplateEditModal
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
