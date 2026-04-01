# Frontend

SPA en React 19 + Vite + TailwindCSS — arquitectura feature-based.

## Stack

Tecnologías del frontend.

- **React 19** + TypeScript 5.9
- **Vite 7** — build tool y dev server
- **TailwindCSS 3** — utility-first CSS
- **shadcn/ui** — componentes Radix UI + TailwindCSS

## Estructura

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

## State Management

Gestión de estado global y local.

### Stores (Zustand)

- `authStore.ts` — auth state (token, user, empresa, sucursal)
- `notificationStore.ts` — notifications (in-app, SSE)
- `helpStore.ts` — help articles
- `configStore.ts` — UI config presets
- `pageStore.ts` — page state

### Forms

- **React Hook Form + Zod** — todos los formularios
- Schema validation con Zod
- Resolver: `zodResolver(schema)`

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

- `api.ts` — Axios instance con interceptors
- `authService.ts` — login, logout, refresh
- `notificationService.ts` — notifications API
- `helpService.ts` — help articles API
- `archivoService.ts` — file upload/download
- `systemConfigService.ts` — system config
- `sseService.ts` — Server-Sent Events client

### Axios Interceptors

- JWT auto-attached en todos los requests
- 401 auto-refresh con token rotation
- Timeout: 30s
- Base URL: `VITE_API_URL`

### Error Handling

Manejo de errores específicos.

**403 Forbidden**: Cuando un usuario no tiene permisos para ver un catálogo, se debe manejar explícitamente para evitar que bloquee la carga de otros datos.

**Promise.all vs carga independiente**: Los catálogos esenciales (Empresas, Sucursales, Áreas) se cargan juntos, mientras que los secundarios se cargan de forma independiente para que un error 403 no bloquee la UI completa.

## Components

Componentes clave del frontend.

### Layout

- `MainLayout.tsx` — layout principal con sidebar y header
- `Header.tsx` — header con búsqueda, notifications
- `AppSidebar.tsx` — sidebar con navegación collapsible
- `CambiarUbicacionModal.tsx` — cambiar empresa/sucursal

### Auth

- `PermissionGuard` — wrap para rutas protegidas por permisos
- Verifica roles y permisos del usuario

### Notifications

- `NotificationBell.tsx` — campana con badge de count
- `NotificationList.tsx` — lista de notificaciones
- `RecipientSelector.tsx` — selector de destinatarios
- SSE para real-time updates

### Help

- `TinyMceEditor.tsx` — rich text editor
- `TinyMceViewer.tsx` — viewer para contenido HTML
- `HtmlViewer.tsx` — visor HTML seguro
- `ModuleDialog.tsx` — diálogo de módulos
- `HelpSidebar.tsx` — sidebar de ayuda

### Files

- `FileUploader.tsx` — upload con drag & drop
- `FileViewer.tsx` — viewer para archivos
- `ExcelTable.tsx` — viewer Excel conSheetJS

### Table

- `DataTable` — tabla con sorting, filtering, pagination
- `ColumnFilterPopover.tsx` — filtro por columna
- `ActiveFiltersBar.tsx` — barra de filtros activos
- `FilterConfig.ts` — configuración de filtros

### Config

- `PresetSelector.tsx` — selector de presets de UI
- `AdvancedConfigUI.tsx` — configuración avanzada de UI

### Archivos

Componentes para gestión de archivos.

- `FileUploader.tsx` — upload con drag & drop
- `FileViewer.tsx` — viewer para archivos
- `ExcelTable.tsx` — viewer Excel con SheetJS

### Dev

Componentes de desarrollo.

- `AutoVerify.tsx` — verificación automática

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

## Pages

Páginas principales de la aplicación.

### Auth

- `Login.tsx` — login con 3 pasos (usuario, contraseña, ubicación)
- `SelectEmpresaSucursal.tsx` — selección de empresa/sucursal
- `BlockedPage.tsx` — acceso denegado

### Admin

- `Usuarios/UsuariosList.tsx` — gestión de usuarios
- `Roles/RolesList.tsx` — gestión de roles
- `Permisos/PermisosList.tsx` — gestión de permisos

### Catalogos

- `catalogos/generales/*/` — Empresas, Sucursales, Áreas, etc.

### Configuracion

- `ConfiguracionGeneral.tsx` — configuración general
- `PerfilConfig.tsx` — configuración del perfil
- `SistemaConfig.tsx` — configuración del sistema
- `UIConfig.tsx` — configuración de UI

### Ordenes

- `ordenes/CrearOrdenCompra.tsx` — crear orden de compra
- `ordenes/AutorizacionesOC.tsx` — autorizaciones de OC

### Workflows

- `workflows/WorkflowsList.tsx` — lista de workflows
- `workflows/WorkflowDiagram.tsx` — diagrama de workflow

### Help

- `help/HelpList.tsx` — lista de artículos de ayuda
- `help/HelpView.tsx` — ver artículo
- `help/HelpEditor.tsx` — editor de artículos

### Dashboard

- `Dashboard.tsx` — panel principal

## Types

Definiciones de tipos TypeScript.

### Auth Types

- `auth.types.ts` — UserInfo, Empresa, Sucursal, LoginSteps

### API Types

- `api.types.ts` — ApiResponse, ApiError, PaginatedResponse

### Catalog Types

- `catalogo.types.ts` — Empresa, Sucursal, Area, etc.

### Config Types

- `config.types.ts` — UIConfig, UIPresetId, VisualPreferences

### Notification Types

- `notification.types.ts` — Notification, UserNotification, SendNotificationRequest

### Help Types

- `help.types.ts` — HelpArticle, HelpModule

### File Types

- `archivo.types.ts` — Archivo, ArchivoListItem

### Table Types

- `table.types.ts` — ColumnFilter, FilterType, TableConfig

### Workflow Types

- `workflow.types.ts` — Workflow, WorkflowPaso, Workflow transition

### Order Types

- `ordenCompra.types.ts` — OrdenCompra, OrdenCompraPartida

### Role & Permission Types

- `rol.types.ts` — Rol, RolConUsuarios
- `permiso.types.ts` — Permiso

### User Types

- `usuario.types.ts` — UsuarioDetalle

### SSE Types

- `sse.types.ts` — SseEvent, SseUserInfo

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

// @lat: [[index]]
