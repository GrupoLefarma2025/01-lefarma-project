/**
 * Zustand Store para el manejo de notificaciones
 * Maneja el estado de notificaciones del usuario y la conexión SSE
 */


import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  NotificationUiState,
  UserNotification,
  NotificationFilter,
  SendNotificationRequest,
} from '@/types/notification.types';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/shared/auth/authStore';

interface NotificationState extends NotificationUiState {
  // Acciones
  setNotifications: (notifications: UserNotification[]) => void;
  addNotification: (notification: UserNotification) => void;
  removeNotification: (notificationId: number) => void;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadNotifications: (userId?: number, filter?: NotificationFilter) => Promise<void>;
  setConnected: (isConnected: boolean) => void;
  setError: (error: string | undefined) => void;
  clearError: () => void;
  sendNotification: (request: SendNotificationRequest) => Promise<void>;
  refreshUnreadCount: (userId: number) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      isLoading: false,
      error: undefined,

      // Establecer notificaciones (reemplaza todas)
      setNotifications: (notifications) => {
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        set({ notifications, unreadCount });
      },

      // Agregar una notificación individual
      addNotification: (notification) => {
        const { notifications, unreadCount } = get();

        // Buscar si ya existe una notificación con el mismo ID
        const existingIndex = notifications.findIndex((n) => n.id === notification.id);

        if (existingIndex >= 0) {
          // La notificación ya existe - actualizarla si cambió
          const existingNotification = notifications[existingIndex];

          // Si cambió de leída a no leída, sumar al contador
          if (existingNotification.isRead && !notification.isRead) {
            const newNotifications = [...notifications];
            newNotifications[existingIndex] = notification;
            const newUnreadCount = unreadCount + 1;

            set({
              notifications: newNotifications,
              unreadCount: newUnreadCount,
            });

            // Mostrar notificación nativa
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(notification.notification?.title || 'Nueva Notificación', {
                body: notification.notification?.message,
                icon: '/favicon.ico',
                tag: notification.id.toString(),
              });
            }
          } else {
            // Ya existe con el mismo estado, no hacer nada
            if (import.meta.env.DEV) {
              console.debug('[notificationStore] Notification already exists with same state, no update needed');
            }
          }
        } else {
          // Nueva notificación - agregarla al inicio
          const newNotifications = [notification, ...notifications];
          const newUnreadCount = notification.isRead ? unreadCount : unreadCount + 1;

          if (import.meta.env.DEV) {
            console.debug('[notificationStore] Adding NEW notification via SSE:', {
              newCount: newNotifications.length,
              newUnread: newUnreadCount,
            });
          }

          set({
            notifications: newNotifications,
            unreadCount: newUnreadCount,
          });

          // Mostrar notificación nativa del navegador
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.notification?.title || 'Nueva Notificación', {
              body: notification.notification?.message,
              icon: '/favicon.ico',
              tag: notification.id.toString(),
            });
          }
        }
      },

      // Remover una notificación
      removeNotification: (notificationId) => {
        const { notifications } = get();
        const newNotifications = notifications.filter((n) => n.id !== notificationId);
        const unreadCount = newNotifications.filter((n) => !n.isRead).length;
        set({ notifications: newNotifications, unreadCount });
      },

      // Marcar notificación como leída
      markAsRead: async (notificationId) => {
        const { notifications } = get();
        const notification = notifications.find((n) => n.id === notificationId);

        if (notification && !notification.isRead) {
          // Usar userId del authStore en lugar de notification.userId (que viene undefined del backend)
          const { user } = useAuthStore.getState();
          const userId = user?.id;

          if (!userId) {
            console.error('[notificationStore] No userId found in authStore');
            set({ error: 'No hay usuario autenticado' });
            return;
          }

          // Update optimista
          set({
            notifications: notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, get().unreadCount - 1),
          });

          try {
            await notificationService.markAsRead(notificationId, userId);
          } catch (error) {
            console.error('[notificationStore] Error marking notification as read:', error);
            // Revertir en caso de error
            set({
              notifications: notifications.map((n) =>
                n.id === notificationId ? { ...n, isRead: false, readAt: undefined } : n
              ),
              unreadCount: get().unreadCount + 1,
            });
            set({ error: 'Error al marcar notificación como leída' });
          }
        }
      },

      // Marcar todas las notificaciones como leídas
      markAllAsRead: async () => {
        const { notifications, unreadCount } = get();
        const { user } = useAuthStore.getState();
        const userId = user?.id;

        if (!userId) {
          set({ error: 'No hay usuario autenticado' });
          return;
        }

        // Update optimista
        const updatedNotifications = notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        }));

        set({ notifications: updatedNotifications, unreadCount: 0 });

        try {
          await notificationService.markAllAsRead(userId);
        } catch (error) {
          // Revertir en caso de error
          set({ notifications, unreadCount });
          set({ error: 'Error al marcar todas las notificaciones como leídas' });
          console.error('Error marking all as read:', error);
        }
      },

      // Cargar notificaciones del servidor
      loadNotifications: async (userId, filter) => {
        set({ isLoading: true, error: undefined });
        try {
          const { user } = useAuthStore.getState();
          const targetUserId = userId ?? user?.id ?? 0;

          if (!targetUserId) {
            set({ notifications: [], unreadCount: 0, isLoading: false });
            return;
          }

          const notifications = await notificationService.getUserNotifications(targetUserId, filter);
          // Defensivo: asegurar que notifications siempre sea un arreglo
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          const unreadCount = safeNotifications.filter((n) => !n.isRead).length;
          set({ notifications: safeNotifications, unreadCount, isLoading: false });
        } catch (error) {
          console.error('[notificationStore] Error loading notifications:', error);
          set({
            error: 'Error al cargar notificaciones',
            isLoading: false,
            notifications: [], // Asegurar que notifications siempre sea un arreglo
          });
        }
      },

      // Establecer estado de conexión SSE
      setConnected: (isConnected) => {
        set({ isConnected });
      },

      // Establecer mensaje de error
      setError: (error) => {
        set({ error });
      },

      // Limpiar mensaje de error
      clearError: () => {
        set({ error: undefined });
      },

      // Enviar una notificación
      sendNotification: async (request) => {
        set({ isLoading: true, error: undefined });
        try {
          await notificationService.sendNotification(request);
          set({ isLoading: false });
        } catch (error) {
          set({ error: 'Error al enviar notificación', isLoading: false });
          console.error('Error sending notification:', error);
          throw error;
        }
      },

      // Refrescar conteo de no leídas
      refreshUnreadCount: async (userId) => {
        const { user } = useAuthStore.getState();
        const effectiveUserId = userId ?? user?.id;

        if (!effectiveUserId) {
          set({ unreadCount: 0 });
          return;
        }

        try {
          const count = await notificationService.getUnreadCount(effectiveUserId);
          set({ unreadCount: count });
        } catch (error) {
          console.error('Error refreshing unread count:', error);
        }
      },
    }),
    { name: 'notification-store' }
  )
);

// Selectores para optimizar renderizados
export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectIsConnected = (state: NotificationState) => state.isConnected;
export const selectIsLoading = (state: NotificationState) => state.isLoading;
export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.isRead);
