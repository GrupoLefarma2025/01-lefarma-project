import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  BulkNotificationRequest,
  RoleNotificationRequest,
  UserNotification,
  NotificationFilter,
} from '@/types/notification.types';

class NotificationService {
  private readonly basePath = '/notifications';

  async sendNotification(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send`,
      request
    );
    return response.data.data;
  }

  async sendBulkNotification(request: BulkNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send-bulk`,
      request
    );
    return response.data.data;
  }

  async sendByRole(request: RoleNotificationRequest): Promise<SendNotificationResponse> {
    const response = await API.post<ApiResponse<SendNotificationResponse>>(
      `${this.basePath}/send-by-role`,
      request
    );
    return response.data.data;
  }

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

  async getUserNotifications(
    userId: number,
    filter?: NotificationFilter
  ): Promise<UserNotification[]> {
    const params = new URLSearchParams();

    if (filter?.unreadOnly) {
      params.append('unreadOnly', 'true');
    }

    const response = await API.get<UserNotification[]>(
      `${this.basePath}/user/${userId}`,
      { params }
    );
    return response.data;
  }

  async markAsRead(notificationId: number, userId: number): Promise<void> {
    const payload = { UserId: userId };
    await API.patch<ApiResponse<void>>(`${this.basePath}/${notificationId}/read`, payload);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await API.patch<ApiResponse<void>>(`${this.basePath}/user/${userId}/read-all`);
  }

  async getUnreadCount(userId: number): Promise<number> {
    const notifications = await this.getUserNotifications(userId, { unreadOnly: true });
    return notifications.length;
  }

  async sendTestNotification(channelType: 'email' | 'telegram' | 'in-app'): Promise<SendNotificationResponse> {
    const testRequest: SendNotificationRequest = {
      channels: [
        {
          channelType,
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
      title: '', 
      message: '', 
      type: 'info',
      priority: 'normal',
      category: 'system',
    };
  }
}

export const notificationService = new NotificationService();
