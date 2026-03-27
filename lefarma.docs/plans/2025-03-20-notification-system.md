# Sistema de Notificaciones Multi-Canal - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de notificaciones unificado con soporte para email, in-app (SSE), y telegram, arquitectura extensible para futuros canales, y sistema de templates con Razor.

**Architecture:** Strategy Pattern con canales intercambiables (INotificationChannel), servicio orquestador (NotificationService), persistencia completa con Entity Framework, y frontend con Zustand + SSE.

**Tech Stack:** .NET 10, Entity Framework Core, Razor Templates, MailKit (email), Telegram Bot API, React 19, Zustand, TypeScript, EventSource (SSE).

---

## Estructura de Archivos

### Backend
```
Lefarma.API/
├── Domain/Entities/
│   ├── Notification.cs
│   ├── NotificationChannel.cs
│   ├── UserNotification.cs
│   └── NotificationRecipient.cs
├── Domain/Interfaces/
│   ├── INotificationRepository.cs
│   ├── INotificationChannel.cs
│   ├── INotificationService.cs
│   └── ITemplateService.cs
├── Features/Notifications/
│   ├── Controllers/
│   │   ├── NotificationsController.cs
│   │   └── NotificationStreamController.cs
│   ├── Services/
│   │   ├── NotificationService.cs
│   │   ├── TemplateService.cs
│   │   └── Channels/
│   │       ├── EmailNotificationChannel.cs
│   │       ├── TelegramNotificationChannel.cs
│   │       └── InAppNotificationChannel.cs
│   ├── DTOs/
│   │   └── NotificationDTOs.cs
│   └── Validators/
│       └── NotificationValidator.cs
├── Infrastructure/Data/
│   ├── Configurations/
│   │   ├── NotificationConfiguration.cs
│   │   ├── NotificationChannelConfiguration.cs
│   │   └── UserNotificationConfiguration.cs
│   └── Repositories/
│       └── NotificationRepository.cs
└── Infrastructure/Templates/Views/Notifications/
    ├── Email/DefaultEmail.cshtml
    ├── Telegram/DefaultTelegram.cshtml
    └── InApp/DefaultInApp.cshtml
```

### Frontend
```
lefarma.frontend/src/
├── services/notifications/
│   ├── notificationService.ts
│   ├── notificationStore.ts
│   ├── types.ts
│   └── hooks.ts
└── components/notifications/
    ├── NotificationBell.tsx
    ├── NotificationList.tsx
    └── NotificationItem.tsx
```

---

## Implementación Backend

### Task 1: Configuración y Dependencias
- [ ] Agregar paquetes NuGet: MailKit, Razor Runtime Compilation
- [ ] Configurar appsettings.json con EmailSettings, TelegramSettings, NotificationSettings
- [ ] Commit

### Task 2: Crear Entidades de Dominio
- [ ] Crear Notification.cs
- [ ] Crear NotificationChannel.cs
- [ ] Crear UserNotification.cs
- [ ] Commit

### Task 3: Configuraciones EF Core
- [ ] Crear NotificationConfiguration.cs
- [ ] Crear NotificationChannelConfiguration.cs
- [ ] Crear UserNotificationConfiguration.cs
- [ ] Agregar DbSets al ApplicationDbContext
- [ ] Commit

### Task 4: Interfaces del Dominio
- [ ] Crear INotificationChannel.cs
- [ ] Crear INotificationService.cs
- [ ] Crear INotificationRepository.cs
- [ ] Crear ITemplateService.cs
- [ ] Commit

### Task 5: DTOs
- [ ] Crear NotificationDTOs.cs con todos los DTOs
- [ ] Crear TemplateViewModels.cs
- [ ] Commit

### Task 6: Template Service
- [ ] Configurar Razor Runtime Compilation en Program.cs
- [ ] Crear TemplateService.cs con IRazorViewEngine
- [ ] Registrar servicio en Program.cs
- [ ] Commit

### Task 7: Email Channel
- [ ] Crear EmailSettings.cs
- [ ] Crear EmailNotificationChannel.cs con MailKit
- [ ] Registrar EmailSettings y canal en Program.cs
- [ ] Commit

### Task 8: Telegram Channel
- [ ] Crear TelegramSettings.cs
- [ ] Crear TelegramNotificationChannel.cs con HttpClient
- [ ] Registrar TelegramSettings en Program.cs
- [ ] Commit

### Task 9: In-App Channel y Repository
- [ ] Crear NotificationRepository.cs
- [ ] Crear InAppNotificationChannel.cs usando ISseService
- [ ] Registrar servicios en Program.cs
- [ ] Commit

### Task 10: Notification Service
- [ ] Crear NotificationService.cs con lógica de orquestación
- [ ] Registrar servicio y canales como keyed services en Program.cs
- [ ] Commit

### Task 11: Templates Razor
- [ ] Crear directorio Infrastructure/Templates/Views/Notifications/
- [ ] Crear DefaultEmail.cshtml
- [ ] Crear DefaultTelegram.cshtml
- [ ] Crear DefaultInApp.cshtml
- [ ] Commit

### Task 12: Controllers
- [ ] Crear NotificationsController.cs con todos los endpoints
- [ ] Crear NotificationStreamController.cs para SSE
- [ ] Commit

### Task 13: Migración EF Core
- [ ] Crear migración: `dotnet ef migrations add AddNotificationsTables`
- [ ] Aplicar migración: `dotnet ef database update`
- [ ] Commit

---

## Implementación Frontend

### Task 14: Types
- [ ] Crear services/notifications/types.ts
- [ ] Exportar tipos en types/index.ts
- [ ] Commit

### Task 15: Service
- [ ] Crear services/notifications/notificationService.ts
- [ ] Commit

### Task 16: Zustand Store
- [ ] Crear services/notifications/notificationStore.ts
- [ ] Commit

### Task 17: SSE Hooks
- [ ] Crear services/notifications/hooks.ts con useNotificationStream
- [ ] Commit

### Task 18: NotificationBell Component
- [ ] Crear components/notifications/NotificationBell.tsx
- [ ] Commit

### Task 19: NotificationList Component
- [ ] Crear components/notifications/NotificationItem.tsx
- [ ] Crear components/notifications/NotificationList.tsx
- [ ] Commit

### Task 20: Integración en Layout
- [ ] Agregar NotificationBell al Header
- [ ] Commit

---

## Testing y Documentación

### Task 21: Testing
- [ ] Probar endpoint /api/notifications/test con cada canal
- [ ] Verificar persistencia en base de datos
- [ ] Probar conexión SSE en frontend
- [ ] Verificar notificaciones en tiempo real
- [ ] Documentar resultados en TESTING_RESULTS.md
- [ ] Commit

### Task 22: Documentación Final
- [ ] Crear docs/notification-system-usage.md en backend
- [ ] Crear docs/notification-system-usage.md en frontend
- [ ] Commit final

---

## Resumen

**Total de Tasks:** 22
**Estimación de Tiempo:** 8-12 horas
**Orden Recomendado:** Tasks 1-13 (Backend) → Task 13 (Migración) → Tasks 14-20 (Frontend) → Tasks 21-22 (Testing/Docs)

**Próximos Pasos:**
Elegir método de ejecución (Subagent-Driven o Inline) y comenzar con Task 1.
