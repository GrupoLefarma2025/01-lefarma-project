import { useEffect, useState } from 'react';
import { Building2, Compass, Loader2, MapPin, Route } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { educacionMedicaApi } from '../../../services/educacionMedica.api';
import type { SeleccionDetalle } from '../../../types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import { fechaMedia } from '../calendarioUtils';

type Estrategia = 'ciudad' | 'centroide';

interface GenerarRutasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seleccion: SeleccionDetalle | null;
  onGenerated: () => void;
}

export function GenerarRutasModal({
  open,
  onOpenChange,
  seleccion,
  onGenerated,
}: GenerarRutasModalProps) {
  const [estrategia, setEstrategia] = useState<Estrategia>('ciudad');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal */
  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const generar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    setError(null);
    try {
      const response = await educacionMedicaApi.rutas.generar(
        seleccion.idSeleccionMensual,
        estrategia
      );
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo generar la propuesta.');
      }
      toast.success('Propuesta de rutas generada. Las visitas ya están en el calendario.');
      onOpenChange(false);
      onGenerated();
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo generar la propuesta de rutas.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      id="calendario-generar-rutas"
      open={open}
      setOpen={onOpenChange}
      title="Generar propuesta de rutas"
      subtitle="Calendariza los hospitales autorizados de la selección."
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            className="bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
            onClick={() => void generar()}
            disabled={guardando || !seleccion}
          >
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar propuesta
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-orange-200/70 bg-orange-50/60 p-4 dark:border-orange-900/60 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm dark:bg-orange-900/50 dark:text-orange-300">
              <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Selección #{seleccion?.idSeleccionMensual ?? '—'}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {seleccion?.hospitales.length ?? 0} hospitales
                </span>
                <span>
                  {seleccion?.fechaInicioVigencia
                    ? `${fechaMedia(seleccion.fechaInicioVigencia.slice(0, 10))} – ${fechaMedia(
                        seleccion.fechaFinVigencia?.slice(0, 10) ??
                          seleccion.fechaInicioVigencia.slice(0, 10)
                      )}`
                    : 'Periodo por definir'}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Estrategia de calendarización
          </p>

          <button
            type="button"
            aria-pressed={estrategia === 'ciudad'}
            onClick={() => setEstrategia('ciudad')}
            className={[
              'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
              estrategia === 'ciudad'
                ? 'border-orange-300 bg-orange-50/60 ring-1 ring-orange-200 dark:border-orange-800 dark:bg-orange-950/30 dark:ring-orange-950'
                : 'border-slate-200 bg-card hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50',
            ].join(' ')}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600 shadow-sm dark:bg-slate-900 dark:text-orange-300">
              <MapPin className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                Por ciudad
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Agrupa los hospitales por ciudad para evitar fragmentar los viajes entre días.
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-pressed={estrategia === 'centroide'}
            onClick={() => setEstrategia('centroide')}
            className={[
              'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
              estrategia === 'centroide'
                ? 'border-orange-300 bg-orange-50/60 ring-1 ring-orange-200 dark:border-orange-800 dark:bg-orange-950/30 dark:ring-orange-950'
                : 'border-slate-200 bg-card hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50',
            ].join(' ')}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-300">
              <Compass className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                Por centroide
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Compacta los días al máximo ordenando por cercanía al centro de la región.
              </span>
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          Se creará la primera versión de rutas. Después podrás ajustar fechas, responsables y
          talleres desde el calendario.
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
