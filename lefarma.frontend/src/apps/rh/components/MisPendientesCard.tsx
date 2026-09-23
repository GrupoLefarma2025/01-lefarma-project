import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { misIncidenciasChecadoApi } from '../services/rh.api';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  IncidenciaChecadoResponse,
  PagedResult,
  SolicitudPersonalResponse,
} from '@/types/solicitudPersonal.types';
import { isEstadoTerminal } from '@/hooks/useSolicitudes';
import { usePermission } from '@/hooks/usePermission';
import { toISODate } from '@/utils/date';
import { IncidenciaJustificarFlow } from './IncidenciaJustificarFlow';

function fmtFechaCorta(fecha: string) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MisPendientesCard({ refreshKey }: { refreshKey?: number } = {}) {
  const [incidencias, setIncidencias] = useState<IncidenciaChecadoResponse[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPersonalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] =
    useState<IncidenciaChecadoResponse | null>(null);
  const puedeVerMisIncidencias = usePermission({ require: 'incidencias_checado.ver_mias' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const hoy = new Date();
    const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    try {
      const [incRes, solRes] = await Promise.all([
        misIncidenciasChecadoApi
          .get({
            fechaDesde: toISODate(primerDiaMesAnterior),
            fechaHasta: toISODate(hoy),
          })
          .catch(() => null),
        API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>('/solicitudes-personal', {
          params: { verTodas: false, pageSize: 100 },
        }).catch(() => null),
      ]);

      setIncidencias(incRes?.data.success ? incRes.data.data ?? [] : []);
      setSolicitudes(solRes?.data.success ? solRes.data.data?.items ?? [] : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const pendientes = useMemo(
    () =>
      incidencias
        .filter(
          (i) => !i.justificada && !i.enTramite && (i.incidenciasCalculadas ?? []).length > 0
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [incidencias]
  );

  const solicitudesEnTramite = useMemo(
    () => solicitudes.filter((s) => !isEstadoTerminal(s.estadoNombre)),
    [solicitudes]
  );

  const sinPendientes = pendientes.length === 0 && solicitudesEnTramite.length === 0;
  const mostrarDetalle = !loading && !sinPendientes && !collapsed;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Mis pendientes
              </CardTitle>

              {!loading && !sinPendientes && (
                <div className="flex flex-wrap items-center gap-2">
                  {pendientes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCollapsed(false)}
                      className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-200"
                    >
                      {pendientes.length}{' '}
                      {pendientes.length === 1
                        ? 'incidencia por justificar'
                        : 'incidencias por justificar'}
                    </button>
                  )}
                  {solicitudesEnTramite.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCollapsed(false)}
                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200"
                    >
                      {solicitudesEnTramite.length}{' '}
                      {solicitudesEnTramite.length === 1
                        ? 'solicitud en trámite'
                        : 'solicitudes en trámite'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!loading && !sinPendientes && (
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Expandir pendientes' : 'Colapsar pendientes'}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </CardHeader>

        {loading ? (
          <CardContent className="space-y-2 pt-0">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        ) : sinPendientes ? (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No tienes pendientes por ahora.
            </div>
          </CardContent>
        ) : mostrarDetalle ? (
          <CardContent className="space-y-4 pt-0">
            {pendientes.length > 0 && (
              <div className="space-y-1.5">
                {pendientes.slice(0, 3).map((incidencia) => (
                  <div
                    key={`${incidencia.fecha}-${incidencia.nomina ?? ''}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {(incidencia.incidenciasCalculadas ?? [])
                          .map((i) => i.nombre)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtFechaCorta(incidencia.fecha)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setIncidenciaSeleccionada(incidencia)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Justificar incidencia
                    </Button>
                  </div>
                ))}
                {pendientes.length > 3 && puedeVerMisIncidencias && (
                  <Link
                    to="/rh/mis-incidencias"
                    className="inline-block text-xs font-medium text-primary hover:underline"
                  >
                    y {pendientes.length - 3}{' '}
                    {pendientes.length - 3 === 1 ? 'incidencia más' : 'incidencias más'} · Ver
                    todas en Mis incidencias
                  </Link>
                )}
              </div>
            )}

            {solicitudesEnTramite.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {solicitudesEnTramite.length}{' '}
                    {solicitudesEnTramite.length === 1
                      ? 'solicitud en trámite'
                      : 'solicitudes en trámite'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Esperando revisión o resolución
                  </span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/rh/solicitudes">Ver mis solicitudes</Link>
                </Button>
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>

      <IncidenciaJustificarFlow
        incidencia={incidenciaSeleccionada}
        onClose={() => setIncidenciaSeleccionada(null)}
        onSaved={fetchData}
      />
    </>
  );
}

export default MisPendientesCard;
