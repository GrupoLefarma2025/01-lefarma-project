/**
 * Componente NotificationBell
 * Campana de notificaciones con badge de conteo
 * Se integra en el Header de la aplicación
 */

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationStore } from '@/store/notificationStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationList } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotificationType, NotificationPriority } from '@/types/notification.types';

interface NotificationBellProps {
  onError?: (error: Error) => void;
}

/**
 * Retorna el icono según el tipo de notificación
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'alert':
      return '🚨';
    default:
      return 'ℹ️';
  }
}

/**
 * Retorna el color según la prioridad
 */
function getPriorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Componente principal NotificationBell
 */
export function NotificationBell({ onError }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { isConnected } = useNotifications({
    autoConnect: true,
    onConnectionChange: (isConnected) => {
      console.log('[NotificationBell] SSE connection:', isConnected ? 'connected' : 'disconnected');
    },
  });

  const {
    notifications,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationList();

  /**
   * Maneja el click en una notificación
   */
  const handleNotificationClick = async (notificationId: number) => {
    try {
      await markAsRead(notificationId);
      // Aquí podrías navegar a una página específica relacionada con la notificación
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
   * Carga notificaciones al abrir el dropdown
   */
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length === 0) {
      loadNotifications();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {!isConnected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-red-500 border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {unreadCount} sin leer
            </span>
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={isConnected ? 'Conectado' : 'Desconectado'}
            />
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <ScrollArea className="h-96">
          <DropdownMenuGroup>
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((userNotification) => {
                const notification = userNotification.notification;
                if (!notification) return null;

                const timeAgo = formatDistanceToNow(new Date(userNotification.createdAt), {
                  addSuffix: true,
                  locale: es,
                });

                return (
                  <DropdownMenuItem
                    key={userNotification.id}
                    className={`flex flex-col items-start p-3 cursor-pointer ${
                      !userNotification.isRead ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleNotificationClick(userNotification.id)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {!userNotification.isRead && (
                            <span
                              className={`h-2 w-2 rounded-full ${getPriorityColor(
                                notification.priority
                              )}`}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {timeAgo}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuGroup>
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleMarkAllAsRead}
            >
              Marcar todas como leídas
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
