import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { calcularRangoPeriodo, PERIODOS } from '@/utils/date';
import { misIncidenciasChecadoApi } from '../services/rh.api';
import { IncidenciaJustificarFlow } from '../components/IncidenciaJustificarFlow';
import { ReglasDescuentoModal } from '../components/ReglasDescuentoModal';
import { resumenDescuentoIncidencia } from '../utils/incidencias';
import type { IncidenciaChecadoResponse } from '@/types/solicitudPersonal.types';

const PAGE_SIZE = 10;

type EstadoFiltro = 'todas' | 'pendientes' | 'tramite' | 'justificadas';

function formatHora(valor?: string | null) {
  if (!valor) return '—';
  const partes = valor.split(':');
  return partes.length >= 2 ? `${partes[0]}:${partes[1]}` : valor;
}

function fechaLarga(fecha: string) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function paginasVisibles(actual: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas: (number | '...')[] = [1];
  const inicio = Math.max(2, actual - 1);
  const fin = Math.min(total - 1, actual + 1);
  if (inicio > 2) paginas.push('...');
  for (let i = inicio; i <= fin; i++) paginas.push(i);
  if (fin < total - 1) paginas.push('...');
  paginas.push(total);
  return paginas;
}

function EstadoBadge({ incidencia }: { incidencia: IncidenciaChecadoResponse }) {
  if (incidencia.justificada) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Justificada
      </span>
    );
  }
  if (incidencia.enTramite) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <Clock className="h-3.5 w-3.5" />
        En trámite
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      <AlertTriangle className="h-3.5 w-3.5" />
      Pendiente de justificar
    </span>
  );
}

export default function MisIncidenciasPage() {
  usePageTitle('Mis incidencias', 'Consulta tus incidencias de checado y justifícalas');

  const [periodo, setPeriodo] = useState('este-mes');
  const [fechaInicioPersonalizada, setFechaInicioPersonalizada] = useState('');
  const [fechaFinPersonalizada, setFechaFinPersonalizada] = useState('');
  const [incidencias, setIncidencias] = useState<IncidenciaChecadoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todas');
  const [page, setPage] = useState(1);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] =
    useState<IncidenciaChecadoResponse | null>(null);

  const rango = useMemo(() => {
    if (periodo === 'personalizado') {
      return { fechaInicio: fechaInicioPersonalizada, fechaFin: fechaFinPersonalizada };
    }
    return calcularRangoPeriodo(periodo);
  }, [periodo, fechaInicioPersonalizada, fechaFinPersonalizada]);

  const fetchIncidencias = useCallback(async () => {
    if (!rango.fechaInicio || !rango.fechaFin) {
      setIncidencias([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await misIncidenciasChecadoApi.get({
        fechaDesde: rango.fechaInicio,
        fechaHasta: rango.fechaFin,
      });
      const lista = res.data.success ? res.data.data ?? [] : [];
      setIncidencias([...lista].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode !== 403) {
        toast.error(err.message ?? 'No se pudieron cargar tus incidencias.');
      }
      setIncidencias([]);
    } finally {
      setLoading(false);
    }
  }, [rango.fechaInicio, rango.fechaFin]);

  useEffect(() => {
    fetchIncidencias();
  }, [fetchIncidencias]);

  const pendientes = useMemo(
    () => incidencias.filter((i) => !i.justificada && !i.enTramite),
    [incidencias]
  );
  const enTramite = useMemo(() => incidencias.filter((i) => i.enTramite), [incidencias]);
  const justificadas = useMemo(() => incidencias.filter((i) => i.justificada), [incidencias]);

  const filtradas = useMemo(() => {
    switch (estadoFiltro) {
      case 'pendientes':
        return pendientes;
      case 'tramite':
        return enTramite;
      case 'justificadas':
        return justificadas;
      default:
        return incidencias;
    }
  }, [estadoFiltro, incidencias, pendientes, enTramite, justificadas]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const visibles = filtradas.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);
  const desde = filtradas.length === 0 ? 0 : (paginaActual - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(paginaActual * PAGE_SIZE, filtradas.length);

  const chips: { value: EstadoFiltro; label: string; count: number; activeClass: string }[] = [
    {
      value: 'todas',
      label: 'Todas',
      count: incidencias.length,
      activeClass: 'border-slate-400 bg-slate-600 text-white hover:bg-slate-600',
    },
    {
      value: 'pendientes',
      label: 'Por justificar',
      count: pendientes.length,
      activeClass: 'border-red-300 bg-red-600 text-white hover:bg-red-600',
    },
    {
      value: 'tramite',
      label: 'En trámite',
      count: enTramite.length,
      activeClass: 'border-amber-300 bg-amber-500 text-white hover:bg-amber-500',
    },
    {
      value: 'justificadas',
      label: 'Justificadas',
      count: justificadas.length,
      activeClass: 'border-green-300 bg-green-600 text-white hover:bg-green-600',
    },
  ];

  return (
    <div className="w-full space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label
                htmlFor="filtro-periodo-incidencias"
                className="text-xs font-medium text-muted-foreground"
              >
                Período
              </label>
              <Select
                value={periodo}
                onValueChange={(v) => {
                  setPeriodo(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-periodo-incidencias" className="h-10">
                  <SelectValue placeholder="Selecciona un período" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {periodo === 'personalizado' && (
              <>
                <div className="space-y-1">
                  <label
                    htmlFor="filtro-fecha-inicio-incidencias"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Fecha inicio
                  </label>
                  <Input
                    id="filtro-fecha-inicio-incidencias"
                    type="date"
                    className="h-10"
                    value={fechaInicioPersonalizada}
                    onChange={(e) => {
                      setFechaInicioPersonalizada(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="filtro-fecha-fin-incidencias"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Fecha fin
                  </label>
                  <Input
                    id="filtro-fecha-fin-incidencias"
                    type="date"
                    className="h-10"
                    value={fechaFinPersonalizada}
                    onChange={(e) => {
                      setFechaFinPersonalizada(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <ReglasDescuentoModal />
          </div>
        </CardContent>
      </Card>

      {!loading && incidencias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const activo = estadoFiltro === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  setEstadoFiltro(chip.value);
                  setPage(1);
                }}
                className={
                  activo
                    ? `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${chip.activeClass}`
                    : 'inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted'
                }
              >
                {chip.label} ({chip.count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <Skeleton className="mb-2 h-4 w-52" />
              <Skeleton className="mb-2 h-5 w-64" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-70" />
          <p className="text-sm font-medium">
            {incidencias.length === 0
              ? 'No tienes incidencias en este período'
              : 'No hay incidencias con ese estado'}
          </p>
          <p className="text-xs">
            {incidencias.length === 0
              ? 'Si esperabas ver una incidencia, prueba con otro período en el filtro.'
              : 'Prueba con otro filtro o período.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibles.map((incidencia) => {
              const esPendiente = !incidencia.justificada && !incidencia.enTramite;
              const resumenDescuento = resumenDescuentoIncidencia(
                incidencia.incidenciasCalculadas ?? [],
                incidencia.justificada,
                incidencia.enTramite
              );
              return (
                <div
                  key={`${incidencia.fecha}-${incidencia.nomina ?? ''}`}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold capitalize">
                        {fechaLarga(incidencia.fecha)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(incidencia.incidenciasCalculadas ?? []).map((inc, index) => {
                          const cantidad = inc.cantidadAcumulada ?? 1;
                          const contador =
                            cantidad > 1 && inc.posicionAcumulacion
                              ? `${inc.posicionAcumulacion}/${cantidad}`
                              : null;
                          return (
                            <Badge key={index} variant="outline">
                              {inc.nombre}
                              {contador && (
                                <span className="ml-1 font-semibold">· {contador}</span>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Entrada: esperada {formatHora(incidencia.entrada)} · registrada{' '}
                        {formatHora(incidencia.entro)}
                        <span className="mx-1.5">—</span>
                        Salida: esperada {formatHora(incidencia.salida)} · registrada{' '}
                        {formatHora(incidencia.salio)}
                      </p>
                      <div className="flex items-start gap-2 pt-0.5">
                        <span
                          className={
                            resumenDescuento.genera
                              ? 'inline-flex w-fit shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'
                              : 'inline-flex w-fit shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800'
                          }
                        >
                          {resumenDescuento.genera ? 'Sí' : 'No'}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-sm text-muted-foreground">
                            {resumenDescuento.texto}
                          </p>
                          {resumenDescuento.detalle && (
                            <p className="text-xs text-muted-foreground">
                              {resumenDescuento.detalle}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <EstadoBadge incidencia={incidencia} />
                      {incidencia.tipoSolicitudNombre && (
                        <span className="text-xs text-muted-foreground">
                          {incidencia.tipoSolicitudNombre}
                        </span>
                      )}
                      {esPendiente && (
                        <Button size="sm" onClick={() => setIncidenciaSeleccionada(incidencia)}>
                          <Plus className="mr-1.5 h-4 w-4" />
                          Justificar incidencia
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 sm:flex-row">
              <span className="text-xs text-muted-foreground">
                Mostrando {desde}–{hasta} de {filtradas.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={paginaActual === 1}
                  aria-label="Página anterior"
                  onClick={() => setPage(Math.max(1, paginaActual - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {paginasVisibles(paginaActual, totalPages).map((p, index) =>
                  p === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === paginaActual ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 min-w-8 px-2 text-xs"
                      aria-label={`Página ${p}`}
                      aria-current={p === paginaActual ? 'page' : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={paginaActual === totalPages}
                  aria-label="Página siguiente"
                  onClick={() => setPage(Math.min(totalPages, paginaActual + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <IncidenciaJustificarFlow
        incidencia={incidenciaSeleccionada}
        onClose={() => setIncidenciaSeleccionada(null)}
        onSaved={fetchIncidencias}
      />
    </div>
  );
}
