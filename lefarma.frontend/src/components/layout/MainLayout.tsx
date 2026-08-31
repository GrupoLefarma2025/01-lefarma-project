import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from './Header';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

export interface MainLayoutProps {
  items: SidebarMenuItemConfig[];
  brandTitle: string;
  brandPath: string;
  configPath?: string;
  /** Muestra el contexto de empresa/sucursal/área en el encabezado (CxP=true, RH=false). */
  showContext?: boolean;
}

export const MainLayout = ({ items, brandTitle, brandPath, configPath, showContext }: MainLayoutProps) => {
  const defaultCollapsed = true;

  return (
    <SidebarProvider defaultOpen={!defaultCollapsed} className="h-svh overflow-hidden">
      <AppSidebar items={items} brandTitle={brandTitle} brandPath={brandPath} configPath={configPath} />
      <SidebarInset className="overflow-hidden">
        <Header showContext={showContext} configPath={configPath} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
