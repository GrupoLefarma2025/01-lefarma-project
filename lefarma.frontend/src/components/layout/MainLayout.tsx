import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from './Header';
// import { useConfigStore } from '@/store/configStore';


export const MainLayout = () => {
  // const { ui } = useConfigStore();

  const defaultCollapsed = true;
  // const defaultCollapsed = ui.componentes?.sidebar?.defaultCollapsed ?? false;

  return (
    <SidebarProvider defaultOpen={!defaultCollapsed} className="h-svh overflow-hidden">
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
