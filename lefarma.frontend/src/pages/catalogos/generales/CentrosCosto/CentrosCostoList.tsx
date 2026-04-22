import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { MapPin, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
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
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/CentrosCosto';

const centroCostoSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  limitePresupuesto: z.number().nonnegative('El límite no puede ser negativo').optional(),
  activo: z.boolean(),
});

interface CentroCosto {
  idCentroCosto: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  descripcionNormalizada?: string;
  limitePresupuesto?: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

type CentroCostoFormValues = z.infer<typeof centroCostoSchema>;
type CentroCostoRequest = CentroCostoFormValues & { idCentroCosto: number };

export default function CentrosCostoList() {
  usePageTitle('Centros de Costo', 'Catálogo de centros de costo');
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [centroCostoId, setCentroCostoId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const form = useForm<CentroCostoFormValues>({
    resolver: zodResolver(centroCostoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      limitePresupuesto: undefined,
      activo: true,
    },
  });

  const fetchCentrosCosto = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<CentroCosto[]>>(ENDPOINT);
      if (response.data.success) {
        setCentrosCosto(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.statusCode === 404;
      if (isNotFound) {
        setCentrosCosto([]);
        toast.warning('No se encontraron centros de costo en el sistema');
      } else {
        toast.error(error?.message ?? 'Error al cargar los centros de costo');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentrosCosto();
  }, []);

  const handleNuevoCentroCosto = () => {
    setCentroCostoId(0);
    form.reset({ nombre: '', descripcion: '', limitePresupuesto: undefined, activo: true });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEditCentroCosto = (id: number) => {
    const centroCosto = centrosCosto.find((c) => c.idCentroCosto === id);
    if (centroCosto) {
      setCentroCostoId(centroCosto.idCentroCosto);
      form.reset({
        nombre: centroCosto.nombre,
        descripcion: centroCosto.descripcion || '',
        limitePresupuesto: centroCosto.limitePresupuesto ?? undefined,
        activo: centroCosto.activo,
      });
      setIsEditing(true);
      setModalOpen(true);
    }
  };

  const handleSaveCentroCosto = async (values: CentroCostoFormValues) => {
    setIsSaving(true);
    try {
      const payload: CentroCostoRequest = { idCentroCosto: centroCostoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${centroCostoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Centro de costo actualizado correctamente.' : 'Centro de costo creado correctamente.');
        setModalOpen(false);
        await fetchCentrosCosto();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el centro de costo');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el centro de costo');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCentroCosto = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este centro de costo?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Centro de costo eliminado correctamente');
        fetchCentrosCosto();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar el centro de costo');
    }
  };

  const filteredCentrosCosto = useMemo(() => {
    return centrosCosto.filter((c) =>
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [centrosCosto, search]);

  const columns: ColumnDef<CentroCosto>[] = [
    {
      accessorKey: 'nombre',
      header: 'Centro de Costo',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <MapPin className="h-4 w-4 text-foreground" />
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
      accessorKey: 'limitePresupuesto',
      header: 'Límite de Presupuesto',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.limitePresupuesto != null
            ? row.original.limitePresupuesto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
            : <span className="text-muted-foreground">—</span>}
        </span>
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
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleEditCentroCosto(row.original.idCentroCosto)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDeleteCentroCosto(row.original.idCentroCosto)}
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
            placeholder="Buscar por nombre o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevoCentroCosto}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Centro de Costo
        </Button>
      </div>

      <div className="relative">
        {!loading && centrosCosto.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <MapPin className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay centros de costo registrados</p>
            <Button className="mt-4" size="sm" onClick={fetchCentrosCosto}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredCentrosCosto}
              title="Centros de Costo"
              showRowCount
              showRefreshButton
              onRefresh={fetchCentrosCosto}
              filterConfig={{
                tableId: 'centros-costo',
                searchableColumns: ['nombre', 'codigo', 'descripcion'],
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
        id="modal-centro-costo"
        open={modalOpen}
        setOpen={setModalOpen}
        title={isEditing ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={form.handleSubmit(handleSaveCentroCosto)}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Centro de Costo'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del centro de costo" {...field} />
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
                      <Input placeholder="Descripción breve" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="limitePresupuesto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Límite de Presupuesto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Ej. 50000.00 (opcional)"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? undefined : parseFloat(val));
                        }}
                      />
                    </FormControl>
                    <FormDescription>Monto máximo asignado a este centro de costo.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>El centro de costo aparecerá en los catálogos.</FormDescription>
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
