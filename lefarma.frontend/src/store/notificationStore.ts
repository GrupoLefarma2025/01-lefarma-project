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
        const exists = notifications.some((n) => n.id === notification.id);

        if (!exists) {
          const newNotifications = [notification, ...notifications];
          const newUnreadCount = notification.isRead ? unreadCount : unreadCount + 1;
          set({
            notifications: newNotifications,
            unreadCount: newUnreadCount,
          });

          // Mostrar notificación nativa del navegador si está permitido
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
          // Optimistic update
          set({
            notifications: notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, get().unreadCount - 1),
          });

          try {
            const userId = notification.userId;
            await notificationService.markAsRead(notificationId, userId);
          } catch (error) {
            // Revert on error
            set({
              notifications: notifications.map((n) =>
                n.id === notificationId ? { ...n, isRead: false, readAt: undefined } : n
              ),
              unreadCount: get().unreadCount + 1,
            });
            set({ error: 'Error al marcar notificación como leída' });
            console.error('Error marking notification as read:', error);
          }
        }
      },

      // Mark all notifications as read
      markAllAsRead: async () => {
        const { notifications, unreadCount } = get();
        const userId = 1; // TODO: Get from auth store

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
          const targetUserId = userId || 1; // TODO: Get from auth store
          const notifications = await notificationService.getUserNotifications(targetUserId, filter);
          const unreadCount = notifications.filter((n) => !n.isRead).length;
          set({ notifications, unreadCount, isLoading: false });
        } catch (error) {
          set({
            error: 'Error al cargar notificaciones',
            isLoading: false,
          });
          console.error('Error loading notifications:', error);
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
        try {
          const count = await notificationService.getUnreadCount(userId);
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
