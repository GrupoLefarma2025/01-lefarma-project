import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  FileCheck2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { PermissionElement } from '@/components/permissions/PermissionElement';
import { tipoSolicitudApi } from '../services/rh.api';
import type {
  CreateTipoSolicitudRequest,
  TipoSolicitudResponse,
  UpdateTipoSolicitudRequest,
} from '@/types/solicitudPersonal.types';

const CATEGORIAS = [
  { value: '1', label: 'Incidencia' },
  { value: '2', label: 'Permiso' },
  { value: '3', label: 'Vacaciones' },
  { value: '4', label: 'Goce de Sueldo' },
  { value: '5', label: 'Incapacidad' },
];

const PERIODOS = [
  { value: 'semana', label: 'Semana' },
  { value: 'quincena', label: 'Quincena' },
  { value: 'mes', label: 'Mes' },
];

const tipoSolicitudSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
  clave: z.string().trim().min(1, 'La clave es obligatoria').max(50, 'Máximo 50 caracteres'),
  categoria: z.string().min(1, 'La categoría es obligatoria'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  requiereReposicionTiempo: z.boolean(),
  requiereFechaFin: z.boolean(),
  requiereFechaRegreso: z.boolean(),
  requiereLugarComision: z.boolean(),
  descuentaNomina: z.boolean(),
  descuentaVacaciones: z.boolean(),
  requiereDocumentacion: z.boolean(),
  permiteFechasPasadas: z.boolean(),
  permiteFechasFuturas: z.boolean(),
  tomaEnCuentaChecado: z.boolean(),
  requiereIncidenciasExistentes: z.boolean(),
  pideDiasSolicitados: z.boolean(),
  limitePorPeriodo: z
    .string()
    .or(z.literal(''))
    .refine((v) => v === '' || /^\d+$/.test(v), {
      message: 'Solo dígitos',
    })
    .refine((v) => v === '' || Number(v) >= 1, {
      message: 'El límite debe ser mayor o igual a 1',
    }),
  periodoLimite: z.string().or(z.literal('')),
  totalParaDescuento: z
    .string()
    .or(z.literal(''))
    .refine((v) => v === '' || /^\d+$/.test(v), {
      message: 'Solo dígitos',
    })
    .refine((v) => v === '' || Number(v) >= 1, {
      message: 'El total para descuento debe ser mayor o igual a 1',
    }),
  activo: z.boolean(),
}).refine((data) => data.permiteFechasPasadas || data.permiteFechasFuturas, {
  message: 'Debe permitir al menos fechas pasadas o futuras',
  path: ['permiteFechasPasadas'],
});

type FormValues = z.infer<typeof tipoSolicitudSchema>;

const BoolCell = ({ value }: { value: boolean }) =>
  value ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="text-muted-foreground/40 h-4 w-4" />
  );

const RuleItem = ({ label, active }: { label: string; active: boolean }) => (
  <div className="flex items-center gap-1.5" title={label}>
    <BoolCell value={active} />
    <span className="text-xs">{label}</span>
  </div>
);

const FechasCell = ({ pasadas, futuras }: { pasadas: boolean; futuras: boolean }) => {
  if (pasadas && futuras) return <Badge variant="outline">Pasadas y futuras</Badge>;
  if (pasadas) return <Badge variant="outline">Solo pasadas</Badge>;
  if (futuras) return <Badge variant="outline">Solo futuras</Badge>;
  return <Badge variant="outline">Ninguna</Badge>;
};

const getCategoriaLabel = (value: string): string =>
  CATEGORIAS.find((c) => c.value === value)?.label ?? value;

const getPeriodoLabel = (value?: string | null): string => {
  if (!value) return '-';
  return PERIODOS.find((p) => p.value === value)?.label ?? value;
};

function FlagCheckbox({
  name,
  label,
  description,
  form,
}: {
  name: keyof FormValues;
  label: string;
  description?: string;
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
          <FormControl>
            <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
        </FormItem>
      )}
    />
  );
}

export default function TiposSolicitudList() {
  usePageTitle('Tipos de Solicitud', 'Gestión de tipos de solicitud de personal');

  const [items, setItems] = useState<TipoSolicitudResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(0);

  const [modalStates, setModalStates] = useState({ newTipo: false });
  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates((prev) => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(tipoSolicitudSchema),
    defaultValues: {
      nombre: '',
      clave: '',
      categoria: '2',
      descripcion: '',
      requiereReposicionTiempo: false,
      requiereFechaFin: false,
      requiereFechaRegreso: false,
      requiereLugarComision: false,
      descuentaNomina: false,
      descuentaVacaciones: false,
      requiereDocumentacion: false,
      permiteFechasPasadas: true,
      permiteFechasFuturas: true,
      tomaEnCuentaChecado: false,
      requiereIncidenciasExistentes: false,
      pideDiasSolicitados: false,
      limitePorPeriodo: '',
      periodoLimite: 'quincena',
      totalParaDescuento: '',
      activo: true,
    },
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await tipoSolicitudApi.getAll({ orderBy: 'nombre' });
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode === 403) {
        toast.error('No tienes permisos para ver los tipos de solicitud');
      } else {
        toast.error(err.message ?? 'Error al cargar los tipos de solicitud');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleNuevo = () => {
    setEditingId(0);
    form.reset({
      nombre: '',
      clave: '',
      categoria: '2',
      descripcion: '',
      requiereReposicionTiempo: false,
      requiereFechaFin: false,
      requiereFechaRegreso: false,
      requiereLugarComision: false,
      descuentaNomina: false,
      descuentaVacaciones: false,
      requiereDocumentacion: false,
      permiteFechasPasadas: true,
      permiteFechasFuturas: true,
      tomaEnCuentaChecado: false,
      requiereIncidenciasExistentes: false,
      pideDiasSolicitados: false,
      limitePorPeriodo: '',
      periodoLimite: 'quincena',
      totalParaDescuento: '',
      activo: true,
    });
    setIsEditing(false);
    toggleModal('newTipo', true);
  };

  const handleEditar = (id: number) => {
    const item = items.find((t) => t.idTipoSolicitud === id);
    if (!item) return;
    setEditingId(item.idTipoSolicitud);
    form.reset({
      nombre: item.nombre,
      clave: item.clave,
      categoria: item.categoria,
      descripcion: item.descripcion ?? '',
      requiereReposicionTiempo: item.requiereReposicionTiempo,
      requiereFechaFin: item.requiereFechaFin,
      requiereFechaRegreso: item.requiereFechaRegreso,
      requiereLugarComision: item.requiereLugarComision,
      descuentaNomina: item.descuentaNomina,
      descuentaVacaciones: item.descuentaVacaciones,
      requiereDocumentacion: item.requiereDocumentacion,
      permiteFechasPasadas: item.permiteFechasPasadas,
      permiteFechasFuturas: item.permiteFechasFuturas,
      tomaEnCuentaChecado: item.tomaEnCuentaChecado,
      requiereIncidenciasExistentes: item.requiereIncidenciasExistentes,
      pideDiasSolicitados: item.pideDiasSolicitados,
      limitePorPeriodo: item.limitePorPeriodo ? String(item.limitePorPeriodo) : '',
      periodoLimite: item.periodoLimite ?? 'quincena',
      totalParaDescuento: item.totalParaDescuento ? String(item.totalParaDescuento) : '',
      activo: item.activo,
    });
    setIsEditing(true);
    toggleModal('newTipo', true);
  };

  const handleGuardar = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const base = {
        nombre: values.nombre.trim(),
        clave: values.clave.trim(),
        categoria: values.categoria,
        descripcion: values.descripcion?.trim() || '',
        requiereReposicionTiempo: values.requiereReposicionTiempo,
        requiereFechaFin: values.requiereFechaFin,
        requiereFechaRegreso: values.requiereFechaRegreso,
        requiereLugarComision: values.requiereLugarComision,
        descuentaNomina: values.descuentaNomina,
        descuentaVacaciones: values.descuentaVacaciones,
        requiereDocumentacion: values.requiereDocumentacion,
        permiteFechasPasadas: values.permiteFechasPasadas,
        permiteFechasFuturas: values.permiteFechasFuturas,
        tomaEnCuentaChecado: values.tomaEnCuentaChecado,
        requiereIncidenciasExistentes: values.requiereIncidenciasExistentes,
        pideDiasSolicitados: values.pideDiasSolicitados,
        limitePorPeriodo:
          values.limitePorPeriodo && values.limitePorPeriodo.length > 0
            ? Number(values.limitePorPeriodo)
            : null,
        periodoLimite: values.periodoLimite || null,
        totalParaDescuento:
          values.totalParaDescuento && values.totalParaDescuento.length > 0
            ? Number(values.totalParaDescuento)
            : null,
        activo: values.activo,
      };

      const response = isEditing
        ? await tipoSolicitudApi.update(editingId, {
            idTipoSolicitud: editingId,
            ...base,
          } as UpdateTipoSolicitudRequest)
        : await tipoSolicitudApi.create(base as CreateTipoSolicitudRequest);

      if (response.data.success) {
        toast.success(
          isEditing
            ? 'Tipo de solicitud actualizado correctamente.'
            : 'Tipo de solicitud creado correctamente.'
        );
        toggleModal('newTipo', false);
        await fetchItems();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el tipo de solicitud');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar el tipo de solicitud');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este tipo de solicitud?')) return;
    try {
      const response = await tipoSolicitudApi.remove(id);
      if (response.data.success) {
        toast.success('Tipo de solicitud eliminado correctamente');
        fetchItems();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar el tipo de solicitud');
    }
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        t.nombre.toLowerCase().includes(term) ||
        t.clave.toLowerCase().includes(term) ||
        t.categoria.toLowerCase().includes(term) ||
        (t.descripcion ?? '').toLowerCase().includes(term)
    );
  }, [items, search]);

  const columns: ColumnDef<TipoSolicitudResponse>[] = [
    {
      accessorKey: 'nombre',
      header: 'Tipo',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <FileCheck2 className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            <span className="text-xs text-muted-foreground">{row.original.clave}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'categoria',
      header: 'Categoría',
      cell: ({ row }) => (
        <Badge variant="outline" className="h-5">
          {getCategoriaLabel(row.original.categoria)}
        </Badge>
      ),
    },
    {
      id: 'limite',
      header: 'Límite por periodo',
      cell: ({ row }) =>
        row.original.limitePorPeriodo ? (
          <span className="text-sm">
            {row.original.limitePorPeriodo} /{' '}
            {getPeriodoLabel(row.original.periodoLimite).toLowerCase()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin límite</span>
        ),
    },
    {
      id: 'descuento',
      header: 'Descuento',
      cell: ({ row }) =>
        row.original.totalParaDescuento ? (
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            A partir de {row.original.totalParaDescuento}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin descuento</span>
        ),
    },
    {
      id: 'fechas',
      header: 'Fechas',
      cell: ({ row }) => (
        <FechasCell
          pasadas={row.original.permiteFechasPasadas}
          futuras={row.original.permiteFechasFuturas}
        />
      ),
    },
    {
      id: 'validaciones',
      header: 'Validaciones',
      cell: ({ row }) => (
        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
          <RuleItem label="Checado" active={row.original.tomaEnCuentaChecado} />
          <RuleItem label="Incidencias" active={row.original.requiereIncidenciasExistentes} />
          <RuleItem label="Días solicitados" active={row.original.pideDiasSolicitados} />
        </div>
      ),
    },
    {
      id: 'requisitos',
      header: 'Requisitos',
      cell: ({ row }) => (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <RuleItem label="Fecha fin" active={row.original.requiereFechaFin} />
          <RuleItem label="Regreso" active={row.original.requiereFechaRegreso} />
          <RuleItem label="Comisión" active={row.original.requiereLugarComision} />
          <RuleItem label="Reposición" active={row.original.requiereReposicionTiempo} />
          <RuleItem label="Documentación" active={row.original.requiereDocumentacion} />
        </div>
      ),
    },
    {
      id: 'descuentos',
      header: 'Descuentos',
      cell: ({ row }) => (
        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
          <RuleItem label="Nómina" active={row.original.descuentaNomina} />
          <RuleItem label="Vacaciones" active={row.original.descuentaVacaciones} />
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
          <PermissionElement require={['tipos-solicitud.editar']}>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => handleEditar(row.original.idTipoSolicitud)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          </PermissionElement>
          <PermissionElement require={['tipos-solicitud.eliminar']}>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              onClick={() => handleEliminar(row.original.idTipoSolicitud)}
            >
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
        <PermissionElement require={['tipos-solicitud.crear']}>
          <Button onClick={handleNuevo}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Tipo de Solicitud
          </Button>
        </PermissionElement>
      </div>

      <div className="relative">
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <FileCheck2 className="text-muted-foreground/40 mb-4 h-10 w-10" />
            <p className="text-sm font-medium text-foreground">
              No hay tipos de solicitud registrados
            </p>
            <Button className="mt-4" size="sm" onClick={fetchItems}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredItems}
              title="Listado de Tipos de Solicitud"
              showRowCount
              showRefreshButton
              onRefresh={fetchItems}
              filterConfig={{
                tableId: 'tipos-solicitud',
                searchableColumns: ['nombre', 'clave', 'descripcion'],
                defaultSearchColumns: ['nombre'],
              }}
            />
            {loading && (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-tipo-solicitud"
        open={modalStates.newTipo}
        setOpen={(open) => toggleModal('newTipo', open)}
        title={isEditing ? 'Editar Tipo de Solicitud' : 'Nuevo Tipo de Solicitud'}
        size="xl"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newTipo', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleGuardar)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Tipo de Solicitud'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del tipo de solicitud" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave *</FormLabel>
                    <FormControl>
                      <Input placeholder="Clave interna" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIAS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
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
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
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
                name="limitePorPeriodo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Límite por periodo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Opcional"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>Vacío = sin límite.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodoLimite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periodo del límite</FormLabel>
                    <Select value={field.value || 'quincena'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERIODOS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
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
                name="totalParaDescuento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total para descuento</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Opcional"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Al alcanzar este total en el periodo se genera un descuento. Vacío = sin
                      descuento.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Configuración de fechas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <FlagCheckbox
                    form={form}
                    name="permiteFechasPasadas"
                    label="Permite fechas pasadas"
                    description="Incluyendo el día de hoy."
                  />
                  <FlagCheckbox
                    form={form}
                    name="permiteFechasFuturas"
                    label="Permite fechas futuras"
                    description="A partir de mañana."
                  />
                  <FlagCheckbox
                    form={form}
                    name="tomaEnCuentaChecado"
                    label="Toma en cuenta checado"
                    description="Si el empleado no checa, no se aplican restricciones de fechas pasadas/futuras."
                  />
                  <FlagCheckbox
                    form={form}
                    name="requiereIncidenciasExistentes"
                    label="Requiere incidencias existentes"
                    description="Solo permite solicitar fechas que tengan una incidencia registrada."
                  />
                  <FlagCheckbox
                    form={form}
                    name="pideDiasSolicitados"
                    label="Pide días solicitados"
                    description="No abre el selector de múltiples fechas; pide fecha inicio y número de días naturales."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Requisitos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <FlagCheckbox
                    form={form}
                    name="requiereFechaFin"
                    label="Requiere fecha fin"
                    description="Solicitará fecha de fin al crear la solicitud."
                  />
                  <FlagCheckbox
                    form={form}
                    name="requiereFechaRegreso"
                    label="Requiere fecha de regreso"
                    description="Solicitará fecha de regreso al crear la solicitud."
                  />
                  <FlagCheckbox
                    form={form}
                    name="requiereLugarComision"
                    label="Requiere lugar de comisión"
                    description="Solicitará lugar de comisión al crear la solicitud."
                  />
                  <FlagCheckbox
                    form={form}
                    name="requiereReposicionTiempo"
                    label="Requiere reposición de tiempo"
                    description="El empleado deberá indicar cuándo repondrá el tiempo."
                  />
                  <FlagCheckbox
                    form={form}
                    name="requiereDocumentacion"
                    label="Requiere documentación"
                    description="Permite adjuntar documentación a la solicitud."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Descuentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <FlagCheckbox
                    form={form}
                    name="descuentaNomina"
                    label="Descuenta nómina"
                    description="Se aplicará un descuento en nómina si aplica."
                  />
                  <FlagCheckbox
                    form={form}
                    name="descuentaVacaciones"
                    label="Descuenta vacaciones"
                    description="Se descontarán días de vacaciones."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Estado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <FlagCheckbox
                    form={form}
                    name="activo"
                    label="Activo"
                    description="Aparecerá en los catálogos."
                  />
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
