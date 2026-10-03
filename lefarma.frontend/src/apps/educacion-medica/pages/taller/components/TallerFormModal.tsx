import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ActualizarTallerRequest,
  Asignacion,
  CrearTallerRequest,
  Producto,
  Taller,
  TipoRecursoTaller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface RecursoForm {
  tipoRecurso: TipoRecursoTaller;
  idProducto: string;
  descripcion: string;
  tipoEnvio: string;
  cantidad: string;
  observaciones: string;
}

const RECURSOS: { value: TipoRecursoTaller; label: string }[] = [
  { value: 'Producto', label: 'Muestras de producto' },
  { value: 'Folleto', label: 'Folletos' },
  { value: 'Envio', label: 'Gastos de envío' },
  { value: 'BoxLunch', label: 'Box lunch' },
];

function recursoVacio(tipoRecurso: TipoRecursoTaller = 'Producto'): RecursoForm {
  return {
    tipoRecurso,
    idProducto: '',
    descripcion: '',
    tipoEnvio: '',
    cantidad: '',
    observaciones: '',
  };
}

const aTexto = (valor: string | null | undefined) => valor ?? '';
const aNumero = (valor: string): number | null => {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};
const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};

interface TallerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Taller en edición; null para alta. */
  taller: Taller | null;
  asignaciones: Asignacion[];
  /** Hospital preseleccionado (deep-link "Registrar taller"). */
  idSeleccionHospitalInicial?: number | null;
  guardando?: boolean;
  onGuardar: (
    payload: CrearTallerRequest | ActualizarTallerRequest,
    idTaller: number | null
  ) => void | Promise<void>;
}

/** Alta/edición de un taller con los campos FOR-005 1–12 (sin costos: los registra el AEM). */
export function TallerFormModal({
  open,
  onClose,
  taller,
  asignaciones,
  idSeleccionHospitalInicial,
  guardando,
  onGuardar,
}: TallerFormModalProps) {
  const [idSeleccionHospital, setIdSeleccionHospital] = useState('');
  const [numeroParticipantes, setNumeroParticipantes] = useState('');
  const [unidadMedica, setUnidadMedica] = useState('');
  const [lugar, setLugar] = useState('');
  const [fechaTaller, setFechaTaller] = useState('');
  const [horaTaller, setHoraTaller] = useState('');
  const [requiereEquipo, setRequiereEquipo] = useState(false);
  const [tipoEquipo, setTipoEquipo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [recursos, setRecursos] = useState<RecursoForm[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  const hospitalesAsignados = useMemo(() => {
    const vistos = new Map<number, Asignacion>();
    for (const a of asignaciones) {
      if (!vistos.has(a.idSeleccionHospital)) vistos.set(a.idSeleccionHospital, a);
    }
    return [...vistos.values()];
  }, [asignaciones]);

  // Al abrir: precarga el taller a editar o reinicia el formulario de alta.
  const [aperturaAnterior, setAperturaAnterior] = useState(false);
  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    if (open) {
      if (taller) {
        setIdSeleccionHospital(String(taller.idSeleccionHospital ?? ''));
        setNumeroParticipantes(aTexto(taller.numeroParticipantes?.toString()));
        setUnidadMedica(aTexto(taller.unidadMedica));
        setLugar(aTexto(taller.lugar));
        setFechaTaller(aTexto(taller.fechaTaller));
        setHoraTaller(taller.horaTaller ? taller.horaTaller.slice(0, 5) : '');
        setRequiereEquipo(taller.requiereEquipoProyeccion ?? false);
        setTipoEquipo(aTexto(taller.tipoEquipoProyeccion));
        setObservaciones(aTexto(taller.observaciones));
        setRecursos(
          taller.recursos.map((r) => ({
            tipoRecurso: (r.tipoRecurso as TipoRecursoTaller) ?? 'Producto',
            idProducto: aTexto(r.idProducto),
            descripcion: aTexto(r.descripcion),
            tipoEnvio: aTexto(r.tipoEnvio),
            cantidad: aTexto(r.cantidad?.toString()),
            observaciones: aTexto(r.observaciones),
          }))
        );
      } else {
        setIdSeleccionHospital(
          idSeleccionHospitalInicial ? String(idSeleccionHospitalInicial) : ''
        );
        setNumeroParticipantes('');
        setUnidadMedica('');
        setLugar('');
        setFechaTaller('');
        setHoraTaller('');
        setRequiereEquipo(false);
        setTipoEquipo('');
        setObservaciones('');
        setRecursos([]);
      }
    }
  }

  // Catálogo de productos para el recurso "Muestras de producto" (se carga al primer uso).
  const productosSolicitados = useRef(false);
  useEffect(() => {
    if (!open || productosSolicitados.current) return;
    productosSolicitados.current = true;
    void educacionMedicaApi.productos
      .getAll()
      .then((res) => {
        if (res.data.success) setProductos(res.data.data ?? []);
      })
      .catch(() => setProductos([]));
  }, [open]);

  const actualizarRecurso = (idx: number, cambios: Partial<RecursoForm>) => {
    setRecursos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...cambios } : r)));
  };

  const guardar = () => {
    if (!taller && !idSeleccionHospital) {
      toast.error('Selecciona el hospital de la selección.');
      return;
    }

    const payloadBase = {
      numeroParticipantes: aNumero(numeroParticipantes),
      unidadMedica: aTextoONull(unidadMedica),
      lugar: aTextoONull(lugar),
      fechaTaller: aTextoONull(fechaTaller),
      horaTaller: aTextoONull(horaTaller),
      requiereEquipoProyeccion: requiereEquipo,
      tipoEquipoProyeccion: requiereEquipo ? aTextoONull(tipoEquipo) : null,
      observaciones: aTextoONull(observaciones),
      recursos: recursos.map((r) => ({
        tipoRecurso: r.tipoRecurso,
        idProducto: r.tipoRecurso === 'Producto' ? aTextoONull(r.idProducto) : null,
        descripcion: aTextoONull(r.descripcion),
        tipoEnvio: r.tipoRecurso === 'Envio' ? aTextoONull(r.tipoEnvio) : null,
        cantidad: aNumero(r.cantidad),
        observaciones: aTextoONull(r.observaciones),
      })),
    };

    if (taller) {
      void onGuardar(payloadBase as ActualizarTallerRequest, taller.idTaller);
    } else {
      void onGuardar(
        { ...payloadBase, idSeleccionHospital: Number(idSeleccionHospital) } as CrearTallerRequest,
        null
      );
    }
  };

  return (
    <Modal
      id="modal-taller-form"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={taller ? 'Editar taller (FOR-005)' : 'Capturar taller (FOR-005)'}
      size="wide"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : taller ? 'Guardar cambios' : 'Capturar taller'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Hospital (selección del mes)</Label>
            {taller ? (
              <Input value={taller.nombreHospital ?? '—'} disabled />
            ) : (
              <Select value={idSeleccionHospital} onValueChange={setIdSeleccionHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un hospital asignado" />
                </SelectTrigger>
                <SelectContent>
                  {hospitalesAsignados.map((a) => (
                    <SelectItem key={a.idSeleccionHospital} value={String(a.idSeleccionHospital)}>
                      {a.nombreHospital ?? `Hospital ${a.idHospital ?? a.idSeleccionHospital}`}
                      {a.nombreRegion ? ` · ${a.nombreRegion}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label>No. de participantes</Label>
            <Input
              type="number"
              min={0}
              value={numeroParticipantes}
              onChange={(e) => setNumeroParticipantes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Unidad médica</Label>
            <Input value={unidadMedica} onChange={(e) => setUnidadMedica(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Lugar</Label>
            <Input value={lugar} onChange={(e) => setLugar(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fecha del taller</Label>
            <Input
              type="date"
              value={fechaTaller}
              onChange={(e) => setFechaTaller(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Hora del taller</Label>
            <Input
              type="time"
              value={horaTaller}
              onChange={(e) => setHoraTaller(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>¿Requiere equipo de proyección?</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch checked={requiereEquipo} onCheckedChange={setRequiereEquipo} />
              {requiereEquipo && (
                <Select value={tipoEquipo} onValueChange={setTipoEquipo}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder="Propio o rentado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Propio">Propio</SelectItem>
                    <SelectItem value="Rentado">Rentado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Recursos del taller</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRecursos((prev) => [...prev, recursoVacio()])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Agregar recurso
            </Button>
          </div>
          {recursos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin recursos capturados. Agrega muestras, folletos, envío o box lunch.
            </p>
          )}
          {recursos.map((recurso, idx) => (
            <div
              key={idx}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={recurso.tipoRecurso}
                  onValueChange={(v) =>
                    actualizarRecurso(idx, { tipoRecurso: v as TipoRecursoTaller })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURSOS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {recurso.tipoRecurso === 'Producto' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Producto</Label>
                  <Select
                    value={recurso.idProducto}
                    onValueChange={(v) => actualizarRecurso(idx, { idProducto: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecciona producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map((p) => (
                        <SelectItem key={p.codigoProducto} value={String(p.codigoProducto)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : recurso.tipoRecurso === 'Envio' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de envío</Label>
                  <Select
                    value={recurso.tipoEnvio}
                    onValueChange={(v) => actualizarRecurso(idx, { tipoEnvio: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Interno o externo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interno">Interno</SelectItem>
                      <SelectItem value="Externo">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    value={recurso.descripcion}
                    onChange={(e) => actualizarRecurso(idx, { descripcion: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">
                  {recurso.tipoRecurso === 'BoxLunch'
                    ? 'No. de servicios'
                    : recurso.tipoRecurso === 'Envio'
                      ? 'Cantidad'
                      : 'Cantidad (piezas)'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={recurso.cantidad}
                  onChange={(e) => actualizarRecurso(idx, { cantidad: e.target.value })}
                />
              </div>

              <div className="flex items-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRecursos((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-1 sm:col-span-4">
                <Label className="text-xs">Observaciones del recurso</Label>
                <Input
                  value={recurso.observaciones}
                  onChange={(e) => actualizarRecurso(idx, { observaciones: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label>Observaciones</Label>
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
