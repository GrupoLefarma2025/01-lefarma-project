import type { ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Key,
  Settings,
  Building2,
  User,
  ChevronRight,
  Component
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: ElementType;
  path: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: 'Principal',
    items: [
      {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/',
      },
      {
        title: 'Roles',
        icon: Shield,
        path: '/roles',
      },
      {
        title: 'Permisos',
        icon: Key,
        path: '/permisos',
      },
      {
        title: 'Catalogos',
        icon: Component,
        path: '/catalogos',
      },
      {
        title: 'Perfil',
        icon: User,
        path: '/perfil',
      },
      {
        title: 'Configuración',
        icon: Settings,
        path: '/configuracion',
      },
    ],
  },
  {
    title: 'Pantallas Demo',
    items: [
      {
        title: 'Componentes UI',
        icon: Component,
        path: '/demo-components',
      },
    ],
  },
];

export const Sidebar = () => {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border lg:block hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 h-16 px-6 border-b border-border">
        <div className="bg-primary p-2 rounded-lg">
          <Building2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-primary">LeFarma</h1>
          <p className="text-xs text-primary">v1.0.0</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6">
        {menuGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{item.title}</span>
                        {isActive && <ChevronRight className="h-4 w-4" />}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};
