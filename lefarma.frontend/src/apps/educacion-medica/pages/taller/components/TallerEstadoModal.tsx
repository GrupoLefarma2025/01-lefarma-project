import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, CheckCircle2, Loader2, PlayCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  Taller,
  TallerEstadoHistorial,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const PASOS = ['Creada', 'Autorizado', 'Programado', 'EnCurso', 'Realizado'];

const ROLES_CANCELAN = [
  'Gerente de Ventas',
  'Auxiliar Administrativo Educación Médica',
  'Coordinador de Educación Médica',
];

interface TallerEstadoModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  onChanged: () => void;
}

/**
 * Máquina de estados del taller (ADR-00008): stepper + solo transiciones permitidas
 * por rol/estado; Cancelado exige motivo. El historial completo vive en el modal
 * de historial.
 */
export function TallerEstadoModal({ open, onClose, taller, onChanged }: TallerEstadoModalProps) {
  const user = useAuthStore((s) => s.user);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<TallerEstadoHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const idTaller = taller?.idTaller ?? null;
  const esMiembro =
    taller != null &&
    user != null &&
    (taller.idEjecutivo === user.id || taller.idEspecialista === user.id);
  const puedeCancelar = (user?.roles ?? []).some((r) => ROLES_CANCELAN.includes(r.nombreRol));

  const transiciones = useMemo(() => {
    const opciones: { value: string; label: string }[] = [];
    if (!taller) return opciones;
    if (taller.estado === 'Programado') {
      if (esMiembro) opciones.push({ value: 'EnCurso', label: 'Iniciar taller (En curso)' });
      if (puedeCancelar) opciones.push({ value: 'Cancelado', label: 'Cancelar taller' });
    } else if (taller.estado === 'EnCurso') {
      if (esMiembro) opciones.push({ value: 'Realizado', label: 'Cerrar taller (Realizado)' });
      if (puedeCancelar) opciones.push({ value: 'Cancelado', label: 'Cancelar taller' });
    }
    return opciones;
  }, [taller, esMiembro, puedeCancelar]);

  const cargarHistorial = useCallback(async () => {
    if (idTaller == null) return;
    setLoadingHistorial(true);
    try {
      const res = await educacionMedicaApi.talleres.estados(idTaller);
      if (res.data.success) setHistorial(res.data.data ?? []);
    } catch {
      // El historial es informativo; el modal de historial muestra el error.
    } finally {
      setLoadingHistorial(false);
    }
  }, [idTaller]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal; la carga ocurre tras el await
      setNuevoEstado('');
      setMotivo('');
      void cargarHistorial();
    }
  }, [open, cargarHistorial]);

  const confirmar = async () => {
    if (idTaller == null || !nuevoEstado) return;
    if (nuevoEstado === 'Cancelado' && motivo.trim().length < 5) {
      toast.error('El motivo de la cancelación es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.cambiarEstado(idTaller, {
        nuevoEstado,
        motivo: nuevoEstado === 'Cancelado' ? motivo.trim() : null,
      });
      if (res.data.success) {
        toast.success(
          nuevoEstado === 'Cancelado'
            ? 'Taller cancelado.'
            : `Taller en estado ${res.data.data?.estado ?? nuevoEstado}.`
        );
        onChanged();
        onClose();
      } else {
        toast.error(res.data.message ?? 'No se pudo cambiar el estado');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cambiar el estado');
    } finally {
      setGuardando(false);
    }
  };

  const indiceActual = taller ? PASOS.indexOf(taller.estado) : -1;
  const cancelado = taller?.estado === 'Cancelado';

  // Sugerencia el día del taller (decisión #10): el sistema destaca "Iniciar" cuando fecha_taller = hoy.
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate()
  ).padStart(2, '0')}`;
  const esHoy = taller?.fechaTaller?.slice(0, 10) === hoyIso;

  return (
    <Modal
      id="modal-taller-estado"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Estado del taller${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
      size="wide"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cerrar
          </Button>
          <Button onClick={() => void confirmar()} disabled={guardando || !nuevoEstado}>
            {guardando ? 'Aplicando...' : 'Aplicar transición'}
          </Button>
        </div>
      }
    >
      {taller && (
        <div className="space-y-5">
          {/* Stepper del taller (decisión #14) */}
          <div className="flex flex-wrap items-center gap-2">
            {PASOS.map((paso, idx) => {
              const activo = !cancelado && idx === indiceActual;
              const completado = !cancelado && idx < indiceActual;
              return (
                <div key={paso} className="flex items-center gap-2">
                  {idx > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
                  <span
                    className={
                      activo
                        ? 'rounded-full border border-primary bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                        : completado
                          ? 'rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : 'rounded-full border px-3 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {paso === 'EnCurso' ? 'En curso' : paso}
                  </span>
                </div>
              );
            })}
            {cancelado && (
              <Badge variant="destructive" className="ml-2">
                Cancelado
              </Badge>
            )}
          </div>

          {transiciones.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {cancelado || taller.estado === 'Realizado'
                ? 'El taller cerró su ciclo: no hay transiciones disponibles.'
                : 'No tienes transiciones disponibles en este estado (rol/estado).'}
            </p>
          ) : (
            <div className="space-y-3">
              {esHoy && taller.estado === 'Programado' && esMiembro && (
                <p className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                  Hoy es el día del taller: se sugiere iniciarlo (En curso) cuando comience.
                </p>
              )}
              <div className="space-y-1">
                <Label>Nueva transición</Label>
                <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Selecciona el estado destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {transiciones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {nuevoEstado === 'Cancelado' && (
                <div className="space-y-1">
                  <Label>Motivo de la cancelación *</Label>
                  <Textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Describe el motivo (obligatorio)"
                  />
                </div>
              )}
              {nuevoEstado === 'Realizado' && (
                <p className="text-xs text-muted-foreground">
                  Para cerrar el taller se requiere al menos 1 evidencia y 1 asistencia registradas.
                </p>
              )}
            </div>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial de estados
            </h3>
            {loadingHistorial ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin transiciones registradas.</p>
            ) : (
              <ul className="space-y-1.5">
                {historial.map((evento) => (
                  <li
                    key={evento.idHistorial}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                  >
                    {evento.estadoNuevo === 'Realizado' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : evento.estadoNuevo === 'Cancelado' ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : evento.estadoNuevo === 'EnCurso' ? (
                      <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {evento.estadoAnterior ?? '—'} → {evento.estadoNuevo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {evento.origen === 'Automatico' ? 'Automático' : 'Manual'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {evento.nombreUsuario ?? 'Sistema'} ·{' '}
                      {new Date(evento.fecha).toLocaleString('es-MX')}
                    </span>
                    {evento.motivo && <span className="italic">“{evento.motivo}”</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
