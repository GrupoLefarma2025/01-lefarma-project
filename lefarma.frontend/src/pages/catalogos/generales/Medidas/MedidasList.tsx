// @lat: [[frontend#Pages]]
import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Ruler, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Medida, UnidadMedida } from '@/types/catalogo.types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/Medidas';
const UNIDADES_ENDPOINT = '/catalogos/UnidadesMedida';

const medidasSchema = z.object({
  unidadesMedida: z.array(z.number()).optional(),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  activo: z.boolean(),
});

const unidadMedidaSchema = z.object({
  idMedida: z.number({ message: 'La medida es obligatoria' }).min(1, 'Selecciona una medida'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  abreviatura: z.string().min(1, 'La abreviatura es obligatoria'),
  descripcion: z.string().optional().or(z.literal('')),
  activo: z.boolean(),
});

type MedidaFormValues = z.infer<typeof medidasSchema>;
type MedidaRequest = MedidaFormValues & { idMedida: number };

type UnidadMedidaFormValues = z.infer<typeof unidadMedidaSchema>;
type UnidadMedidaRequest = UnidadMedidaFormValues & { idUnidadMedida: number };

export default function MedidasList() {
  usePageTitle('Medidas', 'Gestión de medidas del catálogo general');
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingUnidad, setIsSavingUnidad] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [medidaId, setMedidaId] = useState(0);
  const [isEditingUnidad, setIsEditingUnidad] = useState(false);
  const [unidadMedidaId, setUnidadMedidaId] = useState(0);

  const [modalStates, setModalStates] = useState({ newMedida: false, gestionUnidades: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formMedida = useForm<MedidaFormValues>({
    resolver: zodResolver(medidasSchema),
    defaultValues: {
      unidadesMedida: [],
      nombre: '',
      descripcion: '',
      activo: true,
    },
  });

  const formUnidadMedida = useForm<UnidadMedidaFormValues>({
    resolver: zodResolver(unidadMedidaSchema),
    defaultValues: {
      idMedida: 0,
      nombre: '',
      abreviatura: '',
      descripcion: '',
      activo: true,
    },
  });

  const fetchMedidas = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Medida[]>>(ENDPOINT);
      if (response.data.success) {
        setMedidas(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'Medidas.NotFound');
      const isForbidden = error?.statusCode === 403;
      if (isNotFound) {
        setMedidas([]);
        toast.warning('No se encontraron medidas en el sistema');
      } else if (isForbidden) {
        toast.error('No tienes permisos para ver las medidas');
        setMedidas([]);
      } else {
        toast.error(error?.message ?? 'Error al cargar las medidas');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUnidadesMedida = async () => {
    try {
      const response = await API.get<ApiResponse<UnidadMedida[]>>(UNIDADES_ENDPOINT);
      if (response.data.success) {
        setUnidadesMedida(response.data.data || []);
      }
    } catch (error: any) {
      const isForbidden = error?.statusCode === 403;
      if (isForbidden) {
        toast.error('No tienes permisos para ver las unidades de medida');
      }
      // silencioso para otros errores — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchMedidas();
    fetchUnidadesMedida();
  }, []);

  const handleNuevaMedida = () => {
    setMedidaId(0);
    formMedida.reset({ unidadesMedida: [], nombre: '', descripcion: '', activo: true });
    setIsEditing(false);
    toggleModal('newMedida', true);
  };

  const handleEditMedida = (id: number) => {
    const medida = medidas.find((t) => t.idMedida === id);
    if (medida) {
      setMedidaId(medida.idMedida);
      const unidadesAsociadas = (medida.unidadesMedida ?? []).filter((u) => u.activo).map((u) => u.idUnidadMedida);
      formMedida.reset({
        unidadesMedida: unidadesAsociadas,
        nombre: medida.nombre,
        descripcion: medida.descripcion || '',
        activo: medida.activo,
      });
      setIsEditing(true);
      toggleModal('newMedida', true);
    }
  };

  const handleSaveMedida = async (values: MedidaFormValues) => {
    setIsSaving(true);
    try {
      const payload: MedidaRequest = { idMedida: medidaId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${medidaId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Medida actualizada correctamente.' : 'Medida creada correctamente.');
        toggleModal('newMedida', false);
        await fetchMedidas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la medida');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar la medida');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMedida = async (id: number) => {
    if (!confirm('¿Estas seguro de eliminar esta medida?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Medida eliminada correctamente');
        fetchMedidas();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar la medida');
    }
  };

  const handleAbrirGestionUnidades = () => {
    setIsEditingUnidad(false);
    setUnidadMedidaId(0);
    formUnidadMedida.reset({ idMedida: 0, nombre: '', abreviatura: '', descripcion: '', activo: true });
    toggleModal('gestionUnidades', true);
  };

  const handleEditUnidad = (unidad: UnidadMedida) => {
    setUnidadMedidaId(unidad.idUnidadMedida);
    formUnidadMedida.reset({
      idMedida: unidad.idMedida,
      nombre: unidad.nombre,
      abreviatura: unidad.abreviatura,
      descripcion: unidad.descripcion || '',
      activo: unidad.activo,
    });
    setIsEditingUnidad(true);
  };

  const handleCancelarEditUnidad = () => {
    setIsEditingUnidad(false);
    setUnidadMedidaId(0);
    formUnidadMedida.reset({ idMedida: 0, nombre: '', abreviatura: '', descripcion: '', activo: true });
  };

  const handleSaveUnidad = async (values: UnidadMedidaFormValues) => {
    setIsSavingUnidad(true);
    try {
      const payload: UnidadMedidaRequest = { idUnidadMedida: unidadMedidaId, ...values };
      const response = isEditingUnidad
        ? await API.put(`${UNIDADES_ENDPOINT}/${unidadMedidaId}`, payload)
        : await API.post(UNIDADES_ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditingUnidad ? 'Unidad de medida actualizada.' : 'Unidad de medida creada.');
        handleCancelarEditUnidad();
        await fetchUnidadesMedida();
        await fetchMedidas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la unidad de medida');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar la unidad de medida');
      }
    } finally {
      setIsSavingUnidad(false);
    }
  };

  const handleDeleteUnidad = async (id: number) => {
    if (!confirm('¿Estas seguro de eliminar esta unidad de medida?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${UNIDADES_ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Unidad de medida eliminada correctamente');
        fetchUnidadesMedida();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar la unidad de medida');
    }
  };

  const filteredMedidas = useMemo(() => {
    return medidas.filter((t) =>
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [medidas, search]);

  const columns: ColumnDef<Medida>[] = [
    {
      accessorKey: 'nombre',
      header: 'Medida',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Ruler className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            {row.original.descripcion && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {row.original.descripcion}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.descripcion || '—'}
        </span>
      ),
    },
    {
      id: 'unidades',
      header: 'Unidades de Medida',
      cell: ({ row }) => {
        const unidades = row.original.unidadesMedida?.filter((u) => u.activo) || [];
        return unidades.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {unidades.map((u) => (
              <Badge key={u.idUnidadMedida} variant="outline" className="text-xs">
                {u.abreviatura}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin unidades</span>
        );
      },
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'} className="h-5">
          {row.original.activo ? 'Activo' : 'Inactivo'}
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
            onClick={() => handleEditMedida(row.original.idMedida)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDeleteMedida(row.original.idMedida)}
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
            placeholder="Buscar por nombre o descripcion..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleAbrirGestionUnidades}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Unidad de Medida
          </Button>
          <Button onClick={handleNuevaMedida}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Medida
          </Button>
        </div>
      </div>

      <div className="relative">
        {!loading && medidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Ruler className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay medidas registradas</p>
            <Button className="mt-4" size="sm" onClick={fetchMedidas}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredMedidas}
              title="Listado de Medidas"
              showRowCount
              showRefreshButton
              onRefresh={fetchMedidas}
              filterConfig={{
                tableId: 'medidas',
                searchableColumns: ['nombre', 'abreviatura'],
                defaultSearchColumns: ['nombre'],
              }}
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
        id="modal-medida"
        open={modalStates.newMedida}
        setOpen={(open) => toggleModal('newMedida', open)}
        title={isEditing ? 'Editar Medida' : 'Nueva Medida'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newMedida', false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={formMedida.handleSubmit(handleSaveMedida)}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Medida'}
            </Button>
          </div>
        }
      >
        <Form {...formMedida}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formMedida.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la medida" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formMedida.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripcion breve" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formMedida.control}
                name="unidadesMedida"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Unidades de Medida</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={unidadesMedida.map((u) => ({
                          value: String(u.idUnidadMedida),
                          label: `${u.nombre} (${u.abreviatura})`,
                        }))}
                        value={(field.value ?? []).map(String)}
                        onChange={(vals) => field.onChange(vals.map(Number))}
                        placeholder="Selecciona unidades de medida..."
                        searchPlaceholder="Buscar unidad..."
                        emptyText="No hay unidades disponibles."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formMedida.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>La medida aparecerá en los catálogos.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </Modal>

      {/* Modal: Gestión de Unidades de Medida */}
      <Modal
        id="modal-gestion-unidades"
        open={modalStates.gestionUnidades}
        setOpen={(open) => {
          if (!open) handleCancelarEditUnidad();
          toggleModal('gestionUnidades', open);
        }}
        title="Unidades de Medida"
        size="xl"
        footer={null}
      >
        <div className="space-y-6">
          {/* Tabla de unidades existentes */}
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium">Abreviatura</th>
                  <th className="px-3 py-2 text-left font-medium">Medida</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {unidadesMedida.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-xs">
                      No hay unidades de medida registradas
                    </td>
                  </tr>
                ) : (
                  unidadesMedida.map((u) => {
                    const medida = medidas.find((t) => t.idMedida === u.idMedida);
                    const isBeingEdited = isEditingUnidad && unidadMedidaId === u.idUnidadMedida;
                    return (
                      <tr key={u.idUnidadMedida} className={`border-t transition-colors ${isBeingEdited ? 'bg-muted/50' : 'hover:bg-muted/30'}`}>
                        <td className="px-3 py-2 font-medium">{u.nombre}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{u.abreviatura}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{medida?.nombre ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={u.activo ? 'default' : 'secondary'} className="h-5 text-xs">
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => handleEditUnidad(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteUnidad(u.idUnidadMedida)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              {isEditingUnidad ? 'Editando unidad' : 'Nueva unidad'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Formulario agregar / editar */}
          <Form {...formUnidadMedida}>
            <form className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={formUnidadMedida.control}
                  name="idMedida"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Medida</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
                        value={field.value ? String(field.value) : ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una medida..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {medidas.map((t) => (
                            <SelectItem key={t.idMedida} value={String(t.idMedida)}>
                              {t.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formUnidadMedida.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Kilogramo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formUnidadMedida.control}
                  name="abreviatura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abreviatura</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. kg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formUnidadMedida.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descripcion</FormLabel>
                      <FormControl>
                        <Input placeholder="Descripcion breve" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formUnidadMedida.control}
                  name="activo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Activo</FormLabel>
                        <FormDescription>La unidad aparecera en los catalogos.</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                {isEditingUnidad && (
                  <Button type="button" variant="outline" onClick={handleCancelarEditUnidad}>
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={isSavingUnidad}
                  onClick={formUnidadMedida.handleSubmit(handleSaveUnidad)}
                >
                  {isSavingUnidad && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditingUnidad ? 'Guardar Cambios' : 'Agregar Unidad'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
