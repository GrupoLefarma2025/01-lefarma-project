import { CheckCircle2, ClipboardList, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/shared/auth/authStore';
import { checkPermission, usePermissionVersion } from '@/utils/permissions';
import { educacionMedicaMenuItems } from '../../menuItems';
import { useDashboardData } from './useDashboardData';
import {
  AccesosCard,
  EquipoCard,
  KpiResumenCard,
  MatrizCard,
  ProximosDiasCard,
  SolicitudesCard,
  UltimosTalleresTable,
  VisitasCard,
  type EnlaceRapido,
} from './DashboardCards';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtPeriodo = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
};

/** Accesos rápidos derivados del menú (mismos permisos, sin duplicar códigos). */
function obtenerEnlacesRapidos(): EnlaceRapido[] {
  const enlaces: EnlaceRapido[] = [];
  for (const item of educacionMedicaMenuItems) {
    if ('items' in item) {
      for (const sub of item.items) {
        if (sub.permission && !checkPermission(sub.permission)) continue;
        enlaces.push({ title: sub.title, path: sub.path, icon: sub.icon });
      }
    } else {
      if (item.permission && !checkPermission(item.permission)) continue;
      if (!('path' in item)) continue;
      if (item.path === '/educacion-medica/dashboard' || item.path === '/educacion-medica/help') {
        continue;
      }
      enlaces.push({ title: item.title, path: item.path, icon: item.icon });
    }
  }
  return enlaces.slice(0, 8);
}

/**
 * Dashboard de Educación Médica (ADR-00012): landing adaptativo por permisos.
 * KPIs + tarjetas + últimos talleres; cada bloque se auto-oculta sin permiso o sin datos.
 */
export function EducacionMedicaDashboard() {
  usePageTitle('Dashboard', 'Tu resumen de Educación Médica');
  usePermissionVersion(); // re-render cuando cambian los permisos (accesos rápidos)
  const { user } = useAuthStore();
  const {
    periodo,
    loading,
    puedeVerTalleres,
    pendientes,
    misTalleres,
    asignaciones,
    matrices,
    talleresPeriodo,
    solicitudes,
    recargar,
  } = useDashboardData();

  const enlaces: EnlaceRapido[] = obtenerEnlacesRapidos();
  const equipo = misTalleres?.idEquipo != null ? misTalleres : null;
  const talleresBase = equipo ? equipo.talleres : talleresPeriodo;
  const totalTalleres = equipo
    ? equipo.talleres.length
    : matrices.reduce((suma, matriz) => suma + matriz.totalTalleres, 0);
  const realizados = talleresBase.filter((taller) => taller.estado === 'Realizado').length;
  const costoMes = equipo
    ? equipo.talleres.reduce((suma, taller) => suma + taller.costoTotal, 0)
    : matrices.reduce((suma, matriz) => suma + matriz.costoTotal, 0);
  const verTodosPath = equipo
    ? '/educacion-medica/talleres/mis-talleres'
    : '/educacion-medica/talleres';
  const sinActividad =
    pendientes.length === 0 &&
    !equipo &&
    asignaciones.length === 0 &&
    matrices.length === 0 &&
    solicitudes.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Hola{user?.nombre ? `, ${user.nombre}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumen de Educación Médica · {fmtPeriodo(periodo)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={recargar} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, indice) => (
              <Skeleton key={indice} className="h-16 w-full" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, indice) => (
              <Skeleton key={indice} className="h-40 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {(puedeVerTalleres || pendientes.length > 0) && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {puedeVerTalleres && (
                <KpiResumenCard
                  title="Talleres del mes"
                  value={totalTalleres}
                  subtitle={equipo ? 'del equipo' : 'del periodo'}
                  icon={ClipboardList}
                  tone="blue"
                  to={verTodosPath}
                />
              )}
              {puedeVerTalleres && (
                <KpiResumenCard
                  title="Realizados"
                  value={realizados}
                  subtitle={`de ${totalTalleres} talleres`}
                  icon={CheckCircle2}
                  tone="emerald"
                  to={verTodosPath}
                />
              )}
              <KpiResumenCard
                title="Pendientes de firma"
                value={pendientes.length}
                subtitle="por resolver"
                icon={ShieldCheck}
                tone="amber"
                to="/educacion-medica/aprobaciones"
              />
              {puedeVerTalleres && (
                <KpiResumenCard
                  title="Costo del mes"
                  value={fmtMoneda(costoMes)}
                  subtitle="acumulado"
                  icon={Wallet}
                  tone="violet"
                  to="/educacion-medica/talleres"
                />
              )}
            </div>
          )}

          {sinActividad && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay actividad para {fmtPeriodo(periodo)}. Usa los accesos rápidos para empezar.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {equipo && <EquipoCard misTalleres={equipo} />}
            {asignaciones.length > 0 && <VisitasCard asignaciones={asignaciones} />}
            <ProximosDiasCard visitas={asignaciones} talleres={talleresBase} />
            {matrices.length > 0 && <MatrizCard matrices={matrices} />}
            {solicitudes.length > 0 && <SolicitudesCard solicitudes={solicitudes} />}
            {enlaces.length > 0 && <AccesosCard enlaces={enlaces} />}
          </div>

          {puedeVerTalleres && talleresBase.length > 0 && (
            <UltimosTalleresTable
              talleres={talleresBase}
              mostrarEquipo={!equipo}
              titulo={equipo ? 'Últimos talleres del equipo' : 'Últimos talleres del mes'}
              verTodosPath={verTodosPath}
            />
          )}
        </>
      )}
    </div>
  );
}

export default EducacionMedicaDashboard;
