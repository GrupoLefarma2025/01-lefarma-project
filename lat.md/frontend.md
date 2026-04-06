# Frontend

SPA en React 19 + Vite + TailwindCSS — arquitectura feature-based.

## Frontend

Descripción general del frontend SPA.

### Stack

Tecnologías del frontend.

- **React 19** + TypeScript 5.9
- **Vite 7** — build tool y dev server
- **TailwindCSS 3** — utility-first CSS
- **shadcn/ui** — componentes Radix UI + TailwindCSS

### Estructura

Organización de carpetas del proyecto.

```
src/
├── components/
│   ├── ui/           # shadcn/ui primitives
│   ├── layout/       # Header, Sidebar, MainLayout
│   ├── table/        # DataTable, filters, column filter
│   ├── notifications/ # NotificationBell, NotificationList
│   ├── help/         # TinyMCE editor, HtmlViewer
│   ├── archivos/     # FileUploader, FileViewer, ExcelTable
│   ├── config/       # PresetSelector, AdvancedConfigUI
│   └── auth/         # PermissionGuard
├── pages/
│   ├── auth/         # Login, SelectEmpresaSucursal, BlockedPage
│   ├── admin/        # Usuarios, Roles, Permisos
│   ├── catalogos/    # Empresas, Gastos, Sucursales, etc.
│   ├── configuracion/ # PerfilConfig, SistemaConfig, UIConfig
│   ├── workflows/    # WorkflowsList, WorkflowDiagram
│   ├── ordenes/      # CrearOrdenCompra, AutorizacionesOC
│   └── help/         # HelpList, HelpView, HelpEditor
├── routes/           # AppRoutes, PrivateRoute, PublicRoute
├── services/        # API clients (Axios)
├── store/            # Zustand stores
├── hooks/            # Custom hooks
├── types/            # Type definitions
├── lib/              # Utils (cn() helper)
└── constants/        # App constants
```

### State Management

Gestión de estado global y local.

### Stores (Zustand)

Zustand stores para gestión de estado global — auth, notifications, help, config.

- `authStore.ts` — auth state (token, user, empresa, sucursal)
- `notificationStore.ts` — notifications (in-app, SSE)
- `helpStore.ts` — help articles
- `configStore.ts` — UI config presets
- `pageStore.ts` — page state

### Forms

React Hook Form con Zod para validación de formularios en toda la aplicación.

- **React Hook Form + Zod** — todos los formularios
- Schema validation con Zod
- Resolver: `zodResolver(schema)`

---

## Routing

Configuración de rutas y guards.

- `AppRoutes.tsx` — todas las rutas de la app
- `PrivateRoute.tsx` — requiere auth
- `PublicRoute.tsx` — solo no-auth (login)
- `LandingRoute.tsx` — landing page
- `PermissionGuard` — verificación de permisos

## API Integration

Integración con el backend.

### Services

Servicios API basados en Axios para comunicación con el backend.

- `api.ts` — Axios instance con interceptors
- `authService.ts` — login, logout, refresh
- `notificationService.ts` — notifications API
- `helpService.ts` — help articles API
- `archivoService.ts` — file upload/download
- `systemConfigService.ts` — system config
- `sseService.ts` — Server-Sent Events client

### Axios Interceptors

Configuración de interceptors para JWT y manejo de errores 401/403.

- JWT auto-attached en todos los requests
- 401 auto-refresh con token rotation
- Timeout: 30s
- Base URL: `VITE_API_URL`

### Error Handling

Manejo de errores específicos.

**403 Forbidden**: Cuando un usuario no tiene permisos para ver un catálogo, se debe manejar explícitamente para evitar que bloquee la carga de otros datos.

**Promise.all vs carga independiente**: Los catálogos esenciales (Empresas, Sucursales, Áreas) se cargan juntos, mientras que los secundarios se cargan de forma independiente para que un error 403 no bloquee la UI completa.

---

## Components

Componentes clave del frontend.

### Layout

Componentes de layout principal — header, sidebar y estructura de páginas.

- `MainLayout.tsx` — layout principal con sidebar y header
- `Header.tsx` — header con búsqueda, notifications
- `AppSidebar.tsx` — sidebar con navegación collapsible
- `CambiarUbicacionModal.tsx` — cambiar empresa/sucursal

### Auth

Componentes de autenticación y autorización — PermissionGuard para rutas.

- `PermissionGuard` — wrap para rutas protegidas por permisos
- Verifica roles y permisos del usuario

### Notifications

Componentes de notificaciones — bell, lista y selector de destinatarios.

- `NotificationBell.tsx` — campana con badge de count
- `NotificationList.tsx` — lista de notificaciones
- `RecipientSelector.tsx` — selector de destinatarios
- SSE para real-time updates

### Help

Componentes del sistema de ayuda — editor TinyMCE, viewer HTML y sidebar.

- `TinyMceEditor.tsx` — rich text editor
- `TinyMceViewer.tsx` — viewer para contenido HTML
- `HtmlViewer.tsx` — visor HTML seguro
- `ModuleDialog.tsx` — diálogo de módulos
- `HelpSidebar.tsx` — sidebar de ayuda

### Files

Componentes para gestión de archivos — upload, viewer y preview de Excel.

- `FileUploader.tsx` — upload con drag & drop
- `FileViewer.tsx` — viewer para archivos
- `ExcelTable.tsx` — viewer Excel conSheetJS

### Table

Componentes de tablas — DataTable con sorting, filtering y pagination.

- `DataTable` — tabla con sorting, filtering, pagination
- `ColumnFilterPopover.tsx` — filtro por columna
- `ActiveFiltersBar.tsx` — barra de filtros activos
- `FilterConfig.ts` — configuración de filtros

### Config

Componentes de configuración de UI — preset selector y configuración avanzada.

- `PresetSelector.tsx` — selector de presets de UI
- `AdvancedConfigUI.tsx` — configuración avanzada de UI

### Archivos

Componentes para gestión de archivos — upload, viewer y Excel.

- `FileUploader.tsx` — upload con drag & drop
- `FileViewer.tsx` — viewer para archivos
- `ExcelTable.tsx` — viewer Excel con SheetJS

### Dev

Componentes de desarrollo — AutoVerify para verificación automática.

- `AutoVerify.tsx` — verificación automática

---

## Hooks

Custom hooks del frontend.

- `usePageTitle` — set page title
- `usePermission` — check permissions
- `useNotifications` — notifications hook
- `useUserSync` — sync user data
- `useTokenRefresh` — auto-refresh JWT
- `useMobile` — detect mobile
- `useTableFilters` — table filters state

## Lib

Utilidades y helpers.

- `utils.ts` — función cn() para className
- `tableConfigStorage.ts` — persistencia de config de tablas

---

## Pages

Páginas principales de la aplicación.

### Auth

Páginas de autenticación — login, selección de empresa/sucursal y acceso denegado.

- `Login.tsx` — login con 3 pasos (usuario, contraseña, ubicación)
- `SelectEmpresaSucursal.tsx` — selección de empresa/sucursal
- `BlockedPage.tsx` — acceso denegado

### Admin

Páginas de administración — gestión de usuarios, roles y permisos.

- `Usuarios/UsuariosList.tsx` — gestión de usuarios
- `Roles/RolesList.tsx` — gestión de roles
- `Permisos/PermisosList.tsx` — gestión de permisos

### Catalogos

Páginas de catálogos generales — empresas, sucursales, áreas, proveedores, etc.

- `catalogos/generales/*/` — Empresas, Sucursales, Áreas, etc.

### Configuracion

Páginas de configuración — perfil, sistema y UI.

- `ConfiguracionGeneral.tsx` — configuración general
- `PerfilConfig.tsx` — configuración del perfil
- `SistemaConfig.tsx` — configuración del sistema
- `UIConfig.tsx` — configuración de UI

### Ordenes

Páginas de órdenes de compra — creación y autorizaciones.

- `ordenes/CrearOrdenCompra.tsx` — crear orden de compra
- `ordenes/AutorizacionesOC.tsx` — autorizaciones de OC

### Workflows

Páginas de workflows — lista y diagrama de workflows.

- `workflows/WorkflowsList.tsx` — lista de workflows
- `workflows/WorkflowDiagram.tsx` — diagrama de workflow

### Help

Páginas del centro de ayuda — lista, vista y editor de artículos.

- `help/HelpList.tsx` — lista de artículos de ayuda
- `help/HelpView.tsx` — ver artículo
- `help/HelpEditor.tsx` — editor de artículos

### Dashboard

Página principal del dashboard.

- `Dashboard.tsx` — panel principal

---

## Types

Definiciones de tipos TypeScript.

### Auth Types

Tipos para autenticación — UserInfo, Empresa, Sucursal, LoginSteps.

- `auth.types.ts` — UserInfo, Empresa, Sucursal, LoginSteps

### API Types

Tipos para respuestas y errores de API — ApiResponse, ApiError, PaginatedResponse.

- `api.types.ts` — ApiResponse, ApiError, PaginatedResponse

### Catalog Types

Tipos para catálogos — Empresa, Sucursal, Area, Proveedor, etc.

- `catalogo.types.ts` — Empresa, Sucursal, Area, etc.

### Config Types

Tipos para configuración de UI — UIConfig, UIPresetId, VisualPreferences.

- `config.types.ts` — UIConfig, UIPresetId, VisualPreferences

### Notification Types

Tipos para notificaciones — Notification, UserNotification, SendNotificationRequest.

- `notification.types.ts` — Notification, UserNotification, SendNotificationRequest

### Help Types

Tipos para el sistema de ayuda — HelpArticle, HelpModule.

- `help.types.ts` — HelpArticle, HelpModule

### File Types

Tipos para gestión de archivos — Archivo, ArchivoListItem.

- `archivo.types.ts` — Archivo, ArchivoListItem

### Table Types

Tipos para tablas — ColumnFilter, FilterType, TableConfig.

- `table.types.ts` — ColumnFilter, FilterType, TableConfig

### Workflow Types

Tipos para workflows — Workflow, WorkflowPaso, Workflow transition.

- `workflow.types.ts` — Workflow, WorkflowPaso, Workflow transition

### Order Types

Tipos para órdenes de compra — OrdenCompra, OrdenCompraPartida.

- `ordenCompra.types.ts` — OrdenCompra, OrdenCompraPartida

### Role & Permission Types

Tipos para roles y permisos — Rol, RolConUsuarios, Permiso.

- `rol.types.ts` — Rol, RolConUsuarios
- `permiso.types.ts` — Permiso

### User Types

Tipos para usuarios — UsuarioDetalle.

- `usuario.types.ts` — UsuarioDetalle

### SSE Types

Tipos para Server-Sent Events — SseEvent, SseUserInfo.

- `sse.types.ts` — SseEvent, SseUserInfo

---

## Entry Points

Puntos de entrada de la aplicación.

- `main.tsx` — React entry
- `App.tsx` — Router, toast, auth init

## Key Files

Archivos clave del frontend.

- `src/App.tsx` — main app component
- `src/main.tsx` — React entry point
- `src/store/authStore.ts` — Zustand auth store
- `src/services/api.ts` — Axios instance
