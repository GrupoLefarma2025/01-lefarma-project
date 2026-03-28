import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { CreditCard, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { FormaPago } from '@/types/catalogo.types';
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

const ENDPOINT = '/catalogos/FormasPago';

const formaPagoSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  clave: z.string().optional().or(z.literal('')),
  activo: z.boolean(),
});

type FormaPagoFormValues = z.infer<typeof formaPagoSchema>;
type FormaPagoRequest = FormaPagoFormValues & { idFormaPago: number };

export default function FormasPagoList() {
  usePageTitle('Formas de Pago', 'Gestión de formas de pago del catálogo general');
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formaPagoId, setFormaPagoId] = useState(0);

  const [modalStates, setModalStates] = useState({ newFormaPago: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formFormaPago = useForm<FormaPagoFormValues>({
    resolver: zodResolver(formaPagoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      clave: '',
      activo: true,
    },
  });

  const fetchFormasPago = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<FormaPago[]>>(ENDPOINT);
      if (response.data.success) {
        setFormasPago(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'FormasPago.NotFound');
      if (isNotFound) {
        setFormasPago([]);
      } else {
        toast.error(error?.message ?? 'Error al cargar las formas de pago');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormasPago();
  }, []);

  const handleNuevaFormaPago = () => {
    setFormaPagoId(0);
    formFormaPago.reset();
    setIsEditing(false);
    toggleModal('newFormaPago', true);
  };

  const handleEditFormaPago = (id: number) => {
    const formaPago = formasPago.find((f) => f.idFormaPago === id);
    if (formaPago) {
      setFormaPagoId(formaPago.idFormaPago);
      formFormaPago.reset({
        nombre: formaPago.nombre,
        descripcion: formaPago.descripcion || '',
        clave: formaPago.clave || '',
        activo: formaPago.activo,
      });
      setIsEditing(true);
      toggleModal('newFormaPago', true);
    }
  };

  const handleSaveFormaPago = async (values: FormaPagoFormValues) => {
    setIsSaving(true);
    try {
      const payload: FormaPagoRequest = { idFormaPago: formaPagoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${formaPagoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Forma de pago actualizada correctamente.' : 'Forma de pago creada correctamente.');
        toggleModal('newFormaPago', false);
        await fetchFormasPago();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la forma de pago');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar la forma de pago');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta forma de pago?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Forma de pago eliminada correctamente');
        fetchFormasPago();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar la forma de pago');
    }
  };

  const filteredFormasPago = useMemo(() => {
    return formasPago.filter((f) =>
      f.nombre.toLowerCase().includes(search.toLowerCase()) ||
      f.clave?.toLowerCase().includes(search.toLowerCase()) ||
      f.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [formasPago, search]);

  const columns: ColumnDef<FormaPago>[] = [
    {
      accessorKey: 'nombre',
      header: 'Forma de Pago',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <CreditCard className="h-4 w-4 text-foreground" />
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
            onClick={() => handleEditFormaPago(row.original.idFormaPago)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idFormaPago)}>
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
        <Button onClick={handleNuevaFormaPago}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Forma de Pago
        </Button>
      </div>

      <div className="relative">
        {!loading && formasPago.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <CreditCard className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay formas de pago registradas</p>
            <Button className="mt-4" size="sm" onClick={fetchFormasPago}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredFormasPago}
              title="Listado de Formas de Pago"
              showRowCount
              showRefreshButton
              onRefresh={fetchFormasPago}
              filterConfig={{
                tableId: 'formas-pago',
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
        id="modal-forma-pago"
        open={modalStates.newFormaPago}
        setOpen={(open) => toggleModal('newFormaPago', open)}
        title={isEditing ? 'Editar Forma de Pago' : 'Nueva Forma de Pago'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newFormaPago', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formFormaPago.handleSubmit(handleSaveFormaPago)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Forma de Pago'}
            </Button>
          </div>
        }
      >
        <Form {...formFormaPago}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formFormaPago.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre de la forma de pago" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formFormaPago.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna (ej. EFO)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formFormaPago.control}
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
                control={formFormaPago.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>La forma de pago aparecerá en los catálogos.</FormDescription>
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
