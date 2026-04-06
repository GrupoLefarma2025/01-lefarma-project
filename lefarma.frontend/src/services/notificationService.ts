/**
 * Servicio para el sistema de notificaciones de Lefarma
 * Maneja el envío y recepción de notificaciones a través de múltiples canales
 */


import { API } from './api';
import { ApiResponse } from '@/types/api.types';
import {
  SendNotificationRequest,
  SendNotificationResponse,
  BulkNotificationRequest,
  RoleNotificationRequest,
  UserNotification,
  NotificationFilter,
} from '@/types/notification.types';

/**
 * Servicio de notificaciones
 * Proporciona métodos para enviar y gestionar notificaciones
 */
class NotificationService {
  private readonly basePath = '/notifications';

  /**
   * Envía una notificación a través de los canales especificados
   */
  async sendNotification(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send`,
      request
    );
    return response.data.data;
  }

  /**
   * Envía una notificación a múltiples usuarios (bulk)
   */
  async sendBulkNotification(request: BulkNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send-bulk`,
      request
    );
    return response.data.data;
  }

  /**
   * Envía una notificación a todos los usuarios con roles específicos
   */
  async sendByRole(request: RoleNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send-by-role`,
      request
    );
    return response.data.data;
  }

  /**
   * Envía una notificación a todos los canales configurados
   * Método de conveniencia para broadcast rápido
   */
  async sendToAllChannels(
    title: string,
    message: string,
    recipients: string
  ): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/broadcast`,
      { title, message, recipients }
    );
    return response.data.data;
  }

  /**
   * Obtiene las notificaciones del usuario actual
   */
  async getUserNotifications(
    userId: number,
    filter?: NotificationFilter
  ): Promise<UserNotification[]> {
    const params = new URLSearchParams();

    if (filter?.unreadOnly) {
      params.append('unreadOnly', 'true');
    }

    const response = await API.get<ApiResponse<UserNotification[]>>(
      `${this.basePath}/user/${userId}`,
      { params }
    );
    // response.data YA es el array de notificaciones, no response.data.data
    return response.data as unknown as UserNotification[];
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    // Backend espera UserId con mayúscula (C# naming convention)
    const payload = { UserId: userId };
    console.log('[notificationService] Marking as read:', { notificationId, payload });
    try {
      const response = await API.patch(`${this.basePath}/${notificationId}/read`, payload);
      console.log('[notificationService] Mark as read response:', response);
    } catch (error) {
      console.error('[notificationService] Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones del usuario como leídas
   */
  async markAllAsRead(userId: number): Promise<void> {
    await API.patch(`${this.basePath}/user/${userId}/read-all`);
  }

  /**
   * Obtiene el conteo de notificaciones no leídas
   */
  async getUnreadCount(userId: number): Promise<number> {
    const notifications = await this.getUserNotifications(userId, { unreadOnly: true });
    return notifications.length;
  }

  /**
   * Envía una notificación de prueba para verificar la configuración
   */
  async sendTestNotification(channelType: 'email' | 'telegram' | 'in-app'): Promise<SendNotificationResponse> {
    const testRequest: SendNotificationRequest = {
      channels: [
        {
          channelType,
          // No especificamos userIds - el backend usará el usuario actual
        },
      ],
      title: 'Notificación de Prueba',
      message: `Esta es una notificación de prueba del canal ${channelType}.`,
      type: 'info',
      priority: 'normal',
      category: 'system',
    };

    return this.sendNotification(testRequest);
  }

  /**
   * Construye una solicitud de notificación con plantilla
   */
  buildTemplatedNotification(
    templateId: string,
    templateData: Record<string, unknown>,
    channels: Array<{ type: 'email' | 'telegram' | 'in-app'; recipients: string }>
  ): SendNotificationRequest {
    return {
      channels: channels.map((ch) => ({
        channelType: ch.type,
        recipients: ch.recipients,
      })),
      templateId,
      templateData,
      title: '', // Se llenará desde la plantilla
      message: '', // Se llenará desde la plantilla
      type: 'info',
      priority: 'normal',
      category: 'system',
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();
