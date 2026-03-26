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
  Info
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
import type { Workflow, WorkflowPaso, WorkflowAccion } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
}

// Tipos de acciones para los colores
const ACTION_COLORS = {
  APROBACION: '#10b981', // green
  RECHAZO: '#ef4444',    // red
  RETORNO: '#f59e0b',    // amber
  CANCELACION: '#6b7280' // gray
} as const;

export default function WorkflowDiagram() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPaso, setSelectedPaso] = useState<WorkflowPaso | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  usePageTitle(workflow?.nombre || 'Diagrama de Workflow', 'Editor visual de flujo');

  useEffect(() => {
    if (id) {
      fetchWorkflow(parseInt(id));
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
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar el workflow');
      navigate('/workflows');
    } finally {
      setLoading(false);
    }
  };

  const renderConnection = (
    fromPos: { x: number; y: number },
    toPos: { x: number; y: number },
    accion: WorkflowAccion,
    index: number, // Para offsetear labels cuando hay múltiples conexiones
    totalConnections: number
  ) => {
    const nodeWidth = 220;
    const nodeHeight = 90;

    // Puntos de inicio y fin
    const startX = fromPos.x + nodeWidth / 2;
    const startY = fromPos.y + nodeHeight;
    const endX = toPos.x + nodeWidth / 2;
    const endY = toPos.y;

    // Color según tipo de acción
    const color = ACTION_COLORS[accion.tipoAccion as keyof typeof ACTION_COLORS] || '#6b7280';

    // Calcular si va hacia arriba, abajo, izquierda o derecha
    const goingDown = endY > startY;
    const goingRight = endX > startX;
    const goingLeft = endX < startX;

    let path: string;
    let labelX: number;
    let labelY: number;
    let labelOffset = 0;

    // Offset para evitar overlapping de labels
    if (totalConnections > 1) {
      labelOffset = (index - (totalConnections - 1) / 2) * 20;
    }

    if (goingDown) {
      // Conexión hacia abajo (normal)
      const midY = startY + (endY - startY) / 2;
      path = `M ${startX} ${startY} 
              C ${startX} ${midY}, 
                ${endX} ${midY}, 
                ${endX} ${endY}`;
      labelX = (startX + endX) / 2 + labelOffset;
      labelY = (startY + endY) / 2;
    } else {
      // Conexión hacia arriba o lateral (retornos)
      const controlOffset = 80;
      const midX = (startX + endX) / 2;
      
      if (goingLeft) {
        // Curva hacia la izquierda y arriba
        path = `M ${startX} ${startY} 
                C ${startX - controlOffset} ${startY + 30}, 
                  ${endX - controlOffset} ${endY - 30}, 
                  ${endX} ${endY}`;
        labelX = startX - controlOffset + labelOffset;
        labelY = (startY + endY) / 2;
      } else {
        // Curva hacia arriba en el mismo lugar
        path = `M ${startX} ${startY} 
                C ${startX + controlOffset} ${startY + 30}, 
                  ${endX + controlOffset} ${endY - 30}, 
                  ${endX} ${endY}`;
        labelX = startX + controlOffset + labelOffset;
        labelY = (startY + endY) / 2;
      }
    }

    return (
      <g key={`connection-${accion.idAccion}`}>
        {/* Línea con gradiente */}
        <defs>
          <linearGradient
            id={`gradient-${accion.idAccion}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <path
          d={path}
          stroke={`url(#gradient-${accion.idAccion})`}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="5,5"
          className="transition-all duration-300"
          opacity={0.7}
        />

        {/* Punta de flecha */}
        <polygon
          points={`${endX},${endY} ${endX - 6},${endY - 10} ${endX + 6},${endY - 10}`}
          fill={color}
          opacity={0.9}
        />

        {/* Label de la acción con fondo */}
        <g>
          {/* Fondo del label */}
          <rect
            x={labelX - 45}
            y={labelY - 10}
            width={90}
            height={20}
            rx={4}
            fill="#0a0e14"
            fillOpacity={0.9}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
          {/* Texto */}
          <text
            x={labelX}
            y={labelY + 4}
            fontSize="11"
            fill={color}
            textAnchor="middle"
            fontFamily="Manrope, sans-serif"
            fontWeight="600"
          >
            {accion.nombreAccion.length > 12
              ? accion.nombreAccion.substring(0, 12) + '...'
              : accion.nombreAccion}
          </text>
        </g>
      </g>
    );
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
                            {paso.codigoEstado && (
                              <p className="text-xs font-mono text-muted-foreground ml-8">
                                {paso.codigoEstado}
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
                            {paso.handlerKey && (
                              <Badge variant="secondary" className="text-xs">
                                {paso.handlerKey}
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
                              const color = ACTION_COLORS[accion.tipoAccion as keyof typeof ACTION_COLORS] || '#6b7280';
                              
                              return (
                                <div
                                  key={accion.idAccion}
                                  className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-background/50 hover:bg-accent/50 transition-colors"
                                >
                                  <div className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{accion.nombreAccion}</p>
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
                                    {accion.tipoAccion}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditorOpen(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Editar Configuración
          </Button>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
        {/* Main canvas */}
        <div className="lg:col-span-2 relative flex flex-col gap-4">
          {/* Legend - Simplified */}
          <div className="bg-card rounded-lg border border-border p-3 shrink-0">
            <div className="flex items-center gap-6 text-xs flex-wrap">
              <span className="text-muted-foreground font-semibold">Tipos de Acción:</span>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-green-500" />
                <span>Aprobación</span>
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
            {viewMode === 'diagram' ? (
              renderDiagram()
            ) : (
              <div className="bg-card rounded-lg border border-border p-6 h-full flex items-center justify-center">
                <p className="text-muted-foreground">Vista de configuración (TODO)</p>
              </div>
            )}
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

                {selectedPaso.codigoEstado && (
                  <div>
                    <label className="text-xs text-muted-foreground">Código Estado</label>
                    <p className="text-sm font-mono">{selectedPaso.codigoEstado}</p>
                  </div>
                )}

                {selectedPaso.descripcionAyuda && (
                  <div>
                    <label className="text-xs text-muted-foreground">Descripción</label>
                    <p className="text-sm">{selectedPaso.descripcionAyuda}</p>
                  </div>
                )}

                {selectedPaso.handlerKey && (
                  <div>
                    <label className="text-xs text-muted-foreground">Handler</label>
                    <Badge variant="outline" className="mt-1 font-mono">
                      <Wrench className="mr-1 h-3 w-3" />
                      {selectedPaso.handlerKey}
                    </Badge>
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
                          <span>{accion.nombreAccion}</span>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: ACTION_COLORS[accion.tipoAccion as keyof typeof ACTION_COLORS],
                              color: ACTION_COLORS[accion.tipoAccion as keyof typeof ACTION_COLORS]
                            }}
                          >
                            {accion.tipoAccion}
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

      {/* Editor Modal */}
      {workflow && (
        <WorkflowEditorModal
          workflow={workflow}
          open={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={async () => {
            await fetchWorkflow(workflow.idWorkflow);
            setIsEditorOpen(false);
            toast.success('Cambios guardados correctamente');
          }}
        />
      )}
    </div>
  );
}


interface WorkflowEditorModalProps {
  workflow: WorkflowWithDetails;
  open: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

function WorkflowEditorModal({ workflow, open, onClose, onSave }: WorkflowEditorModalProps) {
  const [activeTab, setActiveTab] = useState('pasos');
  const [isSaving, setIsSaving] = useState(false);
  const [editingPaso, setEditingPaso] = useState<WorkflowPaso | null>(null);
  const [editingAccion, setEditingAccion] = useState<WorkflowAccion | null>(null);
  const [editingCondicion, setEditingCondicion] = useState<any | null>(null);
  const [editingParticipante, setEditingParticipante] = useState<any | null>(null);
  const [editingNotificacion, setEditingNotificacion] = useState<any | null>(null);
  
  const [modalStates, setModalStates] = useState({
    stepForm: false,
    actionModal: false,
    condicionModal: false,
    participanteModal: false,
    notificacionModal: false
  });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } catch (error) {
      toast.error('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPaso = (paso: WorkflowPaso) => {
    setEditingPaso(paso);
    toggleModal('stepForm', true);
  };

  const handleSavePaso = async (updatedPaso: WorkflowPaso) => {
    try {
      // Preparar el request para actualizar el paso
      const updateRequest = {
        nombrePaso: updatedPaso.nombrePaso,
        codigoEstado: updatedPaso.codigoEstado || null,
        descripcionAyuda: updatedPaso.descripcionAyuda || null,
        handlerKey: updatedPaso.handlerKey || null,
        esInicio: updatedPaso.esInicio,
        esFinal: updatedPaso.esFinal,
        requiereFirma: updatedPaso.requiereFirma,
        requiereComentario: updatedPaso.requiereComentario,
        requiereAdjunto: updatedPaso.requiereAdjunto
      };

      // Llamar al endpoint de actualización de paso
      const response = await API.put<ApiResponse<WorkflowPaso>>(
        `/config/workflows/${workflow.idWorkflow}/pasos/${updatedPaso.idPaso}`,
        updateRequest
      );

      if (response.data.success) {
        toggleModal('stepForm', false);
        setEditingPaso(null);
        toast.success('Paso actualizado correctamente');
        // Recargar el workflow completo para ver los cambios
        await onSave();
      } else {
        toast.error('Error al actualizar el paso');
      }
    } catch (error) {
      console.error('Error saving paso:', error);
      toast.error('Error al actualizar el paso');
    }
  };

  return (
     <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] p-0">
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

        <div className="flex-1 overflow-hidden px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="pasos" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Pasos
              </TabsTrigger>
              <TabsTrigger value="acciones" className="gap-2">
                <Play className="h-4 w-4" />
                Acciones
              </TabsTrigger>
              <TabsTrigger value="condiciones" className="gap-2">
                <Filter className="h-4 w-4" />
                Condiciones
              </TabsTrigger>
              <TabsTrigger value="participantes" className="gap-2">
                <Users className="h-4 w-4" />
                Participantes
              </TabsTrigger>
              <TabsTrigger value="notificaciones" className="gap-2">
                <Bell className="h-4 w-4" />
                Notificaciones
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="pasos" className="mt-0 h-full">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Gestiona los pasos del flujo de trabajo
                    </p>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Paso
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {workflow.pasos.map((paso) => (
                      <div
                        key={paso.idPaso}
                        className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 rounded-md bg-muted px-2 py-1">
                              <span className="text-xs font-mono">{paso.orden}</span>
                            </div>
                            <div>
                              <h4 className="font-semibold">{paso.nombrePaso}</h4>
                              {paso.codigoEstado && (
                                <p className="text-xs font-mono text-muted-foreground mt-1">
                                  {paso.codigoEstado}
                                </p>
                              )}
                              {paso.descripcionAyuda && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {paso.descripcionAyuda}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-3">
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
                                {paso.handlerKey && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Wrench className="mr-1 h-3 w-3" />
                                    {paso.handlerKey}
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
                            <Button variant="ghost" size="sm" className="text-destructive">
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
                              const color = ACTION_COLORS[accion.tipoAccion as keyof typeof ACTION_COLORS] || '#6b7280';
                              
                              return (
                                <div
                                  key={accion.idAccion}
                                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                                >
                                  <div className="h-10 w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{accion.nombreAccion}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {destinoPaso ? `→ ${destinoPaso.nombrePaso}` : 'Sin destino'}
                                    </p>
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
                                    {accion.tipoAccion}
                                  </Badge>
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
                          <div key={condicion.idCondicion} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                  {paso.orden}
                                </span>
                                <span className="font-medium text-sm">{paso.nombrePaso}</span>
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
                          <div key={participante.idParticipante} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                  {paso.orden}
                                </span>
                                <span className="font-medium text-sm">{paso.nombrePaso}</span>
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

                  {workflow.pasos.some(p => (p.acciones || []).some(a => a.notificaciones && a.notificaciones.length > 0)) ? (
                    <div className="space-y-2">
                      {workflow.pasos.flatMap(paso =>
                        (paso.acciones || []).flatMap(accion =>
                          (accion.notificaciones || []).map(notificacion => (
                            <div key={notificacion.idNotificacion} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                                    {paso.orden}
                                  </span>
                                  <span className="font-medium text-sm">{accion.nombreAccion}</span>
                                  <Badge variant="outline" className="text-xs">{accion.tipoAccion}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {[
                                    notificacion.enviarEmail ? 'Email' : null,
                                    notificacion.enviarWhatsapp ? 'WhatsApp' : null,
                                    notificacion.enviarTelegram ? 'Telegram' : null
                                  ].filter(Boolean).join(', ') || 'Sin canal'} • {notificacion.asuntoTemplate || 'Sin asunto'}
                                </p>
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
            </div>
          </Tabs>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Vista Previa
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Step Edit Form */}
      {editingPaso && (
        <StepEditForm
          paso={editingPaso}
          open={modalStates.stepForm}
          onClose={() => {
            toggleModal('stepForm', false);
            setEditingPaso(null);
          }}
          onSave={handleSavePaso}
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
}

function StepEditForm({ paso, open, onClose, onSave }: StepEditFormProps) {
  const [formData, setFormData] = useState<WorkflowPaso>(paso);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(paso);
  }, [paso]);

  const handleChange = (field: keyof WorkflowPaso, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      toast.error('Error al guardar el paso');
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

              <div className="space-y-2">
                <Label htmlFor="codigoEstado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Código de Estado *
                </Label>
                <Input
                  id="codigoEstado"
                  value={formData.codigoEstado || ''}
                  onChange={(e) => handleChange('codigoEstado', e.target.value)}
                  placeholder="ej. EN_REVISION_F2"
                  required
                  className="font-mono text-sm"
                />
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

            <div className="space-y-2">
              <Label htmlFor="handlerKey" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Handler (Opcional)
              </Label>
              <Input
                id="handlerKey"
                value={formData.handlerKey || ''}
                onChange={(e) => handleChange('handlerKey', e.target.value)}
                placeholder="ej. Firma3Handler, Firma4Handler"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Clase del handler para lógica personalizada (ej. asignar CC en Firma 3)
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
    nombreAccion: '',
    tipoAccion: 'APROBACION',
    claseEstetica: 'success',
    idPasoOrigen: 0,
    idPasoDestino: 0
  });

  useEffect(() => {
    if (accion) {
      // Encontrar el paso origen de esta acción
      const pasoOrigen = workflow.pasos.find(p => 
        p.acciones?.some(a => a.idAccion === accion.idAccion)
      );
      
      setFormData({
        nombreAccion: accion.nombreAccion,
        tipoAccion: accion.tipoAccion,
        claseEstetica: accion.claseEstetica || 'success',
        idPasoOrigen: pasoOrigen?.idPaso || 0,
        idPasoDestino: accion.idPasoDestino || 0
      });
    } else {
      setFormData({
        nombreAccion: '',
        tipoAccion: 'APROBACION',
        claseEstetica: 'success',
        idPasoOrigen: workflow.pasos[0]?.idPaso || 0,
        idPasoDestino: 0
      });
    }
  }, [accion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // TODO: Implement API call
      console.log('Saving accion:', formData);
      await onSave();
      toast.success(accion ? 'Acción actualizada' : 'Acción creada');
    } catch (error) {
      toast.error('Error al guardar la acción');
    } finally {
      setIsSaving(false);
    }
  };

  const tiposAccion = [
    { value: 'APROBACION', label: 'Aprobación', color: '#10b981' },
    { value: 'RECHAZO', label: 'Rechazo', color: '#ef4444' },
    { value: 'RETORNO', label: 'Retorno', color: '#f59e0b' },
    { value: 'CANCELACION', label: 'Cancelación', color: '#6b7280' }
  ];

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
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre de la Acción */}
        <div className="space-y-2">
          <Label htmlFor="nombreAccion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nombre de la Acción *
          </Label>
          <Input
            id="nombreAccion"
            value={formData.nombreAccion}
            onChange={(e) => setFormData(prev => ({ ...prev, nombreAccion: e.target.value }))}
            placeholder="ej. Autorizar, Rechazar, Devolver Corrección"
            required
            className="font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Este es el texto que verá el usuario en el botón de acción
          </p>
        </div>

        {/* Tipo de Acción */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Acción *
          </Label>
          <Select
            value={formData.tipoAccion}
            onValueChange={(value) => setFormData(prev => ({ ...prev, tipoAccion: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposAccion.map(tipo => (
                <SelectItem key={tipo.value} value={tipo.value}>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6" style={{ backgroundColor: tipo.color }} />
                    <span>{tipo.label}</span>
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
                style={{ backgroundColor: tiposAccion.find(t => t.value === formData.tipoAccion)?.color }}
              />
              <span className="font-mono text-xs px-2 py-1 rounded bg-background">
                {formData.nombreAccion}
              </span>
              <div 
                className="h-0.5 flex-1" 
                style={{ backgroundColor: tiposAccion.find(t => t.value === formData.tipoAccion)?.color }}
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
    idPasoSiCumple: 0
  });

  useEffect(() => {
    if (condicion) {
      setFormData(condicion);
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        campoEvaluacion: '',
        operador: '>',
        valorComparacion: '',
        idPasoSiCumple: 0
      });
    }
  }, [condicion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      console.log('Saving condicion:', formData);
      await onSave();
      toast.success(condicion ? 'Condición actualizada' : 'Condición creada');
    } catch (error) {
      toast.error('Error al guardar la condición');
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
    idUsuario: 0
  });

  useEffect(() => {
    if (participante) {
      setFormData({
        idPaso: participante.idPaso,
        idRol: participante.idRol || 0,
        idUsuario: participante.idUsuario || 0
      });
      setTipoAsignacionUI(participante.idRol ? 'rol' : 'usuario');
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        idRol: 0,
        idUsuario: 0
      });
      setTipoAsignacionUI('rol');
    }
  }, [participante, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idPaso: formData.idPaso,
        idRol: tipoAsignacionUI === 'rol' ? (formData.idRol || null) : null,
        idUsuario: tipoAsignacionUI === 'usuario' ? (formData.idUsuario || null) : null
      };
      console.log('Saving participante:', payload);
      await onSave();
      toast.success(participante ? 'Participante actualizado' : 'Participante agregado');
    } catch (error) {
      toast.error('Error al guardar el participante');
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
  const [formData, setFormData] = useState({
    idAccion: 0,
    enviarEmail: true,
    enviarWhatsapp: false,
    enviarTelegram: false,
    avisarAlCreador: true,
    avisarAlSiguiente: true,
    avisarAlAnterior: false,
    asuntoTemplate: '',
    cuerpoTemplate: ''
  });

  useEffect(() => {
    if (notificacion) {
      setFormData(notificacion);
    } else {
      // Encontrar la primera acción disponible
      const primeraAccion = workflow.pasos.flatMap(p => p.acciones || [])[0];
      setFormData({
        idAccion: primeraAccion?.idAccion || 0,
        enviarEmail: true,
        enviarWhatsapp: false,
        enviarTelegram: false,
        avisarAlCreador: true,
        avisarAlSiguiente: true,
        avisarAlAnterior: false,
        asuntoTemplate: '',
        cuerpoTemplate: ''
      });
    }
  }, [notificacion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      console.log('Saving notificacion:', formData);
      await onSave();
      toast.success(notificacion ? 'Notificación actualizada' : 'Notificación creada');
    } catch (error) {
      toast.error('Error al guardar la notificación');
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
              {todasLasAcciones.map(({ idAccion, nombreAccion, tipoAccion, paso }) => (
                <SelectItem key={idAccion} value={idAccion.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">[{paso.orden}]</span>
                    <span>{nombreAccion}</span>
                    <Badge variant="outline" className="text-xs">
                      {tipoAccion}
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
          </div>
          <p className="text-xs text-muted-foreground">
            Creador: quien inició la orden • Siguiente: quien recibirá la orden • Anterior: quien tenía la orden
          </p>
        </div>

        {/* Templates */}
        {formData.enviarEmail && (
          <>
            <div className="space-y-2">
              <Label htmlFor="asuntoTemplate" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asunto del Email
              </Label>
              <Input
                id="asuntoTemplate"
                value={formData.asuntoTemplate}
                onChange={(e) => setFormData(prev => ({ ...prev, asuntoTemplate: e.target.value }))}
                placeholder="ej. Orden {{Folio}} - {{Accion}}"
              />
              <p className="text-xs text-muted-foreground">
                Variables: {'{{Folio}}, {{Accion}}, {{Usuario}}, {{Total}}'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuerpoTemplate" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cuerpo del Mensaje *
              </Label>
              <Textarea
                id="cuerpoTemplate"
                value={formData.cuerpoTemplate}
                onChange={(e) => setFormData(prev => ({ ...prev, cuerpoTemplate: e.target.value }))}
                placeholder="Hola, la orden {{Folio}} por un total de ${{Total}} ha sido {{Accion}}."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Usa variables para personalizar el mensaje
              </p>
            </div>
          </>
        )}

        {/* Warning note */}
        <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs">
              Las notificaciones se enviarán automáticamente cuando se ejecute esta acción.
              Puedes usar variables en el template como {'{nombreUsuario}'}, {'{fechaAccion}'}, {'{estadoActual}'}.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}


