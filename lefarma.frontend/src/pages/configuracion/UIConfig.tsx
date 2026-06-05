import { useConfigStore } from '@/store/configStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun, Monitor, PanelLeftClose, PanelLeft } from 'lucide-react';
import { PresetSelector } from '@/components/config/PresetSelector';
import { AdvancedConfigUI } from '@/components/config/AdvancedConfigUI';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function UIConfig() {
  const { ui, setTema, setSidebarCollapsed } = useConfigStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTemaChange = (tema: 'light' | 'dark' | 'system') => {
    setTema(tema);
  };

  const getTemaIcon = (tema: 'light' | 'dark' | 'system') => {
    switch (tema) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuración de Tema */}
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Personaliza el tema visual de la aplicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {(['light', 'dark', 'system'] as const).map((tema) => (
              <button
                key={tema}
                onClick={() => handleTemaChange(tema)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  ui.tema === tema
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
              >
                {getTemaIcon(tema)}
                <span className="text-sm font-medium capitalize">
                  {tema === 'system' ? 'Sistema' : tema === 'light' ? 'Claro' : 'Oscuro'}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {ui.tema === 'system'
              ? 'La aplicación usará el tema de tu sistema operativo'
              : `Tema ${ui.tema === 'light' ? 'claro' : 'oscuro'} seleccionado`}
          </p>
        </CardContent>
      </Card>

      {/* Configuración de Sidebar */}
      <Card>
        <CardHeader>
          <CardTitle>Barra Lateral</CardTitle>
          <CardDescription>Controla el estado del menú lateral</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => setSidebarCollapsed(!ui.sidebarCollapsed)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg]:size-4 [&amp;_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 w-7"
          >
            {ui.sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="text-sm">
              {ui.sidebarCollapsed ? 'Contraído' : 'Expandido'}
            </span>
          </button>
        </CardContent>
      </Card>

      {/* Configuración de Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Preconfiguración de Interfaz</CardTitle>
          <CardDescription>
            Selecciona un estilo predefinido o personaliza avanzado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PresetSelector />

          {/* Toggle Configuración Avanzada */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? 'Ocultar' : 'Mostrar'} Configuración Avanzada
            </Button>
          </div>

          {/* Configuración Avanzada */}
          {showAdvanced && <AdvancedConfigUI />}
        </CardContent>
      </Card>
    </div>
  );
}
