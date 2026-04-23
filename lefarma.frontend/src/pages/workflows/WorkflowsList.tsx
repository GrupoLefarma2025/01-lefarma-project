import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { 
  Workflow, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Loader2, 
  RefreshCcw, 
  GitBranch,
  Eye,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { WorkflowWithStats } from '@/types/workflow.types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { toApiError } from '@/utils/errors';


const workflowSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  codigoProceso: z
    .string()
    .min(3, 'El código debe tener al menos 3 caracteres')
    .regex(/^[A-Z_]+$/, 'El código debe estar en mayúsculas y usar guiones bajos'),
  version: z.number().min(1, 'La versión debe ser mayor a 0'),
  activo: z.boolean(),
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;
type WorkflowRequest = WorkflowFormValues & { idWorkflow: number };

export default function WorkflowsList() {
  usePageTitle('Workflows', 'Gestión de flujos de autorización y procesos');
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [modalStates, setModalStates] = useState({
    newWorkflow: false,
  });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  const [workflowId, setWorkflowId] = useState(0);

  const formWorkflow = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      codigoProceso: '',
      version: 1,
      activo: true,
    },
  });

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<WorkflowWithStats[]>>(`/config/workflows`);
      if (response.data.success) {
        setWorkflows(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar los workflows');
    }finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleNuevoWorkflow = () => {
    setWorkflowId(0);
    formWorkflow.reset();
    setIsEditing(false);
    toggleModal('newWorkflow', true);
  };

  const handleEditWorkflow = (id: number) => {
    const workflow = workflows.find((w) => w.idWorkflow === id);
    if (workflow) {
      setWorkflowId(workflow.idWorkflow);
      formWorkflow.reset({
        nombre: workflow.nombre,
        descripcion: workflow.descripcion || '',
        codigoProceso: workflow.codigoProceso,
        version: workflow.version,
        activo: workflow.activo,
      });
      setIsEditing(true);
      toggleModal('newWorkflow', true);
    }
  };

  const handleSaveWorkflow = async (values: WorkflowFormValues) => {
    setIsSaving(true);
    try {
      const payload: WorkflowRequest = { idWorkflow: workflowId, ...values };

      const response = isEditing
        ? await API.put(`config/workflows/${workflowId}`, payload)
        : await API.post(`config/workflows`, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Workflow actualizado correctamente.' : 'Workflow creado correctamente.');
        toggleModal('newWorkflow', false);
        await fetchWorkflows();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el workflow');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar el workflow');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este workflow? Esta acción no se puede deshacer.')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`/config/workflows/${id}`);
      if (response.data.success) {
        toast.success('Workflow eliminado correctamente');
        fetchWorkflows();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al eliminar el workflow');
    }
  };

  const handleViewDiagram = (id: number) => {
    navigate(`/workflows/${id}/diagram`);
  };

  const filteredWorkflows = useMemo(() => {
    return workflows.filter(
      (w) =>
        w.nombre.toLowerCase().includes(search.toLowerCase()) ||
        w.codigoProceso.toLowerCase().includes(search.toLowerCase()) ||
        w.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [workflows, search]);

  const columns: ColumnDef<WorkflowWithStats>[] = [
    {
      accessorKey: 'nombre',
      header: 'Workflow',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2.5 ring-1 ring-blue-500/20">
            <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{row.original.nombre}</span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.codigoProceso}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <span className="text-sm text-muted-foreground line-clamp-2">
            {row.original.descripcion || 'Sin descripción'}
          </span>
        </div>
      ),
    },
    {
      id: 'stats',
      header: 'Configuración',
      cell: ({ row }) => (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">
              {row.original.stats?.totalPasos || 0} pasos
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">
              {row.original.stats?.totalAcciones || 0} acciones
            </span>
          </div>
          {(row.original.stats?.totalCondiciones || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">
                {row.original.stats?.totalCondiciones} condiciones
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'version',
      header: 'Versión',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          v{row.original.version}
        </Badge>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge 
          variant={row.original.activo ? 'default' : 'secondary'} 
          className="h-5 gap-1.5"
        >
          {row.original.activo ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Activo
            </>
          ) : (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              Inactivo
            </>
          )}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => handleViewDiagram(row.original.idWorkflow)}
            title="Ver diagrama"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => handleEditWorkflow(row.original.idWorkflow)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original.idWorkflow)}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los flujos de autorización y procesos del sistema
          </p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar workflow, código o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevoWorkflow} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Workflow
        </Button>
      </div>

      {/* Table */}
      <div className="relative">
        {!loading && workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Workflow className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground">No hay workflows configurados</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Comienza creando tu primer flujo de autorización
            </p>
            <Button size="sm" onClick={handleNuevoWorkflow}>
              <Plus className="mr-2 h-4 w-4" /> Crear Workflow
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredWorkflows}
              title="Listado de Workflows"
              showRowCount
              showRefreshButton
              onRefresh={fetchWorkflows}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Nuevo/Editar Workflow */}
      <Modal
        id="modal-workflow"
        open={modalStates.newWorkflow}
        setOpen={(open) => toggleModal('newWorkflow', open)}
        title={isEditing ? 'Editar Workflow' : 'Nuevo Workflow'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newWorkflow', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formWorkflow.handleSubmit(handleSaveWorkflow)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Workflow'}
            </Button>
          </div>
        }
      >
        <Form {...formWorkflow}>
          <form className="space-y-4">
            <FormField
              control={formWorkflow.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Workflow</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Orden de Compra" {...field} />
                  </FormControl>
                  <FormDescription>
                    Nombre descriptivo del flujo de trabajo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formWorkflow.control}
              name="codigoProceso"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código del Proceso</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: ORDEN_COMPRA" 
                      {...field}
                      className="font-mono"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    Identificador único en mayúsculas (sin espacios, usa guiones bajos)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formWorkflow.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Breve descripción del propósito de este workflow" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={formWorkflow.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versión</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={formWorkflow.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>El workflow estará disponible para su uso</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
