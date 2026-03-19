import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { LayoutGrid, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
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
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/Areas';
const EMPRESAS_ENDPOINT = '/catalogos/Empresas';

const areaSchema = z.object({
  idEmpresa: z.number({ message: 'La empresa es obligatoria' }).min(1, 'Selecciona una empresa'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  clave: z.string().optional().or(z.literal('')),
  numeroEmpleados: z.number().optional().or(z.literal(0)),
  activo: z.boolean(),
});

interface Empresa {
  idEmpresa: number;
  nombre: string;
}

interface Area {
  idArea: number;
  idEmpresa: number;
  idSupervisorResponsable?: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  clave?: string;
  numeroEmpleados: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

type AreaFormValues = z.infer<typeof areaSchema>;
type AreaRequest = AreaFormValues & { idArea: number };

export default function AreasList() {
  usePageTitle('Áreas', 'Gestión de áreas del catálogo general');
  const [areas, setAreas] = useState<Area[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [areaId, setAreaId] = useState(0);

  const [modalStates, setModalStates] = useState({ newArea: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formArea = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      idEmpresa: 0,
      nombre: '',
      descripcion: '',
      clave: '',
      numeroEmpleados: 0,
      activo: true,
    },
  });

  const fetchAreas = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Area[]>>(ENDPOINT);
      if (response.data.success) {
        setAreas(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'Areas.NotFound');
      if (isNotFound) {
        setAreas([]);
      } else {
        toast.error(error?.message ?? 'Error al cargar las áreas');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const response = await API.get<ApiResponse<Empresa[]>>(EMPRESAS_ENDPOINT);
      if (response.data.success) {
        setEmpresas(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchAreas();
    fetchEmpresas();
  }, []);

  const handleNuevaArea = () => {
    setAreaId(0);
    formArea.reset();
    setIsEditing(false);
    toggleModal('newArea', true);
  };

  const handleEditArea = (id: number) => {
    const area = areas.find((a) => a.idArea === id);
    if (area) {
      setAreaId(area.idArea);
      formArea.reset({
        idEmpresa: area.idEmpresa,
        nombre: area.nombre,
        descripcion: area.descripcion || '',
        clave: area.clave || '',
        numeroEmpleados: area.numeroEmpleados || 0,
        activo: area.activo,
      });
      setIsEditing(true);
      toggleModal('newArea', true);
    }
  };

  const handleSaveArea = async (values: AreaFormValues) => {
    setIsSaving(true);
    try {
      const payload: AreaRequest = { idArea: areaId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${areaId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Área actualizada correctamente.' : 'Área creada correctamente.');
        toggleModal('newArea', false);
        await fetchAreas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el área');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el área');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta área?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Área eliminada correctamente');
        fetchAreas();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar el área');
    }
  };

  const filteredAreas = useMemo(() => {
    return areas.filter((a) =>
      a.nombre.toLowerCase().includes(search.toLowerCase()) ||
      a.clave?.toLowerCase().includes(search.toLowerCase()) ||
      a.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [areas, search]);

  const columns: ColumnDef<Area>[] = [
    {
      accessorKey: 'nombre',
      header: 'Área',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <LayoutGrid className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            {row.original.clave && (
              <span className="text-xs text-muted-foreground">{row.original.clave}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'idEmpresa',
      header: 'Empresa',
      cell: ({ row }) => {
        const empresa = empresas.find((e) => e.idEmpresa === row.original.idEmpresa);
        return empresa ? (
          <div className="flex items-center gap-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {empresa.nombre}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripcion',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[240px] block">
          {row.original.descripcion || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'numeroEmpleados',
      header: 'Empleados',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.numeroEmpleados ?? 0}</span>
      ),
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
          <Button size="sm" variant="outline" className="h-8 gap-1.5"
            onClick={() => handleEditArea(row.original.idArea)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idArea)}>
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
            placeholder="Buscar por nombre, clave o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevaArea}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Área
        </Button>
      </div>

      <div className="relative">
        {!loading && areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <LayoutGrid className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay áreas registradas</p>
            <p className="mt-1 text-xs text-muted-foreground">Crea la primera área para comenzar.</p>
            <Button className="mt-4" size="sm" onClick={fetchAreas}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredAreas}
              title="Listado de Áreas"
              showRowCount
              showRefreshButton
              onRefresh={fetchAreas}
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
        id="modal-area"
        open={modalStates.newArea}
        setOpen={(open) => toggleModal('newArea', open)}
        title={isEditing ? 'Editar Área' : 'Nueva Área'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newArea', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formArea.handleSubmit(handleSaveArea)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Área'}
            </Button>
          </div>
        }
      >
        <Form {...formArea}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formArea.control}
                name="idEmpresa"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Empresa</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una empresa..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empresas.map((e) => (
                          <SelectItem key={e.idEmpresa} value={String(e.idEmpresa)}>
                            {e.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formArea.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre del área" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formArea.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formArea.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl><Input placeholder="Descripcion breve del área" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formArea.control}
                name="numeroEmpleados"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numero de Empleados</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formArea.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>El área aparecerá en los catálogos.</FormDescription>
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
