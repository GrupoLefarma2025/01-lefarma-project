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
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      isLoading: false,
      error: undefined,

      setNotifications: (notifications) => {
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        set({ notifications, unreadCount });
      },

      addNotification: (notification) => {
        const { notifications, unreadCount } = get();

        const existingIndex = notifications.findIndex((n) => n.id === notification.id);

        if (existingIndex >= 0) {
          const existingNotification = notifications[existingIndex];

          if (existingNotification.isRead && !notification.isRead) {
            const newNotifications = [...notifications];
            newNotifications[existingIndex] = notification;
            const newUnreadCount = unreadCount + 1;

            set({
              notifications: newNotifications,
              unreadCount: newUnreadCount,
            });

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(notification.notification?.title || 'Nueva Notificación', {
                body: notification.notification?.message,
                icon: '/favicon.ico',
                tag: notification.id.toString(),
              });
            }
          }
        } else {
          const newNotifications = [notification, ...notifications];
          const newUnreadCount = notification.isRead ? unreadCount : unreadCount + 1;

          set({
            notifications: newNotifications,
            unreadCount: newUnreadCount,
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.notification?.title || 'Nueva Notificación', {
              body: notification.notification?.message,
              icon: '/favicon.ico',
              tag: notification.id.toString(),
            });
          }
        }
      },

      removeNotification: (notificationId) => {
        const { notifications } = get();
        const newNotifications = notifications.filter((n) => n.id !== notificationId);
        const unreadCount = newNotifications.filter((n) => !n.isRead).length;
        set({ notifications: newNotifications, unreadCount });
      },

      markAsRead: async (notificationId) => {
        const { notifications } = get();
        const notification = notifications.find((n) => n.id === notificationId);

        if (notification && !notification.isRead) {
          const { user } = useAuthStore.getState();
          const userId = user?.id;

          if (!userId) {
            console.error('[notificationStore] No userId found in authStore');
            set({ error: 'No hay usuario autenticado' });
            return;
          }

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

      markAllAsRead: async () => {
        const { notifications, unreadCount } = get();
        const { user } = useAuthStore.getState();
        const userId = user?.id;

        if (!userId) {
          set({ error: 'No hay usuario autenticado' });
          return;
        }

        const updatedNotifications = notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        }));

        set({ notifications: updatedNotifications, unreadCount: 0 });

        try {
          await notificationService.markAllAsRead(userId);
        } catch (error) {
          set({ notifications, unreadCount });
          set({ error: 'Error al marcar todas las notificaciones como leídas' });
          console.error('Error marking all as read:', error);
        }
      },

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
          const safeNotifications = Array.isArray(notifications) ? notifications : [];
          const unreadCount = safeNotifications.filter((n) => !n.isRead).length;
          set({ notifications: safeNotifications, unreadCount, isLoading: false });
        } catch (error) {
          console.error('[notificationStore] Error loading notifications:', error);
          set({
            error: 'Error al cargar notificaciones',
            isLoading: false,
            notifications: [], 
          });
        }
      },

      setConnected: (isConnected) => {
        set({ isConnected });
      },

      setError: (error) => {
        set({ error });
      },

      clearError: () => {
        set({ error: undefined });
      },

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

export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectIsConnected = (state: NotificationState) => state.isConnected;
export const selectIsLoading = (state: NotificationState) => state.isLoading;
export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.isRead);
