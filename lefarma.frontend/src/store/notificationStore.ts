/**
 * Zustand Store para el manejo de notificaciones
 * Maneja el estado de notificaciones del usuario y la conexión SSE
 */


import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  NotificationUiState,
  UserNotification,
  NotificationFilter,
  NotificationChannelType,
  SendNotificationRequest,
} from '@/types/notification.types';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from './authStore';

interface NotificationState extends NotificationUiState {
  // Actions
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
      // Initial state
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      isLoading: false,
      error: undefined,

      // Set notifications (replaces all)
      setNotifications: (notifications) => {
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        set({ notifications, unreadCount });
      },

      // Add a single notification
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

      // Remove a notification
      removeNotification: (notificationId) => {
        const { notifications } = get();
        const newNotifications = notifications.filter((n) => n.id !== notificationId);
        const unreadCount = newNotifications.filter((n) => !n.isRead).length;
        set({ notifications: newNotifications, unreadCount });
      },

      // Mark notification as read
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

          // Optimistic update
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
            // Revert on error
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

      // Mark all notifications as read
      markAllAsRead: async () => {
        const { notifications, unreadCount } = get();
        const { user } = useAuthStore.getState();
        const userId = user?.id;

        if (!userId) {
          set({ error: 'No hay usuario autenticado' });
          return;
        }

        // Optimistic update
        const updatedNotifications = notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        }));

        set({ notifications: updatedNotifications, unreadCount: 0 });

        try {
          await notificationService.markAllAsRead(userId);
        } catch (error) {
          // Revert on error
          set({ notifications, unreadCount });
          set({ error: 'Error al marcar todas las notificaciones como leídas' });
          console.error('Error marking all as read:', error);
        }
      },

      // Load notifications from server
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
          // Defensive: ensure notifications is always an array
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          const unreadCount = safeNotifications.filter((n) => !n.isRead).length;
          set({ notifications: safeNotifications, unreadCount, isLoading: false });
        } catch (error) {
          console.error('[notificationStore] Error loading notifications:', error);
          set({
            error: 'Error al cargar notificaciones',
            isLoading: false,
            notifications: [], // Ensure notifications is always an array
          });
        }
      },

      // Set SSE connection status
      setConnected: (isConnected) => {
        set({ isConnected });
      },

      // Set error message
      setError: (error) => {
        set({ error });
      },

      // Clear error message
      clearError: () => {
        set({ error: undefined });
      },

      // Send a notification
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

      // Refresh unread count
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
