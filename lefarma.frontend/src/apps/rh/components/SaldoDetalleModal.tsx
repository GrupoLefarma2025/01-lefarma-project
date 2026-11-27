import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { toApiError } from '@/utils/errors';
import { vacacionesApi } from '../services/vacaciones.api';
import type {
  SaldoVacacionesAjusteRequest,
  SaldoVacacionesDetalle,
  SaldoVacacionesResponse,
  SolicitudVacacionesDetalle,
} from '@/types/vacaciones.types';

interface SaldoDetalleModalProps {
  saldo: SaldoVacacionesResponse | null;
  onClose: () => void;
  onUpdated: () => void;
}

const formatearFecha = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const formatearNumero = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const formatearAntiguedad = (anios?: number) =>
  anios == null ? '—' : `${anios} ${anios === 1 ? 'año' : 'años'}`;

const iniciales = (nombre?: string) =>
  nombre
    ? nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join('')
    : '—';

const esPeriodoVigente = (inicio: string, fin: string) => {
  const hoy = new Date();
  const desde = new Date(`${inicio.slice(0, 10)}T00:00:00`);
  const hasta = new Date(`${fin.slice(0, 10)}T23:59:59`);
  return (
    !Number.isNaN(desde.getTime()) &&
    !Number.isNaN(hasta.getTime()) &&
    hoy >= desde &&
    hoy <= hasta
  );
};

function StatItem({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="min-w-[68px]">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums leading-tight">
        {formatearNumero(value)}
      </p>
    </div>
  );
}

function SolicitudCard({ solicitud }: { solicitud: SolicitudVacacionesDetalle }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        solicitud.enTramite
          ? 'border-dashed border-amber-500/60 bg-amber-500/5'
          : 'border-slate-200/80 bg-card dark:border-slate-800'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">{solicitud.folio}</span>
          <span className="text-muted-foreground">
            {' '}
            · {formatearFecha(solicitud.fechaInicio)} a {formatearFecha(solicitud.fechaFin)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {solicitud.enTramite && (
            <Badge variant="outline" className="border-amber-500/60 text-amber-700">
              {solicitud.estadoNombre ?? 'En trámite'}
            </Badge>
          )}
          <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">
            {formatearNumero(solicitud.dias)} días
          </Badge>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {solicitud.fechas.map((fecha) => (
          <Badge key={fecha} variant="secondary" className="font-normal">
            {formatearFecha(fecha)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface AjusteForm {
  ajustados: string;
  vencidos: string;
  compensados: string;
  motivo: string;
}

export function SaldoDetalleModal({ saldo, onClose, onUpdated }: SaldoDetalleModalProps) {
  const puedeAjustar = usePermission({ require: 'vacaciones.saldos.cargar' });

  const [detalle, setDetalle] = useState<SaldoVacacionesDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AjusteForm>({ ajustados: '', vencidos: '', compensados: '', motivo: '' });
  const [idSaldoActivo, setIdSaldoActivo] = useState<number | null>(saldo?.idSaldo ?? null);
  const [mostrarTodosAjustes, setMostrarTodosAjustes] = useState(false);

  const idSaldoProp = saldo?.idSaldo;

  const cargarDetalle = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await vacacionesApi.getSaldoDetalle(id);
      setDetalle(response.data.data ?? null);
    } catch (e) {
      setError(toApiError(e).message ?? 'Error al obtener el detalle del saldo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idSaldoProp == null) {
      setDetalle(null);
      setEditando(false);
      setIdSaldoActivo(null);
      setMostrarTodosAjustes(false);
      return;
    }
    setEditando(false);
    setMostrarTodosAjustes(false);
    setIdSaldoActivo(idSaldoProp);
  }, [idSaldoProp]);

  useEffect(() => {
    if (idSaldoActivo == null) {
      setDetalle(null);
      return;
    }
    cargarDetalle(idSaldoActivo);
  }, [idSaldoActivo]);

  const cambiarPeriodo = (id: number) => {
    if (id === idSaldoActivo) return;
    setEditando(false);
    setMostrarTodosAjustes(false);
    setIdSaldoActivo(id);
  };

  const parseValor = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const previewPendiente = useMemo(() => {
    if (!detalle) return 0;
    const ajustados = parseValor(form.ajustados) ?? detalle.diasAjustados;
    const vencidos = parseValor(form.vencidos) ?? detalle.diasVencidos;
    const compensados = parseValor(form.compensados) ?? detalle.diasCompensados;
    return (
      detalle.diasGenerados +
      compensados +
      ajustados +
      detalle.diasAjustadosArrastre -
      vencidos -
      detalle.diasTomados
    );
  }, [detalle, form]);

  const iniciarAjuste = () => {
    if (!detalle) return;
    setForm({
      ajustados: formatearNumero(detalle.diasAjustados),
      vencidos: formatearNumero(detalle.diasVencidos),
      compensados: formatearNumero(detalle.diasCompensados),
      motivo: '',
    });
    setEditando(true);
  };

  const handleFieldChange =
    (field: keyof AjusteForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleIntegerChange =
    (field: 'ajustados' | 'vencidos' | 'compensados', permiteNegativo: boolean) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const sinDecimales = event.target.value.split(/[.,]/)[0];
      const negativo = permiteNegativo && sinDecimales.trimStart().startsWith('-');
      const digitos = sinDecimales.replace(/\D/g, '');
      setForm((prev) => ({ ...prev, [field]: `${negativo ? '-' : ''}${digitos}` }));
    };

  const guardarAjuste = async () => {
    if (!detalle) return;

    const motivo = form.motivo.trim();
    if (!motivo) {
      toast.error('El motivo del ajuste es obligatorio');
      return;
    }

    const payload: SaldoVacacionesAjusteRequest = { motivo };
    const ajustados = parseValor(form.ajustados);
    const vencidos = parseValor(form.vencidos);
    const compensados = parseValor(form.compensados);
    if (ajustados !== null) payload.diasAjustados = ajustados;
    if (vencidos !== null) payload.diasVencidos = vencidos;
    if (compensados !== null) payload.diasCompensados = compensados;

    if (ajustados === null && vencidos === null && compensados === null) {
      toast.error('Debe indicar al menos un valor a ajustar');
      return;
    }

    setSaving(true);
    try {
      await vacacionesApi.ajustarSaldo(detalle.idSaldo, payload);
      toast.success('Saldo ajustado exitosamente');
      setEditando(false);
      await cargarDetalle(detalle.idSaldo);
      onUpdated();
    } catch (e) {
      toast.error(toApiError(e).message ?? 'Error al ajustar el saldo');
    } finally {
      setSaving(false);
    }
  };

  const diasDisponibles = detalle
    ? detalle.diasGenerados +
      detalle.diasCompensados +
      detalle.diasAjustados +
      detalle.diasAjustadosArrastre -
      detalle.diasVencidos
    : 0;
  const porcentajeUso = detalle
    ? diasDisponibles > 0
      ? Math.min(100, Math.max(0, (detalle.diasTomados / diasDisponibles) * 100))
      : detalle.diasTomados > 0
        ? 100
        : 0
    : 0;

  const solicitudesCerradas = detalle?.solicitudes.filter((s) => !s.enTramite) ?? [];
  const solicitudesEnTramite = detalle?.solicitudes.filter((s) => s.enTramite) ?? [];

  const historialAjustesOrdenado = detalle ? [...detalle.historialAjustes].reverse() : [];
  const historialAjustesVisibles = mostrarTodosAjustes
    ? historialAjustesOrdenado
    : historialAjustesOrdenado.slice(0, 2);

  const footer = detalle ? (
    editando ? (
      <>
        <Button variant="outline" onClick={() => setEditando(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={guardarAjuste} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar ajuste
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        {puedeAjustar && (
          <Button onClick={iniciarAjuste}>
            <Pencil className="mr-2 h-4 w-4" />
            Ajustar saldo
          </Button>
        )}
      </>
    )
  ) : (
    <Button variant="outline" onClick={onClose}>
      Cerrar
    </Button>
  );

  const periodoLabel = detalle
    ? `Período ${detalle.numeroPeriodo}`
    : saldo
      ? `Período ${saldo.numeroPeriodo}`
      : '';

  return (
    <Modal
      id="saldo-detalle-modal"
      open={saldo != null}
      setOpen={(open: boolean) => {
        if (!open) onClose();
      }}
      title={`Detalle de vacaciones — ${detalle?.usuarioNombre ?? saldo?.usuarioNombre ?? 'Empleado'}${periodoLabel ? ` · ${periodoLabel}` : ''}`}
      size="w75"
      footer={footer}
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando detalle…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-destructive">{error}</p>
          {idSaldoActivo != null && (
            <Button variant="outline" size="sm" onClick={() => cargarDetalle(idSaldoActivo)}>
              Reintentar
            </Button>
          )}
        </div>
      ) : detalle ? (
        <div className="space-y-5">
          <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                {iniciales(detalle.usuarioNombre)}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold">
                  {detalle.usuarioNombre ?? 'Empleado'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[detalle.puesto, detalle.departamento].filter(Boolean).join(' · ') ||
                    'Sin puesto registrado'}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>
                    Nómina{' '}
                    <span className="font-medium text-foreground">{detalle.nomina ?? '—'}</span>
                  </span>
                  {detalle.empleadoEmpresa && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate">{detalle.empleadoEmpresa}</span>
                    </>
                  )}
                  {detalle.correo && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate">{detalle.correo}</span>
                    </>
                  )}
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>
                    Ingreso{' '}
                    <span className="font-medium text-foreground">
                      {formatearFecha(detalle.fechaIngreso)}
                    </span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span>
                    Antigüedad{' '}
                    <span className="font-medium text-foreground">
                      {formatearAntiguedad(detalle.antiguedad)}
                    </span>
                  </span>
                  {detalle.vacacionesPorAntiguedad != null && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span>
                        <span className="font-medium text-foreground">
                          {formatearNumero(detalle.vacacionesPorAntiguedad)} días
                        </span>{' '}
                        por antigüedad
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Badge
                variant="outline"
                className="border-slate-200 bg-card text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {periodoLabel}
              </Badge>
              <p className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
                {detalle.periodo}
              </p>
            </div>
          </section>

          {detalle.historial.length > 1 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-1">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Períodos
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Haz clic en una fila para cambiar de período.
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {detalle.historial.length} períodos registrados
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-900/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 text-[11px]">Período</TableHead>
                      <TableHead className="h-8 text-[11px]">Fechas</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Generados</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Tomados</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Ajustados</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Pendientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.historial.map((fila) => {
                      const seleccionado = fila.idSaldo === detalle.idSaldo;
                      const vigente = esPeriodoVigente(
                        fila.fechaInicioPeriodo,
                        fila.fechaFinPeriodo
                      );
                      return (
                        <TableRow
                          key={fila.idSaldo}
                          onClick={() => cambiarPeriodo(fila.idSaldo)}
                          aria-current={seleccionado ? 'true' : undefined}
                          className={cn(
                            'cursor-pointer text-xs transition-colors',
                            seleccionado
                              ? 'bg-blue-50/70 hover:bg-blue-50/70 dark:bg-blue-950/30 dark:hover:bg-blue-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          )}
                        >
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                                  seleccionado
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-slate-300 dark:border-slate-600'
                                )}
                                aria-hidden
                              >
                                {seleccionado && <Check className="h-3 w-3" />}
                              </span>
                              <span
                                className={cn(
                                  'font-medium',
                                  seleccionado && 'text-primary'
                                )}
                              >
                                Período {fila.numeroPeriodo}
                              </span>
                              {vigente && (
                                <Badge
                                  variant="outline"
                                  className="h-4 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                  Vigente
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2 text-muted-foreground">
                            {fila.periodo}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {formatearNumero(fila.diasGenerados)}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {formatearNumero(fila.diasTomados)}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {formatearNumero(fila.diasAjustados)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'py-2 text-right font-semibold tabular-nums',
                              fila.diasPendientes < 0 && 'text-destructive'
                            )}
                          >
                            {formatearNumero(fila.diasPendientes)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/80 bg-card p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <StatItem label="Generados" value={detalle.diasGenerados} dotClass="bg-emerald-500" />
                <StatItem label="Tomados" value={detalle.diasTomados} dotClass="bg-amber-500" />
                <StatItem label="Ajustados" value={detalle.diasAjustados} dotClass="bg-blue-500" />
                {detalle.diasAjustadosArrastre > 0 && (
                  <StatItem
                    label="Arrastre"
                    value={detalle.diasAjustadosArrastre}
                    dotClass="bg-cyan-500"
                  />
                )}
                <StatItem
                  label="Compensados"
                  value={detalle.diasCompensados}
                  dotClass="bg-violet-500"
                />
                <StatItem label="Vencidos" value={detalle.diasVencidos} dotClass="bg-red-500" />
              </div>

              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-1.5',
                  detalle.diasPendientes < 0
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
                )}
              >
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Días pendientes
                  </p>
                  <p
                    className={cn(
                      'text-xl font-semibold tabular-nums leading-tight',
                      detalle.diasPendientes < 0
                        ? 'text-destructive'
                        : 'text-emerald-700 dark:text-emerald-300'
                    )}
                  >
                    {formatearNumero(detalle.diasPendientes)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    detalle.diasPendientes < 0
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  )}
                >
                  {detalle.diasPendientes < 0 ? 'Saldo negativo' : 'Disponible'}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-muted-foreground">
                <span>Días usados del período</span>
                <span className="tabular-nums">
                  <span className="font-medium text-foreground">
                    {formatearNumero(detalle.diasTomados)}
                  </span>{' '}
                  de {formatearNumero(diasDisponibles)} disponibles ·{' '}
                  {Math.round(porcentajeUso)}%
                </span>
              </div>
              <Progress
                value={porcentajeUso}
                className="h-2 border-0 bg-slate-100 dark:bg-slate-800"
              />
              <p className="text-[10px] text-muted-foreground">
                Pendientes = generados + ajustados + arrastre + compensados − vencidos − tomados.
              </p>
            </div>

            {detalle.diasEnTramite > 0 && (
              <div
                className={cn(
                  'mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-[11px]',
                  detalle.diasPendientesProyectado < 0
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-amber-500/40 bg-amber-500/5'
                )}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">
                    {formatearNumero(detalle.diasEnTramite)} días en trámite
                  </span>{' '}
                  · si se aprueban quedarían{' '}
                  <span
                    className={cn(
                      'font-semibold',
                      detalle.diasPendientesProyectado < 0 && 'text-destructive'
                    )}
                  >
                    {formatearNumero(detalle.diasPendientesProyectado)} días
                  </span>
                </span>
                {detalle.diasPendientesProyectado < 0 && (
                  <span className="text-destructive">Quedaría en saldo negativo.</span>
                )}
              </div>
            )}
          </section>

          {detalle.arrastres.length > 0 && (
            <section className="space-y-2">
              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Arrastre
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Saldo del puente de carga. No vence automáticamente y se consume primero.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-900/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 text-[11px]">Concepto</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Total</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Aplicados</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">Restantes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.arrastres.map((fila) => (
                      <TableRow key={fila.idArrastre} className="text-xs">
                        <TableCell className="py-2 font-medium">{fila.descripcion}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          {formatearNumero(fila.diasTotal)}
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          {formatearNumero(fila.diasAplicados)}
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">
                          {formatearNumero(fila.diasRestante)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {historialAjustesVisibles.length > 0 ? (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Historial de ajustes
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
                {historialAjustesVisibles.map((ajuste, idx) => (
                  <div
                    key={`${ajuste.fecha}-${idx}`}
                    className={cn(
                      'px-3 py-2 text-[11px]',
                      idx > 0 && 'border-t border-slate-200/70 dark:border-slate-800'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <span className="font-medium text-foreground">
                        {formatearFecha(ajuste.fecha)}
                        {ajuste.usuarioNombre ? ` · ${ajuste.usuarioNombre}` : ''}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        Ajustados {formatearNumero(ajuste.diasAjustados)} · Vencidos{' '}
                        {formatearNumero(ajuste.diasVencidos)} · Compensados{' '}
                        {formatearNumero(ajuste.diasCompensados)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{ajuste.motivo}</p>
                  </div>
                ))}
              </div>
              {detalle.historialAjustes.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-[11px] text-muted-foreground"
                  onClick={() => setMostrarTodosAjustes((prev) => !prev)}
                >
                  {mostrarTodosAjustes ? (
                    <>
                      <ChevronUp className="mr-1 h-3 w-3" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3 w-3" />
                      Ver {detalle.historialAjustes.length - 2} más
                    </>
                  )}
                </Button>
              )}
            </section>
          ) : (
            detalle.fechaModificacion && (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Último ajuste:</span>{' '}
                {formatearFecha(detalle.fechaModificacion)}
                {detalle.ajustadoPor ? ` por ${detalle.ajustadoPor}` : ''}
              </p>
            )
          )}

          {editando && (
            <div className="space-y-4 rounded-xl border border-amber-500/50 bg-amber-50/40 p-3.5 dark:bg-amber-950/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  <Pencil className="h-3.5 w-3.5" />
                  Ajuste manual de saldo
                </h4>
                <Badge
                  variant="outline"
                  className="border-amber-500/60 bg-card text-[10px] text-amber-700 dark:text-amber-300"
                >
                  Editando
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Los días se capturan en números enteros. El pendiente se recalcula solo: Generados +
                Ajustados + Arrastre + Compensados − Vencidos − Tomados.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="ajuste-ajustados">Días ajustados</Label>
                  <Input
                    id="ajuste-ajustados"
                    type="text"
                    inputMode="numeric"
                    value={form.ajustados}
                    onChange={handleIntegerChange('ajustados', true)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Corrección manual. Positivo suma días (ej. 2) y negativo los resta (ej. -1).
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ajuste-vencidos">Días vencidos</Label>
                  <Input
                    id="ajuste-vencidos"
                    type="text"
                    inputMode="numeric"
                    value={form.vencidos}
                    onChange={handleIntegerChange('vencidos', false)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Días caducados por la política; ya no se pueden disfrutar. Solo enteros
                    positivos.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ajuste-compensados">Días compensados</Label>
                  <Input
                    id="ajuste-compensados"
                    type="text"
                    inputMode="numeric"
                    value={form.compensados}
                    onChange={handleIntegerChange('compensados', false)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Días pagados en lugar de disfrutarse. Solo enteros positivos.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ajuste-motivo">
                  Motivo del ajuste <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ajuste-motivo"
                  rows={2}
                  maxLength={300}
                  placeholder="Ej. Corrección de días por antigüedad, convenio con el empleado…"
                  value={form.motivo}
                  onChange={handleFieldChange('motivo')}
                />
                <p className="text-[10px] text-muted-foreground">
                  Obligatorio, máx. 300 caracteres; se guarda como el último ajuste del período.
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-card/60 px-3 py-2 text-xs">
                Pendiente resultante:{' '}
                <span
                  className={cn(
                    'font-semibold',
                    previewPendiente < 0 ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {formatearNumero(previewPendiente)} días
                </span>
                {previewPendiente < 0 && ' — quedará en saldo negativo'}
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Días de vacaciones en {periodoLabel}
            </h4>
            {detalle.solicitudes.length === 0 ? (
              <EmptyState
                title="Sin solicitudes de vacaciones"
                description={`No hay solicitudes de vacaciones registradas en ${periodoLabel}.`}
              />
            ) : (
              <div className="space-y-4">
                {solicitudesCerradas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Tomados ({solicitudesCerradas.length})
                    </p>
                    <div className="space-y-2">
                      {solicitudesCerradas.map((solicitud) => (
                        <SolicitudCard key={solicitud.idSolicitud} solicitud={solicitud} />
                      ))}
                    </div>
                  </div>
                )}

                {solicitudesEnTramite.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      En trámite ({solicitudesEnTramite.length}) · no descuentan todavía
                    </p>
                    <div className="space-y-2">
                      {solicitudesEnTramite.map((solicitud) => (
                        <SolicitudCard key={solicitud.idSolicitud} solicitud={solicitud} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
