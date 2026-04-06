import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { FileText, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
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

const ENDPOINT = '/catalogos/CuentasContables';
const CENTROS_COSTO_ENDPOINT = '/catalogos/CentrosCosto';

const cuentaContableSchema = z.object({
  cuenta: z.string().min(1, 'La cuenta es obligatoria'),
  descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  nivel1: z.string().min(1, 'El nivel 1 es obligatorio'),
  nivel2: z.string().min(1, 'El nivel 2 es obligatorio'),
  empresaPrefijo: z.string().optional().or(z.literal('')),
  centroCostoId: z.number().optional(),
  activo: z.boolean(),
});

interface CuentaContable {
  idCuentaContable: number;
  cuenta: string;
  descripcion: string;
  nivel1: string;
  nivel2: string;
  empresaPrefijo?: string;
  centroCostoId?: number;
  centroCostoNombre?: string;
  activo: boolean;
  fechaCreacion: string;
}

interface CentroCosto {
  idCentroCosto: number;
  nombre: string;
  activo: boolean;
}

type CuentaContableFormValues = z.infer<typeof cuentaContableSchema>;
type CuentaContableRequest = CuentaContableFormValues & { idCuentaContable: number };

export default function CuentasContablesList() {
  usePageTitle('Cuentas Contables', 'Catálogo contable del sistema');
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [cuentaId, setCuentaId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const form = useForm<CuentaContableFormValues>({
    resolver: zodResolver(cuentaContableSchema),
    defaultValues: {
      cuenta: '',
      descripcion: '',
      nivel1: '',
      nivel2: '',
      empresaPrefijo: '',
      centroCostoId: undefined,
      activo: true,
    },
  });

  const fetchCuentas = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<CuentaContable[]>>(ENDPOINT);
      if (response.data.success) {
        setCuentas(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'CuentasContables.NotFound');
      if (isNotFound) {
        setCuentas([]);
        toast.warning('No se encontraron cuentas contables en el sistema');
      } else {
        toast.error(error?.message ?? 'Error al cargar las cuentas contables');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCentrosCosto = async () => {
    try {
      const response = await API.get<ApiResponse<CentroCosto[]>>(CENTROS_COSTO_ENDPOINT);
      if (response.data.success) {
        setCentrosCosto(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchCuentas();
    fetchCentrosCosto();
  }, []);

  const handleNuevaCuenta = () => {
    setCuentaId(0);
    form.reset({
      cuenta: '',
      descripcion: '',
      nivel1: '',
      nivel2: '',
      empresaPrefijo: '',
      centroCostoId: undefined,
      activo: true,
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEditCuenta = (id: number) => {
    const cuenta = cuentas.find((c) => c.idCuentaContable === id);
    if (cuenta) {
      setCuentaId(cuenta.idCuentaContable);
      form.reset({
        cuenta: cuenta.cuenta,
        descripcion: cuenta.descripcion,
        nivel1: cuenta.nivel1,
        nivel2: cuenta.nivel2,
        empresaPrefijo: cuenta.empresaPrefijo || '',
        centroCostoId: cuenta.centroCostoId,
        activo: cuenta.activo,
      });
      setIsEditing(true);
      setModalOpen(true);
    }
  };

  const handleSaveCuenta = async (values: CuentaContableFormValues) => {
    setIsSaving(true);
    try {
      const payload: CuentaContableRequest = { idCuentaContable: cuentaId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${cuentaId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Cuenta contable actualizada correctamente.' : 'Cuenta contable creada correctamente.');
        setModalOpen(false);
        await fetchCuentas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la cuenta contable');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar la cuenta contable');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCuenta = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta contable?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Cuenta contable eliminada correctamente');
        fetchCuentas();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar la cuenta contable');
    }
  };

  const filteredCuentas = useMemo(() => {
    return cuentas.filter((c) =>
      c.cuenta.toLowerCase().includes(search.toLowerCase()) ||
      c.descripcion.toLowerCase().includes(search.toLowerCase())
    );
  }, [cuentas, search]);

  const columns: ColumnDef<CuentaContable>[] = [
    {
      accessorKey: 'cuenta',
      header: 'Cuenta',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <FileText className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-mono font-medium">{row.original.cuenta}</span>
            {row.original.empresaPrefijo && (
              <span className="text-xs text-muted-foreground">{row.original.empresaPrefijo}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.descripcion}</span>
      ),
    },
    {
      accessorKey: 'nivel1',
      header: 'Nivel 1',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-muted-foreground">{row.original.nivel1}</span>
      ),
    },
    {
      accessorKey: 'nivel2',
      header: 'Nivel 2',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-muted-foreground">{row.original.nivel2}</span>
      ),
    },
    {
      accessorKey: 'centroCostoNombre',
      header: 'Centro de Costo',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.centroCostoNombre || '—'}</span>
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
            onClick={() => handleEditCuenta(row.original.idCuentaContable)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDeleteCuenta(row.original.idCuentaContable)}
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
            placeholder="Buscar por cuenta o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevaCuenta}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta Contable
        </Button>
      </div>

      <div className="relative">
        {!loading && cuentas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <FileText className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay cuentas contables registradas</p>
            <p className="text-xs text-muted-foreground mt-1">Catálogo contable del sistema</p>
            <Button className="mt-4" size="sm" onClick={fetchCuentas}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredCuentas}
              title="Cuentas Contables"
              showRowCount
              showRefreshButton
              onRefresh={fetchCuentas}
              filterConfig={{
                tableId: 'cuentas-contables',
                searchableColumns: ['codigo', 'nombre'],
                defaultSearchColumns: ['codigo'],
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
        id="modal-cuenta-contable"
        open={modalOpen}
        setOpen={setModalOpen}
        title={isEditing ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={form.handleSubmit(handleSaveCuenta)}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Cuenta Contable'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. 601-001-001-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="empresaPrefijo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa Prefijo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. ATC-103" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripción de la cuenta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nivel1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel 1 *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. 601" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nivel2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel 2 *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. 601-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="centroCostoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de Costo</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona centro..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {centrosCosto.map((c) => (
                          <SelectItem key={c.idCentroCosto} value={String(c.idCentroCosto)}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <FormDescription>La cuenta contable aparecerá en los catálogos.</FormDescription>
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
