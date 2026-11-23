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
  receivedVia: string; 
  createdAt: string;
  notification?: Notification;
  title?: string;
  message?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
}

export interface NotificationChannel {
  id: number;
  notificationId: number;
  channelType: NotificationChannelType;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  recipient: string; 
  sentAt?: string;
  errorMessage?: string;
  retryCount: number;
  externalId?: string; 
  createdAt: string;
}

export interface NotificationChannelRequest {
  channelType: NotificationChannelType;
  userIds?: number[]; 
  roleNames?: string[]; 
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
  scheduledFor?: string; 
  expiresAt?: string; 
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
  userIds: number[]; 
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
  roles: string[]; 
  scheduledFor?: string;
  expiresAt?: string;
}

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
export type NotificationSseEvent = SseEvent;

export interface NotificationUiState {
  notifications: UserNotification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
}

export interface NotificationFilter {
  unreadOnly?: boolean;
  type?: NotificationType | 'all';
  category?: NotificationCategory | 'all';
  priority?: NotificationPriority | 'all';
  startDate?: string;
  endDate?: string;
}

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
