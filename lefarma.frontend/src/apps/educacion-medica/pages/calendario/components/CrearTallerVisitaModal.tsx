import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Loader2, Presentation, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/usePermission';
import { educacionMedicaApi } from '../../../services/educacionMedica.api';
import type { CalendarioItem, Taller } from '../../../types/educacionMedica.types';
import { fechaLarga, fmtHora } from '../calendarioUtils';
import { toApiError } from '@/utils/errors';

interface CrearTallerVisitaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CalendarioItem | null;
  onSaved: (taller: Taller) => void;
}

export function CrearTallerVisitaModal({
  open,
  onOpenChange,
  item,
  onSaved,
}: CrearTallerVisitaModalProps) {
  const puedeGestionarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_gestionar',
  });
  const puedeAjustarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_ajustar',
  });

  const [fecha, setFecha] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal */
  useEffect(() => {
    if (!open) return;
    setFecha(item?.fecha ?? '');
    setParticipantes(item?.participantes ? String(item.participantes) : '');
    setObservaciones('');
    setMotivo('');
    setError(null);
  }, [open, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fechaDistinta = Boolean(item && fecha && fecha !== item.fecha);
  const yaTieneTaller = Boolean(item?.idTaller);
  const requiereOtraFecha = yaTieneTaller && !fechaDistinta;
  const requiereAjuste = item?.estadoRuta === 'Cerrada';
  const puedeCambiarFecha = puedeGestionarRutas && (!requiereAjuste || puedeAjustarRutas);
  const motivoValido = !fechaDistinta || !requiereAjuste || motivo.trim().length >= 5;

  const guardar = async () => {
    if (!item) return;
    if (requiereOtraFecha) {
      setError('Esta visita ya tiene un taller. Elige otra fecha para crear una nueva visita.');
      return;
    }
    if (fechaDistinta && !puedeCambiarFecha) {
      setError('No tienes permiso para crear una visita en otra fecha.');
      return;
    }
    if (fechaDistinta && requiereAjuste && motivo.trim().length < 5) {
      setError('El motivo del ajuste es obligatorio.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        idRutaVisita: item.idRutaVisita,
        numeroParticipantes: participantes ? Number(participantes) : null,
        observaciones: observaciones.trim() || null,
        fechaTaller: fecha || item.fecha,
        horaTaller: item.hora,
        motivoAjuste: fechaDistinta ? motivo.trim() || null : null,
      };
      const response = fechaDistinta
        ? await educacionMedicaApi.talleres.crearDesdeVisita(payload)
        : await educacionMedicaApi.talleres.crear(payload);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message ?? 'No se pudo crear el taller.');
      }

      toast.success(
        fechaDistinta ? 'Nueva visita y taller programados.' : 'Taller programado en la visita.'
      );
      onOpenChange(false);
      onSaved(response.data.data);
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo crear el taller.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="calendario-crear-taller"
      open={open}
      setOpen={onOpenChange}
      title="Programar taller"
      subtitle="El hospital y los responsables se heredan de la visita."
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
            onClick={() => void guardar()}
            disabled={
              saving || !motivoValido || requiereOtraFecha || (fechaDistinta && !puedeCambiarFecha)
            }
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Programar taller
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-orange-200/70 bg-orange-50/60 p-4 dark:border-orange-900/60 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm dark:bg-orange-900/50 dark:text-orange-300">
              <Presentation className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item?.hospital ?? 'Hospital'}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Visita: {item ? fechaLarga(item.fecha) : 'Sin fecha'}
                </span>
                {item?.hora && <span>{fmtHora(item.hora)}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="calendario-fecha-taller">Fecha del taller</Label>
            <Input
              id="calendario-fecha-taller"
              type="date"
              value={fecha}
              disabled={!puedeCambiarFecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calendario-participantes">Participantes estimados</Label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="calendario-participantes"
                className="pl-9"
                type="number"
                min={0}
                placeholder="Ej. 24"
                value={participantes}
                onChange={(event) => setParticipantes(event.target.value)}
              />
            </div>
          </div>
        </div>

        {requiereOtraFecha && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Esta visita ya tiene un taller. Elige otra fecha para crear una nueva visita.
            </span>
          </div>
        )}

        {fechaDistinta && (
          <div
            className={[
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed',
              puedeCambiarFecha
                ? 'border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                : 'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
            ].join(' ')}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {!puedeGestionarRutas
                ? 'Para otra fecha necesitas permiso de gestión de rutas.'
                : requiereAjuste && !puedeAjustarRutas
                  ? 'La ruta está cerrada. Solo el CEM puede autorizar el ajuste con rutas.puede_ajustar.'
                  : requiereAjuste
                    ? 'La ruta está cerrada: se creará otra visita y el ajuste quedará auditado con el motivo.'
                    : 'Se creará otra visita para este hospital en la fecha indicada.'}
            </span>
          </div>
        )}

        {fechaDistinta && requiereAjuste && puedeAjustarRutas && (
          <div className="grid gap-2">
            <Label htmlFor="calendario-motivo-ajuste">Motivo del ajuste</Label>
            <Textarea
              id="calendario-motivo-ajuste"
              rows={2}
              placeholder="Explica por qué se agrega otra visita a una ruta cerrada."
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="calendario-observaciones">Notas de programación</Label>
          <Textarea
            id="calendario-observaciones"
            rows={3}
            placeholder="Indicaciones para el taller, tema o material especial."
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
          />
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          El producto se toma de la matriz del ejecutivo. Si no hay matriz, se usa el producto
          predeterminado con cantidad 2.
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
