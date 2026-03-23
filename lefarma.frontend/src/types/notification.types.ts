/**
 * Tipos para el sistema de notificaciones de Lefarma
 * Soporta múltiples canales: email, telegram, in-app
 */

// ============= Notificaciones =============

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'alert';
export type NotificationCategory = 'system' | 'orders' | 'payments' | 'catalogs' | 'security';

export type NotificationChannelType = 'email' | 'telegram' | 'in-app';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  category: NotificationCategory;
  templateId?: string;
  templateData?: Record<string, unknown>;
  createdBy: string;
  scheduledFor?: string;
  expiresAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserNotification {
  id: number;
  notificationId: number;
  userId: number;
  isRead: boolean;
  readAt?: string;
  receivedVia: string; // JSON array
  createdAt: string;
  // Datos del notification relacionados
  notification?: Notification;
}

export interface NotificationChannel {
  id: number;
  notificationId: number;
  channelType: NotificationChannelType;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  recipient: string; // email;email o chatId;chatId
  sentAt?: string;
  errorMessage?: string;
  retryCount: number;
  externalId?: string; // messageId, telegram_id
  createdAt: string;
}

// ============= Request DTOs =============

export interface NotificationChannelRequest {
  channelType: NotificationChannelType;
  recipients: string; // Semicolon-separated: email1;email2 o chatId1;chatId2
  channelSpecificData?: Record<string, unknown>;
}

export interface SendNotificationRequest {
  channels: NotificationChannelRequest[];
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  templateId?: string;
  templateData?: Record<string, unknown>;
  scheduledFor?: string; // ISO date string
  expiresAt?: string; // ISO date string
}

export interface BulkNotificationRequest {
  channels: NotificationChannelRequest[];
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  templateId?: string;
  templateData?: Record<string, unknown>;
  userIds: number[]; // Lista de IDs de usuarios
  scheduledFor?: string;
  expiresAt?: string;
}

export interface RoleNotificationRequest {
  channels: NotificationChannelRequest[];
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  templateId?: string;
  templateData?: Record<string, unknown>;
  roles: string[]; // Lista de nombres de roles
  scheduledFor?: string;
  expiresAt?: string;
}

// ============= Response DTOs =============

export interface ChannelResult {
  success: boolean;
  message: string;
  sentRecipients?: string[];
  failedRecipients?: string[];
  externalId?: string;
}

export interface SendNotificationResponse {
  notificationId: number;
  channelResults: Record<string, ChannelResult>;
  createdAt: string;
}

// ============= SSE Events =============

export interface SseNotificationEvent {
  type: 'notification';
  data: UserNotification;
}

export interface SseHeartbeatEvent {
  type: 'heartbeat';
  data: {
    timestamp: string;
  };
}

export type SseEvent = SseNotificationEvent | SseHeartbeatEvent;

// ============= UI State =============

export interface NotificationUiState {
  notifications: UserNotification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
}

export interface NotificationFilter {
  unreadOnly?: boolean;
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
}

// ============= Component Props =============

export interface NotificationBellProps {
  onError?: (error: Error) => void;
}

export interface NotificationListProps {
  userId?: number;
  filter?: NotificationFilter;
  onNotificationClick?: (notification: UserNotification) => void;
  onMarkAsRead?: (notificationId: number) => void;
  onMarkAllAsRead?: () => void;
}
