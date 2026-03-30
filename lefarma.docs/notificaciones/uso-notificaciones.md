# Guía de Uso del Sistema de Notificaciones

Esta guía explica cómo enviar notificaciones desde:
1. **Backend** - C#/.NET usando `INotificationService`
2. **Frontend** - React/TypeScript usando `notificationService`

---

# PARTE 1: BACKEND (.NET / C#)

## Índice

- [Configuración](#configuración)
- [Inyección del Servicio](#inyección-del-servicio)
- [Métodos Disponibles](#métodos-disponibles)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Tipos de Notificación](#tipos-de-notificación)
- [Canales Disponibles](#canales-disponibles)
- [Plantillas](#plantillas)
- [Buenas Prácticas](#buenas-prácticas)

---

## Configuración

El sistema de notificaciones está configurado en `appsettings.json`:

```json
{
  "EmailSettings": {
    "SmtpServer": "mail.grupolefarma.com.mx",
    "SmtpPort": 587,
    "SmtpUser": "autorizaciones@grupolefarma.com.mx",
    "SmtpPassword": "tu-password",
    "FromEmail": "autorizaciones@grupolefarma.com.mx",
    "FromName": "Grupo Lefarma",
    "UseSsl": true,
    "AcceptInvalidCertificates": true,
    "Timeout": 30000
  },
  "TelegramSettings": {
    "BotToken": "tu-bot-token",
    "ApiUrl": "https://api.telegram.org/bot"
  }
}
```

---

## Inyección del Servicio

Para usar el sistema de notificaciones en cualquier servicio o controlador:

```csharp
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;

public class TuService : ITuService
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<TuService> _logger;

    public TuService(
        INotificationService notificationService,
        ILogger<TuService> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    // Tu código aquí...
}
```

---

## Métodos Disponibles

### 1. SendAsync - Enviar notificación simple

Envía una notificación a usuarios específicos o roles a través de múltiples canales.

**Firma:**
```csharp
Task<SendNotificationResponse> SendAsync(SendNotificationRequest request, CancellationToken ct = default)
```

### 2. SendBulkAsync - Enviar notificación masiva

Envía notificaciones personalizadas a múltiples usuarios.

**Firma:**
```csharp
Task<SendNotificationResponse> SendBulkAsync(BulkNotificationRequest request, CancellationToken ct = default)
```

### 3. SendByRoleAsync - Enviar por roles

Envía notificación a todos los usuarios que tengan ciertos roles.

**Firma:**
```csharp
Task<SendNotificationResponse> SendByRoleAsync(RoleNotificationRequest request, CancellationToken ct = default)
```

### 4. GetUserNotificationsAsync - Obtener notificaciones de usuario

Obtiene las notificaciones de un usuario específico.

**Firma:**
```csharp
Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, bool unreadOnly = false, CancellationToken ct = default)
```

---

## Ejemplos de Uso

### Ejemplo 1: Notificación por Email e In-App

**Escenario:** Cuando se aprueba una autorización de gasto.

```csharp
public async Task NotificarAutorizacionAprobada(int gastoId, int userIdAprobador)
{
    var request = new SendNotificationRequest
    {
        Title = "Autorización Aprobada",
        Message = $"<p>Tu solicitud de gasto <strong>#{gastoId}</strong> ha sido aprobada.</p>",
        Type = "success",
        Priority = "normal",
        Category = "gastos",
        Channels = new List<NotificationChannelRequest>
        {
            new()
            {
                ChannelType = "email",
                UserIds = new List<int> { userIdAprobador },
                ChannelSpecificData = new Dictionary<string, object>
                {
                    ["cc"] = "gerencia@grupolefarma.com.mx" // CC opcional
                }
            },
            new()
            {
                ChannelType = "in-app",
                UserIds = new List<int> { userIdAprobador }
            }
        }
    };

    var response = await _notificationService.SendAsync(request);

    if (response.ChannelResults["email"].Success)
    {
        _logger.LogInformation("Email enviado correctamente a {UserId}", userIdAprobador);
    }
}
```

### Ejemplo 2: Notificación a Todos los Gerentes

**Escenario:** Notificar a todos los gerentes sobre un nuevo catálogo creado.

```csharp
public async Task NotificarNuevoCatalogo(string catalogoNombre)
{
    var request = new RoleNotificationRequest
    {
        Title = "Nuevo Catálogo Creado",
        Message = $"Se ha creado un nuevo catálogo: {catalogoNombre}",
        Type = "info",
        Priority = "low",
        Category = "catalogos",
        Roles = new List<string> { "GerenteArea", "GerenteAdmon" },
        Channels = new List<NotificationChannelRequest>
        {
            new()
            {
                ChannelType = "in-app",
                RoleNames = new List<string> { "GerenteArea", "GerenteAdmon" }
            }
        }
    };

    await _notificationService.SendByRoleAsync(request);
}
```

### Ejemplo 3: Notificación Urgente con Email + Telegram

**Escenario:** Alerta crítica de sistema.

```csharp
public async Task NotificarErrorCritico(string errorMessage)
{
    var request = new SendNotificationRequest
    {
        Title = "🚨 ERROR CRÍTICO DEL SISTEMA",
        Message = $"Se ha detectado un error crítico: {errorMessage}",
        Type = "error",
        Priority = "urgent",
        Category = "system",
        Channels = new List<NotificationChannelRequest>
        {
            new()
            {
                ChannelType = "email",
                RoleNames = new List<string> { "Administrador" }
            },
            new()
            {
                ChannelType = "telegram",
                RoleNames = new List<string> { "Administrador" },
                ChannelSpecificData = new Dictionary<string, object>
                {
                    ["parse_mode"] = "HTML" // Formato HTML para Telegram
                }
            }
        }
    };

    await _notificationService.SendAsync(request);
}
```

### Ejemplo 4: Notificación con Plantilla

**Escenario:** Email de bienvenida con HTML personalizado.

```csharp
public async Task EnviarEmailBienvenida(int userId, string nombreUsuario)
{
    var request = new SendNotificationRequest
    {
        Title = "Bienvenido a Lefarma",
        Message = string.Empty, // Se usa la plantilla
        Type = "info",
        Priority = "normal",
        Category = "onboarding",
        TemplateId = "bienvenida",
        TemplateData = new Dictionary<string, object>
        {
            ["nombre"] = nombreUsuario,
            ["anio"] = DateTime.Now.Year
        },
        Channels = new List<NotificationChannelRequest>
        {
            new()
            {
                ChannelType = "email",
                UserIds = new List<int> { userId }
            }
        }
    };

    await _notificationService.SendAsync(request);
}
```

**Plantilla HTML (`Views/Notifications/bienvenida.html`):**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Bienvenido, {{nombre}} 👋</h1>
        <p>Te damos la bienvenida al sistema de gestión Lefarma.</p>
        <p>© {{anio}} Grupo Lefarma</p>
    </div>
</body>
</html>
```

### Ejemplo 5: Notificación Masiva Personalizada

**Escenario:** Enviar reportes a múltiples usuarios con datos personalizados.

```csharp
public async Task EnviarReportesPersonalizados(Dictionary<int, string> reportesPorUsuario)
{
    var channels = new List<NotificationChannelRequest>
    {
        new()
        {
            ChannelType = "email",
            UserIds = reportesPorUsuario.Keys.ToList()
        }
    };

    // Nota: Para emails personalizados por usuario,
    // necesitarías implementar un bucle o usar plantillas con datos dinámicos
    foreach (var (userId, reporteUrl) in reportesPorUsuario)
    {
        var request = new SendNotificationRequest
        {
            Title = "Tu Reporte Mensual",
            Message = $"<p>Tu reporte está disponible: <a href='{reporteUrl}'>Descargar</a></p>",
            Type = "info",
            Priority = "normal",
            Category = "reportes",
            Channels = new List<NotificationChannelRequest>
            {
                new()
                {
                    ChannelType = "email",
                    UserIds = new List<int> { userId }
                }
            }
        };

        await _notificationService.SendAsync(request);
    }
}
```

### Ejemplo 6: Notificación Programada

**Escenario:** Recordatorio programado para vencimiento de documentos.

```csharp
public async Task ProgramarRecordatorioVencimiento(int userId, DateTime fechaVencimiento)
{
    var request = new SendNotificationRequest
    {
        Title = "Recordatorio de Vencimiento",
        Message = $"Tienes un documento que vence el {fechaVencimiento:dd/MM/yyyy}",
        Type = "warning",
        Priority = "high",
        Category = "documentos",
        ScheduledFor = fechaVencimiento.AddDays(-7), // 7 días antes
        Channels = new List<NotificationChannelRequest>
        {
            new()
            {
                ChannelType = "in-app",
                UserIds = new List<int> { userId }
            },
            new()
            {
                ChannelType = "email",
                UserIds = new List<int> { userId }
            }
        }
    };

    await _notificationService.SendAsync(request);
}
```

---

## Tipos de Notificación

| Tipo | Uso Recomendado | Color UI |
|------|-----------------|----------|
| `info` | Información general | Azul |
| `success` | Operación exitosa | Verde |
| `warning` | Alerta preventiva | Amarillo |
| `error` | Error o falla | Rojo |
| `alert` | Alerta importante | Naranja |

## Prioridades

| Prioridad | Uso |
|-----------|-----|
| `low` | Información no crítica (boletines, actualizaciones) |
| `normal` | Comunicaciones estándar |
| `high` | Importante pero no urgente |
| `urgent` | Requiere atención inmediata |

## Categorías

Sistema organiza las notificaciones por categorías:

- `system` - Eventos del sistema
- `gastos` - Autorizaciones de gastos
- `catalogos` - Gestión de catálogos
- `orders` - Pedidos
- `payments` - Pagos
- `documentos` - Documentación
- `onboarding` - Bienvenida
- `reportes` - Reportes

---

## Canales Disponibles

### 1. Email (`email`)

**Configuración específica:**
```csharp
ChannelSpecificData = new Dictionary<string, object>
{
    ["cc"] = "copiado@ejemplo.com",           // CC
    ["bcc"] = "oculto@ejemplo.com",           // BCC
    ["replyTo"] = "responder@ejemplo.com",    // Reply-To
    ["plainText"] = "Versión texto plano"      // Texto plano fallback
}
```

### 2. In-App (`in-app`)

Las notificaciones in-app se entregan en tiempo real via **Server-Sent Events (SSE)**. El frontend se conecta automáticamente al endpoint `/api/notifications/sse`.

No requiere configuración específica.

### 3. Telegram (`telegram`)

**Configuración específica:**
```csharp
ChannelSpecificData = new Dictionary<string, object>
{
    ["parse_mode"] = "HTML",  // o "Markdown"
    ["disable_web_page_preview"] = true
}
```

**Nota:** Requiere configurar el bot token en `appsettings.json`.

---

## Plantillas

### Crear una Plantilla

Crea archivos HTML en `Views/Notifications/`:

```html
<!-- Views/Notifications/recibo-gasto.html -->
<!DOCTYPE html>
<html>
<body>
    <h1>Recibo de Gasto #{{gastoId}}</h1>
    <p>Monto: <strong>${{monto}}</strong></p>
    <p>Fecha: {{fecha}}</p>
    <p>Aprobado por: {{aprobador}}</p>
</body>
</html>
```

### Usar una Plantilla

```csharp
var request = new SendNotificationRequest
{
    Title = "Recibo de Gasto",
    Message = string.Empty, // No se usa, se reemplaza por la plantilla
    TemplateId = "recibo-gasto",
    TemplateData = new Dictionary<string, object>
    {
        ["gastoId"] = 12345,
        ["monto"] = "1500.00",
        ["fecha"] = DateTime.Now.ToString("dd/MM/yyyy"),
        ["aprobador"] = "Juan Pérez"
    },
    Channels = new List<NotificationChannelRequest>
    {
        new() { ChannelType = "email", UserIds = new List<int> { userId } }
    }
};
```

---

## Buenas Prácticas

### ✅ Hacer

1. **Usar categorías consistentes** para agrupar notificaciones similares
2. **Especificar siempre el tipo** (`info`, `success`, `warning`, `error`)
3. **Usar HTML sanitizado** en el cuerpo del mensaje
4. **Enviar notificaciones in-app** para confirmación inmediata de acciones
5. **Usar plantillas** para emails complejos o recurrentes
6. **Manejar respuestas** y loggear errores:
   ```csharp
   var response = await _notificationService.SendAsync(request);

   foreach (var (channel, result) in response.ChannelResults)
   {
       if (!result.Success)
       {
           _logger.LogError("Fallo canal {Channel}: {Error}", channel, result.Message);
       }
   }
   ```

### ❌ Evitar

1. **No enviar notificaciones vacías** (sin título o mensaje)
2. **No abuse de prioridad `urgent`** - solo para emergencias reales
3. **No incluir datos sensibles** en el mensaje (contraseñas, tokens)
4. **No olvidar manejar excepciones** del servicio de notificaciones
5. **No enviar notificaciones masivas** en un bucle sincrónico (usa background jobs)

---

## Ejemplo Completo: Servicio de Gastos

```csharp
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;

public class GastoNotificationService
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<GastoNotificationService> _logger;

    public GastoNotificationService(
        INotificationService notificationService,
        ILogger<GastoNotificationService> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task NotificarGastoCreado(int gastoId, int userIdSolicitante)
    {
        var request = new SendNotificationRequest
        {
            Title = "Nueva Solicitud de Gasto",
            Message = $"<p>Se ha creado la solicitud de gasto <strong>#{gastoId}</strong>.</p>",
            Type = "info",
            Priority = "normal",
            Category = "gastos",
            Channels = new List<NotificationChannelRequest>
            {
                new()
                {
                    ChannelType = "in-app",
                    RoleNames = new List<string> { "GerenteArea", "CxP" }
                },
                new()
                {
                    ChannelType = "email",
                    RoleNames = new List<string> { "GerenteArea" },
                    ChannelSpecificData = new Dictionary<string, object>
                    {
                        ["cc"] = "auxiliar_pagos@grupolefarma.com.mx"
                    }
                }
            }
        };

        try
        {
            var response = await _notificationService.SendAsync(request);

            _logger.LogInformation("Notificación enviada para gasto {GastoId}: {Results}",
                gastoId,
                string.Join(", ", response.ChannelResults.Select(r => $"{r.Key}={r.Value.Success}")));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enviando notificación para gasto {GastoId}", gastoId);
            // No lanzar la excepción - la notificación no debería fallar el flujo principal
        }
    }

    public async Task NotificarGastoAprobado(int gastoId, int userIdSolicitante, string aprobador)
    {
        var request = new SendNotificationRequest
        {
            Title = "✅ Gasto Aprobado",
            Message = $"""
                <p>Tu solicitud de gasto <strong>#{gastoId}</strong> ha sido aprobada.</p>
                <p>Aprobado por: {aprobador}</p>
                """,
            Type = "success",
            Priority = "normal",
            Category = "gastos",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "email", UserIds = new List<int> { userIdSolicitante } },
                new() { ChannelType = "in-app", UserIds = new List<int> { userIdSolicitante } }
            }
        };

        await _notificationService.SendAsync(request);
    }

    public async Task NotificarGastoRechazado(int gastoId, int userIdSolicitante, string motivo)
    {
        var request = new SendNotificationRequest
        {
            Title = "❌ Gasto Rechazado",
            Message = $"""
                <p>Tu solicitud de gasto <strong>#{gastoId}</strong> ha sido rechazada.</p>
                <p><strong>Motivo:</strong> {motivo}</p>
                """,
            Type = "error",
            Priority = "high",
            Category = "gastos",
            Channels = new List<NotificationChannelRequest>
            {
                new() { ChannelType = "email", UserIds = new List<int> { userIdSolicitante } },
                new() { ChannelType = "in-app", UserIds = new List<int> { userIdSolicitante } }
            }
        };

        await _notificationService.SendAsync(request);
    }
}
```

---

## Referencias

- **Interfaz del servicio**: `Domain/Interfaces/INotificationService.cs`
- **Implementación**: `Features/Notifications/Services/NotificationService.cs`
- **DTOs**: `Features/Notifications/DTOs/NotificationDTOs.cs`
- **Canales**: `Features/Notifications/Services/Channels/`
- **Configuración**: `appsettings.json` (secciones EmailSettings, TelegramSettings)

---

¿Dudas? Revisa los logs del backend para ver detalles sobre el envío de notificaciones.
