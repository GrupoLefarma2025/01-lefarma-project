/**
 * Componente NotificationList
 * Lista completa de notificaciones con filtros y acciones
 * Se puede usar en una página dedicada de notificaciones
 */

import { useState, useEffect } from 'react';
import { Bell, Check, CheckCircle2, Filter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationList } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/store/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotificationType, NotificationCategory, NotificationPriority, UserNotification } from '@/types/notification.types';

interface NotificationListProps {
  userId?: number;
  onNotificationClick?: (notification: UserNotification) => void;
}

/**
 * Retorna el icono según el tipo de notificación
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <span className="text-lg">❌</span>;
    case 'warning':
      return <span className="text-lg">⚠️</span>;
    case 'alert':
      return <span className="text-lg">🚨</span>;
    default:
      return <Bell className="h-5 w-5 text-blue-500" />;
  }
}

/**
 * Retorna el badge de prioridad
 */
function PriorityBadge({ priority }: { priority: NotificationPriority }) {
  const variants: Record<NotificationPriority, string> = {
    urgent: 'destructive',
    high: 'secondary',
    normal: 'outline',
    low: 'outline',
  };

  const labels: Record<NotificationPriority, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    normal: 'Normal',
    low: 'Baja',
  };

  return (
    <Badge variant={variants[priority] as any} className="text-xs">
      {labels[priority]}
    </Badge>
  );
}

/**
 * Componente principal NotificationList
 */
export function NotificationList({ userId, onNotificationClick }: NotificationListProps) {
  const [filter, setFilter] = useState<{
    unreadOnly: boolean;
    type?: NotificationType;
    category?: NotificationCategory;
    priority?: NotificationPriority;
  }>({
    unreadOnly: false,
  });

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationList();

  // Cargar notificaciones al montar
  useEffect(() => {
    loadNotifications(userId, filter);
  }, [userId, filter]);

  /**
   * Aplica los filtros seleccionados
   */
  const applyFilter = (key: string, value: any) => {
    setFilter((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * Marca una notificación como leída
   */
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  /**
   * Marca todas como leídas
   */
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  /**
   * Maneja el click en una notificación
   */
  const handleNotificationClick = (notification: UserNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  };

  return (
    <div className="space-y-4">
      {/* Header con contadores y filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notificaciones</CardTitle>
              <CardDescription>
                {unreadCount} sin leer de {notifications.length} totales
              </CardDescription>
            </div>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} variant="outline" size="sm">
                <Check className="h-4 w-4 mr-2" />
                Marcar todas como leídas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Filtro: Solo no leídas */}
            <div className="flex items-center space-x-2">
              <Switch
                id="unreadOnly"
                checked={filter.unreadOnly}
                onCheckedChange={(checked) => applyFilter('unreadOnly', checked)}
              />
              <Label htmlFor="unreadOnly" className="cursor-pointer">
                Solo no leídas
              </Label>
            </div>

            {/* Filtro: Tipo */}
            <Select
              value={filter.type || 'all'}
              onValueChange={(value) =>
                applyFilter('type', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="success">Éxito</SelectItem>
                <SelectItem value="alert">Alerta</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro: Categoría */}
            <Select
              value={filter.category || 'all'}
              onValueChange={(value) =>
                applyFilter('category', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="orders">Órdenes</SelectItem>
                <SelectItem value="payments">Pagos</SelectItem>
                <SelectItem value="catalogs">Catálogos</SelectItem>
                <SelectItem value="security">Seguridad</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro: Prioridad */}
            <Select
              value={filter.priority || 'all'}
              onValueChange={(value) =>
                applyFilter('priority', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>

            {/* Recargar */}
            <Button
              onClick={() => loadNotifications(userId, filter)}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <Filter className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de notificaciones */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Cargando notificaciones...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tienes notificaciones</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-2 pr-4">
            {notifications.map((userNotification) => {
              const notification = userNotification.notification;
              if (!notification) return null;

              const timeAgo = formatDistanceToNow(new Date(userNotification.createdAt), {
                addSuffix: true,
                locale: es,
              });

              return (
                <Card
                  key={userNotification.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${
                    !userNotification.isRead ? 'border-l-4 border-l-primary' : ''
                  }`}
                  onClick={() => handleNotificationClick(userNotification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icono */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          {!userNotification.isRead && (
                            <Badge variant="default" className="flex-shrink-0">
                              Nueva
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap">
                          <PriorityBadge priority={notification.priority} />
                          <span className="text-xs text-muted-foreground">
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
