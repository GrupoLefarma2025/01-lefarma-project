import { useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import type {
  MatrizRevision,
  MatrizTalleresDetalle,
} from '../../../types/educacionMedica.types';
import { fechaMedia } from '../calendarioUtils';

interface MatrizEnvioModalProps {
  open: boolean;
  onClose: () => void;
  matriz: MatrizTalleresDetalle | null;
  revision: MatrizRevision | null;
  enviando: boolean;
  onConfirmar: (comentario: string) => Promise<boolean>;
}

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

export function MatrizEnvioModal({
  open,
  onClose,
  matriz,
  revision,
  enviando,
  onConfirmar,
}: MatrizEnvioModalProps) {
  const [comentario, setComentario] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [aperturaAnterior, setAperturaAnterior] = useState(false);

  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    setComentario('');
    setConfirmado(false);
  }

  const visitasSinTaller = revision?.visitasSinTaller ?? 0;
  const requiereConfirmacion = visitasSinTaller > 0;
  const puedeEnviar = Boolean(matriz) && Boolean(revision) && (!requiereConfirmacion || confirmado);
  const advertencias = revision?.advertencias.filter((a) => a.severidad !== 'info') ?? [];

  const confirmar = async () => {
    if (!puedeEnviar || enviando) return;
    const aplicado = await onConfirmar(comentario.trim());
    if (aplicado) onClose();
  };

  return (
    <Modal
      id="modal-matriz-envio"
      open={open}
      setOpen={(abierto) => {
        if (!abierto) onClose();
      }}
      title="Enviar matriz a autorización"
      subtitle="La captura se cerrará para todos los equipos al confirmar el envío."
      size="wide"
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5 bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
            onClick={() => void confirmar()}
            disabled={!puedeEnviar || enviando}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {enviando ? 'Enviando…' : 'Enviar a autorización'}
          </Button>
        </div>
      }
    >
      {!matriz ? (
        <p className="text-sm text-muted-foreground">No hay una matriz seleccionada.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {matriz.gerencia ?? `Gerencia ${matriz.idTipoGerencia}`} · {fmtPeriodo(matriz.periodo)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {matriz.totalTalleres} taller(es) · {fmtMoneda(matriz.costoTotal)} · Paso actual:{' '}
              {matriz.pasoNombre ?? '—'}
            </p>
          </div>

          {!revision ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-xs leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              No se pudo cargar la revisión de cobertura. Cierra este modal y vuelve a intentar.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
                    Visitas tipo taller
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {revision.visitasTipoTaller}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-slate-400">Con taller</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {revision.visitasConTaller}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                    Sin taller
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {revision.visitasSinTaller}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-slate-400">Talleres</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {revision.totalTalleres}
                  </p>
                </div>
              </div>

              {visitasSinTaller > 0 && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-[11px] leading-relaxed text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Estas visitas no tienen taller. No es un error si el hospital no tenía
                    disponibilidad; revisa la lista y confirma que es intencional.
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[11px]">
                      <thead>
                        <tr className="sticky top-0 bg-slate-50/90 text-[9px] uppercase tracking-[0.08em] text-slate-400 dark:bg-slate-900/90">
                          <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="px-3 py-2 text-left font-semibold">Hospital</th>
                          <th className="px-3 py-2 text-left font-semibold">Equipo</th>
                          <th className="px-3 py-2 text-left font-semibold">Ruta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revision.visitasSinTallerDetalle.map((visita) => (
                          <tr key={visita.idRutaVisita}>
                            <td className="border-t border-slate-100 px-3 py-2 tabular-nums text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3 w-3 text-slate-300" />
                                {fechaMedia(visita.fechaVisita)}
                              </span>
                            </td>
                            <td className="border-t border-slate-100 px-3 py-2 font-medium text-slate-700 dark:border-slate-800/70 dark:text-slate-200">
                              {visita.hospital ?? 'Hospital sin nombre'}
                            </td>
                            <td className="border-t border-slate-100 px-3 py-2 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                              {visita.nombreEjecutivo ?? 'Sin EV'} +{' '}
                              {visita.nombreEspecialista ?? 'Sin EP'}
                            </td>
                            <td className="border-t border-slate-100 px-3 py-2 dark:border-slate-800/70">
                              <Badge variant="outline" className="rounded-full text-[9px]">
                                {visita.estadoRuta ?? '—'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {advertencias.length > 0 && (
                <div className="space-y-1.5">
                  {advertencias.map((advertencia) => (
                    <div
                      key={`${advertencia.codigo}-${advertencia.mensaje}`}
                      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {advertencia.mensaje}
                    </div>
                  ))}
                </div>
              )}

              {requiereConfirmacion && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <Checkbox
                    id="confirmar-visitas-sin-taller"
                    checked={confirmado}
                    onCheckedChange={(valor) => setConfirmado(valor === true)}
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="confirmar-visitas-sin-taller"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Revisé las visitas sin taller y son intencionales
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      El envío quedará registrado con esta confirmación.
                    </p>
                  </div>
                </div>
              )}

              {visitasSinTaller === 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Todas las visitas tipo taller tienen taller capturado.
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="comentario-envio-matriz" className="text-xs text-slate-600 dark:text-slate-300">
              Comentario (opcional)
            </Label>
            <Textarea
              id="comentario-envio-matriz"
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              placeholder="Nota para el historial del workflow…"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
