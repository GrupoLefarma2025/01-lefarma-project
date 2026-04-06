import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Key, Plus, Pencil, Trash2, Search, Loader2, ShieldCheck, Tag, Box, Play, Users, UserCog, X, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Permiso, PermisoConRolesYUsuarios } from '@/types/permiso.types';
import { Rol } from '@/types/rol.types';
import { Usuario } from '@/types/usuario.types';
import { useForm, useWatch } from 'react-hook-form';
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
import { cn } from '@/lib/utils';

const permisoSchema = z.object({
  codigoPermiso: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
  nombrePermiso: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  categoria: z.string().optional().or(z.literal('')),
  recurso: z.string().optional().or(z.literal('')),
  accion: z.string().optional().or(z.literal('')),
  esActivo: z.boolean(),
  rolesIds: z.array(z.number()),
  usuariosIds: z.array(z.number()),
});

type PermisoFormValues = z.infer<typeof permisoSchema>;

// Componente memoizado para la sección de roles
const RolesSection = memo(({
  rolesIds,
  roles,
  onRemoveRol,
  onAddRoles,
}: {
  rolesIds: number[];
  roles: Rol[];
  onRemoveRol: (id: number) => void;
  onAddRoles: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <label className="text-base font-semibold">Roles Asignados</label>
        <Badge variant="secondary">
          {rolesIds.length} rol{rolesIds.length !== 1 ? 'es' : ''}
        </Badge>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAddRoles}>
        <Plus className="h-4 w-4 mr-1" />
        Agregar
      </Button>
    </div>

    {rolesIds.length > 0 ? (
      <div className="space-y-2">
        {roles
          .filter(r => rolesIds.includes(r.idRol))
          .map((rol) => (
            <div
              key={rol.idRol}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{rol.nombreRol}</p>
                  <p className="text-xs text-muted-foreground">{rol.descripcion || 'Sin descripción'}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRemoveRol(rol.idRol)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-lg text-center">
        No hay roles asignados a este permiso
      </p>
    )}
  </div>
));

// Componente memoizado para la sección de usuarios
const UsuariosSection = memo(({
  usuariosIds,
  usuarios,
  onRemoveUsuario,
  onAddUsuarios,
}: {
  usuariosIds: number[];
  usuarios: Usuario[];
  onRemoveUsuario: (id: number) => void;
  onAddUsuarios: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <UserCog className="h-5 w-5 text-muted-foreground" />
        <label className="text-base font-semibold">Usuarios Asignados</label>
        <Badge variant="secondary">
          {usuariosIds.length} usuario{usuariosIds.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAddUsuarios}>
        <Plus className="h-4 w-4 mr-1" />
        Agregar
      </Button>
    </div>

    {usuariosIds.length > 0 ? (
      <div className="space-y-2">
        {usuarios
          .filter(u => usuariosIds.includes(u.idUsuario))
          .map((usuario) => (
            <div
              key={usuario.idUsuario}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{usuario.nombreCompleto || usuario.samAccountName}</p>
                  <p className="text-xs text-muted-foreground">{usuario.correo}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRemoveUsuario(usuario.idUsuario)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic p-4 border border-dashed rounded-lg text-center">
        No hay usuarios asignados a este permiso
      </p>
    )}
  </div>
));

export default function PermisosList() {
  usePageTitle('Permisos', 'Gestión de permisos del sistema');
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisoConRelaciones, setPermisoConRelaciones] = useState<PermisoConRolesYUsuarios | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [isUsuariosModalOpen, setIsUsuariosModalOpen] = useState(false);

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
      rolesIds: [],
      usuariosIds: [],
    },
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rPermisos, rRoles, rUsuarios] = await Promise.all([
        API.get<ApiResponse<Permiso[]>>('/Admin/permisos'),
        API.get<ApiResponse<Rol[]>>('/Admin/roles'),
        API.get<ApiResponse<Usuario[]>>('/Admin/usuarios'),
      ]);

      if (rPermisos.data.success) setPermisos(rPermisos.data.data || []);
      if (rRoles.data.success) setRoles(rRoles.data.data || []);
      if (rUsuarios.data.success) setUsuarios(rUsuarios.data.data || []);
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
    setPermisoConRelaciones(null);
    form.reset({
      codigoPermiso: '',
      nombrePermiso: '',
      descripcion: '',
      categoria: '',
      recurso: '',
      accion: '',
      esActivo: true,
      rolesIds: [],
      usuariosIds: [],
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = async (permiso: Permiso) => {
    setSelectedId(permiso.idPermiso);
    setIsEditing(true);
    setIsModalOpen(true);

    form.reset({
      codigoPermiso: permiso.codigoPermiso,
      nombrePermiso: permiso.nombrePermiso,
      descripcion: permiso.descripcion || '',
      categoria: permiso.categoria || '',
      recurso: permiso.recurso || '',
      accion: permiso.accion || '',
      esActivo: permiso.esActivo,
      rolesIds: [],
      usuariosIds: [],
    });

    // Cargar relaciones del permiso
    try {
      const response = await API.get<ApiResponse<PermisoConRolesYUsuarios>>(`/Admin/permisos/${permiso.idPermiso}/relaciones`);
      if (response.data.success && response.data.data) {
        setPermisoConRelaciones(response.data.data);
        form.setValue('rolesIds', response.data.data.roles.map(r => r.idRol));
        form.setValue('usuariosIds', response.data.data.usuarios.map(u => u.idUsuario));
      }
    } catch (error) {
      console.error('Error al cargar relaciones del permiso:', error);
    }
  };

  const handleRemoveRol = useCallback((rolId: number) => {
    const currentIds = form.getValues('rolesIds');
    form.setValue('rolesIds', currentIds.filter(id => id !== rolId));
  }, [form]);

  const handleAddRoles = useCallback(() => {
    setIsRolesModalOpen(true);
  }, []);

  const handleRemoveUsuario = useCallback((usuarioId: number) => {
    const currentIds = form.getValues('usuariosIds');
    form.setValue('usuariosIds', currentIds.filter(id => id !== usuarioId));
  }, [form]);

  const handleAddUsuarios = useCallback(() => {
    setIsUsuariosModalOpen(true);
  }, []);

  const handleSave = async (values: PermisoFormValues) => {
    setIsSaving(true);
    try {
      const permisoData = {
        codigoPermiso: values.codigoPermiso,
        nombrePermiso: values.nombrePermiso,
        descripcion: values.descripcion,
        categoria: values.categoria,
        recurso: values.recurso,
        accion: values.accion,
        esActivo: values.esActivo,
      };

      const response = isEditing
        ? await API.put(`/Admin/permisos/${selectedId}`, permisoData)
        : await API.post(`/Admin/permisos`, { ...permisoData, esSistema: false });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al guardar el permiso');
      }

      if (isEditing && selectedId) {
        await API.put(`/Admin/permisos/${selectedId}/roles`, { rolesIds: values.rolesIds });
        await API.put(`/Admin/permisos/${selectedId}/usuarios`, { usuariosIds: values.usuariosIds });
      }

      toast.success(isEditing ? "Permiso actualizado" : "Permiso creado");
      setIsModalOpen(false);
      fetchData();
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
        fetchData();
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

  const rolesOptions = useMemo(() => {
    return roles
      .filter(r => r.esActivo)
      .map(r => ({
        label: `${r.nombreRol} ${r.descripcion ? `(${r.descripcion})` : ''}`,
        value: String(r.idRol),
        icon: Shield,
      }));
  }, [roles]);

  const usuarioOptions = useMemo(() => {
    return usuarios
      .filter(u => u.esActivo)
      .map(u => ({
        label: `${u.nombreCompleto || u.samAccountName || 'Usuario'} ${u.correo ? `(${u.correo})` : ''}`,
        value: String(u.idUsuario),
        icon: Users,
      }));
  }, [usuarios]);

  const rolesIds = useWatch({ control: form.control, name: 'rolesIds' }) || [];
  const usuariosIds = useWatch({ control: form.control, name: 'usuariosIds' }) || [];

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
      accessorKey: 'cantidadRoles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>{row.original.cantidadRoles || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: 'cantidadUsuarios',
      header: 'Usuarios',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{row.original.cantidadUsuarios || 0}</span>
        </div>
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
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idPermiso)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
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
        id="modal-permiso"
        open={isModalOpen}
        setOpen={setIsModalOpen}
        title={isEditing ? 'Editar Permiso' : 'Nuevo Permiso'}
        size="xl"
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
          <form className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Datos básicos */}
            <div className="grid grid-cols-1 gap-4">
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
                  <FormItem>
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
                      <Input placeholder="Ej: Órdenes, Inventario..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recurso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recurso</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: ordenes" {...field} />
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
                      <FormLabel>Acción</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: crear, editar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="esActivo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Permiso Activo</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Roles Asignados */}
            {isEditing && (
              <RolesSection
                rolesIds={rolesIds}
                roles={roles}
                onRemoveRol={handleRemoveRol}
                onAddRoles={handleAddRoles}
              />
            )}

            {/* Usuarios Asignados */}
            {isEditing && (
              <UsuariosSection
                usuariosIds={usuariosIds}
                usuarios={usuarios}
                onRemoveUsuario={handleRemoveUsuario}
                onAddUsuarios={handleAddUsuarios}
              />
            )}
          </form>
        </Form>
      </Modal>

      {/* Modal para agregar roles */}
      <Modal
        id="modal-roles"
        open={isRolesModalOpen}
        setOpen={setIsRolesModalOpen}
        title="Agregar Roles"
        size="md"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsRolesModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => setIsRolesModalOpen(false)}>
              Aceptar
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="rolesIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seleccionar Roles</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={rolesOptions}
                    onChange={(vals: string[]) => field.onChange(vals.map((v: string) => Number(v)))}
                    value={field.value.map((v: number) => String(v))}
                    placeholder="Buscar roles..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </Modal>

      {/* Modal para agregar usuarios */}
      <Modal
        id="modal-usuarios"
        open={isUsuariosModalOpen}
        setOpen={setIsUsuariosModalOpen}
        title="Agregar Usuarios"
        size="md"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsUsuariosModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => setIsUsuariosModalOpen(false)}>
              Aceptar
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="usuariosIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seleccionar Usuarios</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={usuarioOptions}
                    onChange={(vals: string[]) => field.onChange(vals.map((v: string) => Number(v)))}
                    value={field.value.map((v: number) => String(v))}
                    placeholder="Buscar usuarios..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </Modal>
    </div>
  );
}
