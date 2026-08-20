import { useEffect, useState } from 'react';
import { FileCheck2, Plus, Pencil, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
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
import { incidenciaChecadoConfigApi } from '../services/rh.api';
import type {
  CreateIncidenciaChecadoConfigRequest,
  IncidenciaChecadoConfigResponse,
  UpdateIncidenciaChecadoConfigRequest,
} from '@/types/solicitudPersonal.types';
import { TIPOS_INCIDENCIA, getTipoIncidenciaLabel } from '../utils/incidencias';

const PERIODOS = [
  { value: 'semana', label: 'Semana' },
  { value: 'quincena', label: 'Quincena' },
  { value: 'mes', label: 'Mes' },
];

const emptyForm = {
  nombre: '',
  descripcion: '',
  tipoIncidencia: '',
  minutosMin: null as number | null,
  minutosMax: null as number | null,
  cantidadAcumulada: 1,
  periodo: '',
  prioridad: 0,
  registroEntrada: false,
  registroSalida: false,
  excluirDiasHabilesConsumenSaldo: false,
  activo: true,
};

type FormValues = typeof emptyForm;

const getPeriodoLabel = (value: string): string =>
  PERIODOS.find((p) => p.value === value)?.label ?? value;

export default function IncidenciasChecadoConfigList() {
  usePageTitle(
    'Configuración de descuentos por incidencias',
    'Reglas de descuento por acumulación de incidencias de checado'
  );

  const [items, setItems] = useState<IncidenciaChecadoConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await incidenciaChecadoConfigApi.getAll();
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode === 403) {
        toast.error('No tienes permisos para ver esta configuración');
      } else {
        toast.error(err.message ?? 'Error al cargar la configuración');
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
    setForm(emptyForm);
    setErrors({});
    setIsEditing(false);
    setOpen(true);
  };

  const handleEditar = async (id: number) => {
    try {
      setLoading(true);
      const response = await incidenciaChecadoConfigApi.getById(id);
      if (!response.data.success || !response.data.data) {
        toast.error(response.data.message ?? 'Registro no encontrado');
        return;
      }
      const item = response.data.data;
      setEditingId(item.idConfig);
      setForm({
        nombre: item.nombre,
        descripcion: item.descripcion,
        tipoIncidencia: item.tipoIncidencia,
        minutosMin: item.minutosMin ?? null,
        minutosMax: item.minutosMax ?? null,
        cantidadAcumulada: item.cantidadAcumulada,
        periodo: item.periodo,
        prioridad: item.prioridad,
        registroEntrada: item.registroEntrada,
        registroSalida: item.registroSalida,
        excluirDiasHabilesConsumenSaldo: item.excluirDiasHabilesConsumenSaldo,
        activo: item.activo,
      });
      setErrors({});
      setIsEditing(true);
      setOpen(true);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar el registro');
    } finally {
      setLoading(false);
    }
  };

  const validate = (values: FormValues): boolean => {
    const next: Partial<Record<keyof FormValues, string>> = {};
    const nombre = values.nombre.trim();
    const descripcion = values.descripcion.trim();

    if (!nombre) next.nombre = 'El nombre es obligatorio';
    else if (nombre.length > 100) next.nombre = 'Máximo 100 caracteres';

    if (!descripcion) next.descripcion = 'La descripción es obligatoria';
    else if (descripcion.length > 500) next.descripcion = 'Máximo 500 caracteres';

    if (!values.tipoIncidencia) next.tipoIncidencia = 'El tipo de incidencia es obligatorio';
    if (!values.periodo) next.periodo = 'El periodo es obligatorio';

    if (values.cantidadAcumulada < 1) next.cantidadAcumulada = 'Debe ser al menos 1';
    if (values.prioridad < 0) next.prioridad = 'La prioridad no puede ser negativa';

    if (values.minutosMin != null && values.minutosMax != null && values.minutosMin > values.minutosMax) {
      next.minutosMax = 'Minutos min no puede ser mayor que minutos max';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleGuardar = async () => {
    if (!validate(form)) return;

    setIsSaving(true);
    try {
      const base: CreateIncidenciaChecadoConfigRequest = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        tipoIncidencia: form.tipoIncidencia,
        minutosMin: form.minutosMin ?? null,
        minutosMax: form.minutosMax ?? null,
        cantidadAcumulada: form.cantidadAcumulada,
        periodo: form.periodo,
        prioridad: form.prioridad,
        registroEntrada: form.registroEntrada,
        registroSalida: form.registroSalida,
        excluirDiasHabilesConsumenSaldo: form.excluirDiasHabilesConsumenSaldo,
        activo: form.activo,
      };

      const response = isEditing
        ? await incidenciaChecadoConfigApi.update(editingId, {
            idConfig: editingId,
            ...base,
          } as UpdateIncidenciaChecadoConfigRequest)
        : await incidenciaChecadoConfigApi.create(base);

      if (response.data.success) {
        toast.success(isEditing ? 'Registro actualizado correctamente' : 'Registro creado correctamente');
        setOpen(false);
        await fetchItems();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el registro');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar el registro');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const parseNumber = (value: string): number | null => {
    if (value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  };

  const columns: ColumnDef<IncidenciaChecadoConfigResponse>[] = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <FileCheck2 className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            <span className="text-xs text-muted-foreground">{row.original.descripcion}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'tipoIncidencia',
      header: 'Tipo',
        cell: ({ row }) => <Badge variant="outline">{getTipoIncidenciaLabel(row.original.tipoIncidencia)}</Badge>,
    },
    {
      id: 'registro',
      header: 'Aplica a',
      cell: ({ row }) => {
        const parts: string[] = [];
        if (row.original.registroEntrada) parts.push('Entrada');
        if (row.original.registroSalida) parts.push('Salida');
        return <span className="text-xs text-muted-foreground">{parts.join(' / ') || 'N/A'}</span>;
      },
    },
    {
      id: 'minutos',
      header: 'Minutos',
      cell: ({ row }) => {
        const { minutosMin, minutosMax } = row.original;
        if (minutosMin == null && minutosMax == null) return <span className="text-xs text-muted-foreground">N/A</span>;
        if (minutosMax == null) return <span className="text-sm">{minutosMin}+</span>;
        if (minutosMin == null) return <span className="text-sm">Hasta {minutosMax}</span>;
        return <span className="text-sm">{minutosMin} - {minutosMax}</span>;
      },
    },
    {
      accessorKey: 'cantidadAcumulada',
      header: 'Cantidad',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.cantidadAcumulada}</span>,
    },
    {
      accessorKey: 'periodo',
      header: 'Periodo',
      cell: ({ row }) => <span className="text-sm">{getPeriodoLabel(row.original.periodo)}</span>,
    },
    {
      accessorKey: 'prioridad',
      header: 'Prioridad',
      cell: ({ row }) => <span className="text-sm">{row.original.prioridad}</span>,
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) =>
        row.original.activo ? (
          <Badge variant="default" className="h-5 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Activo
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-5 gap-1">
            <XCircle className="h-3 w-3" /> Inactivo
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <PermissionElement require={['incidencias_checado.crear']}>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handleEditar(row.original.idConfig)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </PermissionElement>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-end gap-4">
            <PermissionElement require={['incidencias_checado.crear']}>
              <Button onClick={handleNuevo}>
                <Plus className="mr-2 h-4 w-4" /> Nueva regla
              </Button>
            </PermissionElement>
          </div>

          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            title="Configuración de descuentos por incidencias"
            showRowCount
            globalFilter
            pagination
            pageSize={10}
          />
        </CardContent>
      </Card>

      <Modal
        id="modal-incidencia-checado-config"
        open={open}
        setOpen={(open: boolean) => setOpen(open)}
        title={isEditing ? 'Editar regla' : 'Nueva regla'}
        size="xl"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={handleGuardar}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Regla'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Ej. Retardo de entrada menor a 20 min"
              value={form.nombre}
              onChange={(e) => updateField('nombre', e.target.value)}
            />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              placeholder="Describe la regla de acumulación"
              value={form.descripcion}
              onChange={(e) => updateField('descripcion', e.target.value)}
            />
            {errors.descripcion && <p className="text-xs text-destructive">{errors.descripcion}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoIncidencia">Tipo de incidencia *</Label>
            <Select value={form.tipoIncidencia} onValueChange={(v) => updateField('tipoIncidencia', v)}>
              <SelectTrigger id="tipoIncidencia">
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_INCIDENCIA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipoIncidencia && <p className="text-xs text-destructive">{errors.tipoIncidencia}</p>}
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="registroEntrada"
              checked={form.registroEntrada}
              onCheckedChange={(v) => updateField('registroEntrada', Boolean(v))}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="registroEntrada">Registro de entrada</Label>
              <p className="text-xs text-muted-foreground">Aplica para reglas de omisión de entrada.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="registroSalida"
              checked={form.registroSalida}
              onCheckedChange={(v) => updateField('registroSalida', Boolean(v))}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="registroSalida">Registro de salida</Label>
              <p className="text-xs text-muted-foreground">Aplica para reglas de omisión de salida.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:col-span-2">
            <Checkbox
              id="excluirDiasHabilesConsumenSaldo"
              checked={form.excluirDiasHabilesConsumenSaldo}
              onCheckedChange={(v) => updateField('excluirDiasHabilesConsumenSaldo', Boolean(v))}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="excluirDiasHabilesConsumenSaldo">Excluir días que consumen saldo</Label>
              <p className="text-xs text-muted-foreground">
                Si está activo, los días registrados en días hábiles con consume_saldo no generan incidencia ni descuento.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodo">Periodo *</Label>
            <Select value={form.periodo} onValueChange={(v) => updateField('periodo', v)}>
              <SelectTrigger id="periodo">
                <SelectValue placeholder="Selecciona un periodo" />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.periodo && <p className="text-xs text-destructive">{errors.periodo}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minutosMin">Minutos mínimos</Label>
            <Input
              id="minutosMin"
              type="number"
              min="0"
              placeholder="Opcional"
              value={form.minutosMin ?? ''}
              onChange={(e) => updateField('minutosMin', parseNumber(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Para retardos. Vacío si no aplica.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minutosMax">Minutos máximos</Label>
            <Input
              id="minutosMax"
              type="number"
              min="0"
              placeholder="Opcional"
              value={form.minutosMax ?? ''}
              onChange={(e) => updateField('minutosMax', parseNumber(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Para retardos. Vacío si no aplica.</p>
            {errors.minutosMax && <p className="text-xs text-destructive">{errors.minutosMax}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidadAcumulada">Cantidad acumulada *</Label>
            <Input
              id="cantidadAcumulada"
              type="number"
              min="1"
              value={form.cantidadAcumulada}
              onChange={(e) => updateField('cantidadAcumulada', parseNumber(e.target.value) ?? 1)}
            />
            <p className="text-xs text-muted-foreground">Cuántas incidencias del tipo/periodo generan descuento.</p>
            {errors.cantidadAcumulada && <p className="text-xs text-destructive">{errors.cantidadAcumulada}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prioridad">Prioridad</Label>
            <Input
              id="prioridad"
              type="number"
              min="0"
              value={form.prioridad}
              onChange={(e) => updateField('prioridad', parseNumber(e.target.value) ?? 0)}
            />
            <p className="text-xs text-muted-foreground">Mayor prioridad se evalúa primero.</p>
            {errors.prioridad && <p className="text-xs text-destructive">{errors.prioridad}</p>}
          </div>

          <div className="flex items-start gap-3 md:col-span-2">
            <Checkbox
              id="activo"
              checked={form.activo}
              onCheckedChange={(v) => updateField('activo', Boolean(v))}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="activo">Activo</Label>
              <p className="text-xs text-muted-foreground">Determina si la regla aplica en la evaluación de descuentos.</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
