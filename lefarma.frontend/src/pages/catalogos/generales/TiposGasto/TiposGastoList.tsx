import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Wallet, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import { TipoGasto } from '@/types/catalogo.types';
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
import { PermissionElement } from '@/components/permissions/PermissionElement';

const ENDPOINT = '/catalogos/TiposGasto';

const tipoGastoSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().trim().optional().or(z.literal('')),
  clave: z.string().trim().optional().or(z.literal('')),
  requiereComprobacionPago: z.boolean(),
  requiereComprobacionGasto: z.boolean(),
  activo: z.boolean(),
});

type TipoGastoFormValues = z.infer<typeof tipoGastoSchema>;
type TipoGastoRequest = TipoGastoFormValues & { idTipoGasto: number };

const BoolCell = ({ value }: { value: boolean }) =>
  value
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <XCircle className="h-4 w-4 text-muted-foreground/40" />;

export default function TiposGastoList() {
  usePageTitle('Tipos de Gasto', 'Gestión de tipos de gasto del catálogo general');
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tipoGastoId, setTipoGastoId] = useState(0);

  const [modalStates, setModalStates] = useState({ newTipoGasto: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formTipoGasto = useForm<TipoGastoFormValues>({
    resolver: zodResolver(tipoGastoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      clave: '',
      requiereComprobacionPago: true,
      requiereComprobacionGasto: true,
      activo: true,
    },
  });

  const fetchTiposGasto = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<TipoGasto[]>>(ENDPOINT);
      if (response.data.success) {
        setTiposGasto(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode === 403) {
        toast.error('No tienes permisos para ver los tipos de gasto');
      } else {
        toast.error(err.message ?? 'Error al cargar los tipos de gasto');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiposGasto();
  }, []);

  const handleNuevoTipoGasto = () => {
    setTipoGastoId(0);
    formTipoGasto.reset({
      nombre: '',
      descripcion: '',
      clave: '',
      requiereComprobacionPago: true,
      requiereComprobacionGasto: true,
      activo: true,
    });
    setIsEditing(false);
    toggleModal('newTipoGasto', true);
  };

  const handleEditTipoGasto = (id: number) => {
    const item = tiposGasto.find((t) => t.idTipoGasto === id);
    if (item) {
      setTipoGastoId(item.idTipoGasto);
      formTipoGasto.reset({
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        clave: item.clave || '',
        requiereComprobacionPago: item.requiereComprobacionPago,
        requiereComprobacionGasto: item.requiereComprobacionGasto,
        activo: item.activo,
      });
      setIsEditing(true);
      toggleModal('newTipoGasto', true);
    }
  };

  const handleSaveTipoGasto = async (values: TipoGastoFormValues) => {
    setIsSaving(true);
    try {
      const payload: TipoGastoRequest = { idTipoGasto: tipoGastoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${tipoGastoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Tipo de gasto actualizado correctamente.' : 'Tipo de gasto creado correctamente.');
        toggleModal('newTipoGasto', false);
        await fetchTiposGasto();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el tipo de gasto');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar el tipo de gasto');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este tipo de gasto?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Tipo de gasto eliminado correctamente');
        fetchTiposGasto();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar el tipo de gasto');
    }
  };

  const filteredTiposGasto = useMemo(() => {
    return tiposGasto.filter((t) =>
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.clave?.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [tiposGasto, search]);

  const columns: ColumnDef<TipoGasto>[] = [
    {
      accessorKey: 'nombre',
      header: 'Tipo de Gasto',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Wallet className="h-4 w-4 text-foreground" />
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
      accessorKey: 'descripcion',
      header: 'Descripcion',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[240px] block">
          {row.original.descripcion || '-'}
        </span>
      ),
    },
    {
      id: 'comprobacion',
      header: 'Comprobación',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BoolCell value={row.original.requiereComprobacionPago} />
            <span>Pago</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BoolCell value={row.original.requiereComprobacionGasto} />
            <span>Gasto</span>
          </div>
        </div>
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
          <PermissionElement require={['tipos-gasto.editar']}>
            <Button size="sm" variant="outline" className="h-8 gap-1.5"
              onClick={() => handleEditTipoGasto(row.original.idTipoGasto)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          </PermissionElement>
          <PermissionElement require={['tipos-gasto.eliminar']}>
            <Button size="sm" variant="destructive" className="h-8 gap-1.5"
              onClick={() => handleDelete(row.original.idTipoGasto)}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </PermissionElement>
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
        <PermissionElement require={['tipos-gasto.crear']}>
          <Button onClick={handleNuevoTipoGasto}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Tipo de Gasto
          </Button>
        </PermissionElement>
      </div>

      <div className="relative">
        {!loading && tiposGasto.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Wallet className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay tipos de gasto registrados</p>
            <Button className="mt-4" size="sm" onClick={fetchTiposGasto}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredTiposGasto}
              title="Listado de Tipos de Gasto"
              showRowCount
              showRefreshButton
              onRefresh={fetchTiposGasto}
              filterConfig={{
                tableId: 'tipos-gasto',
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
        id="modal-tipo-gasto"
        open={modalStates.newTipoGasto}
        setOpen={(open) => toggleModal('newTipoGasto', open)}
        title={isEditing ? 'Editar Tipo de Gasto' : 'Nuevo Tipo de Gasto'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newTipoGasto', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formTipoGasto.handleSubmit(handleSaveTipoGasto)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Tipo de Gasto'}
            </Button>
          </div>
        }
      >
        <Form {...formTipoGasto}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formTipoGasto.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl><Input placeholder="Nombre del tipo de gasto" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formTipoGasto.control}
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
                control={formTipoGasto.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Input placeholder="Descripción breve" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                [
                  { name: 'requiereComprobacionPago' as const, label: 'Requiere comprobación de pago', description: undefined },
                  { name: 'requiereComprobacionGasto' as const, label: 'Requiere comprobación de gasto', description: undefined },
                  { name: 'activo' as const, label: 'Activo', description: 'El tipo de gasto aparecerá en los catálogos.' },
                ] as Array<{ name: 'requiereComprobacionPago' | 'requiereComprobacionGasto' | 'activo'; label: string; description: string | undefined }>
              ).map(({ name, label, description }) => (
                <FormField key={name} control={formTipoGasto.control} name={name}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{label}</FormLabel>
                        {description && <FormDescription>{description}</FormDescription>}
                      </div>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
