import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Shield, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, Users, Key, UserCog, UserMinus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Rol, RolConUsuarios, UsuarioBasico } from '@/types/rol.types';
import { Permiso } from '@/types/permiso.types';
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


const rolSchema = z.object({
  nombreRol: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  esActivo: z.boolean(),
  permisosIds: z.array(z.number()),
  usuariosIds: z.array(z.number()),
});

type RolFormValues = z.infer<typeof rolSchema>;

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
        No hay usuarios asignados a este rol
      </p>
    )}
  </div>
));

// Componente memoizado para la sección de permisos
const PermisosSection = memo(({
  permisosIds,
  permisosPorCategoria,
  collapsedCategories,
  onToggleCategory,
  onTogglePermiso,
}: {
  permisosIds: number[];
  permisosPorCategoria: Record<string, Permiso[]>;
  collapsedCategories: Set<string>;
  onToggleCategory: (categoria: string) => void;
  onTogglePermiso: (id: number, checked: boolean) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Key className="h-5 w-5 text-muted-foreground" />
      <label className="text-base font-semibold">Permisos por Categoría</label>
      <Badge variant="secondary">
        {permisosIds.length} permiso{permisosIds.length !== 1 ? 's' : ''}
      </Badge>
    </div>

    <div className="space-y-2">
      {Object.entries(permisosPorCategoria)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([categoria, permsCategoria]) => {
          const isCollapsed = collapsedCategories.has(categoria);
          const permisosAsignados = permsCategoria.filter(p => permisosIds.includes(p.idPermiso));

          return (
            <div key={categoria} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => onToggleCategory(categoria)}
                className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{categoria}</span>
                  <Badge variant="outline" className="text-xs">
                    {permisosAsignados.length}/{permsCategoria.length}
                  </Badge>
                </div>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {!isCollapsed && (
                <div className="p-3 space-y-2 bg-background max-h-60 overflow-y-auto">
                  {permsCategoria.map((permiso) => {
                    const isChecked = permisosIds.includes(permiso.idPermiso);
                    return (
                      <div
                        key={permiso.idPermiso}
                        className={cn(
                          "flex items-start gap-3 p-2 rounded transition-colors",
                          isChecked ? "bg-primary/5" : ""
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => onTogglePermiso(permiso.idPermiso, checked as boolean)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{permiso.nombrePermiso}</p>
                          <p className="text-xs text-muted-foreground truncate">{permiso.codigoPermiso}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  </div>
));

export default function RolesList() {
  usePageTitle('Roles', 'Gestión de roles y asignación de permisos');
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [rolConUsuarios, setRolConUsuarios] = useState<RolConUsuarios | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUsuariosModalOpen, setIsUsuariosModalOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const form = useForm<RolFormValues>({
    resolver: zodResolver(rolSchema),
    defaultValues: {
      nombreRol: '',
      descripcion: '',
      esActivo: true,
      permisosIds: [],
      usuariosIds: [],
    },
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRoles, rPermisos, rUsuarios] = await Promise.all([
        API.get<ApiResponse<Rol[]>>('/Admin/roles'),
        API.get<ApiResponse<Permiso[]>>('/Admin/permisos'),
        API.get<ApiResponse<Usuario[]>>('/Admin/usuarios'),
      ]);

      if (rRoles.data.success) setRoles(rRoles.data.data || []);
      if (rPermisos.data.success) setPermisos(rPermisos.data.data || []);
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
    setRolConUsuarios(null);
    setCollapsedCategories(new Set());
    form.reset({
      nombreRol: '',
      descripcion: '',
      esActivo: true,
      permisosIds: [],
      usuariosIds: [],
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = async (rol: Rol) => {
    setSelectedId(rol.idRol);
    setIsEditing(true);
    setIsModalOpen(true);
    setCollapsedCategories(new Set());

    form.reset({
      nombreRol: rol.nombreRol,
      descripcion: rol.descripcion || '',
      esActivo: rol.esActivo,
      permisosIds: rol.permisos?.map(p => p.idPermiso) || [],
      usuariosIds: [],
    });

    // Cargar usuarios del rol
    try {
      const response = await API.get<ApiResponse<RolConUsuarios>>(`/Admin/roles/${rol.idRol}/usuarios`);
      if (response.data.success && response.data.data) {
        setRolConUsuarios(response.data.data);
        form.setValue('usuariosIds', response.data.data.usuarios.map(u => u.idUsuario));
      }
    } catch (error) {
      console.error('Error al cargar usuarios del rol:', error);
    }
  };

  const toggleCategory = (categoria: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoria)) {
        newSet.delete(categoria);
      } else {
        newSet.add(categoria);
      }
      return newSet;
    });
  };

  const handleRemoveUsuario = useCallback((usuarioId: number) => {
    const currentIds = form.getValues('usuariosIds');
    form.setValue('usuariosIds', currentIds.filter(id => id !== usuarioId));
  }, [form]);

  const handleAddUsuarios = useCallback(() => {
    setIsUsuariosModalOpen(true);
  }, []);

  const handleTogglePermiso = useCallback((permisoId: number, checked: boolean) => {
    const currentIds = form.getValues('permisosIds');
    if (checked) {
      form.setValue('permisosIds', [...currentIds, permisoId]);
    } else {
      form.setValue('permisosIds', currentIds.filter(id => id !== permisoId));
    }
  }, [form]);

  const handleSave = async (values: RolFormValues) => {
    setIsSaving(true);
    try {
      // Guardar datos básicos del rol y permisos
      const rolData = {
        nombreRol: values.nombreRol,
        descripcion: values.descripcion,
        esActivo: values.esActivo,
        permisosIds: values.permisosIds,
      };

      const rolResponse = isEditing
        ? await API.put(`/Admin/roles/${selectedId}`, rolData)
        : await API.post(`/Admin/roles`, { ...rolData, esSistema: false });

      if (!rolResponse.data.success) {
        throw new Error(rolResponse.data.message || 'Error al guardar el rol');
      }

      // Si es edición, guardar los usuarios
      if (isEditing && selectedId) {
        await API.put(`/Admin/roles/${selectedId}/usuarios`, { usuariosIds: values.usuariosIds });
      }

      toast.success(isEditing ? "Rol actualizado" : "Rol creado");
      setIsModalOpen(false);
      fetchData();
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
      icon: Key,
      categoria: p.categoria || 'Sin categoría',
    }));
  }, [permisos]);

  const permisosPorCategoria = useMemo(() => {
    const grupos: Record<string, Permiso[]> = {};
    permisos.forEach(p => {
      const cat = p.categoria || 'Sin categoría';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(p);
    });
    return grupos;
  }, [permisos]);

  const usuarioOptions = useMemo(() => {
    return usuarios
      .filter(u => u.esActivo)
      .map(u => ({
        label: `${u.nombreCompleto || u.samAccountName || 'Usuario'} ${u.correo ? `(${u.correo})` : ''}`,
        value: String(u.idUsuario),
        icon: Users,
      }));
  }, [usuarios]);

  // useWatch es más eficiente que form.watch() - solo re-renderiza cuando estos valores cambian
  const permisosIds = useWatch({ control: form.control, name: 'permisosIds' }) || [];
  const usuariosIds = useWatch({ control: form.control, name: 'usuariosIds' }) || [];

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
        size="xl"
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
          <form className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Datos básicos */}
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

            {/* Usuarios Asignados */}
            {isEditing && (
              <UsuariosSection
                usuariosIds={usuariosIds}
                usuarios={usuarios}
                onRemoveUsuario={handleRemoveUsuario}
                onAddUsuarios={handleAddUsuarios}
              />
            )}

            {/* Permisos por categoría */}
            <PermisosSection
              permisosIds={permisosIds}
              permisosPorCategoria={permisosPorCategoria}
              collapsedCategories={collapsedCategories}
              onToggleCategory={toggleCategory}
              onTogglePermiso={handleTogglePermiso}
            />
          </form>
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
            <Button
              type="button"
              onClick={() => {
                setIsUsuariosModalOpen(false);
              }}
            >
              Agregar Seleccionados
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Selecciona los usuarios que deseas agregar a este rol:
            </p>
            <FormField
              control={form.control}
              name="usuariosIds"
              render={({ field }) => (
                <FormItem>
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
          </div>
        </Form>
      </Modal>
    </div>
  );
}
