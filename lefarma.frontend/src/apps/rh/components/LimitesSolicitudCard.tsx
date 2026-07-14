import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { misLimitesApi } from '../services/rh.api';
import type { LimitePorTipoResponse, MisLimitesResponse } from '@/types/solicitudPersonal.types';

type EstadoLimite = 'ok' | 'warning' | 'critical';

interface LimiteEstado {
  estado: EstadoLimite;
  porcentaje: number;
  label: string;
  icon: typeof CheckCircle2;
  barClass: string;
  badgeClass: string;
  ringClass: string;
}

function calcularEstado(usado: number, limite: number): LimiteEstado {
  const porcentaje = limite > 0 ? Math.round((usado / limite) * 100) : 0;
  const disponible = Math.max(0, limite - usado);

  if (limite === 0 || usado >= limite) {
    return {
      estado: 'critical',
      porcentaje: 100,
      label: 'Límite alcanzado',
      icon: AlertTriangle,
      barClass: 'bg-red-500',
      badgeClass:
        'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
      ringClass: 'ring-red-200/60 dark:ring-red-900/40',
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
      ringClass: 'ring-amber-200/60 dark:ring-amber-900/40',
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
    ringClass: 'ring-emerald-200/40 dark:ring-emerald-900/30',
  };
}

function formatearRangoFechas(inicio: string, fin: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };
  return `${fmt(inicio)} – ${fmt(fin)}`;
}

function LimiteCard({ limite }: { limite: LimitePorTipoResponse }) {
  const estado = calcularEstado(limite.usado, limite.limite);
  const Icon = estado.icon;
  const sinLimite = limite.limite === 0;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-shadow hover:shadow-md',
        !sinLimite && 'ring-1',
        estado.ringClass
      )}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                estado.estado === 'ok' &&
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                estado.estado === 'warning' &&
                  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                estado.estado === 'critical' &&
                  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              )}
            >
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{limite.tipo}</p>
              <p className="text-xs text-muted-foreground">{limite.periodo}</p>
            </div>
          </div>

          {sinLimite ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Sin límite
            </span>
          ) : (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                estado.badgeClass
              )}
            >
              <Icon className="h-3 w-3" />
              {estado.label}
            </span>
          )}
        </div>

        {!sinLimite && (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {limite.disponible}
                  <span className="ml-1 text-base font-medium text-muted-foreground">
                    / {limite.limite}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">disponibles</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-muted-foreground">
                  {limite.usado} usado{limite.usado === 1 ? '' : 's'}
                </p>
                <p className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">
                  {estado.porcentaje}% del límite
                </p>
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuenow={estado.porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${limite.tipo}: ${limite.usado} de ${limite.limite}`}
              className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full transition-all duration-500 ease-out', estado.barClass)}
                style={{ width: `${Math.min(100, estado.porcentaje)}%` }}
              />
            </div>
          </>
        )}

        {sinLimite && (
          <p className="text-xs text-muted-foreground">
            No tienes un límite configurado para este tipo en el periodo actual.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

export function LimitesSolicitudCard({
  idUsuario,
  titulo,
}: { idUsuario?: number; titulo?: string } = {}) {
  const [data, setData] = useState<MisLimitesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLimites = async () => {
    try {
      setLoading(true);
      const response = await misLimitesApi.get(idUsuario);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setData(null);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode !== 403) {
        toast.error(err.message ?? 'No se pudieron cargar los límites de solicitudes.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimites();
  }, [idUsuario]);

  const limites = data?.limitesPorTipo ?? [];
  const sinLimitesConfigurados = !loading && limites.length === 0;

  const resumen = limites.reduce(
    (acc, l) => {
      if (l.limite === 0) return acc;
      acc.disponibles += l.disponible;
      acc.limite += l.limite;
      acc.usado += l.usado;
      if (l.disponible === 0) acc.bloqueados += 1;
      else if (l.disponible === 1) acc.casiAgotados += 1;
      return acc;
    },
    { disponibles: 0, limite: 0, usado: 0, bloqueados: 0, casiAgotados: 0 }
  );

  const hayAlerta = resumen.bloqueados > 0 || resumen.casiAgotados > 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {titulo ?? 'Mis límites de solicitudes'}
          </CardTitle>
          {data?.periodoActual && (
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
        </div>
        <button
          type="button"
          onClick={fetchLimites}
          disabled={loading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Refrescar límites"
        >
          <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {hayAlerta && (
          <Alert
            variant={resumen.bloqueados > 0 ? 'destructive' : 'default'}
            className={
              resumen.bloqueados > 0
                ? 'border-red-200 bg-red-50/60 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
                : 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {resumen.bloqueados > 0
                ? `Tienes ${resumen.bloqueados} tipo${resumen.bloqueados === 1 ? '' : 's'} agotado${resumen.bloqueados === 1 ? '' : 's'}`
                : 'Atención: límites por agotarse'}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {resumen.bloqueados > 0
                ? 'No podrás crear nuevas solicitudes de estos tipos hasta el próximo periodo.'
                : `${resumen.casiAgotados} tipo${resumen.casiAgotados === 1 ? '' : 's'} te ${resumen.casiAgotados === 1 ? 'queda' : 'quedan'} con 1 solicitud disponible.`}
            </AlertDescription>
          </Alert>
        )}

        {!loading && limites.length > 0 && (
          <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                <span className="font-semibold text-foreground">{resumen.disponibles}</span>{' '}
                solicitudes disponibles
              </span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              <span>
                <span className="font-semibold text-foreground">{resumen.usado}</span> usadas este
                periodo
              </span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2">
              <FileCheck2 className="h-3.5 w-3.5 text-violet-600" />
              <span>
                <span className="font-semibold text-foreground">{resumen.limite}</span> límite total
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : sinLimitesConfigurados ? (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
            <ShieldCheck className="text-muted-foreground/40 mb-3 h-8 w-8" />
            <p className="text-sm font-medium text-foreground">Sin límites configurados</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              No tienes reglas de límite activas para tus tipos de solicitud en este periodo. Puedes
              crear solicitudes libremente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {limites.map((l) => (
              <LimiteCard key={l.idTipoSolicitud} limite={l} />
            ))}
          </div>
        )}

        {!loading && limites.length > 0 && (
          <p className="text-muted-foreground/70 text-[10px]">
            Solo se muestran las solicitudes en estado{' '}
            <span className="font-semibold">cerrado</span>. Las pendientes, rechazadas y canceladas
            no cuentan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default LimitesSolicitudCard;
