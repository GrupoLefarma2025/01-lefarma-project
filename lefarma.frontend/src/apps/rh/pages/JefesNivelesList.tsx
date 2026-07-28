import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { empleadoJefesConfigApi, usuariosCatalogoApi } from '../services/rh.api';
import type {
  EmpleadoJefeConfigItem,
  EmpleadoJefesConfigListItem,
  UpdateEmpleadoJefesConfigRequest,
} from '@/types/jefesNiveles.types';
import type { UsuarioCatalogo } from '../services/rh.api';

const MAX_NIVEL = 5;

const nivelesSchema = z.object({
  idUsuario: z.number().int().positive('Selecciona un empleado válido'),
  niveles: z
    .array(
      z.object({
        nivel: z.number().int().min(1).max(MAX_NIVEL),
        aplica: z.boolean(),
      })
    )
    .refine(
      (arr) => arr.filter((n) => n.aplica).length > 0,
      'Debes activar al menos un nivel'
    ),
});

type FormValues = z.infer<typeof nivelesSchema>;

function buildDefaultNiveles(niveles: EmpleadoJefeConfigItem[]): FormValues {
  const map = new Map<number, boolean>(niveles.map((n) => [n.nivel, n.aplica]));
  const all: FormValues['niveles'] = Array.from({ length: MAX_NIVEL }, (_, i) => {
    const nivel = i + 1;
    return { nivel, aplica: map.get(nivel) ?? (nivel === 1) };
  });
  return { idUsuario: 0, niveles: all };
}

export default function JefesNivelesList() {
  usePageTitle('Jefes por Niveles', 'Configuración de niveles de jefe por empleado');

  const [items, setItems] = useState<EmpleadoJefesConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingIdUsuario, setEditingIdUsuario] = useState(0);
  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  const [modalStates, setModalStates] = useState({ edit: false });
  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates((prev) => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(nivelesSchema),
    defaultValues: buildDefaultNiveles([]),
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await empleadoJefesConfigApi.getList();
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      setLoadingUsuarios(true);
      const list = await usuariosCatalogoApi.getAll();
      setUsuarios(list);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar usuarios');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleNuevo = () => {
    setEditingIdUsuario(0);
    form.reset(buildDefaultNiveles([]));
    form.setValue('idUsuario', 0);
    setIsEditing(false);
    toggleModal('edit', true);
    if (usuarios.length === 0) fetchUsuarios();
  };

  const handleEditar = (idUsuario: number) => {
    const item = items.find((i) => i.idUsuario === idUsuario);
    setEditingIdUsuario(idUsuario);
    form.reset(
      buildDefaultNiveles(item?.niveles ?? [{ nivel: 1, aplica: true }])
    );
    form.setValue('idUsuario', idUsuario);
    setIsEditing(true);
    toggleModal('edit', true);
  };

  const handleEliminar = async (idUsuario: number) => {
    if (!confirm(`¿Eliminar la configuración del usuario ${idUsuario}? Volverá al default legacy (solo nivel 1).`)) return;
    try {
      const response = await empleadoJefesConfigApi.update(idUsuario, { niveles: [] });
      if (response.data.success) {
        toast.success('Configuración eliminada (volvió al default).');
        await fetchItems();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar la configuración');
    }
  };

  const handleGuardar = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const targetIdUsuario = isEditing ? editingIdUsuario : values.idUsuario;
      const payload: UpdateEmpleadoJefesConfigRequest = {
        niveles: values.niveles.filter((n) => n.aplica),
      };

      const response = await empleadoJefesConfigApi.update(targetIdUsuario, payload);
      if (response.data.success) {
        toast.success(isEditing ? 'Configuración actualizada.' : 'Configuración creada.');
        toggleModal('edit', false);
        await fetchItems();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la configuración');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(e.description));
      } else {
        toast.error(err.message ?? 'Error al guardar la configuración');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        (i.nombreCompleto ?? '').toLowerCase().includes(term) ||
        (i.numeroEmpleado ?? '').toLowerCase().includes(term) ||
        (i.puesto ?? '').toLowerCase().includes(term) ||
        String(i.idUsuario).includes(term)
    );
  }, [items, search]);

  const columns: ColumnDef<EmpleadoJefesConfigListItem>[] = [
    {
      accessorKey: 'numeroEmpleado',
      header: 'Nómina',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.numeroEmpleado ?? '—'}
        </span>
      ),
    },
    {
      id: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {row.original.nombreCompleto ?? `Usuario ${row.original.idUsuario}`}
          </span>
          <span className="text-xs text-muted-foreground">
            idUsuario: {row.original.idUsuario}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'puesto',
      header: 'Puesto',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.puesto ?? '—'}
        </span>
      ),
    },
    {
      id: 'niveles',
      header: 'Niveles activos',
      cell: ({ row }) => {
        const activos = row.original.niveles
          .filter((n) => n.aplica)
          .sort((a, b) => a.nivel - b.nivel);
        if (activos.length === 0) {
          return <Badge variant="secondary">Default (nivel 1)</Badge>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {activos.map((n) => (
              <Badge key={n.nivel} variant="outline" className="h-5">
                Nivel {n.nivel}
              </Badge>
            ))}
          </div>
        );
      },
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
            onClick={() => handleEditar(row.original.idUsuario)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleEliminar(row.original.idUsuario)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const nivelesActivos = form.watch('niveles').filter((n) => n.aplica).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, nómina, puesto o id..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Configuración
        </Button>
      </div>

      <div className="relative">
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <ListChecks className="text-muted-foreground/40 mb-4 h-10 w-10" />
            <p className="text-sm font-medium text-foreground">
              No hay empleados con configuración de niveles
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Los empleados sin configuración usan el default legacy (solo nivel 1).
            </p>
            <Button className="mt-4" size="sm" onClick={handleNuevo}>
              <Plus className="mr-2 h-4 w-4" /> Crear primera configuración
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredItems}
              title="Configuración de Niveles de Jefe"
              showRowCount
              showRefreshButton
              onRefresh={fetchItems}
            />
            {loading && (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-jefes-niveles"
        open={modalStates.edit}
        setOpen={(open) => toggleModal('edit', open)}
        title={isEditing ? 'Editar Configuración' : 'Nueva Configuración'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('edit', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleGuardar)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            {!isEditing && (
              <FormField
                control={form.control}
                name="idUsuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado *</FormLabel>
                    <FormControl>
                      <select
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        disabled={loadingUsuarios}
                      >
                        <option value="" disabled>
                          {loadingUsuarios ? 'Cargando usuarios...' : 'Selecciona un empleado'}
                        </option>
                        {usuarios.map((u) => (
                          <option key={u.idUsuario} value={u.idUsuario}>
                            {u.nombreCompleto ?? `Usuario ${u.idUsuario}`} (#{u.idUsuario})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormDescription>
                      Solo aparecen usuarios del sistema. Si no encuentras al empleado, verifica que
                      tenga usuario en Asokam.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEditing && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Editando a:</div>
                <div className="text-sm font-medium">
                  {items.find((i) => i.idUsuario === editingIdUsuario)?.nombreCompleto ??
                    `Usuario ${editingIdUsuario}`}{' '}
                  (#{editingIdUsuario})
                </div>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Niveles de jefe que aplican</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: MAX_NIVEL }, (_, i) => i + 1).map((nivel) => (
                  <FormField
                    key={nivel}
                    control={form.control}
                    name={`niveles.${nivel - 1}.aplica`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-0.5 leading-none">
                          <FormLabel>Nivel {nivel}</FormLabel>
                          {nivel === 1 && (
                            <FormDescription>
                              Por defecto el nivel 1 siempre aplica.
                            </FormDescription>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
                <p className="text-muted-foreground pt-2 text-xs">
                  {nivelesActivos === 0
                    ? '⚠️ Ningún nivel activo: se guardará como default legacy (solo nivel 1).'
                    : `${nivelesActivos} nivel(es) activo(s).`}
                </p>
              </CardContent>
            </Card>

            <div className="text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3 text-xs">
              <UserCog className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Recordatorio:</strong> sin configuración, el sistema usa el default
                legacy (solo nivel 1). Los pasos con nivel 1 funcionan siempre; los niveles 2+
                solo aplican si los activas aquí.
              </div>
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
