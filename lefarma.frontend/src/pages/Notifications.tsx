/**
 * Página de Notificaciones
 * Muestra todas las notificaciones del usuario con filtros
 * Incluye formulario de prueba para enviar notificaciones
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { NotificationList } from '@/components/notifications/NotificationList';
import { RecipientSelector } from '@/components/notifications/RecipientSelector';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import type { NotificationType, NotificationPriority, NotificationCategory, NotificationChannelType } from '@/types/notification.types';

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [testForm, setTestForm] = useState({
    title: 'Notificación de Prueba',
    message: 'Esta es una notificación de prueba del sistema Lefarma.',
    type: 'info' as NotificationType,
    priority: 'normal' as NotificationPriority,
    category: 'system' as NotificationCategory,
    channels: ['in-app'] as NotificationChannelType[],
  });
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  /**
   * Envía una notificación de prueba
   */
  const handleSendTest = async () => {
    // Validar que haya destinatarios seleccionados
    if (selectedUserIds.length === 0 && selectedRoleNames.length === 0) {
      toast.error('Selecciona al menos un usuario o rol');
      return;
    }

    setIsSending(true);
    try {
      await notificationService.sendNotification({
        title: testForm.title,
        message: testForm.message,
        type: testForm.type,
        priority: testForm.priority,
        category: testForm.category,
        channels: testForm.channels.map((channelType) => ({
          channelType,
          userIds: selectedUserIds,
          roleNames: selectedRoleNames,
        })),
      });

      toast.success('Notificación enviada correctamente');
      // Limpiar selección después de enviar
      setSelectedUserIds([]);
      setSelectedRoleNames([]);
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Error al enviar notificación');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Alterna un canal en el formulario
   */
  const toggleChannel = (channel: NotificationChannelType) => {
    setTestForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
        <p className="text-muted-foreground">
          Gestiona y visualiza todas tus notificaciones
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de prueba */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Enviar Notificación de Prueba</CardTitle>
            <CardDescription>
              Prueba el sistema de notificaciones enviando un mensaje
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={testForm.title}
                onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                placeholder="Título de la notificación"
              />
            </div>

            {/* Mensaje */}
            <div className="space-y-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                placeholder="Contenido de la notificación"
                rows={3}
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={testForm.type}
                onValueChange={(value) => setTestForm({ ...testForm, type: value as NotificationType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Advertencia</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Éxito</SelectItem>
                  <SelectItem value="alert">Alerta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={testForm.priority}
                onValueChange={(value) => setTestForm({ ...testForm, priority: value as NotificationPriority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={testForm.category}
                onValueChange={(value) => setTestForm({ ...testForm, category: value as NotificationCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="orders">Órdenes</SelectItem>
                  <SelectItem value="payments">Pagos</SelectItem>
                  <SelectItem value="catalogs">Catálogos</SelectItem>
                  <SelectItem value="security">Seguridad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canales */}
            <div className="space-y-2">
              <Label>Canales</Label>
              <div className="flex flex-wrap gap-2">
                {(['email', 'telegram', 'in-app'] as NotificationChannelType[]).map((channel) => (
                  <div key={channel} className="flex items-center space-x-2">
                    <Switch
                      id={channel}
                      checked={testForm.channels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    <Label htmlFor={channel} className="capitalize cursor-pointer">
                      {channel}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Destinatarios */}
            <div className="space-y-2">
              <Label>Destinatarios</Label>
              <RecipientSelector
                selectedUserIds={selectedUserIds}
                selectedRoleNames={selectedRoleNames}
                onUserIdsChange={setSelectedUserIds}
                onRoleNamesChange={setSelectedRoleNames}
                disabled={isSending}
              />
            </div>

            {/* Enviar */}
            <Button
              onClick={handleSendTest}
              disabled={isSending || testForm.channels.length === 0}
              className="w-full"
            >
              {isSending ? 'Enviando...' : 'Enviar Notificación'}
            </Button>

            {/* Estado de canales */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Estado de Canales</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">In-App</span>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email</span>
                  <Badge variant="outline" className="text-green-500 border-green-500">
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Telegram</span>
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                    Configurar
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de notificaciones */}
        <div className="lg:col-span-2">
          <NotificationList userId={user?.id} />
        </div>
      </div>
    </div>
  );
}
