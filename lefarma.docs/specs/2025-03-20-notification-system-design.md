# Sistema de Notificaciones Multi-Canal - Diseño Técnico

**Fecha:** 2025-03-20
**Versión:** 1.0
**Autor:** Claude Code
**Estado:** Aprobado para implementación

## 1. Overview

Sistema de notificaciones unificado que permite enviar notificaciones a través de múltiples canales (email, in-app, telegram) con una arquitectura extensible para futuros canales (whatsapp, SMS, push notifications).

## 2. Arquitectura

### 2.1 Patrón de Diseño

**Strategy Pattern** con canales intercambiables:

```
NotificationService (orquestador)
    ├── INotificationChannel (interfaz común)
    │   ├── EmailNotificationChannel
    │   ├── InAppNotificationChannel
    │   ├── TelegramNotificationChannel
    │   └── [Futuros: WhatsApp, SMS, Push]
    ├── ITemplateService (renderizado con Razor)
    └── INotificationRepository (persistencia)
```

### 2.2 Flujo de Datos

1. Cliente llama `NotificationService.SendAsync(request)`
2. Servicio crea registro en `Notifications` (BD)
3. Servicio itera los canales solicitados
4. Por cada canal:
   - Renderiza template con Razor
   - Envía notificación
   - Registra resultado en `NotificationChannels`
5. Para in-app: Crea registros en `UserNotifications` para tracking de lectura

## 3. Base de Datos

### 3.1 Tabla: Notifications

```sql
CREATE TABLE Notifications (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Type NVARCHAR(50) NOT NULL,        -- info, warning, error, success, alert
    Priority NVARCHAR(20) NOT NULL,    -- low, normal, high, urgent
    Category NVARCHAR(100) NOT NULL,   -- system, order, payment, catalog, etc.

    -- Template
    TemplateId NVARCHAR(100) NULL,
    TemplateData NVARCHAR(MAX) NULL,   -- JSON con datos

    -- Metadata
    CreatedBy NVARCHAR(100) NOT NULL,  -- UserId o 'system'
    ScheduledFor DATETIME2 NULL,       -- null = inmediato
    ExpiresAt DATETIME2 NULL,          -- expiración
    RetryCount INT NOT NULL DEFAULT 0,

    -- Timestamps
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
```

### 3.2 Tabla: NotificationChannels

```sql
CREATE TABLE NotificationChannels (
    Id INT PRIMARY KEY IDENTITY(1,1),
    NotificationId INT NOT NULL FOREIGN KEY REFERENCES Notifications(Id),
    ChannelType NVARCHAR(50) NOT NULL,      -- email, in-app, telegram, whatsapp
    Status NVARCHAR(20) NOT NULL,           -- pending, sent, failed, retrying
    Recipient NVARCHAR(500) NOT NULL,       -- email;email;email o chatId;chatId
    SentAt DATETIME2 NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    RetryCount INT NOT NULL DEFAULT 0,
    ExternalId NVARCHAR(200) NULL,          -- messageId, telegram_id, etc.
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
```

### 3.3 Tabla: UserNotifications

```sql
CREATE TABLE UserNotifications (
    Id INT PRIMARY KEY IDENTITY(1,1),
    NotificationId INT NOT NULL FOREIGN KEY REFERENCES Notifications(Id),
    UserId INT NOT NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    ReadAt DATETIME2 NULL,
    ReceivedVia NVARCHAR(200) NOT NULL,     -- JSON: ["email", "in-app"]
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_UserNotifications_UserId_NotificationId
ON UserNotifications(UserId, NotificationId);

CREATE INDEX IX_UserNotifications_IsRead
ON UserNotifications(IsRead);
```

### 3.4 Tabla: NotificationRecipients

```sql
CREATE TABLE NotificationRecipients (
    Id INT PRIMARY KEY IDENTITY(1,1),
    NotificationId INT NOT NULL FOREIGN KEY REFERENCES Notifications(Id),
    RecipientType NVARCHAR(50) NOT NULL,    -- user, role, email, telegramChatId
    RecipientIdentifier NVARCHAR(200) NOT NULL,
    ChannelPreferences NVARCHAR(MAX) NULL,  -- JSON con canales específicos
);
```

## 4. Backend - Contratos y DTOs

### 4.1 SendNotificationRequest

```csharp
public class SendNotificationRequest
{
    public List<NotificationChannelRequest> Channels { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string Type { get; set; } = "info";
    public string Priority { get; set; } = "normal";
    public string Category { get; set; } = "system";

    // Template (opcional)
    public string? TemplateId { get; set; }
    public Dictionary<string, object>? TemplateData { get; set; }

    // Programación
    public DateTime? ScheduledFor { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class NotificationChannelRequest
{
    public string ChannelType { get; set; } // "email", "in-app", "telegram"
    public string Recipients { get; set; } // "email1@test.com;email2@test.com"
    public Dictionary<string, object>? ChannelSpecificData { get; set; }
}
```

### 4.2 SendNotificationResponse

```csharp
public class SendNotificationResponse
{
    public int NotificationId { get; set; }
    public Dictionary<string, ChannelResult> ChannelResults { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChannelResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<string>? SentRecipients { get; set; }
    public List<string>? FailedRecipients { get; set; }
    public string? ExternalId { get; set; } // messageId, telegram_id, etc.
}
```

### 4.3 BulkNotificationRequest

```csharp
public class BulkNotificationRequest : SendNotificationRequest
{
    public List<int> UserIds { get; set; } // Para envío masivo
}
```

### 4.4 RoleNotificationRequest

```csharp
public class RoleNotificationRequest : SendNotificationRequest
{
    public List<string> Roles { get; set; } // ["Administrador", "GerenteArea"]
}
```

## 5. Backend - Interfaces

### 5.1 INotificationChannel

```csharp
public interface INotificationChannel
{
    string ChannelType { get; }
    Task<ChannelResult> SendAsync(NotificationMessage message, CancellationToken ct = default);
    Task<bool> ValidateRecipientsAsync(string recipients, CancellationToken ct = default);
}

public class NotificationMessage
{
    public string Title { get; set; }
    public string Body { get; set; }
    public string Recipients { get; set; }
    public Dictionary<string, object>? Data { get; set; }
}
```

### 5.2 INotificationService

```csharp
public interface INotificationService
{
    Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default);
    Task<SendNotificationResponse> SendToAllChannelsAsync(string title, string message, string recipients, CancellationToken ct = default);
    Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default);
    Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default);
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default);
    Task MarkAsReadAsync(int notificationId, int userId, CancellationToken ct = default);
    Task MarkAllAsReadAsync(int userId, CancellationToken ct = default);
}
```

### 5.3 ITemplateService

```csharp
public interface ITemplateService
{
    Task<string> RenderAsync(string templateId, Dictionary<string, object> data, CancellationToken ct = default);
    Task<bool> TemplateExistsAsync(string templateId, CancellationToken ct = default);
    Task RegisterTemplateAsync(string templateId, string content, TemplateType type);
}

public enum TemplateType
{
    Html,    // Para emails
    Text,    // Para telegram/SMS
    Json     // Para formatos complejos
}
```

## 6. Backend - Implementación de Canales

### 6.1 EmailNotificationChannel

**Configuración (appsettings.json):**
```json
"EmailSettings": {
  "SmtpServer": "smtp.gmail.com",
  "SmtpPort": 587,
  "SmtpUser": "notifications@lefarma.com",
  "SmtpPassword": "password",
  "FromEmail": "notifications@lefarma.com",
  "FromName": "Lefarma Notifications",
  "UseSsl": true
}
```

**Implementación:**
- Parsear recipients separados por `;`
- Renderizar template HTML con Razor
- Enviar via SMTP
- Retornar ChannelResult con messageId del servidor

### 6.2 TelegramNotificationChannel

**Configuración (appsettings.json):**
```json
"TelegramSettings": {
  "BotToken": "your-bot-token",
  "ApiUrl": "https://api.telegram.org/bot{token}/sendMessage"
}
```

**Implementación:**
- Parsear chatIds separados por `;`
- Hacer POST a Telegram API
- Formatear mensaje como texto o Markdown
- Retornar ChannelResult con message_id de Telegram

### 6.3 InAppNotificationChannel

**Implementación:**
- Usar `ISseService` existente para enviar por SSE
- Crear registros en `UserNotifications`
- Eventos SSE: `notification.received`, `notification.read`

## 7. Backend - Sistema de Templates

### 7.1 Estructura de Templates Razor

```
/Views/Notifications/Email/
  - WelcomeEmail.cshtml
  - OrderCreatedEmail.cshtml
  - PaymentReceivedEmail.cshtml

/Views/Notifications/Telegram/
  - OrderCreatedTelegram.cshtml
  - AlertTelegram.cshtml

/Views/Notifications/InApp/
  - NotificationInApp.cshtml
```

### 7.2 Ejemplo de Template Razor

```cshtml
@model NotificationTemplateViewModel

@if (!string.IsNullOrEmpty(Model.CustomerName))
{
    <p>Hola @Model.CustomerName,</p>
}

<p>Tu orden #@Model.OrderId ha sido creada exitosamente.</p>

@if (Model.TotalAmount.HasValue)
{
    <p>Total: $@Model.TotalAmount.Value.ToString("F2")</p>
}

@if (Model.Items != null && Model.Items.Any())
{
    <p>Productos:</p>
    <ul>
    @foreach (var item in Model.Items)
    {
        <li>@item.Name (x@item.Quantity)</li>
    }
    </ul>
}
```

### 7.3 ViewModel

```csharp
public class NotificationTemplateViewModel
{
    public string? CustomerName { get; set; }
    public string OrderId { get; set; }
    public decimal? TotalAmount { get; set; }
    public List<NotificationItemViewModel>? Items { get; set; }
}

public class NotificationItemViewModel
{
    public string Name { get; set; }
    public int Quantity { get; set; }
}
```

## 8. Backend - Endpoints API

### 8.1 NotificationsController

```csharp
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    // POST /api/notifications/send
    [HttpPost("send")]
    public async Task<ActionResult<SendNotificationResponse>> Send(SendNotificationRequest request)

    // POST /api/notifications/send-bulk
    [HttpPost("send-bulk")]
    public async Task<ActionResult<SendNotificationResponse>> SendBulk(BulkNotificationRequest request)

    // POST /api/notifications/send-by-role
    [HttpPost("send-by-role")]
    public async Task<ActionResult<SendNotificationResponse>> SendByRole(RoleNotificationRequest request)

    // GET /api/notifications/user/{userId}
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<List<NotificationDto>>> GetUserNotifications(
        int userId,
        [FromQuery] bool unreadOnly = false)

    // PATCH /api/notifications/{notificationId}/read
    [HttpPatch("{notificationId}/read")]
    public async Task<ActionResult> MarkAsRead(int notificationId, [FromBody] MarkReadRequest request)

    // PATCH /api/notifications/user/{userId}/read-all
    [HttpPatch("user/{userId}/read-all")]
    public async Task<ActionResult> MarkAllAsRead(int userId)

    // GET /api/notifications/{notificationId}
    [HttpGet("{notificationId}")]
    public async Task<ActionResult<NotificationDetailDto>> GetNotification(int notificationId)

    // POST /api/notifications/test
    [HttpPost("test")]
    public async Task<ActionResult<SendNotificationResponse>> Test(TestNotificationRequest request)
}
```

### 8.2 NotificationStreamController (SSE)

```csharp
[ApiController]
[Route("api/notifications")]
public class NotificationStreamController : ControllerBase
{
    // GET /api/notifications/stream
    [HttpGet("stream")]
    public async Task GetStream(CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirst("userId")?.Value ?? "0");
        await _sseService.RegisterConnectionAsync(userId, Response, ct);
    }
}
```

### 8.3 DTOs de Respuesta

```csharp
public class NotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string Type { get; set; }
    public string Priority { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
    public List<string> ReceivedVia { get; set; }
}

public class NotificationDetailDto : NotificationDto
{
    public List<NotificationChannelDto> Channels { get; set; }
    public string? TemplateId { get; set; }
}

public class NotificationChannelDto
{
    public string ChannelType { get; set; }
    public string Status { get; set; }
    public string Recipient { get; set; }
    public DateTime? SentAt { get; set; }
}
```

## 9. Frontend - Estructura

```
lefarma.frontend/src/
├── services/notifications/
│   ├── notificationService.ts       # API client
│   ├── notificationStore.ts         # Zustand store
│   ├── types.ts                     # TypeScript types
│   └── hooks.ts                     # Custom hooks
├── components/notifications/
│   ├── NotificationBell.tsx         # Bell icon with badge
│   ├── NotificationList.tsx         # List of notifications
│   └── NotificationItem.tsx         # Single notification item
```

## 10. Frontend - Types

```typescript
export type NotificationChannel = 'email' | 'in-app' | 'telegram';
export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'alert';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SendNotificationRequest {
  channels: NotificationChannelRequest[];
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  scheduledFor?: string;
  expiresAt?: string;
}

export interface NotificationChannelRequest {
  channelType: NotificationChannel;
  recipients: string;
  channelSpecificData?: Record<string, any>;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  createdAt: string;
  isRead: boolean;
  receivedVia: NotificationChannel[];
}

export interface BulkNotificationRequest extends SendNotificationRequest {
  userIds: number[];
}

export interface RoleNotificationRequest extends SendNotificationRequest {
  roles: string[];
}
```

## 11. Frontend - Service

```typescript
import { api } from './api';
import type {
  SendNotificationRequest,
  BulkNotificationRequest,
  RoleNotificationRequest,
  Notification
} from './types';

export const notificationService = {
  send: async (request: SendNotificationRequest) => {
    const response = await api.post('/notifications/send', request);
    return response.data;
  },

  sendBulk: async (request: BulkNotificationRequest) => {
    const response = await api.post('/notifications/send-bulk', request);
    return response.data;
  },

  sendByRole: async (request: RoleNotificationRequest) => {
    const response = await api.post('/notifications/send-by-role', request);
    return response.data;
  },

  getUserNotifications: async (userId: number, unreadOnly = false) => {
    const response = await api.get(`/notifications/user/${userId}`, {
      params: { unreadOnly }
    });
    return response.data;
  },

  markAsRead: async (notificationId: number, userId: number) => {
    const response = await api.patch(`/notifications/${notificationId}/read`, { userId });
    return response.data;
  },

  markAllAsRead: async (userId: number) => {
    const response = await api.patch(`/notifications/user/${userId}/read-all`);
    return response.data;
  }
};
```

## 12. Frontend - Zustand Store

```typescript
import { create } from 'zustand';
import type { Notification } from './types';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  setConnected: (connected: boolean) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  isConnected: false,

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.isRead).length
  }),

  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),

  markAsRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0
  })),

  setConnected: (connected) => set({ isConnected: connected })
}));
```

## 13. Frontend - SSE Hook

```typescript
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../authStore';
import { useNotificationStore } from './notificationStore';
import { toast } from 'react-hot-toast';

export const useNotificationStream = () => {
  const { user } = useAuthStore();
  const { addNotification, setConnected } = useNotificationStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/notifications/stream`
    );

    eventSource.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
    };

    eventSource.addEventListener('notification.received', (e) => {
      const notification = JSON.parse(e.data);
      addNotification(notification);
      toast.info(notification.title);
    });

    eventSource.addEventListener('notification.read', (e) => {
      const data = JSON.parse(e.data);
      useNotificationStore.getState().markAsRead(data.notificationId);
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnected(false);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [user?.id]);

  return { isConnected: useNotificationStore(state => state.isConnected) };
};
```

## 14. Testing

### 14.1 Backend Tests

- Unit tests para cada canal
- Integration tests para NotificationService
- Tests de rendering de templates Razor
- Tests de endpoints API

### 14.2 Frontend Tests

- Tests de notificationService
- Tests de notificationStore
- Tests de SSE connection
- E2E tests con Playwright

### 14.3 Manual Testing Plan

1. **Email**: Enviar a múltiples recipients, CC, HTML rendering
2. **Telegram**: Enviar a múltiples chatIds, formateo de mensajes
3. **In-App**: Verificar SSE en tiempo real, actualización de UI, marca de lectura
4. **Bulk**: Enviar a 100+ usuarios
5. **Por Rol**: Enviar a roles específicos
6. **Templates**: Probar rendering con datos complejos

## 15. Configuración

### 15.1 Paquetes NuGet Requeridos

- `Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation` - Templates Razor
- `MailKit` o `System.Net.Mail` - Envío de emails
- `Newtonsoft.Json` - Serialización JSON

### 15.2 Configuración appsettings.json

```json
{
  "EmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "SmtpPort": 587,
    "SmtpUser": "notifications@lefarma.com",
    "SmtpPassword": "password",
    "FromEmail": "notifications@lefarma.com",
    "FromName": "Lefarma Notifications",
    "UseSsl": true
  },
  "TelegramSettings": {
    "BotToken": "your-bot-token",
    "ApiUrl": "https://api.telegram.org/bot"
  },
  "NotificationSettings": {
    "MaxRetryCount": 3,
    "RetryDelaySeconds": 60,
    "TemplatePath": "Views/Notifications"
  }
}
```

## 16. Dependencias

### 16.1 Backend

- ISseService (ya existe en Features/Auth)
- ApplicationDbContext (para persistencia)
- ILogger (logging)

### 16.2 Frontend

- api service (ya existe)
- authStore (para userId)
- toast (react-hot-toast ya instalado)

## 17. Consideraciones de Seguridad

- Validar recipients antes de enviar
- Sanitizar templates Razor para prevenir XSS
- Rate limiting en endpoints de envío
- Autenticación requerida en todos los endpoints
- Autorización por roles para envío masivo

## 18. Performance

- Async/await en todas las operaciones I/O
- CancellationToken support
- Connection pooling para SMTP
- Bulk operations para base de datos
- SSE ya es eficiente para tiempo real

## 19. Extensibilidad

- Agregar nuevos canales: implementar INotificationChannel
- Agregar nuevos templates: crear archivos .cshtml
- Agregar nuevos eventos SSE: extender ISseService

## 20. Rollout Plan

1. **Fase 1**: Backend - Infraestructura (BD, entidades, repositories)
2. **Fase 2**: Backend - Canales (Email, Telegram, InApp)
3. **Fase 3**: Backend - Templates Razor
4. **Fase 4**: Backend - Endpoints API
5. **Fase 5**: Frontend - Service y Store
6. **Fase 6**: Frontend - SSE y UI
7. **Fase 7**: Testing y validación
