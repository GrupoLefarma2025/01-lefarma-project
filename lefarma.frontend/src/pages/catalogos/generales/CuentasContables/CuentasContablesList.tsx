import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { FileText, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw, HelpCircle, X } from 'lucide-react';
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
import { toApiError } from '@/utils/errors';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const ENDPOINT = '/catalogos/CuentasContables';
const CENTROS_COSTO_ENDPOINT = '/catalogos/CentrosCosto';

export const NIVEL1_OPTIONS = [
  { value: '600', label: '600 — Gastos' },
  { value: '601', label: '601 — Gastos Administrativos' },
  { value: '602', label: '602 — Gastos Financieros' },
  { value: '603', label: '603 — Gastos de Producción' },
  { value: '604', label: '604 — Gastos Administrativos (Operativos)' },
];

/** Parsea "600-001-001-01" → { nivel1, nivel2, nivel3, nivel4 } */
function parseCuenta(cuenta: string) {
  const parts = (cuenta || '').split('-');
  return {
    nivel1: parts[0] || '',
    nivel2: parts[1] || '',
    nivel3: parts[2] || '',
    nivel4: parts[3] || '',
  };
}

/** Construye "600-001-001-01" a partir de las partes */
function buildCuenta(nivel1: string, nivel2: string, nivel3: string, nivel4: string): string {
  const n1 = nivel1.padStart(3, '0');
  const n2 = nivel2.padStart(3, '0');
  const n3 = nivel3.padStart(3, '0');
  const n4 = nivel4.padStart(2, '0');
  return `${n1}-${n2}-${n3}-${n4}`;
}

const cuentaContableSchema = z.object({
  nivel1: z.string().min(1, 'El nivel 1 es obligatorio'),
  nivel2: z.string().min(1, 'El nivel 2 es obligatorio'),
  nivel3: z.string().min(1, 'El nivel 3 es obligatorio'),
  nivel4: z.string().min(1, 'El nivel 4 es obligatorio'),
  descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
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
  nivel3?: string;
  nivel4?: string;
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
type CuentaContableRequest = Omit<CuentaContableFormValues, 'nivel3' | 'nivel4'> & {
  idCuentaContable: number;
  cuenta: string;
};

export default function CuentasContablesList() {
  usePageTitle('Cuentas Contables', 'Catálogo contable del sistema');
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [nivel1Filter, setNivel1Filter] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [cuentaId, setCuentaId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const form = useForm<CuentaContableFormValues>({
    resolver: zodResolver(cuentaContableSchema),
    defaultValues: {
      nivel1: '',
      nivel2: '',
      nivel3: '',
      nivel4: '',
      descripcion: '',
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
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar las cuentas contables');
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
      nivel1: '',
      nivel2: '',
      nivel3: '',
      nivel4: '',
      descripcion: '',
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
      const parts = parseCuenta(cuenta.cuenta);
      form.reset({
        nivel1: parts.nivel1,
        nivel2: parts.nivel2,
        nivel3: parts.nivel3,
        nivel4: parts.nivel4,
        descripcion: cuenta.descripcion,
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
      const cuentaCompleta = buildCuenta(
        values.nivel1,
        values.nivel2,
        values.nivel3,
        values.nivel4,
      );
      const payload: CuentaContableRequest = {
        idCuentaContable: cuentaId,
        cuenta: cuentaCompleta,
        nivel1: values.nivel1,
        nivel2: values.nivel2,
        descripcion: values.descripcion,
        empresaPrefijo: values.empresaPrefijo,
        centroCostoId: values.centroCostoId,
        activo: values.activo,
      };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${cuentaId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(
          isEditing
            ? 'Cuenta contable actualizada correctamente.'
            : 'Cuenta contable creada correctamente.',
        );
        setModalOpen(false);
        await fetchCuentas();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la cuenta contable');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar la cuenta contable');
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
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar la cuenta contable');
    }
  };

  const nivel1Options = useMemo(() => {
    const seen = new Set<string>();
    return cuentas
      .map((c) => c.nivel1)
      .filter((n) => n && !seen.has(n) && seen.add(n))
      .sort();
  }, [cuentas]);

  const filteredCuentas = useMemo(() => {
    return cuentas.filter((c) => {
      const matchesSearch =
        c.cuenta.toLowerCase().includes(search.toLowerCase()) ||
        c.descripcion.toLowerCase().includes(search.toLowerCase());
      const matchesNivel1 = !nivel1Filter || c.nivel1 === nivel1Filter;
      return matchesSearch && matchesNivel1;
    });
  }, [cuentas, search, nivel1Filter]);

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
      cell: ({ row }) => <span className="text-sm">{row.original.descripcion}</span>,
    },
    {
      accessorKey: 'nivel1',
      header: 'Cuenta Mayor (AAA)',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-muted-foreground">{row.original.nivel1}</span>
      ),
    },
    {
      accessorKey: 'nivel2',
      header: 'Sub-cuenta (BBB)',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-muted-foreground">{row.original.nivel2}</span>
      ),
    },
    {
      accessorKey: 'centroCosto',
      id: 'centroCosto',
      header: 'Centro de Costo',
      cell: ({ row }) => {
        const nombre =
          row.original.centroCostoNombre ||
          (row.original as any).centroCosto?.nombre ||
          '—';
        return (
          <span className="text-sm text-muted-foreground">{nombre}</span>
        );
      },
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge
          variant={row.original.activo ? 'default' : 'secondary'}
          className="h-5"
        >
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
    <TooltipProvider>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cuenta o descripción..."
              className="pl-10 pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 cursor-help text-muted-foreground hover:text-foreground">
                  <HelpCircle className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-xs">Formato de Cuenta: AAA-BBB-CCC-DD</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                    <span className="font-mono font-bold">AAA</span>
                    <span>Cuenta mayor (AAA)</span>
                    <span className="font-mono font-bold">BBB</span>
                    <span>Sub-cuenta</span>
                    <span className="font-mono font-bold">CCC</span>
                    <span>Analítica</span>
                    <span className="font-mono font-bold">DD</span>
                    <span>Auxiliar</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Ejemplo: 601-001-001-01
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          {nivel1Options.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Cuenta Mayor (AAA):</span>
              <select
                value={nivel1Filter}
                onChange={(e) => setNivel1Filter(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos</option>
                {nivel1Options.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {nivel1Filter && (
                <button
                  onClick={() => setNivel1Filter('')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Limpiar filtro"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <Button onClick={handleNuevaCuenta}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta Contable
          </Button>
        </div>

        {/* Table */}
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
                  searchableColumns: ['cuenta', 'descripcion'],
                  defaultSearchColumns: ['cuenta'],
                  defaultVisibleColumns: ['cuenta', 'descripcion', 'centroCosto', 'activo', 'actions'],
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

        {/* Modal */}
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
              {/* Cuenta Mayor (AAA), Sub-cuenta (BBB), Analítica (CCC), Auxiliar (DD) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="nivel1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="hidden md:inline">Cuenta Mayor (AAA)</span>
                        <span className="md:hidden">AAA</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {NIVEL1_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
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
                  name="nivel2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="hidden md:inline">Sub-cuenta (BBB)</span>
                        <span className="md:hidden">BBB</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="001" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nivel3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="hidden md:inline">Analítica (CCC)</span>
                        <span className="md:hidden">CCC</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="001" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nivel4"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <span className="hidden md:inline">Auxiliar (DD)</span>
                        <span className="md:hidden">DD</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="01" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
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
            </form>
          </Form>
        </Modal>
      </div>
    </TooltipProvider>
  );
}
