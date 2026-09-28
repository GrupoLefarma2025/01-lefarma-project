import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CalendarDays, History, Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
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

function StatCard({
  label,
  value,
  borderClass,
  valueClass,
}: {
  label: string;
  value: number;
  borderClass: string;
  valueClass: string;
}) {
  return (
    <div className={`rounded-lg border border-l-4 bg-muted/40 p-3 ${borderClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${valueClass}`}>{formatearNumero(value)}</p>
    </div>
  );
}

function SolicitudCard({ solicitud }: { solicitud: SolicitudVacacionesDetalle }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        solicitud.enTramite ? 'border-dashed border-amber-500/60 bg-amber-500/5' : ''
      }`}
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
      return;
    }
    setEditando(false);
    setIdSaldoActivo(idSaldoProp);
  }, [idSaldoProp]);

  useEffect(() => {
    if (idSaldoActivo == null) {
      setDetalle(null);
      return;
    }
    cargarDetalle(idSaldoActivo);
  }, [idSaldoActivo]);

  const cambiarAnio = (id: number) => {
    if (id === idSaldoActivo) return;
    setEditando(false);
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
    return detalle.diasGenerados + compensados + ajustados - vencidos - detalle.diasTomados;
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

  const baseDisponible = detalle
    ? detalle.diasGenerados + detalle.diasCompensados + detalle.diasAjustados
    : 0;
  const porcentajeUso = detalle
    ? baseDisponible > 0
      ? Math.min(100, Math.max(0, (detalle.diasTomados / baseDisponible) * 100))
      : detalle.diasTomados > 0
        ? 100
        : 0
    : 0;

  const solicitudesCerradas = detalle?.solicitudes.filter((s) => !s.enTramite) ?? [];
  const solicitudesEnTramite = detalle?.solicitudes.filter((s) => s.enTramite) ?? [];

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

  return (
    <Modal
      id="saldo-detalle-modal"
      open={saldo != null}
      setOpen={(open: boolean) => {
        if (!open) onClose();
      }}
      title={`Detalle de vacaciones — ${detalle?.usuarioNombre ?? saldo?.usuarioNombre ?? 'Empleado'} · ${detalle?.anio ?? saldo?.anio ?? ''}`}
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{detalle.usuarioNombre ?? 'Empleado'}</h3>
              <p className="text-sm text-muted-foreground">
                {[detalle.puesto, detalle.departamento].filter(Boolean).join(' · ') || 'Sin puesto registrado'}
              </p>
              <p className="text-sm text-muted-foreground">
                {[detalle.empleadoEmpresa, detalle.correo].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detalle.nomina != null && <Badge variant="secondary">Nómina {detalle.nomina}</Badge>}
              <Badge variant="secondary">Ingreso: {formatearFecha(detalle.fechaIngreso)}</Badge>
              <Badge variant="secondary">Antigüedad: {formatearAntiguedad(detalle.antiguedad)}</Badge>
              {detalle.vacacionesPorAntiguedad != null && (
                <Badge variant="secondary">
                  Por antigüedad: {formatearNumero(detalle.vacacionesPorAntiguedad)} días
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Generados"
                    value={detalle.diasGenerados}
                    borderClass="border-l-emerald-500"
                    valueClass="text-emerald-600"
                  />
                  <StatCard
                    label="Tomados"
                    value={detalle.diasTomados}
                    borderClass="border-l-amber-500"
                    valueClass="text-amber-600"
                  />
                  <StatCard
                    label="Ajustados"
                    value={detalle.diasAjustados}
                    borderClass="border-l-blue-500"
                    valueClass="text-blue-600"
                  />
                  <StatCard
                    label="Compensados"
                    value={detalle.diasCompensados}
                    borderClass="border-l-violet-500"
                    valueClass="text-violet-600"
                  />
                  <StatCard
                    label="Vencidos"
                    value={detalle.diasVencidos}
                    borderClass="border-l-red-500"
                    valueClass="text-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Días usados</span>
                    <span>{Math.round(porcentajeUso)}%</span>
                  </div>
                  <Progress
                    value={porcentajeUso}
                    className="border border-border bg-muted-foreground/30"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pendientes = Generados + Ajustados + Compensados − Vencidos − Tomados
                  </p>
                </div>

                {detalle.diasEnTramite > 0 && (
                  <div
                    className={`rounded-md border p-3 ${
                      detalle.diasPendientesProyectado < 0
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-amber-500/50 bg-amber-500/5'
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      Proyección con solicitudes en trámite
                    </p>
                    <p className="text-sm">
                      En trámite:{' '}
                      <span className="font-semibold">
                        {formatearNumero(detalle.diasEnTramite)} días
                      </span>{' '}
                      · Pendiente si se cierran:{' '}
                      <span
                        className={`font-semibold ${
                          detalle.diasPendientesProyectado < 0 ? 'text-destructive' : ''
                        }`}
                      >
                        {formatearNumero(detalle.diasPendientesProyectado)} días
                      </span>
                    </p>
                    {detalle.diasPendientesProyectado < 0 && (
                      <p className="text-xs text-destructive">
                        Quedaría en saldo negativo si se aprueban todas.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full flex-col items-center justify-center gap-1 pt-6 text-center">
                <p className="text-sm text-muted-foreground">Días pendientes</p>
                <p
                  className={`text-4xl font-bold ${
                    detalle.diasPendientes < 0 ? 'text-destructive' : 'text-emerald-600'
                  }`}
                >
                  {formatearNumero(detalle.diasPendientes)}
                </p>
                {detalle.diasPendientes < 0 ? (
                  <Badge variant="destructive">Saldo en negativo</Badge>
                ) : (
                  <Badge variant="secondary">Disponibles para solicitar</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {detalle.fechaModificacion && (
            <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Último ajuste:</span>{' '}
              {formatearFecha(detalle.fechaModificacion)}
              {detalle.ajustadoPor ? ` por ${detalle.ajustadoPor}` : ''}
              {detalle.motivoAjuste ? ` — ${detalle.motivoAjuste}` : ''}
            </div>
          )}

          {detalle.historial.length > 1 && (
            <section className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" />
                Historial por año
              </h4>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Año</TableHead>
                      <TableHead className="text-right">Generados</TableHead>
                      <TableHead className="text-right">Tomados</TableHead>
                      <TableHead className="text-right">Ajustados</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.historial.map((fila) => {
                      const esAnioActual = fila.anio === detalle.anio;
                      return (
                        <TableRow
                          key={fila.idSaldo}
                          onClick={() => cambiarAnio(fila.idSaldo)}
                          className={`cursor-pointer ${esAnioActual ? 'bg-muted/60' : ''}`}
                        >
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              {fila.anio}
                              {esAnioActual && <Badge variant="secondary">Actual</Badge>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatearNumero(fila.diasGenerados)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatearNumero(fila.diasTomados)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatearNumero(fila.diasAjustados)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              fila.diasPendientes < 0 ? 'text-destructive' : ''
                            }`}
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

          {editando && (
            <div className="space-y-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Pencil className="h-4 w-4" />
                  Ajuste manual de saldo
                </h4>
                <Badge variant="outline" className="border-amber-500/60 text-amber-700">
                  Editando
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Los días se capturan en números enteros. El pendiente se recalcula solo: Generados +
                Ajustados + Compensados − Vencidos − Tomados.
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
                  <p className="text-xs text-muted-foreground">
                    Corrección manual del saldo. Positivo suma días (ej. 2) y negativo los resta
                    (ej. -1). Úsalo ante errores de captura o acuerdos con el empleado.
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
                  <p className="text-xs text-muted-foreground">
                    Días que caducaron por la política de la empresa y ya no se pueden disfrutar.
                    Solo enteros positivos (ej. 3).
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
                  <p className="text-xs text-muted-foreground">
                    Días que se pagaron al empleado en lugar de disfrutarlos. Solo enteros positivos
                    (ej. 2).
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
                <p className="text-xs text-muted-foreground">
                  Explica brevemente el porqué (ej. &quot;Corrección por antigüedad 2026&quot;).
                  Obligatorio, máx. 300 caracteres; se guarda como el último ajuste y se muestra en
                  este detalle.
                </p>
              </div>
              <div className="rounded-md border border-amber-500/40 bg-background/60 p-3">
                <p className="text-sm">
                  Pendiente resultante:{' '}
                  <span
                    className={
                      previewPendiente < 0 ? 'font-semibold text-destructive' : 'font-semibold'
                    }
                  >
                    {formatearNumero(previewPendiente)} días
                  </span>
                  {previewPendiente < 0 && ' — quedará en saldo negativo'}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              Días de vacaciones en {detalle.anio}
            </h4>
            {detalle.solicitudes.length === 0 ? (
              <EmptyState
                title="Sin solicitudes de vacaciones"
                description={`No hay solicitudes de vacaciones registradas en ${detalle.anio}.`}
              />
            ) : (
              <div className="space-y-5">
                {solicitudesCerradas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Tomados ({solicitudesCerradas.length})
                    </p>
                    <div className="space-y-3">
                      {solicitudesCerradas.map((solicitud) => (
                        <SolicitudCard key={solicitud.idSolicitud} solicitud={solicitud} />
                      ))}
                    </div>
                  </div>
                )}

                {solicitudesEnTramite.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      En trámite ({solicitudesEnTramite.length}) · no descuentan todavía
                    </p>
                    <div className="space-y-3">
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
