import { useConfigStore } from '@/store/configStore';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Mail, Phone, Bell, Send, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { usePageStore } from '@/store/pageStore';

const NOTIFICACIONES_CONFIG = [
  {
    tipo: 'in-app' as const,
    label: 'Notificaciones en App',
    icon: Bell,
    description: 'Muestra notificaciones dentro de la aplicación',
  },
  {
    tipo: 'email' as const,
    label: 'Correo Electrónico',
    icon: Mail,
    description: 'Recibe notificaciones por email',
  },
  {
    tipo: 'telegram' as const,
    label: 'Telegram',
    icon: Send,
    description: 'Recibe notificaciones vía Telegram bot',
  },
  {
    tipo: 'whatsapp' as const,
    label: 'WhatsApp',
    icon: MessageSquare,
    description: 'Recibe notificaciones por WhatsApp',
  },
];

export function PerfilConfig() {
  const { perfil, ui, updatePerfil, setNotificacionPreferida, updateNotificacion } = useConfigStore();
  const { user } = useAuthStore();
  const { setTitle } = usePageStore();

  const [editMode, setEditMode] = useState(false);
  const [tempPerfil, setTempPerfil] = useState(perfil);

  const handleSave = () => {
    updatePerfil(tempPerfil);
    setEditMode(false);
    setTitle('Perfil actualizado');
    setTimeout(() => setTitle(''), 3000);
  };

  const handleCancel = () => {
    setTempPerfil(perfil);
    setEditMode(false);
  };

  const handleNotificacionChange = (tipo: string, checked: boolean) => {
    updateNotificacion(tipo as any, checked);
  };

  return (
    <div className="space-y-6">
      {/* Información del Usuario */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Información del Perfil</CardTitle>
              <CardDescription>Tu información personal y preferencias</CardDescription>
            </div>
            {!editMode && (
              <Button variant="outline" onClick={() => setEditMode(true)}>
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nombre de Usuario (Read-only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Usuario
            </Label>
            <Input value={user?.username || ''} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">El nombre de usuario no se puede cambiar</p>
          </div>

          {/* Nombre (Editable) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nombre Completo
            </Label>
            <Input
              value={editMode ? tempPerfil.nombre : perfil.nombre || user?.nombre || ''}
              onChange={(e) => setTempPerfil({ ...tempPerfil, nombre: e.target.value })}
              disabled={!editMode}
              placeholder="Tu nombre completo"
            />
          </div>

          {/* Correo (Editable) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Correo Electrónico
            </Label>
            <Input
              type="email"
              value={editMode ? tempPerfil.correo : perfil.correo || user?.correo || ''}
              onChange={(e) => setTempPerfil({ ...tempPerfil, correo: e.target.value })}
              disabled={!editMode}
              placeholder="tu.correo@ejemplo.com"
            />
          </div>

          {/* Teléfono (Editable) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Teléfono (Opcional)
            </Label>
            <Input
              type="tel"
              value={editMode ? tempPerfil.telefono || '' : perfil.telefono || ''}
              onChange={(e) => setTempPerfil({ ...tempPerfil, telefono: e.target.value })}
              disabled={!editMode}
              placeholder="+504 1234-5678"
            />
          </div>

          {/* Botones de acción en modo edición */}
          {editMode && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                Guardar Cambios
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración de Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
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
                  <Label htmlFor={`perfil-notif-${config.tipo}`} className="font-medium cursor-pointer">
                    {config.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <Switch
                  id={`perfil-notif-${config.tipo}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleNotificacionChange(config.tipo, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preferencias de Notificación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Canal de Notificación Preferido
          </CardTitle>
          <CardDescription>Selecciona tu método preferido para recibir notificaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={perfil.notificacionPreferida}
            onValueChange={(value) => setNotificacionPreferida(value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el canal preferido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in-app">Notificaciones en App</SelectItem>
              <SelectItem value="email">Correo Electrónico</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2">
            Las notificaciones importantes se enviarán prioritariamente por este canal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
