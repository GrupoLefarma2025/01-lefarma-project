import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { User, Palette, Server, type LucideIcon } from 'lucide-react';
import { UIConfig } from './UIConfig';
import { PerfilConfig } from './PerfilConfig';
import { SistemaConfig } from './SistemaConfig';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { PermissionElement } from '@/components/permissions/PermissionElement';


interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
  permission?: string[];
}

const tabs: TabItem[] = [
  {
    value: 'perfil',
    label: 'Mi Perfil',
    icon: User,
    description: 'Actualiza tu información personal y configura tus preferencias de notificación',
    permission: [],
  },
  {
    value: 'ui',
    label: 'Interfaz',
    icon: Palette,
    description: 'Personaliza el tema visual de la aplicación',
    permission: ['configuracion.ver_ui'],
  },
  {
    value: 'sistema',
    label: 'Sistema',
    icon: Server,
    description: 'Información técnica y variables de entorno globales',
    permission: ['configuracion.ver_sistema'],
  },
];

export default function ConfiguracionGeneral() {
  usePageTitle('Configuración', 'Personaliza tu experiencia y configura el sistema');
  const [activeTab, setActiveTab] = useState('perfil');

  const activeItem = tabs.find((t) => t.value === activeTab)!;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <Card className="h-fit">
        <CardContent className="p-2">
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <PermissionElement
                  key={tab.value}
                  require={tab.permission}
                >
                  <button
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                </PermissionElement>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          <div>
            {activeTab === 'perfil' && <PerfilConfig />}
            {activeTab === 'ui' && <UIConfig />}
            {activeTab === 'sistema' && <SistemaConfig />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
