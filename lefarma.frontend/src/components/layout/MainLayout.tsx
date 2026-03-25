import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from './Header';
import { useConfigStore } from '@/store/configStore';

export const MainLayout = () => {
  const { ui } = useConfigStore();

  return (
    <SidebarProvider defaultOpen={!ui.componentes.sidebar.defaultCollapsed}>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
