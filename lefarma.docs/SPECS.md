# Lefarma - Resumen de Características Construidas

Este documento resume todas las características implementadas en el proyecto Lefarma.

## Módulos de Catálogos

### Catálogos Generales

| Módulo | Descripción | Estado |
|--------|-------------|--------|
| **Empresas** | Gestión de empresas del sistema | Implementado |
| **Sucursales** | Sucursales por empresa | Implementado |
| **Áreas** | Áreas de la organización | Implementado |
| **Tipos de Gasto** | Clasificación de gastos | Implementado |
| **Estatus de Orden** | Estados de órdenes | Implementado |
| **Formas de Pago** | Métodos de pago disponibles | Implementado |
| **Proveedores** | Registro de proveedores | Implementado |

### Características Comunes de Catálogos

- CRUD completo (Crear, Leer, Actualizar, Eliminar)
- Validación con FluentValidation (backend) y Zod (frontend)
- Búsqueda y filtrado en tablas
- Paginación y ordenamiento
- Soft delete para preservar integridad referencial
- Normalización de textos para búsqueda insensible a acentos

## Sistema de Autenticación

| Característica | Descripción |
|---------------|-------------|
| **Login 2 pasos** | Autenticación con dominio + credenciales |
| **JWT Tokens** | Access token + Refresh token |
| **Protección de rutas** | PrivateRoute y PublicRoute components |
| **Auto-verificación** | Verificación automática de token al cargar |
| **Zustand Store** | Estado global de autenticación |

## Sistema de Notificaciones Multi-Canal

### Canales Soportados

| Canal | Descripción |
|-------|-------------|
| **Email** | Via SMTP (MailKit) |
| **In-App** | Server-Sent Events (SSE) en tiempo real |
| **Telegram** | Bot API de Telegram |

### Características

- Strategy Pattern con canales intercambiables
- Templates Razor para personalización de mensajes
- Persistencia completa en base de datos
- Notificaciones por rol o usuario específico
- Badge de notificaciones no leídas en header

### Base de Datos

- `Notifications` - Registro de notificaciones
- `NotificationChannels` - Estado por canal
- `UserNotifications` - Tracking de lectura por usuario
- `NotificationRecipients` - Destinatarios configurados

## Sistema de Gestión de Archivos

### Características

| Característica | Descripción |
|---------------|-------------|
| **Upload** | Subida de archivos con metadata |
| **Preview** | Previsualización de PDFs e imágenes |
| **Conversión** | Office a PDF via LibreOffice headless |
| **Versionado** | Reemplazo con historial |
| **Soft Delete** | Archivos marcados como inactivos |

### Formatos Soportados

- **Documentos**: PDF, DOCX, XLSX, PPTX
- **Imágenes**: JPG, PNG, GIF, WEBP

### Arquitectura

- Entidad genérica `Archivo` con `EntidadTipo` y `EntidadId`
- Repositorio con filtros por entidad
- Servicio de conversión con LibreOffice
- Frontend con canvas para preview

## Módulo de Ayuda (Help)

### Características

| Característica | Descripción |
|---------------|-------------|
| **Artículos** | CRUD de artículos de ayuda |
| **Editor Rico** | Lexical editor con toolbar |
| **Módulos** | Organización por módulo del sistema |
| **Tipos** | Usuario, Desarrollador, Ambos |
| **Categorías** | Clasificación temática |

### Editor Lexical

- Toolbar con formateo de texto
- Listas ordenadas y no ordenadas
- Encabezados (H1-H4)
- Links y código
- Soporte de imágenes (en desarrollo)

## Sistema de Logging (WideEvent)

### Características

| Característica | Descripción |
|---------------|-------------|
| **Serilog** | Logging estructurado |
| **WideEvent** | Eventos de negocio enriquecidos |
| **Contexto** | Usuario, entidad, acción |
| **Persistencia** | Logs en base de datos |

## Frontend - Componentes UI

### Componentes de Layout

| Componente | Descripción |
|------------|-------------|
| `Header` | Barra superior con usuario y notificaciones |
| `Sidebar` | Navegación lateral con menús |
| `MainLayout` | Layout principal con routing |

### Componentes de UI (shadcn/ui style)

| Componente | Descripción |
|------------|-------------|
| `Button` | Botones con variantes |
| `Dialog/Modal` | Modales y diálogos |
| `DataTable` | Tabla con TanStack Table |
| `Form` | Formularios con React Hook Form |
| `Badge` | Badges de estado |
| `Input` | Campos de entrada |
| `Select` | Selectores |
| `Toast` | Notificaciones toast |

## Patrones de Arquitectura

### Backend

| Patrón | Implementación |
|--------|----------------|
| **Feature-based** | Organización por módulo de negocio |
| **Repository** | Abstracción de acceso a datos |
| **Service Layer** | Lógica de negocio en servicios |
| **ErrorOr** | Manejo funcional de errores |
| **ApiResponse** | Estandarización de respuestas |

### Frontend

| Patrón | Implementación |
|--------|----------------|
| **Zustand** | Estado global (auth, notificaciones) |
| **React Query pattern** | Cache de datos via axios |
| **Compound Components** | Componentes composables |
| **Hooks personalizados** | usePageTitle, useNotificationStream |

## API Response Format

Todas las endpoints retornan `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... },
  "errors": null
}
```

## Endpoints por Módulo

| Módulo | Prefix | Descripción |
|--------|--------|-------------|
| Auth | `/api/auth` | Autenticación |
| Catálogos | `/api/catalogos` | CRUD de catálogos |
| Notificaciones | `/api/notifications` | Sistema de notificaciones |
| Archivos | `/api/archivos` | Gestión de archivos |
| Help | `/api/help` | Artículos de ayuda |

## Próximas Características (Roadmap)

1. **Help Module Redesign** - Rediseño completo del módulo de ayuda
2. **Table Filters** - Filtros avanzados en tablas
3. **Excel Preview** - Previsualización de Excel con SheetJS
4. **Búsqueda Global** - Búsqueda en todos los módulos
5. **Dashboard** - Panel de control con métricas

---

*Documento generado automáticamente - Última actualización: 2026-03-27*
