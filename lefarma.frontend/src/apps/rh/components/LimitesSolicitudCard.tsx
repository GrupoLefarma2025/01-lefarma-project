import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Palmtree,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { misLimitesApi } from '../services/rh.api';
import type { LimitePorTipoResponse, MisLimitesResponse } from '@/types/solicitudPersonal.types';
import type { SaldoVacacionesResponse } from '@/types/vacaciones.types';

type EstadoLimite = 'ok' | 'warning' | 'critical';

interface LimiteEstado {
  estado: EstadoLimite;
  porcentaje: number;
  label: string;
  icon: typeof CheckCircle2;
  barClass: string;
  badgeClass: string;
  iconBoxClass: string;
}

function calcularEstado(usado: number, limite: number): LimiteEstado {
  const porcentaje = limite > 0 ? Math.round((usado / limite) * 100) : 0;
  const disponible = Math.max(0, limite - usado);

  if (limite === 0 || usado >= limite) {
    return {
      estado: 'critical',
      porcentaje: 100,
      label: 'Agotado',
      icon: AlertTriangle,
      barClass: 'bg-red-500',
      badgeClass:
        'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      iconBoxClass: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    };
  }

  if (disponible === 1 || porcentaje >= 80) {
    return {
      estado: 'warning',
      porcentaje,
      label: 'Casi al límite',
      icon: Clock,
      barClass: 'bg-amber-500',
      badgeClass:
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
      iconBoxClass: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    };
  }

  return {
    estado: 'ok',
    porcentaje,
    label: 'Disponible',
    icon: CheckCircle2,
    barClass: 'bg-emerald-500',
    badgeClass:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    iconBoxClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  };
}

function formatearRangoFechas(inicio: string, fin: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };
  return `${fmt(inicio)} – ${fmt(fin)}`;
}

function LimiteRow({ limite }: { limite: LimitePorTipoResponse }) {
  const estado = calcularEstado(limite.usado, limite.limite);
  const Icon = estado.icon;
  const sinLimite = limite.limite === 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          sinLimite
            ? 'bg-muted text-muted-foreground'
            : estado.iconBoxClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{limite.tipo}</p>
          {sinLimite ? (
            <span className="rounded-full border border-border bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Sin límite
            </span>
          ) : (
            <span
              className={cn(
                'rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide',
                estado.badgeClass
              )}
            >
              {estado.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{limite.periodo}</p>
      </div>

      {!sinLimite && (
        <div className="flex shrink-0 items-center gap-3">
          <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            lleva <span className="text-sm font-semibold text-foreground">{limite.usado}</span>
            {' · '}
            <span className="text-sm font-semibold text-foreground">{limite.disponible}</span>{' '}
            disponibles
          </p>
          <div
            role="progressbar"
            aria-valuenow={estado.porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${limite.tipo}: ${limite.usado} de ${limite.limite}`}
            className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"
          >
            <div
              className={cn('h-full rounded-full transition-all duration-500', estado.barClass)}
              style={{ width: `${Math.min(100, estado.porcentaje)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SaldoVacacionesStrip({ saldo }: { saldo: SaldoVacacionesResponse }) {
  const porcentaje =
    saldo.diasGenerados > 0
      ? Math.min(100, Math.round((saldo.diasTomados / saldo.diasGenerados) * 100))
      : 0;
  const agotado = saldo.diasPendientes <= 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-50/80 to-cyan-50/30 px-4 py-4 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-cyan-950/10 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Palmtree className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Vacaciones {saldo.anio}</p>
          <p className="text-[11px] text-muted-foreground">Saldo anual</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 sm:px-2">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-3xl font-bold tabular-nums leading-none',
              agotado ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}
          >
            {saldo.diasPendientes}
          </span>
          <span className="text-sm text-muted-foreground">
            de {saldo.diasGenerados} días disponibles
          </span>
          {agotado && (
            <span className="ml-2 rounded-full border border-red-200 bg-red-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Agotado
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Vacaciones: ${saldo.diasTomados} de ${saldo.diasGenerados} días tomados`}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              agotado ? 'bg-red-500' : 'bg-blue-500'
            )}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-[11px] text-muted-foreground sm:flex-col sm:items-end sm:gap-1 sm:text-right">
        <span className="whitespace-nowrap">
          lleva <span className="font-semibold tabular-nums text-foreground">{saldo.diasTomados}</span>{' '}
          tomados
        </span>
        <span className="whitespace-nowrap">
          <span className="font-semibold tabular-nums text-foreground">{saldo.diasCompensados}</span>{' '}
          compensados ·{' '}
          <span className="font-semibold tabular-nums text-foreground">{saldo.diasAjustados}</span>{' '}
          ajustados
        </span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-4">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

const COLLAPSE_KEY = 'limites-solicitud-card:collapsed';

function leerColapsado(): boolean {
  try {
    const valor = localStorage.getItem(COLLAPSE_KEY);
    return valor === null ? true : valor === 'true';
  } catch {
    return true;
  }
}

export function LimitesSolicitudCard({
  idUsuario,
  titulo,
}: { idUsuario?: number; titulo?: string } = {}) {
  const [data, setData] = useState<MisLimitesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(leerColapsado);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // localStorage no disponible
      }
      return next;
    });
  };

  const cargarDatos = useCallback(async (): Promise<MisLimitesResponse | null> => {
    try {
      const response = await misLimitesApi.get(idUsuario);
      return response.data.success ? response.data.data : null;
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode !== 403) {
        toast.error(err.message ?? 'No se pudieron cargar los límites de solicitudes.');
      }
      return null;
    }
  }, [idUsuario]);

  const fetchLimites = async () => {
    setLoading(true);
    const resultado = await cargarDatos();
    setData(resultado);
    setLoading(false);
  };

  useEffect(() => {
    let cancelado = false;

    cargarDatos().then((resultado) => {
      if (!cancelado) {
        setData(resultado);
        setLoading(false);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [cargarDatos]);

  const limites = (data?.limitesPorTipo ?? []).filter(
    (l) => !l.tipo.toLowerCase().includes('vacac')
  );
  const saldos = data?.saldosVacaciones ?? [];
  const saldoPrincipal = saldos[0];

  const resumen = limites.reduce(
    (acc, l) => {
      if (l.limite === 0) return acc;
      acc.disponibles += l.disponible;
      acc.usado += l.usado;
      if (l.disponible === 0) acc.bloqueados += 1;
      else if (l.disponible === 1) acc.casiAgotados += 1;
      return acc;
    },
    { disponibles: 0, usado: 0, bloqueados: 0, casiAgotados: 0 }
  );

  const hayAlerta = resumen.bloqueados > 0 || resumen.casiAgotados > 0;
  const vacacionesAgotadas = saldoPrincipal != null && saldoPrincipal.diasPendientes <= 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            {titulo ?? 'Mis límites y saldo de vacaciones'}
          </CardTitle>

          {!collapsed && data?.periodoActual && (
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              {data.periodoActual}
              {data.periodoInicio && data.periodoFin && (
                <span className="text-muted-foreground/70">
                  · {formatearRangoFechas(data.periodoInicio, data.periodoFin)}
                </span>
              )}
            </CardDescription>
          )}

          {collapsed && !loading && data && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {saldoPrincipal && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    vacacionesAgotadas
                      ? 'border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                      : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                  )}
                >
                  <Palmtree className="h-3 w-3" />
                  Vacaciones:{' '}
                  {vacacionesAgotadas
                    ? 'sin días disponibles'
                    : `${saldoPrincipal.diasPendientes} días disponibles`}
                </span>
              )}
              {limites.map((l) => {
                const estado = calcularEstado(l.usado, l.limite);
                const Icon = estado.icon;
                const sinLimite = l.limite === 0;
                return (
                  <span
                    key={l.idTipoSolicitud}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      sinLimite
                        ? 'border-border bg-muted text-muted-foreground'
                        : estado.badgeClass
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {l.tipo}:{' '}
                    {sinLimite ? (
                      'sin límite'
                    ) : l.disponible === 0 ? (
                      'agotado'
                    ) : (
                      <span className="tabular-nums">
                        {l.disponible} de {l.limite} disponibles
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={fetchLimites}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Refrescar límites"
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? 'Expandir límites' : 'Colapsar límites'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          {loading ? (
            <SkeletonRows />
          ) : (
            <>
              {data !== null && saldos.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    No tienes saldo de vacaciones cargado para este año. Consulta con Recursos
                    Humanos si crees que deberías tener días disponibles.
                  </p>
                </div>
              )}

              {saldos.map((s) => (
                <SaldoVacacionesStrip key={`${s.idUsuario}-${s.anio}`} saldo={s} />
              ))}

              {hayAlerta && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                    resumen.bloqueados > 0
                      ? 'border-red-200 bg-red-50/60 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <p>
                    {resumen.bloqueados > 0
                      ? `Tienes ${resumen.bloqueados} tipo${resumen.bloqueados === 1 ? '' : 's'} agotado${resumen.bloqueados === 1 ? '' : 's'}. No podrás crear nuevas solicitudes de estos tipos hasta el próximo periodo.`
                      : `${resumen.casiAgotados} tipo${resumen.casiAgotados === 1 ? '' : 's'} a punto de agotarse.`}
                  </p>
                </div>
              )}

              {limites.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Límites del periodo
                  </p>
                  {limites.map((l) => (
                    <LimiteRow key={l.idTipoSolicitud} limite={l} />
                  ))}
                </div>
              )}

              {data !== null && limites.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">Sin límites configurados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No tienes reglas de límite activas para este periodo. Puedes crear solicitudes
                    libremente.
                  </p>
                </div>
              )}

              {limites.length > 0 && (
                <p className="text-muted-foreground/70 text-[10px]">
                  Solo cuentan las solicitudes en estado{' '}
                  <span className="font-semibold">cerrado</span>. Las pendientes, rechazadas y
                  canceladas no cuentan.
                </p>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default LimitesSolicitudCard;
