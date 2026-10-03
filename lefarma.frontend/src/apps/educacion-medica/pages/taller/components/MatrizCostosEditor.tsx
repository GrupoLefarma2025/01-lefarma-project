import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type {
  GuardarCostoRecursoRequest,
  Taller,
  TipoRecursoTaller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface RecursoCostoForm {
  tipoRecurso: TipoRecursoTaller;
  idProducto: string;
  descripcion: string;
  tipoEnvio: string;
  cantidad: string;
  costoUnitario: string;
  observaciones: string;
}

const RECURSOS: { value: TipoRecursoTaller; label: string }[] = [
  { value: 'Producto', label: 'Muestras de producto' },
  { value: 'Folleto', label: 'Folletos' },
  { value: 'Envio', label: 'Gastos de envío' },
  { value: 'BoxLunch', label: 'Box lunch' },
];

const aNumero = (valor: string): number | null => {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

interface MatrizCostosEditorProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  guardando?: boolean;
  onGuardar: (idTaller: number, recursos: GuardarCostoRecursoRequest[]) => void | Promise<void>;
}

/** Registro de costos del AEM: costo unitario por recurso del taller (subtotales en vivo). */
export function MatrizCostosEditor({
  open,
  onClose,
  taller,
  guardando,
  onGuardar,
}: MatrizCostosEditorProps) {
  const [recursos, setRecursos] = useState<RecursoCostoForm[]>([]);

  const [aperturaAnterior, setAperturaAnterior] = useState(false);
  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    if (open) {
      setRecursos(
        (taller?.recursos ?? []).map((r) => ({
          tipoRecurso: (r.tipoRecurso as TipoRecursoTaller) ?? 'Producto',
          idProducto: r.idProducto ?? '',
          descripcion: r.descripcion ?? '',
          tipoEnvio: r.tipoEnvio ?? '',
          cantidad: r.cantidad?.toString() ?? '',
          costoUnitario: r.costoUnitario?.toString() ?? '',
          observaciones: r.observaciones ?? '',
        }))
      );
    }
  }

  const actualizar = (idx: number, cambios: Partial<RecursoCostoForm>) => {
    setRecursos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...cambios } : r)));
  };

  const subtotal = (r: RecursoCostoForm) => (aNumero(r.cantidad) ?? 0) * (aNumero(r.costoUnitario) ?? 0);
  const total = recursos.reduce((acc, r) => acc + subtotal(r), 0);

  const guardar = () => {
    if (!taller) return;
    void onGuardar(
      taller.idTaller,
      recursos.map((r) => ({
        tipoRecurso: r.tipoRecurso,
        idProducto: r.tipoRecurso === 'Producto' ? r.idProducto.trim() || null : null,
        descripcion: r.descripcion.trim() || null,
        tipoEnvio: r.tipoRecurso === 'Envio' ? r.tipoEnvio.trim() || null : null,
        cantidad: aNumero(r.cantidad),
        costoUnitario: aNumero(r.costoUnitario),
        observaciones: r.observaciones.trim() || null,
      }))
    );
  };

  return (
    <Modal
      id="modal-matriz-costos"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Costos del taller — ${taller?.nombreHospital ?? ''}`}
      size="wide"
      footer={
        <div className="flex w-full items-center justify-between gap-2 pt-2">
          <p className="text-sm font-semibold">Costo total: {fmtMoneda(total)}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar costos'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Captura el costo unitario de cada recurso; el subtotal se calcula solo (cantidad × costo
            unitario).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRecursos((prev) => [
                ...prev,
                {
                  tipoRecurso: 'Producto',
                  idProducto: '',
                  descripcion: '',
                  tipoEnvio: '',
                  cantidad: '',
                  costoUnitario: '',
                  observaciones: '',
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Agregar recurso
          </Button>
        </div>

        {recursos.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            El equipo no capturó recursos para este taller.
          </p>
        )}

        {recursos.map((recurso, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_120px_120px_auto]"
          >
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={recurso.tipoRecurso}
                onValueChange={(v) =>
                  actualizar(idx, { tipoRecurso: v as TipoRecursoTaller })
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
            <div className="space-y-1">
              <Label className="text-xs">
                {recurso.tipoRecurso === 'Producto'
                  ? 'Producto (código)'
                  : recurso.tipoRecurso === 'Envio'
                    ? 'Tipo de envío'
                    : 'Descripción'}
              </Label>
              {recurso.tipoRecurso === 'Envio' ? (
                <Select
                  value={recurso.tipoEnvio}
                  onValueChange={(v) => actualizar(idx, { tipoEnvio: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Interno o externo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interno">Interno</SelectItem>
                    <SelectItem value="Externo">Externo</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-9"
                  value={recurso.tipoRecurso === 'Producto' ? recurso.idProducto : recurso.descripcion}
                  onChange={(e) =>
                    actualizar(
                      idx,
                      recurso.tipoRecurso === 'Producto'
                        ? { idProducto: e.target.value }
                        : { descripcion: e.target.value }
                    )
                  }
                />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min={0}
                className="h-9"
                value={recurso.cantidad}
                onChange={(e) => actualizar(idx, { cantidad: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo unitario</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="h-9"
                value={recurso.costoUnitario}
                onChange={(e) => actualizar(idx, { costoUnitario: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subtotal</Label>
              <p className="flex h-9 items-center text-sm font-medium tabular-nums">
                {fmtMoneda(subtotal(recurso))}
              </p>
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
          </div>
        ))}
      </div>
    </Modal>
  );
}
