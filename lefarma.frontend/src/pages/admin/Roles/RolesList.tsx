import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Shield, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, Users, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Rol } from '@/types/rol.types';
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
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const rolSchema = z.object({
  nombreRol: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  esActivo: z.boolean(),
  permisosIds: z.array(z.number()),
});

type RolFormValues = z.infer<typeof rolSchema>;

export default function RolesList() {
  usePageTitle('Roles', 'Gestión de roles y asignación de permisos');
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<RolFormValues>({
    resolver: zodResolver(rolSchema),
    defaultValues: {
      nombreRol: '',
      descripcion: '',
      esActivo: true,
      permisosIds: [],
    },
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRoles, rPermisos] = await Promise.all([
        API.get<ApiResponse<Rol[]>>('/Admin/roles'),
        API.get<ApiResponse<Permiso[]>>('/Admin/permisos'),
      ]);

      if (rRoles.data.success) setRoles(rRoles.data.data || []);
      if (rPermisos.data.success) setPermisos(rPermisos.data.data || []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setSelectedId(null);
    form.reset({
      nombreRol: '',
      descripcion: '',
      esActivo: true,
      permisosIds: [],
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (rol: Rol) => {
    setSelectedId(rol.idRol);
    form.reset({
      nombreRol: rol.nombreRol,
      descripcion: rol.descripcion || '',
      esActivo: rol.esActivo,
      permisosIds: rol.permisos?.map(p => p.idPermiso) || [],
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (values: RolFormValues) => {
    setIsSaving(true);
    try {
      const response = isEditing
        ? await API.put(`/Admin/roles/${selectedId}`, values)
        : await API.post(`/Admin/roles`, { ...values, esSistema: false });

      if (response.data.success) {
        toast.success(isEditing ? "Rol actualizado" : "Rol creado");
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este rol?')) return;
    try {
      const response = await API.delete<ApiResponse<boolean>>(`/Admin/roles/${id}`);
      if (response.data.success) {
        toast.success('Rol eliminado');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar');
    }
  };

  const filteredRoles = useMemo(() => {
    return roles.filter(
      (r) =>
        r.nombreRol.toLowerCase().includes(search.toLowerCase()) ||
        r.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [roles, search]);

  const columns: ColumnDef<Rol>[] = [
    {
      accessorKey: 'nombreRol',
      header: 'Rol',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Shield className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombreRol}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.original.descripcion || 'Sin descripción'}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'cantidadUsuarios',
      header: 'Usuarios',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{row.original.cantidadUsuarios}</span>
        </div>
      ),
    },
    {
      id: 'permisos',
      header: 'Permisos',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {row.original.permisos?.slice(0, 3).map((p, i) => (
            <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
              {p.nombrePermiso}
            </Badge>
          ))}
          {row.original.permisos && row.original.permisos.length > 3 && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-muted">
              +{row.original.permisos.length - 3}
            </Badge>
          )}
          {(!row.original.permisos || row.original.permisos.length === 0) && (
            <span className="text-xs text-muted-foreground">-</span>
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
                onClick={() => handleDelete(row.original.idRol)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
          )}
        </div>
      ),
    },
  ];

  const permisoOptions = useMemo(() => {
    return permisos.map(p => ({
      label: `${p.categoria ? `[${p.categoria}] ` : ''}${p.nombrePermiso}`,
      value: String(p.idPermiso),
      icon: Key
    }));
  }, [permisos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Rol
        </Button>
      </div>

      <div className="relative">
        {!loading && roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Shield className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay roles registrados</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredRoles}
              title="Listado de Roles"
              showRowCount
              showRefreshButton
              onRefresh={fetchData}
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
        id="modal-rol"
        open={isModalOpen}
        setOpen={setIsModalOpen}
        title={isEditing ? 'Editar Rol' : 'Nuevo Rol'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleSave)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Rol'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="nombreRol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Rol</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Gerente de Finanzas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Breve descripción de las responsabilidades" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permisosIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignar Permisos</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={permisoOptions}
                        onChange={(vals) => field.onChange(vals.map(v => Number(v)))}
                        value={field.value.map(v => String(v))}
                        placeholder="Seleccionar permisos..."
                      />
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
                      <FormLabel>Rol Activo</FormLabel>
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
