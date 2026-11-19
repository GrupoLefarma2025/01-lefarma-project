import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/apps/sigma/components/app-sidebar";
import { Navbar } from "@/apps/sigma/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import {
  useSigmaAuth,
  useSigmaPermission,
} from "@/apps/sigma/store/sigmaAuth";
import {
  useSidebarBadgeStore,
  SIDEBAR_BADGE_KEYS,
} from "@/apps/sigma/lib/sidebarBadgeStore";
import { UpdateEmailDialog } from "@/apps/sigma/components/update-email-dialog";
import { fetchDashboardData, type DashboardData } from "@/apps/sigma/lib/dashboard";
import { toast } from "sonner";
import { Users, Loader2 } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const { user, isAuthenticated } = useSigmaAuth();
  const hasPermission = useSigmaPermission();
  const hasBandejaPermission = hasPermission("menu.bandeja");
  const setSidebarBadgeCount = useSidebarBadgeStore(
    (state) => state.setBadgeCount
  );
  const userStatsTotals = useMemo(() => {
    if (!dashboardData?.userStats?.length) {
      return null;
    }

    return dashboardData.userStats.reduce(
      (totals, stat) => {
        totals.authorized += stat.authorizedThisMonth;
        totals.pending += stat.pendingThisMonth;
        totals.rejected += stat.rejectedThisMonth;
        return totals;
      },
      { authorized: 0, pending: 0, rejected: 0 }
    );
  }, [dashboardData?.userStats]);

  useEffect(() => {
    setMounted(true);

    // Verificar autenticación
    if (!isAuthenticated) {
      navigate("/SIGMA");
    }
  }, [isAuthenticated, navigate]);

  // Detectar si el usuario no tiene email
  useEffect(() => {
    // Verificar directamente si el usuario tiene correo
    if (mounted && isAuthenticated && user) {
      // Si el correo está vacío o es null/undefined, mostrar el diálogo
      if (!user.correo || user.correo.trim() === "") {
        setShowEmailDialog(true);
      }
    }
  }, [mounted, isAuthenticated, user]);

  // Cargar datos del dashboard
  useEffect(() => {
    if (mounted && isAuthenticated) {
      loadDashboardData();
    }
  }, [mounted, isAuthenticated]);

  const loadDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const data = await fetchDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Error al cargar las estadísticas del dashboard");
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    const pendingCount =
      dashboardData?.statistics?.documentsPendingAuthorization ?? 0;
    setSidebarBadgeCount(SIDEBAR_BADGE_KEYS.bandeja, pendingCount);
  }, [
    dashboardData?.statistics?.documentsPendingAuthorization,
    setSidebarBadgeCount,
  ]);

  // Mostrar loading mientras se monta el componente
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  // Si no está autenticado, no mostrar nada mientras redirige
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Navbar />
          <main className="flex-1 p-6 space-y-6">
            {/* Welcome Section */}
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : dashboardData ? (
              <>
                <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5">
                  <p className="text-sm">
                    <span className="font-semibold">Bienvenido {user?.nombreCompleto || user?.username || "Usuario"}</span>
                    <span className="text-muted-foreground"> - Resumen de actividad</span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span className="text-muted-foreground">Documentos que faltan por autorizar: </span>
                    <span className="font-bold">{dashboardData.statistics.documentsPendingAuthorization}</span>
                  </p>
                </div>

                {/* User Statistics Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Documentos pendientes de firma por usuario</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.userStats.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay datos disponibles para este mes
                      </p>
                    ) : (
                      <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-0.5 shadow-lg">
                        <div className="rounded-lg bg-background overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Usuario</TableHead>
                                {/* <TableHead className="text-right">
                                  Documentos Autorizados
                                </TableHead> */}
                                <TableHead className="text-right bg-primary/50 text-primary-foreground">
                                  Por firmar
                                </TableHead>
                                {/* <TableHead className="text-right">
                                  Documentos Rechazados
                                </TableHead> */}
                              </TableRow>
                            </TableHeader>
                          <TableBody>
                            {dashboardData.userStats.map((userStat, index) => (
                              <TableRow
                                key={index}
                                className={hasBandejaPermission ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                                onClick={() => {
                                  if (hasBandejaPermission) {
                                    navigate("/SIGMA/documentos/bandeja-firmas");
                                  }
                                }}
                              >
                                <TableCell className="font-medium">
                                  {userStat.userName}
                                </TableCell>
                                {/* <TableCell className="text-right">
                                  {userStat.authorizedThisMonth}
                                </TableCell> */}
                                <TableCell className="text-right bg-primary/50 text-primary-foreground">
                                  {userStat.pendingThisMonth}
                                </TableCell>
                                {/* <TableCell className="text-right">
                                  {userStat.rejectedThisMonth}
                                </TableCell> */}
                              </TableRow>
                            ))}
                          </TableBody>
                          {userStatsTotals && (
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-semibold bg-sidebar-primary/50 text-primary-foreground">
                                  Total
                                </TableCell>
                                {/* <TableCell className="text-right font-semibold">
                                  {userStatsTotals.authorized}
                                </TableCell> */}
                                <TableCell className="text-right font-semibold bg-sidebar-primary/50 text-primary-foreground">
                                  {userStatsTotals.pending}
                                </TableCell>
                                {/* <TableCell className="text-right font-semibold">
                                  {userStatsTotals.rejected}
                                </TableCell> */}
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activity Series Chart */}
                {/* <Card className="overflow-hidden">
                  <CardHeader className="border-b py-5">
                    <div className="space-y-1">
                      <CardTitle>Actividad de documentos</CardTitle>
                      <CardDescription>
                        Evolución de subidos, autorizados y rechazados en los últimos 7 días
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-6 pt-4 sm:px-6 sm:pt-6">
                    {filteredSeries.length > 0 ? (
                      <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[300px] w-full"
                      >
                        <AreaChart data={filteredSeries}>
                          <defs>
                            <linearGradient id="fillUploaded" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="var(--color-uploaded)"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-uploaded)"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                            <linearGradient id="fillAuthorized" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="var(--color-authorized)"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-authorized)"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                            <linearGradient id="fillRejected" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="var(--color-rejected)"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--color-rejected)"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={28}
                            tickFormatter={(value: string) =>
                              formatSeriesTick(value)
                            }
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                labelFormatter={(value) =>
                                  formatSeriesLabel(value)
                                }
                              />
                            }
                          />
                          <Area
                            dataKey="uploaded"
                            type="monotone"
                            fill="url(#fillUploaded)"
                            stroke="var(--color-uploaded)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Area
                            dataKey="authorized"
                            type="monotone"
                            fill="url(#fillAuthorized)"
                            stroke="var(--color-authorized)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Area
                            dataKey="rejected"
                            type="monotone"
                            fill="url(#fillRejected)"
                            stroke="var(--color-rejected)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        No hay actividad registrada en los últimos 7 días.
                      </div>
                    )}
                  </CardContent>
                </Card> */}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground text-center">
                    No se pudo cargar el dashboard
                  </p>
                </CardContent>
              </Card>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Diálogo para actualizar email */}
      <UpdateEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
      />
    </>
  );
}
