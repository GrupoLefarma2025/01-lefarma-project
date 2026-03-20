import { useConfigStore } from '@/store/configStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, Send, MessageSquare, Moon, Sun, Monitor } from 'lucide-react';

const NOTIFICACIONES_CONFIG = [
  { tipo: 'in-app' as const, label: 'Notificaciones en App', icon: Bell, description: 'Muestra notificaciones dentro de la aplicación' },
  { tipo: 'email' as const, label: 'Correo Electrónico', icon: Mail, description: 'Recibe notificaciones por email' },
  { tipo: 'telegram' as const, label: 'Telegram', icon: Send, description: 'Recibe notificaciones vía Telegram bot' },
  { tipo: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, description: 'Recibe notificaciones por WhatsApp' },
];

export function UIConfig() {
  const { ui, setTema, updateNotificacion } = useConfigStore();

  const handleTemaChange = (tema: 'light' | 'dark' | 'system') => {
    setTema(tema);
  };

  const handleNotificacionChange = (tipo: string, checked: boolean) => {
    updateNotificacion(tipo as any, checked);
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

      {/* Configuración de Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>Selecciona cómo deseas recibir notificaciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICACIONES_CONFIG.map((config) => {
            const Icon = config.icon;
            const isEnabled = ui.notificaciones.preferencias.find((p) => p.tipo === config.tipo)?.enabled || false;

            return (
              <div key={config.tipo} className="flex items-start gap-4 p-4 rounded-lg border border-border">
                <div className="shrink-0">
                  <div className={`p-2 rounded-full ${isEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`notif-${config.tipo}`} className="font-medium cursor-pointer">
                    {config.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <Switch
                  id={`notif-${config.tipo}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleNotificacionChange(config.tipo, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
