import { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  Calendar,
  User,
  Activity,
} from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useCurrency } from '@/hooks/useCurrency';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import type { DashboardStatsResponse } from '@/types/dashboard.types';
import { toApiError } from '@/utils/errors';

const ENDPOINT = '/dashboard/stats';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

interface DistribucionItem { name: string; value: number; }

function DistribucionList({ items, colorOffset = 0, fmt }: { items: DistribucionItem[]; colorOffset?: number; fmt: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>;
  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item, idx) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const color = COLORS[(idx + colorOffset) % COLORS.length];
        return (
          <div key={item.name}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-medium truncate">{item.name}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">{pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(item.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
}

export default function Dashboard() {
  usePageTitle('Dashboard', 'Página principal');

  const puedeVerPresupuesto = usePermission({ require: 'dashboard.ver_presupuesto' });
  const { fmt } = useCurrency();

  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await API.get<ApiResponse<DashboardStatsResponse>>(ENDPOINT);
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error: unknown) {
        const err = toApiError(error);
        toast.error(err.message ?? 'Error al cargar las estadísticas del dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = stats?.cards;
  const dataMensual = stats?.graficaMensual ?? [];
  const dataAreas = stats?.distribucionArea ?? [];
  const dataSucursales = stats?.distribucionSucursal ?? [];
  const pagosUrgentes = stats?.pagosUrgentes ?? [];
  const actividadReciente = stats?.actividadReciente ?? [];

  // Gauge: datos del mes actual (último elemento de graficaMensual)
  const currentMonth = dataMensual[dataMensual.length - 1];
  const presupuestoMes = currentMonth?.presupuesto ?? 0;
  const pagadoMes = currentMonth?.pagado ?? 0;
  const solicitadoMes = currentMonth?.solicitado ?? 0;
  const enProcesoMes = Math.max(0, solicitadoMes - pagadoMes);
  const disponibleMes = Math.max(0, presupuestoMes - solicitadoMes);
  const ejercidoPct = presupuestoMes > 0 ? Math.min(100, Math.round((solicitadoMes / presupuestoMes) * 100)) : 0;
  const isOverBudget = presupuestoMes > 0 && solicitadoMes > presupuestoMes;

  const gaugeData = presupuestoMes > 0
    ? [
        { name: 'Pagado', value: pagadoMes || 0.001, fill: '#10b981' },
        { name: 'En Proceso', value: enProcesoMes || 0.001, fill: '#f59e0b' },
        { name: 'Disponible', value: disponibleMes || 0.001, fill: '#e2e8f0' },
      ]
    : [{ name: 'Sin presupuesto', value: 1, fill: '#e2e8f0' }];

  const mesActualNombre = currentMonth?.mes ?? '';

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. PIPELINE DE OPERACIONES (Status Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-12 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Paso 1: Inicial</p>
                    <h3 className="text-2xl font-bold mt-1">{cards?.pendientesEnvio ?? 0}</h3>
                    <p className="text-xs text-blue-600 mt-1 font-medium flex items-center">
                       Órdenes nuevas <ArrowUpRight className="h-3 w-3 ml-1" />
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">En Firmas (3-5)</p>
                    <h3 className="text-2xl font-bold mt-1">{cards?.enFirmas ?? 0}</h3>
                    <p className="text-xs text-orange-600 mt-1 font-medium">Esperando aprobación</p>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">En Tesorería</p>
                    <h3 className="text-2xl font-bold mt-1">{cards?.enTesoreria ?? 0}</h3>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">Listas para pago</p>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vencidas / Alerta</p>
                    <h3 className="text-2xl font-bold mt-1">{cards?.vencidas ?? 0}</h3>
                    <p className="text-xs text-red-600 mt-1 font-medium">Requieren atención</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 2. OPERATIVO: PAGOS Y ACTIVIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Próximos Pagos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Próximos Pagos (Tesorería)</CardTitle>
              <CardDescription>Órdenes autorizadas pendientes de ejecutar</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">Ver todo</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {pagosUrgentes.map((pago) => (
                  <div key={pago.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${pago.status === 'Urgente' ? 'bg-red-100' : 'bg-blue-100'}`}>
                        <Calendar className={`h-4 w-4 ${pago.status === 'Urgente' ? 'text-red-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{pago.folio}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{pago.proveedor}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{fmt(pago.monto)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(pago.fechaLimitePago).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actividad Reciente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>Últimos movimientos registrados</CardDescription>
            </div>
            <Button variant="outline" size="sm">Historial</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {actividadReciente.map((item) => (
                  <div key={item.id} className="relative flex items-center justify-between p-2 pl-10">
                    <div className="absolute left-0 p-1 bg-white rounded-full border-2 border-slate-200 ml-[14px]">
                      <div className={`h-2 w-2 rounded-full ${
                        item.tipo === 'success' ? 'bg-emerald-500' : 
                        item.tipo === 'error' ? 'bg-red-500' : 
                        item.tipo === 'info' ? 'bg-blue-500' : 'bg-amber-500'
                      }`} />
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-1 rounded-md">
                          <User className="h-3 w-3 text-slate-600" />
                        </div>
                        <p className="text-xs">
                          <span className="font-medium">{item.usuario}</span> {item.accion} <span className="font-semibold">{item.entidad}</span>
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.fechaEvento)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. ANÁLISIS VISUAL (Charts) */}
      <div className={`grid grid-cols-1 gap-6 ${puedeVerPresupuesto ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        
        {/* Gauge: Presupuesto del Mes — solo con permiso */}
        {!puedeVerPresupuesto && (
          <Card>
            <CardHeader>
            <CardTitle className="text-lg">Presupuesto del Mes</CardTitle>
            <CardDescription>
              Ejercicio vs límite autorizado (Total cuentas contables) — {mesActualNombre}
              {isOverBudget && (
                <span className="ml-2 text-red-500 font-semibold">⚠ Presupuesto excedido</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-full h-[300px] rounded-lg" />
            ) : (
              <div className="flex flex-col items-center">
                {/* Semicircle gauge */}
                <div className="relative w-full" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="80%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {gaugeData.map((entry, index) => (
                          <Cell key={`gauge-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [fmt(value), name]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro del gauge */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                    <p className={`text-3xl font-bold ${isOverBudget ? 'text-red-500' : 'text-foreground'}`}>
                      {ejercidoPct}%
                    </p>
                    <p className="text-xs text-muted-foreground">Ejercido</p>
                  </div>
                </div>

                {/* Leyenda y montos */}
                <div className="grid grid-cols-3 gap-3 w-full mt-2">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Pagado</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {fmt(pagadoMes)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">En Proceso</span>
                    </div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {fmt(enProcesoMes)}
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Disponible</span>
                    </div>
                    <p className={`text-sm font-bold ${isOverBudget ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                      {isOverBudget
                        ? `(${fmt(solicitadoMes - presupuestoMes)})`
                        : fmt(disponibleMes)}
                    </p>
                  </div>
                </div>

                {/* Presupuesto total */}
                <p className="text-xs text-muted-foreground mt-3">
                  Límite autorizado: <span className="font-semibold">{fmt(presupuestoMes)}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Distribución por Área */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Área</CardTitle>
            <CardDescription>Top áreas por gasto total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
              </div>
            ) : (
              <DistribucionList items={dataAreas} colorOffset={0} fmt={fmt} />
            )}
          </CardContent>
        </Card>

        {/* Distribución por Sucursal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Sucursal</CardTitle>
            <CardDescription>Top sucursales por gasto total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
              </div>
            ) : (
              <DistribucionList items={dataSucursales} colorOffset={3} fmt={fmt} />
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
