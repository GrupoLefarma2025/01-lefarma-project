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

    if (!isAuthenticated) {
      navigate("/SIGMA");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (mounted && isAuthenticated && user) {
      if (!user.correo || user.correo.trim() === "") {
        setShowEmailDialog(true);
      }
    }
  }, [mounted, isAuthenticated, user]);

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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

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
            {}
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

                {}
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
                                {}
                                <TableHead className="text-right bg-primary/50 text-primary-foreground">
                                  Por firmar
                                </TableHead>
                                {}
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
                                {}
                                <TableCell className="text-right bg-primary/50 text-primary-foreground">
                                  {userStat.pendingThisMonth}
                                </TableCell>
                                {}
                              </TableRow>
                            ))}
                          </TableBody>
                          {userStatsTotals && (
                            <TableFooter>
                              <TableRow>
                                <TableCell className="font-semibold bg-sidebar-primary/50 text-primary-foreground">
                                  Total
                                </TableCell>
                                {}
                                <TableCell className="text-right font-semibold bg-sidebar-primary/50 text-primary-foreground">
                                  {userStatsTotals.pending}
                                </TableCell>
                                {}
                              </TableRow>
                            </TableFooter>
                          )}
                        </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {}
                {}
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

      {}
      <UpdateEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
      />
    </>
  );
}
