import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { Header } from './Header';
import { useConfigStore } from '@/store/configStore';
import { useEffect } from 'react';

function SidebarStateBridge() {
  const { open, setOpen } = useSidebar();
  const { ui, sidebarCollapsed, setSidebarCollapsed } = useConfigStore();
  const defaultCollapsed = ui.componentes?.sidebar?.defaultCollapsed ?? false;

  useEffect(() => {
    const target = sidebarCollapsed ?? defaultCollapsed;
    if (open !== !target) {
      setOpen(!target);
    }
  }, [sidebarCollapsed, defaultCollapsed, open, setOpen]);

  return null;
}

export const MainLayout = () => {
  const { ui, sidebarCollapsed, setSidebarCollapsed } = useConfigStore();
  const defaultCollapsed = ui.componentes?.sidebar?.defaultCollapsed ?? false;
  const isCollapsed = sidebarCollapsed ?? defaultCollapsed;

  return (
    <SidebarProvider
      defaultOpen={!isCollapsed}
      onOpenChange={(open) => {
        setSidebarCollapsed(!open);
      }}
      className="h-svh overflow-hidden"
    >
      <SidebarStateBridge />
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
