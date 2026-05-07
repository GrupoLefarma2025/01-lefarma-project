import { useState, useEffect, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useCurrency } from '@/hooks/useCurrency';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import type { DashboardStatsResponse } from '@/types/dashboard.types';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import { toApiError } from '@/utils/errors';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Activity,
  Building2,
  Store,
  Eye,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const ENDPOINT = '/dashboard/stats';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

interface DistribucionItem { name: string; value: number; }

function DistribucionList({ items, colorOffset = 0, fmt }: { items: DistribucionItem[]; colorOffset?: number; fmt: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>;
  return (
    <div className="space-y-2.5">
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
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{pct}%</span>
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

const ESTADO_COLORS: Record<string, string> = {
  'Creada': '#6B7280', 'En Revisión': '#F59E0B', 'En Tesorería': '#3B82F6',
  'Pagada': '#10B981', 'Cerrada': '#059669', 'Cancelada': '#EF4444',
  'Rechazada': '#DC2626', 'Preparación GAF': '#8B5CF6',
  'Revisión Director': '#EC4899',
};

function getEstadoColor(nombre: string): string {
  return ESTADO_COLORS[nombre] || '#6B7280';
}

function DonutChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>;
  return (
    <div className="relative w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => String(value)}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

export default function Dashboard() {
  usePageTitle('Dashboard', 'Pagina principal');

  const puedeVerPresupuesto = usePermission({ require: 'dashboard.puede_ver_presupuesto' });
  const puedeVerTodas = usePermission({ require: 'orden_compra.puede_ver_todas_las_ordenes' });
  const { fmt } = useCurrency();

  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distribucionTab, setDistribucionTab] = useState('empresa');
  const [ordenesModalOpen, setOrdenesModalOpen] = useState(false);
  const [todasLasOrdenes, setTodasLasOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await API.get<ApiResponse<DashboardStatsResponse>>(ENDPOINT);
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error: unknown) {
        const err = toApiError(error);
        toast.error(err.message ?? 'Error al cargar las estadisticas del dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const loadTodasLasOrdenes = async () => {
    setLoadingOrdenes(true);
    try {
      const res = await API.get<ApiResponse<OrdenCompraResponse[]>>(
        '/ordenes?max=200&orderBy=fechaCreacion&orderDirection=desc'
      );
      if (res.data.success) {
        setTodasLasOrdenes(res.data.data ?? []);
      }
    } catch {
      toast.error('Error al cargar todas las ordenes');
    } finally {
      setLoadingOrdenes(false);
    }
  };

  const cards = stats?.cards;
  const dataEmpresas = stats?.distribucionEmpresa ?? [];
  const dataSucursales = stats?.distribucionSucursal ?? [];
  const actividadReciente = stats?.actividadReciente ?? [];
  const currentMonth = stats?.graficaMensual?.[stats.graficaMensual.length - 1];

  const presupuestoTotal = stats?.graficaMensual?.[0]?.presupuesto ?? 0;
  const totalGastado = cards?.totalGastado ?? 0;
  const disponiblePresupuesto = Math.max(0, presupuestoTotal - totalGastado);
  const ejercidoPct = presupuestoTotal > 0 ? Math.min(100, Math.round((totalGastado / presupuestoTotal) * 100)) : 0;
  const isOverBudget = presupuestoTotal > 0 && totalGastado > presupuestoTotal;
  const mesActualNombre = currentMonth?.mes ?? '';

  const gaugeData = presupuestoTotal > 0
    ? [
        { name: 'Gastado', value: totalGastado || 0.001, fill: '#10b981' },
        { name: 'Disponible', value: disponiblePresupuesto || 0.001, fill: '#e2e8f0' },
      ]
    : [{ name: 'Sin presupuesto', value: 1, fill: '#e2e8f0' }];

  const totalesHistoricos = useMemo(() => {
    const c = cards;
    if (!c) return [];
    return [
      { name: 'Cerradas', value: c.cerradas },
      { name: 'Canceladas', value: c.canceladas },
      { name: 'Rechazadas', value: c.rechazadas },
      { name: 'Total Creadas', value: c.cerradas + c.canceladas + c.rechazadas + c.pendientesEnvio + c.enFirmas + c.revisionDirector + c.vencidas },
    ];
  }, [cards]);

  const totalesColors = ['#10b981', '#6b7280', '#ef4444', '#6366f1'];

  const ordenColumns = useMemo<ColumnDef<OrdenCompraResponse>[]>(() => [
    { accessorKey: 'folio', header: 'Folio', size: 120,
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.folio}</span>
    },
    { accessorKey: 'razonSocialProveedor', header: 'Proveedor', size: 200,
      cell: ({ row }) => <span className="text-xs truncate block max-w-[180px]">{row.original.razonSocialProveedor ?? '-'}</span>
    },
    { accessorKey: 'total', header: 'Monto', size: 130,
      cell: ({ row }) => <span className="text-xs">{fmt(row.original.total)}</span>
    },
    { accessorKey: 'estadoNombre', header: 'Estado', size: 130,
      cell: ({ row }) => {
        const nombre = row.original.estadoNombre ?? '-';
        const color = getEstadoColor(nombre);
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: color + '20', color }}>
            {nombre}
          </span>
        );
      }
    },
    { accessorKey: 'fechaSolicitud', header: 'Fecha', size: 110,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{new Date(row.original.fechaSolicitud).toLocaleDateString('es-MX')}</span>
    },
  ], [fmt]);

  return (
    <div className="space-y-5 pb-10">

      {/* ── 1. KPIs (8 tarjetas, 2 filas x 4) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="shadow-sm rounded-xl">
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-10" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard label="Pendientes Envio" value={cards?.pendientesEnvio ?? 0} color="blue" description="Ordenes recien creadas sin enviar" icon={<FileText className="h-4 w-4" />} />
            <KpiCard label="En Firma" value={cards?.enFirmas ?? 0} color="orange" description="En proceso de autorizacion" icon={<Clock className="h-4 w-4" />} />
            <KpiCard label="Revision Director" value={cards?.revisionDirector ?? 0} color="pink" description="Pendientes de revision del director" icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard label="Vencidas / Alerta" value={cards?.vencidas ?? 0} color="amber" description="Ordenes con fecha limite vencida" icon={<Calendar className="h-4 w-4" />} />
            {/* SEGUNDA FILA - OCULTA */}
            {/* <KpiCard label="Cerradas" value={cards?.cerradas ?? 0} color="emerald" description="Ciclo completo, ordenes cerradas/pagadas" icon={<CheckCircle2 className="h-4 w-4" />} /> */}
            {/* <KpiCard label="Canceladas" value={cards?.canceladas ?? 0} color="slate" description="Ordenes canceladas por el usuario" icon={<XCircle className="h-4 w-4" />} /> */}
            {/* <KpiCard label="Rechazadas" value={cards?.rechazadas ?? 0} color="red" description="Rechazadas en alguna firma" icon={<AlertCircle className="h-4 w-4" />} /> */}
            {/* <KpiCard label="Total Creadas (Mes)" value={cards?.totalCreadasMes ?? 0} color="indigo" description="Total de ordenes creadas este mes" icon={<TrendingUp className="h-4 w-4" />} /> */}
          </>
        )}
      </div>

      {/* ── 2. TOTALES + GASTO + PRESUPUESTO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">
        <Card className={`rounded-xl shadow-sm ${puedeVerPresupuesto ? 'lg:col-span-4' : 'lg:col-span-4'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-cyan-50 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4 text-cyan-500" /></div>
              <div>
                <CardTitle className="text-base">Totales Historicos</CardTitle>
                <CardDescription>Cerradas, canceladas, rechazadas y total</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="w-full h-56 rounded-lg" />
            ) : (
              <>
                <DonutChart data={totalesHistoricos} colors={totalesColors} />
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {totalesHistoricos.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: totalesColors[i] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`rounded-xl shadow-sm ${puedeVerPresupuesto ? 'lg:col-span-3' : 'lg:col-span-6'}`}>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <div className="bg-violet-50 p-1.5 rounded-lg"><Building2 className="h-4 w-4 text-violet-500" /></div>
              <div>
                <CardTitle className="text-base">Gasto Total</CardTitle>
                <CardDescription>Distribucion por empresa y sucursal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}</div>
            ) : (
              <Tabs value={distribucionTab} onValueChange={setDistribucionTab}>
                <TabsList className="mb-3 h-9">
                  <TabsTrigger value="empresa" className="gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" />Por Empresa</TabsTrigger>
                  <TabsTrigger value="sucursal" className="gap-1.5 text-xs"><Store className="h-3.5 w-3.5" />Por Sucursal</TabsTrigger>
                </TabsList>
                <TabsContent value="empresa" className="mt-0">
                  <DistribucionList items={dataEmpresas} colorOffset={0} fmt={fmt} />
                </TabsContent>
                <TabsContent value="sucursal" className="mt-0">
                  <DistribucionList items={dataSucursales} colorOffset={3} fmt={fmt} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {puedeVerPresupuesto && (
          <Card className="rounded-xl shadow-sm lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="bg-purple-50 p-1.5 rounded-lg"><TrendingUp className="h-4 w-4 text-purple-500" /></div>
                <div>
                  <CardTitle className="text-base">Presupuesto</CardTitle>
                  <CardDescription>{mesActualNombre}{isOverBudget && <span className="ml-2 text-red-500 font-semibold">Excedido</span>}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="w-full h-[160px] rounded-lg" />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-full" style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={gaugeData} cx="50%" cy="80%" startAngle={180} endAngle={0} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                          {gaugeData.map((entry, i) => <Cell key={`g-${i}`} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [fmt(value), name]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                      <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-foreground'}`}>{ejercidoPct}%</p>
                      <p className="text-[10px] text-muted-foreground">Ejercido</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    <LegendItem color="emerald" label="Gastado" value={fmt(totalGastado)} />
                    <LegendItem color="slate" label="Disponible" value={isOverBudget ? `(${fmt(totalGastado - presupuestoTotal)})` : fmt(disponiblePresupuesto)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Limite: <span className="font-semibold">{fmt(presupuestoTotal)}</span></p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── 3. ULTIMAS ORDENES (60%) + ACTIVIDAD RECIENTE (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="rounded-xl shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-cyan-50 p-1.5 rounded-lg"><FileText className="h-4 w-4 text-cyan-500" /></div>
              <div>
                <CardTitle className="text-base">Ultimas Ordenes</CardTitle>
                <CardDescription>Las 10 mas recientes</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { loadTodasLasOrdenes(); setOrdenesModalOpen(true); }}>
              <Eye className="h-3.5 w-3.5" />Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}</div>
            ) : (
              <MiniOrdenesTable fmt={fmt} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-blue-50 p-1.5 rounded-lg"><Activity className="h-4 w-4 text-blue-500" /></div>
              <div>
                <CardTitle className="text-base">Actividad Reciente</CardTitle>
                <CardDescription>Ultimos movimientos registrados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full rounded" />)}</div>
            ) : (
              <div className="space-y-1.5">
                {actividadReciente.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs bg-muted/50 border border-border/50 rounded-md px-2 py-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      item.tipo === 'success' ? 'bg-emerald-500' : item.tipo === 'error' ? 'bg-red-500' : item.tipo === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <span className="font-medium truncate">{item.usuario}</span>
                    <span className="text-muted-foreground truncate">{item.accion}</span>
                    <span className="font-medium truncate">{item.entidad}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{formatRelativeTime(item.fechaEvento)}</span>
                  </div>
                ))}
                {actividadReciente.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── MODAL: Todas las Ordenes ── */}
      <Dialog open={ordenesModalOpen} onOpenChange={setOrdenesModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogTitle className="text-lg font-bold">Todas las Ordenes</DialogTitle>
          <div className="flex-1 overflow-auto mt-2">
            {loadingOrdenes ? (
              <div className="space-y-3 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}</div>
            ) : (
              <DataTable data={todasLasOrdenes} columns={ordenColumns} globalFilter pagination pageSize={15} showRowCount />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniOrdenesTable({ fmt }: { fmt: (n: number) => string }) {
  const [ordenes, setOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get<ApiResponse<OrdenCompraResponse[]>>('/ordenes?max=10&orderBy=fechaCreacion&orderDirection=desc');
        if (res.data.success) setOrdenes(res.data.data ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full rounded" />)}</div>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left font-medium py-1.5">Folio</th>
          <th className="text-left font-medium py-1.5">Proveedor</th>
          <th className="text-right font-medium py-1.5">Monto</th>
          <th className="text-left font-medium py-1.5">Estado</th>
          <th className="text-right font-medium py-1.5">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {ordenes.map((o) => (
          <tr key={o.idOrden} className="border-b border-muted/50">
            <td className="py-1.5 font-medium">{o.folio}</td>
            <td className="py-1.5 truncate max-w-[120px]">{o.razonSocialProveedor ?? '-'}</td>
            <td className="py-1.5 text-right">{fmt(o.total)}</td>
            <td className="py-1.5">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: getEstadoColor(o.estadoNombre ?? '') + '20', color: getEstadoColor(o.estadoNombre ?? '') }}>
                {o.estadoNombre ?? '-'}
              </span>
            </td>
            <td className="py-1.5 text-right text-muted-foreground">{new Date(o.fechaSolicitud).toLocaleDateString('es-MX')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  const m: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    slate: 'bg-slate-50 border-slate-100 text-slate-600',
  };
  return (
    <div className={`flex flex-col items-center p-2 rounded-lg border ${m[color] || m.slate}`}>
      <span className="text-[10px] font-medium opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function KpiCard({ label, value, description, color, icon }: { label: string; value: number; description: string; color: string; icon: React.ReactNode }) {
  const colors: Record<string, { border: string; bg: string }> = {
    blue: { border: 'border-l-blue-500', bg: 'bg-blue-50' },
    orange: { border: 'border-l-orange-500', bg: 'bg-orange-50' },
    pink: { border: 'border-l-pink-500', bg: 'bg-pink-50' },
    emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50' },
    slate: { border: 'border-l-slate-500', bg: 'bg-slate-50' },
    red: { border: 'border-l-red-500', bg: 'bg-red-50' },
    amber: { border: 'border-l-amber-500', bg: 'bg-amber-50' },
    indigo: { border: 'border-l-indigo-500', bg: 'bg-indigo-50' },
  };
  const c = colors[color] || colors.blue;
  return (
    <Card className={`border-l-4 ${c.border} shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <h3 className="text-xl font-bold mt-1">{value}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{description}</p>
          </div>
          <div className={`${c.bg} p-2 rounded-lg shrink-0`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
