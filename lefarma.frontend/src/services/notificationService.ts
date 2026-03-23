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
      this.basePath,
      request
    );
    return response.data.data;
  }

  /**
   * Envía una notificación a múltiples usuarios (bulk)
   */
  async sendBulkNotification(request: BulkNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/bulk`,
      request
    );
    return response.data.data;
  }

  /**
   * Envía una notificación a todos los usuarios con roles específicos
   */
  async sendByRole(request: RoleNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/by-role`,
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
    return response.data.data;
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await API.post(`${this.basePath}/${notificationId}/read/${userId}`);
  }

  /**
   * Marca todas las notificaciones del usuario como leídas
   */
  async markAllAsRead(userId: number): Promise<void> {
    await API.post(`${this.basePath}/read-all/${userId}`);
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
          recipients: 'test', // El backend usará el usuario actual
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
