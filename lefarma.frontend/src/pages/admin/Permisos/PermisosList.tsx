import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Key, Plus, Pencil, Trash2, Search, Loader2, ShieldCheck, Tag, Box, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Permiso } from '@/types/permiso.types';
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
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const permisoSchema = z.object({
  codigoPermiso: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
  nombrePermiso: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  categoria: z.string().optional().or(z.literal('')),
  recurso: z.string().optional().or(z.literal('')),
  accion: z.string().optional().or(z.literal('')),
  esActivo: z.boolean(),
});

type PermisoFormValues = z.infer<typeof permisoSchema>;

export default function PermisosList() {
  usePageTitle('Permisos', 'Gestión de permisos del sistema');
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<PermisoFormValues>({
    resolver: zodResolver(permisoSchema),
    defaultValues: {
      codigoPermiso: '',
      nombrePermiso: '',
      descripcion: '',
      categoria: '',
      recurso: '',
      accion: '',
      esActivo: true,
    },
  });

  const fetchPermisos = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Permiso[]>>('/Admin/permisos');
      if (response.data.success) {
        setPermisos(response.data.data || []);
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar los permisos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermisos();
  }, []);

  const handleCreate = () => {
    setSelectedId(null);
    form.reset({
      codigoPermiso: '',
      nombrePermiso: '',
      descripcion: '',
      categoria: '',
      recurso: '',
      accion: '',
      esActivo: true,
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (permiso: Permiso) => {
    setSelectedId(permiso.idPermiso);
    form.reset({
      codigoPermiso: permiso.codigoPermiso,
      nombrePermiso: permiso.nombrePermiso,
      descripcion: permiso.descripcion || '',
      categoria: permiso.categoria || '',
      recurso: permiso.recurso || '',
      accion: permiso.accion || '',
      esActivo: permiso.esActivo,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (values: PermisoFormValues) => {
    setIsSaving(true);
    try {
      const response = isEditing
        ? await API.put(`/Admin/permisos/${selectedId}`, values)
        : await API.post(`/Admin/permisos`, { ...values, esSistema: false });

      if (response.data.success) {
        toast.success(isEditing ? "Permiso actualizado" : "Permiso creado");
        setIsModalOpen(false);
        fetchPermisos();
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este permiso?')) return;
    try {
      const response = await API.delete<ApiResponse<boolean>>(`/Admin/permisos/${id}`);
      if (response.data.success) {
        toast.success('Permiso eliminado');
        fetchPermisos();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar');
    }
  };

  const filteredPermisos = useMemo(() => {
    return permisos.filter(
      (p) =>
        p.nombrePermiso.toLowerCase().includes(search.toLowerCase()) ||
        p.codigoPermiso.toLowerCase().includes(search.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(search.toLowerCase())
    );
  }, [permisos, search]);

  const columns: ColumnDef<Permiso>[] = [
    {
      accessorKey: 'codigoPermiso',
      header: 'Código',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{row.original.codigoPermiso}</span>
        </div>
      ),
    },
    {
      accessorKey: 'nombrePermiso',
      header: 'Permiso',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row.original.nombrePermiso}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {row.original.descripcion || 'Sin descripción'}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'categoria',
      header: 'Categoría',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="h-3 w-3" />
          <span>{row.original.categoria || '-'}</span>
        </div>
      ),
    },
    {
      id: 'tecnico',
      header: 'Recurso/Acción',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
           {row.original.recurso && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal bg-muted">
                <Box className="h-2.5 w-2.5" />
                {row.original.recurso}
              </Badge>
           )}
           {row.original.accion && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal border-primary/20 text-primary">
                <Play className="h-2.5 w-2.5" />
                {row.original.accion}
              </Badge>
           )}
        </div>
      ),
    },
    {
      accessorKey: 'esActivo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.esActivo ? 'default' : 'secondary'} className="h-5">
          {row.original.esActivo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {!row.original.esSistema && (
             <Button
                size="sm"
                variant="destructive"
                className="h-8 gap-1.5"
                onClick={() => handleDelete(row.original.idPermiso)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, nombre o categoría..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Permiso
        </Button>
      </div>

      <div className="relative">
        {!loading && permisos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <ShieldCheck className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay permisos registrados</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredPermisos}
              title="Listado de Permisos"
              showRowCount
              showRefreshButton
              onRefresh={fetchPermisos}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-permiso"
        open={isModalOpen}
        setOpen={setIsModalOpen}
        title={isEditing ? 'Editar Permiso' : 'Nuevo Permiso'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleSave)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Permiso'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="codigoPermiso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Único</FormLabel>
                    <FormControl>
                      <Input placeholder="MODULO_ACCION" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombrePermiso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Crear Órdenes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Explica brevemente qué hace este permiso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Catálogos, Compras" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="recurso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurso (API)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Empresas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="accion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acción (API)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: CREATE, DELETE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="esActivo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
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
