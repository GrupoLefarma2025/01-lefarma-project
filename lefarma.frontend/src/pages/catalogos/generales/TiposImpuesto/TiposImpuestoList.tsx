import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Receipt, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { TipoImpuesto } from '@/types/catalogo.types';
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
import { toApiError } from '@/utils/errors';

const ENDPOINT = '/catalogos/TiposImpuesto';

const tipoImpuestoSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  clave: z.string().min(1, 'La clave es obligatoria'),
  tasa: z.number().min(0, 'La tasa no puede ser negativa').max(1, 'La tasa no puede ser mayor a 1'),
  descripcion: z.string().optional().or(z.literal('')),
  activo: z.boolean(),
});

type TipoImpuestoFormValues = z.infer<typeof tipoImpuestoSchema>;
type TipoImpuestoRequest = TipoImpuestoFormValues & { idTipoImpuesto: number };

export default function TiposImpuestoList() {
  usePageTitle('Tipos de Impuesto', 'Gestión de tipos de impuesto del catálogo general');
  const [tiposImpuesto, setTiposImpuesto] = useState<TipoImpuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tipoImpuestoId, setTipoImpuestoId] = useState(0);

  const [modalStates, setModalStates] = useState({ newTipoImpuesto: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formTipoImpuesto = useForm<TipoImpuestoFormValues>({
    resolver: zodResolver(tipoImpuestoSchema),
    defaultValues: {
      nombre: '',
      clave: '',
      tasa: 0,
      descripcion: '',
      activo: true,
    },
  });

  const fetchTiposImpuesto = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<TipoImpuesto[]>>(ENDPOINT);
      if (response.data.success) {
        setTiposImpuesto(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar los tipos de impuesto');
    }finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiposImpuesto();
  }, []);

  const handleNuevoTipoImpuesto = () => {
    setTipoImpuestoId(0);
    formTipoImpuesto.reset();
    setIsEditing(false);
    toggleModal('newTipoImpuesto', true);
  };

  const handleEditTipoImpuesto = (id: number) => {
    const tipoImpuesto = tiposImpuesto.find((t) => t.idTipoImpuesto === id);
    if (tipoImpuesto) {
      setTipoImpuestoId(tipoImpuesto.idTipoImpuesto);
      formTipoImpuesto.reset({
        nombre: tipoImpuesto.nombre,
        clave: tipoImpuesto.clave,
        tasa: tipoImpuesto.tasa,
        descripcion: tipoImpuesto.descripcion || '',
        activo: tipoImpuesto.activo,
      });
      setIsEditing(true);
      toggleModal('newTipoImpuesto', true);
    }
  };

  const handleSaveTipoImpuesto = async (values: TipoImpuestoFormValues) => {
    setIsSaving(true);
    try {
      const payload: TipoImpuestoRequest = { idTipoImpuesto: tipoImpuestoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${tipoImpuestoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Tipo de impuesto actualizado correctamente.' : 'Tipo de impuesto creado correctamente.');
        toggleModal('newTipoImpuesto', false);
        await fetchTiposImpuesto();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el tipo de impuesto');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar el tipo de impuesto');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este tipo de impuesto?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Tipo de impuesto eliminado correctamente');
        fetchTiposImpuesto();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar el tipo de impuesto');
    }
  };

  const filteredTiposImpuesto = useMemo(() => {
    return tiposImpuesto.filter((t) =>
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.clave?.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [tiposImpuesto, search]);

  const formatTasa = (tasa: number) => {
    return `${(tasa * 100).toFixed(0)}%`;
  };

  const columns: ColumnDef<TipoImpuesto>[] = [
    {
      accessorKey: 'nombre',
      header: 'Tipo de Impuesto',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Receipt className="h-4 w-4 text-foreground" />
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
      accessorKey: 'tasa',
      header: 'Tasa',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatTasa(row.original.tasa)}</span>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[240px] block">
          {row.original.descripcion || '-'}
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
          <Button size="sm" variant="outline" className="h-8 gap-1.5"
            onClick={() => handleEditTipoImpuesto(row.original.idTipoImpuesto)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idTipoImpuesto)}>
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
        <Button onClick={handleNuevoTipoImpuesto}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Tipo de Impuesto
        </Button>
      </div>

      <div className="relative">
        {!loading && tiposImpuesto.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Receipt className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay tipos de impuesto registrados</p>
            <Button className="mt-4" size="sm" onClick={fetchTiposImpuesto}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredTiposImpuesto}
              title="Listado de Tipos de Impuesto"
              showRowCount
              showRefreshButton
              onRefresh={fetchTiposImpuesto}
              filterConfig={{
                tableId: 'tipos-impuesto',
                searchableColumns: ['nombre', 'descripcion'],
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
        id="modal-tipo-impuesto"
        open={modalStates.newTipoImpuesto}
        setOpen={(open) => toggleModal('newTipoImpuesto', open)}
        title={isEditing ? 'Editar Tipo de Impuesto' : 'Nuevo Tipo de Impuesto'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newTipoImpuesto', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formTipoImpuesto.handleSubmit(handleSaveTipoImpuesto)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Tipo de Impuesto'}
            </Button>
          </div>
        }
      >
        <Form {...formTipoImpuesto}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formTipoImpuesto.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre del tipo de impuesto (ej. IVA 16%)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formTipoImpuesto.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna (ej. T16)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formTipoImpuesto.control}
                name="tasa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        max="1" 
                        placeholder="0.16"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Tasa como decimal (0.16 = 16%)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formTipoImpuesto.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Input placeholder="Descripción breve" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formTipoImpuesto.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 md:col-span-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>El tipo de impuesto aparecerá en los catálogos.</FormDescription>
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
