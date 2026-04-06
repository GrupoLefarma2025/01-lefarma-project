/**
 * Componente NotificationBell
 * Campana de notificaciones con badge de conteo
 * Se integra en el Header de la aplicación
 */


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
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
      return 'bg-slate-400';
    default:
      return 'bg-emerald-500';
  }
}

/**
 * Componente principal NotificationBell
 */
export function NotificationBell({ onError }: NotificationBellProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { isConnected } = useNotifications({
    autoConnect: true,
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
   * Carga inicial de notificaciones cuando el usuario se autentica
   */
  useEffect(() => {
    if (user?.id && notifications.length === 0) {
      loadNotifications(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * Carga notificaciones al abrir el dropdown
   */
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length === 0 && user?.id) {
      loadNotifications(user.id);
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
              notifications.slice(0, 5).map((userNotification) => {
                // Backend devuelve los datos directamente en userNotification,
                // no anidados en userNotification.notification
                const title = userNotification.title ||
                              userNotification.notification?.title ||
                              'Sin título';
                const message = userNotification.message ||
                                 userNotification.notification?.message ||
                                 'Sin mensaje';
                const type = userNotification.type ||
                            userNotification.notification?.type ||
                            'info';
                const priority = userNotification.priority ||
                               userNotification.notification?.priority ||
                               'normal';

                const timeAgo = formatDistanceToNow(new Date(userNotification.createdAt), {
                  addSuffix: true,
                  locale: es,
                });

                return (
                  <DropdownMenuItem
                    key={userNotification.id}
                    className={`flex flex-col items-start p-3 cursor-pointer group hover:bg-primary [&:hover]:text-white [&:hover_.text-muted-foreground]:text-blue-100 ${
                      !userNotification.isRead ? 'bg-sky-50 dark:bg-sky-950/40' : ''
                    }`}
                    onClick={() => handleNotificationClick(userNotification.id)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <span className="text-lg">{getNotificationIcon(type as NotificationType)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium truncate">
                            {title}
                          </p>
                          {!userNotification.isRead && (
                            <span
                              className={`h-2 w-2 rounded-full ${getPriorityColor(priority as NotificationPriority)}`}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {message}
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
            {notifications.length > 5 && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate('/notificaciones')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver todas las notificaciones
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
