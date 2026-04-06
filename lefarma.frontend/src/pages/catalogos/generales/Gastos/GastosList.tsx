import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Receipt, Plus, Pencil, Trash2, Search, Loader2, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Gasto, UnidadMedida } from '@/types/catalogo.types';
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

const ENDPOINT = '/catalogos/Gastos';
const UNIDADES_ENDPOINT = '/catalogos/UnidadesMedida';

const gastoSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().trim().optional().or(z.literal('')),
  clave: z.string().trim().optional().or(z.literal('')),
  concepto: z.string().trim().optional().or(z.literal('')),
  cuenta: z.string().trim().optional().or(z.literal('')),
  subCuenta: z.string().trim().optional().or(z.literal('')),
  analitica: z.string().trim().optional().or(z.literal('')),
  integracion: z.string().trim().optional().or(z.literal('')),
  cuentaCatalogo: z.string().optional().or(z.literal('')),
  requiereComprobacionPago: z.boolean(),
  requiereComprobacionGasto: z.boolean(),
  permiteSinDatosFiscales: z.boolean(),
  diasLimiteComprobacion: z.number().min(0),
  activo: z.boolean(),
  unidadesMedida: z.array(z.number()),
});

type GastoFormValues = z.infer<typeof gastoSchema>;
type GastoRequest = GastoFormValues & { idGasto: number };

const BoolCell = ({ value }: { value: boolean }) =>
  value
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <XCircle className="h-4 w-4 text-muted-foreground/40" />;

export default function GastosList() {
  usePageTitle('Gastos', 'Gestión de gastos del catálogo general');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [gastoId, setGastoId] = useState(0);

  const [modalStates, setModalStates] = useState({ newGasto: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formGasto = useForm<GastoFormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      clave: '',
      concepto: '',
      cuenta: '',
      subCuenta: '',
      analitica: '',
      integracion: '',
      cuentaCatalogo: '',
      requiereComprobacionPago: false,
      requiereComprobacionGasto: false,
      permiteSinDatosFiscales: false,
      diasLimiteComprobacion: 0,
      activo: true,
      unidadesMedida: [],
    },
  });

  const [cuenta, subCuenta, analitica, integracion] = formGasto.watch(['cuenta', 'subCuenta', 'analitica', 'integracion']);

  useEffect(() => {
    const partes = [cuenta, subCuenta, analitica, integracion].filter(Boolean);
    formGasto.setValue('cuentaCatalogo', partes.join('-'), { shouldDirty: false, shouldTouch: false });
  }, [cuenta, subCuenta, analitica, integracion]);

  const fetchGastos = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Gasto[]>>(ENDPOINT);
      if (response.data.success) {
        setGastos(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'Gastos.NotFound');
      const isForbidden = error?.statusCode === 403;
      if (isNotFound) {
        setGastos([]);
      } else if (isForbidden) {
        toast.error('No tienes permisos para ver los gastos');
        setGastos([]);
      } else {
        toast.error(error?.message ?? 'Error al cargar los gastos');
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
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchGastos();
    fetchUnidadesMedida();
  }, []);

  const handleNuevoGasto = () => {
    setGastoId(0);
    formGasto.reset({
      nombre: '',
      descripcion: '',
      clave: '',
      concepto: '',
      cuenta: '',
      subCuenta: '',
      analitica: '',
      integracion: '',
      cuentaCatalogo: '',
      requiereComprobacionPago: false,
      requiereComprobacionGasto: false,
      permiteSinDatosFiscales: false,
      diasLimiteComprobacion: 0,
      activo: true,
      unidadesMedida: [],
    });
    setIsEditing(false);
    toggleModal('newGasto', true);
  };

  const handleEditGasto = (id: number) => {
    const item = gastos.find((t) => t.idGasto === id);
    if (item) {
      setGastoId(item.idGasto);
      formGasto.reset({
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        clave: item.clave || '',
        concepto: item.concepto || '',
        cuenta: item.cuenta || '',
        subCuenta: item.subCuenta || '',
        analitica: item.analitica || '',
        integracion: item.integracion || '',
        cuentaCatalogo: item.cuentaCatalogo || '',
        requiereComprobacionPago: item.requiereComprobacionPago,
        requiereComprobacionGasto: item.requiereComprobacionGasto,
        permiteSinDatosFiscales: item.permiteSinDatosFiscales,
        diasLimiteComprobacion: item.diasLimiteComprobacion,
        activo: item.activo,
        unidadesMedida: (item.unidadesMedida ?? []).map((u) => u.idUnidadMedida),
      });
      setIsEditing(true);
      toggleModal('newGasto', true);
    }
  };

  const handleSaveGasto = async (values: GastoFormValues) => {
    setIsSaving(true);
    try {
      const payload: GastoRequest = { idGasto: gastoId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${gastoId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Gasto actualizado correctamente.' : 'Gasto creado correctamente.');
        toggleModal('newGasto', false);
        await fetchGastos();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el gasto');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el gasto');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Gasto eliminado correctamente');
        fetchGastos();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar el gasto');
    }
  };

  const filteredGastos = useMemo(() => {
    return gastos.filter((t) =>
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      t.clave?.toLowerCase().includes(search.toLowerCase()) ||
      t.concepto?.toLowerCase().includes(search.toLowerCase())
    );
  }, [gastos, search]);

  const columns: ColumnDef<Gasto>[] = [
    {
      accessorKey: 'nombre',
      header: 'Gasto',
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
            {row.original.descripcion && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.descripcion}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'concepto',
      header: 'Concepto / Cuenta',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          {row.original.concepto && <span className="text-sm">{row.original.concepto}</span>}
          {row.original.cuenta && (
            <span className="text-xs text-muted-foreground">
              {[row.original.cuenta, row.original.subCuenta].filter(Boolean).join(' / ')}
            </span>
          )}
          {!row.original.concepto && !row.original.cuenta && <span className="text-xs text-muted-foreground">-</span>}
        </div>
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
          <div className="flex items-center gap-1.5">
            <BoolCell value={row.original.permiteSinDatosFiscales} />
            <span>Sin datos fiscales</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'diasLimiteComprobacion',
      header: 'Días límite',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.diasLimiteComprobacion} días</span>
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
      id: 'unidadesMedida',
      header: 'Unidades de Medida',
      cell: ({ row }) => {
        const units = row.original.unidadesMedida ?? [];
        if (units.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {units.map((u) => (
              <Badge key={u.idUnidadMedida} variant="outline" className="h-5 text-xs">
                {u.abreviatura}
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
          <Button size="sm" variant="outline" className="h-8 gap-1.5"
            onClick={() => handleEditGasto(row.original.idGasto)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idGasto)}>
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
            placeholder="Buscar por nombre, clave o concepto..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevoGasto}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      <div className="relative">
        {!loading && gastos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Receipt className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay gastos registrados</p>
            <Button className="mt-4" size="sm" onClick={fetchGastos}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredGastos}
              title="Listado de Gastos"
              showRowCount
              showRefreshButton
              onRefresh={fetchGastos}
              filterConfig={{
                tableId: 'gastos',
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
        id="modal-gasto"
        open={modalStates.newGasto}
        setOpen={(open) => toggleModal('newGasto', open)}
        title={isEditing ? 'Editar Gasto' : 'Nuevo Gasto'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newGasto', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formGasto.handleSubmit(handleSaveGasto)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Gasto'}
            </Button>
          </div>
        }
      >
        <Form {...formGasto}>
          <form className="space-y-4">

            {/* Datos generales */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={formGasto.control} 
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre del gasto" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl><Input placeholder="Descripcion breve" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} name="concepto"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Concepto</FormLabel>
                    <FormControl><Input placeholder="Concepto contable" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Datos contables */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField control={formGasto.control} 
                name="cuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta</FormLabel>
                    <FormControl><Input maxLength={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} 
                name="subCuenta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Cuenta</FormLabel>
                    <FormControl><Input maxLength={3}   {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} 
                name="analitica"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Analítica</FormLabel>
                    <FormControl><Input maxLength={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={formGasto.control} 
                name="integracion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Integración</FormLabel>
                    <FormControl><Input maxLength={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField control={formGasto.control} 
              name="cuentaCatalogo"
              disabled
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Catálogo</FormLabel>
                  <FormControl><Input placeholder='XXX-XXX-XXX-XX' {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unidades de Medida */}
            <FormField
              control={formGasto.control}
              name="unidadesMedida"
              render={({ field }) => (
                <FormItem>
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

            {/* Flags y dias */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={formGasto.control} name="diasLimiteComprobacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días Límite de Comprobación</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                [
                  { name: 'requiereComprobacionPago', label: 'Requiere comprobación de pago', description: undefined },
                  { name: 'requiereComprobacionGasto', label: 'Requiere comprobación de gasto', description: undefined },
                  { name: 'permiteSinDatosFiscales', label: 'Permite sin datos fiscales', description: undefined },
                  { name: 'activo', label: 'Activo', description: 'El gasto aparecerá en los catálogos.' },
                ] as Array<{ name: 'requiereComprobacionPago' | 'requiereComprobacionGasto' | 'permiteSinDatosFiscales' | 'activo'; label: string; description: string | undefined }>
              ).map(({ name, label, description }) => (
                <FormField key={name} control={formGasto.control} name={name}
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
