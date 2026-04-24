import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  Ruler,
  Plus,
  Pencil,
  Trash2,
  // Search, // @typescript-eslint/no-unused-vars
  Loader2,
  RefreshCcw,
  ArrowRightLeft,
} from 'lucide-react';
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
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';

const ENDPOINT = '/catalogos/Medidas';
const UNIDADES_ENDPOINT = '/catalogos/UnidadesMedida';

const medidasSchema = z.object({
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
  // const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingUnidad, setIsSavingUnidad] = useState(false);
  const [searchMedidas, setSearchMedidas] = useState('');
  const [searchUnidades, setSearchUnidades] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [medidaId, setMedidaId] = useState(0);
  const [isEditingUnidad, setIsEditingUnidad] = useState(false);
  const [unidadMedidaId, setUnidadMedidaId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [reasignarUnidadId, setReasignarUnidadId] = useState<number | null>(null);

  const formMedida = useForm<MedidaFormValues>({
    resolver: zodResolver(medidasSchema),
    defaultValues: {
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

  const formReasignar = useForm<{ idMedida: number }>({
    defaultValues: { idMedida: 0 },
  });

  useEffect(() => {
    fetchMedidas();
    fetchUnidadesMedida();
  }, []);

  const fetchMedidas = async () => {
    try {
      // setLoading(true);
      const response = await API.get<ApiResponse<Medida[]>>(ENDPOINT);
      if (response.data.success) {
        setMedidas(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar las medidas');
    }
    // } finally {
    //   // setLoading(false);
    // }
  };

  const fetchUnidadesMedida = async () => {
    try {
      const response = await API.get<ApiResponse<UnidadMedida[]>>(UNIDADES_ENDPOINT);
      if (response.data.success) {
        setUnidadesMedida(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar las unidades de medida');
    }
  };

  // Medidas handlers
  const handleNuevaMedida = () => {
    setMedidaId(0);
    formMedida.reset({ nombre: '', descripcion: '', activo: true });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEditMedida = (id: number) => {
    const medida = medidas.find((t) => t.idMedida === id);
    if (medida) {
      setMedidaId(id);
      formMedida.reset({
        nombre: medida.nombre,
        descripcion: medida.descripcion || '',
        activo: medida.activo,
      });
      setIsEditing(true);
      setModalOpen(true);
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
        toast.success(isEditing ? 'Medida actualizada.' : 'Medida creada.');
        setModalOpen(false);
        await fetchMedidas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar la medida');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMedida = async (id: number) => {
    if (!confirm('¿Eliminar esta medida?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Medida eliminada');
        fetchMedidas();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar');
    }
  };

  // Unidades handlers
  const handleNuevaUnidad = () => {
    setUnidadMedidaId(0);
    formUnidadMedida.reset({
      idMedida: 0,
      nombre: '',
      abreviatura: '',
      descripcion: '',
      activo: true,
    });
    setIsEditingUnidad(false);
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

  const handleCancelarUnidad = () => {
    setIsEditingUnidad(false);
    setUnidadMedidaId(0);
    formUnidadMedida.reset({
      idMedida: 0,
      nombre: '',
      abreviatura: '',
      descripcion: '',
      activo: true,
    });
  };

  const handleSaveUnidad = async (values: UnidadMedidaFormValues) => {
    setIsSavingUnidad(true);
    try {
      const payload: UnidadMedidaRequest = { idUnidadMedida: unidadMedidaId, ...values };
      const response = isEditingUnidad
        ? await API.put(`${UNIDADES_ENDPOINT}/${unidadMedidaId}`, payload)
        : await API.post(UNIDADES_ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditingUnidad ? 'Unidad actualizada.' : 'Unidad creada.');
        handleCancelarUnidad();
        await fetchUnidadesMedida();
        await fetchMedidas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar la unidad');
    } finally {
      setIsSavingUnidad(false);
    }
  };

  const handleDeleteUnidad = async (id: number) => {
    if (!confirm('¿Eliminar esta unidad de medida?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${UNIDADES_ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Unidad eliminada');
        await fetchUnidadesMedida();
        await fetchMedidas();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar');
    }
  };

  // Reasignar handlers
  const handleAbrirReasignar = (idUnidadMedida: number) => {
    setReasignarUnidadId(idUnidadMedida);
    const unidad = unidadesMedida.find((u) => u.idUnidadMedida === idUnidadMedida);
    formReasignar.reset({ idMedida: unidad?.idMedida || 0 });
  };

  const handleCerrarReasignar = () => {
    setReasignarUnidadId(null);
    formReasignar.reset({ idMedida: 0 });
  };

  const handleReasignar = async (values: { idMedida: number }) => {
    if (!reasignarUnidadId || !values.idMedida) return;
    setIsSavingUnidad(true);
    try {
      const response = await API.put(`${UNIDADES_ENDPOINT}/${reasignarUnidadId}`, {
        idUnidadMedida: reasignarUnidadId,
        idMedida: values.idMedida,
      });

      if (response.data.success) {
        toast.success('Unidad reasignada correctamente');
        handleCerrarReasignar();
        await fetchUnidadesMedida();
        await fetchMedidas();
      } else {
        toast.error(response.data.message ?? 'Error al reasignar');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error('Error al reasignar la unidad');
    } finally {
      setIsSavingUnidad(false);
    }
  };

  // Filtros
  const filteredMedidas = medidas.filter(
    (m) =>
      m.nombre.toLowerCase().includes(searchMedidas.toLowerCase()) ||
      m.descripcion?.toLowerCase().includes(searchMedidas.toLowerCase())
  );

  const filteredUnidades = unidadesMedida.filter(
    (u) =>
      u.nombre.toLowerCase().includes(searchUnidades.toLowerCase()) ||
      u.abreviatura.toLowerCase().includes(searchUnidades.toLowerCase())
  );

  // Columnas Medidas
  const medidaColumns: ColumnDef<Medida>[] = [
    {
      accessorKey: 'nombre',
      header: 'Medida',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Ruler className="h-4 w-4" />
          </div>
          <span className="font-medium">{row.original.nombre}</span>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.descripcion || '—'}</span>
      ),
    },
    {
      id: 'unidades',
      header: 'Unidades',
      cell: ({ row }) => {
        const unidades = row.original.unidadesMedida?.filter((u) => u.activo) || [];
        return unidades.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {unidades.slice(0, 5).map((u) => (
              <Badge key={u.idUnidadMedida} variant="outline" className="text-xs">
                {u.abreviatura}
              </Badge>
            ))}
            {unidades.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{unidades.length - 5}
              </Badge>
            )}
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
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => handleEditMedida(row.original.idMedida)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7"
            onClick={() => handleDeleteMedida(row.original.idMedida)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  // Columnas Unidades
  const unidadColumns: ColumnDef<UnidadMedida>[] = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>,
    },
    {
      accessorKey: 'abreviatura',
      header: 'Abreviatura',
      cell: ({ row }) => <Badge variant="outline">{row.original.abreviatura}</Badge>,
    },
    {
      accessorKey: 'idMedida',
      header: 'Medida',
      cell: ({ row }) => {
        const medida = medidas.find((m) => m.idMedida === row.original.idMedida);
        return <span>{medida?.nombre || '—'}</span>;
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
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={() => handleAbrirReasignar(row.original.idUnidadMedida)}
            title="Reasignar"
          >
            <ArrowRightLeft className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => handleEditUnidad(row.original)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7"
            onClick={() => handleDeleteUnidad(row.original.idUnidadMedida)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Sección: Medidas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Medidas</h2>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar medidas..."
              className="w-48"
              value={searchMedidas}
              onChange={(e) => setSearchMedidas(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={fetchMedidas}>
              <RefreshCcw className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={handleNuevaMedida}>
              <Plus className="mr-1 h-3 w-3" /> Nueva Medida
            </Button>
          </div>
        </div>

        <DataTable columns={medidaColumns} data={filteredMedidas} showRowCount />
      </div>

      {/* Separador */}
      <div className="border-t" />

      {/* Sección: Unidades de Medida */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Unidades de Medida</h2>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar unidades..."
              className="w-48"
              value={searchUnidades}
              onChange={(e) => setSearchUnidades(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={fetchUnidadesMedida}>
              <RefreshCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <DataTable columns={unidadColumns} data={filteredUnidades} showRowCount />

        {/* Formulario inline para crear/editar unidad */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium">
            {isEditingUnidad ? 'Editar Unidad' : 'Nueva Unidad de Medida'}
          </h3>
          <Form {...formUnidadMedida}>
            <form className="flex flex-wrap items-end gap-4">
              <FormField
                control={formUnidadMedida.control}
                name="idMedida"
                render={({ field }) => (
                  <FormItem className="w-40">
                    <FormLabel className="text-xs">Medida</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(val) => field.onChange(val ? Number(val) : 0)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Medida..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {medidas.map((m) => (
                          <SelectItem key={m.idMedida} value={String(m.idMedida)}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={formUnidadMedida.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="min-w-32 flex-1">
                    <FormLabel className="text-xs">Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Kilogramo" className="h-8" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={formUnidadMedida.control}
                name="abreviatura"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel className="text-xs">Abreviatura</FormLabel>
                    <FormControl>
                      <Input placeholder="kg" className="h-8" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={formUnidadMedida.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="min-w-32 flex-1">
                    <FormLabel className="text-xs">Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" className="h-8" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={formUnidadMedida.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-xs">Activo</FormLabel>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                {isEditingUnidad && (
                  <Button size="sm" variant="outline" onClick={handleCancelarUnidad}>
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={isSavingUnidad}
                  onClick={formUnidadMedida.handleSubmit(handleSaveUnidad)}
                >
                  {isSavingUnidad && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {isEditingUnidad ? 'Guardar' : 'Agregar'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Modal editar medida */}
      <Modal
        id="modal-medida"
        open={modalOpen}
        setOpen={(open) => !open && setModalOpen(false)}
        title={isEditing ? 'Editar Medida' : 'Nueva Medida'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isSaving} onClick={formMedida.handleSubmit(handleSaveMedida)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        }
      >
        <Form {...formMedida}>
          <form className="space-y-4">
            <FormField
              control={formMedida.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
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
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Breve descripción" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={formMedida.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel>Activo</FormLabel>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </Modal>

      {/* Modal reasignar unidad */}
      <Modal
        id="modal-reasignar-unidad"
        open={reasignarUnidadId !== null}
        setOpen={(open) => !open && handleCerrarReasignar()}
        title="Reasignar Unidad de Medida"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCerrarReasignar}>
              Cancelar
            </Button>
            <Button disabled={isSavingUnidad} onClick={formReasignar.handleSubmit(handleReasignar)}>
              {isSavingUnidad && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reasignar
            </Button>
          </div>
        }
      >
        <Form {...formReasignar}>
          <form className="space-y-4">
            <FormField
              control={formReasignar.control}
              name="idMedida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Medida</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(val) => field.onChange(val ? Number(val) : 0)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una medida..." />
                      </SelectTrigger>
                      <SelectContent>
                        {medidas.map((m) => (
                          <SelectItem key={m.idMedida} value={String(m.idMedida)}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </Modal>
    </div>
  );
}
