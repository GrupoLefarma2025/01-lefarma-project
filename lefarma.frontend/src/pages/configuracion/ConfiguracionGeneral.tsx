import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Palette, User, Server } from 'lucide-react';
import { UIConfig } from './UIConfig';
import { PerfilConfig } from './PerfilConfig';
import { SistemaConfig } from './SistemaConfig';

export default function ConfiguracionGeneral() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Personaliza tu experiencia y configura el sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ui" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="ui" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Interfaz</span>
          </TabsTrigger>
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Mi Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="sistema" className="gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
        </TabsList>

        {/* UI Tab */}
        <TabsContent value="ui" className="space-y-6">
          <div className="border-l-4 border-primary pl-4 py-2">
            <h2 className="text-xl font-semibold">Apariencia</h2>
            <p className="text-muted-foreground text-sm">
              Personaliza el tema visual de la aplicación
            </p>
          </div>
          <UIConfig />
        </TabsContent>

        {/* Perfil Tab */}
        <TabsContent value="perfil" className="space-y-6">
          <div className="border-l-4 border-primary pl-4 py-2">
            <h2 className="text-xl font-semibold">Mi Perfil</h2>
            <p className="text-muted-foreground text-sm">
              Actualiza tu información personal y configura tus preferencias de notificación
            </p>
          </div>
          <PerfilConfig />
        </TabsContent>

        {/* Sistema Tab */}
        <TabsContent value="sistema" className="space-y-6">
          <div className="border-l-4 border-primary pl-4 py-2">
            <h2 className="text-xl font-semibold">Configuración del Sistema</h2>
            <p className="text-muted-foreground text-sm">
              Información técnica y variables de entorno globales
            </p>
          </div>
          <SistemaConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
