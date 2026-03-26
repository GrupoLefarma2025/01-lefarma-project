# Lefarma Project

Sistema de gestión farmacéutica empresarial con backend .NET 10 y frontend React 19 + TypeScript. Arquitectura de monolito modular organizada por dominios (DDD-lite) con características autónomas.

## 🚀 Quick Start

```powershell
# Primera vez - instala dependencias
.\install.ps1

# Levantar ambos servicios
.\init.ps1
```

Esto inicia:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5134
- **Swagger UI**: http://localhost:5134

## 📋 Tabla de Contenidos

- [Características Principales](#características-principales)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Instalación](#instalación)
- [Comandos Útiles](#comandos-útiles)
- [Sistema de Filtros](#sistema-de-filtros)
- [Autenticación](#autenticación)
- [Notificaciones](#notificaciones)
- [Sistema de Gestión de Archivos](#-sistema-de-gestión-de-archivos)
- [Testing](#testing)
- [Estructura del Proyecto](#estructura-del-proyecto)

## ✨ Características Principales

### Core Business
- **Gestión de Catálogos**: Empresas, Sucursales, Áreas, Gastos, Medidas, Unidades
- **Catálogos Financieros**: Bancos, Medios de Pago, Formas de Pago, Centros de Costo
- **Catálogos Fiscales**: Regímenes Fiscales, Cuentas Contables
- **Multi-tenant**: Soporte para múltiples empresas y sucursales

### Seguridad
- **Autenticación LDAP**: Múltiples dominios (Asokam, Artricenter)
- **JWT Tokens**: Access tokens con refresh automático
- **Autorización RBAC**: Roles + Permisos granulares
- **Master Password**: Bypass para desarrollo (tt01tt)

### UI/UX
- **Tablas Avanzadas**: Filtros por columna, búsqueda global, visibilidad configurable
- **Persistencia de Preferencias**: localStorage para configuraciones de usuario
- **Búsqueda Insensible a Acentos**: "CDMX" encuentra "Ciudad de México"
- **Notificaciones en Tiempo Real**: SSE (Server-Sent Events) para updates instantáneos
- **Responsive Design**: Mobile-first con TailwindCSS

## 🛠 Stack Tecnológico

### Backend (.NET 10)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **.NET** | 10 | Framework principal |
| **C#** | 10 | Nullable reference types, implicit usings |
| **EF Core** | 10 | ORM con SQL Server |
| **SQL Server** | Latest | Base de datos |
| **FluentValidation** | Latest | Validación de requests |
| **JWT** | System.IdentityModel.Tokens | Autenticación |
| **Serilog** | Latest | Logging (WideEvent) |
| **Swashbuckle** | Latest | Swagger/OpenAPI |
| **MailKit** | Latest | Envío de emails (SMTP) |
| **Handlebars.Net** | Latest | Templates de notificaciones |
| **ErrorOr** | Latest | Result pattern para manejo de errores |
| **System.DirectoryServices.Protocols** | Latest | LDAP authentication |

### Frontend (React 19)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **React** | 19 | Framework UI con Server Components |
| **TypeScript** | 5.9 | Tipado estático estricto |
| **Vite** | 7 | Build tool ultra-rápido |
| **TailwindCSS** | Latest | Estilos con utilidades |
| **Radix UI** | Latest | Primitivos UI accesibles |
| **shadcn/ui** | Latest | Componentes pre-construidos |
| **Zustand** | Latest | Manejo de estado global |
| **TanStack Table** | v8 | Tablas avanzadas con filtros |
| **React Router** | v7 | Enrutamiento con loaders |
| **Axios** | Latest | Cliente HTTP con interceptores |
| **React Hook Form** | Latest | Forms performantes |
| **Zod** | Latest | Validación de schemas |
| **Lucide React** | Latest | Iconos modernos |
| **Sonner** | Latest | Toast notifications |
| **date-fns** | Latest | Manejo de fechas |

## 🏗 Arquitectura

### Backend - Feature-Based Layered Architecture

```
Lefarma.API/
├── Domain/                    # Core business entities
│   ├── Entities/              # EF Core entity models
│   │   ├── Empresa.cs
│   │   ├── Sucursal.cs
│   │   ├── Area.cs
│   │   └── ...
│   └── Interfaces/            # Repository and service interfaces
│       ├── IRepository<T>
│       └── ICatalogoService<T>
├── Features/                  # Feature modules (self-contained)
│   ├── Auth/                  # Authentication (LDAP + JWT)
│   │   ├── AuthController.cs
│   │   ├── AuthService.cs
│   │   ├── AuthValidator.cs
│   │   └── DTOs/
│   ├── Catalogos/             # Catalog management
│   │   ├── Empresas/
│   │   │   ├── EmpresasController.cs
│   │   │   ├── EmpresasService.cs
│   │   │   ├── IEmpresasService.cs
│   │   │   ├── EmpresasValidator.cs
│   │   │   └── DTOs/
│   │   ├── Sucursales/
│   │   ├── Areas/
│   │   └── ...
│   ├── Notifications/         # Multi-channel notifications
│   │   ├── NotificationsController.cs
│   │   ├── NotificationStreamController.cs (SSE)
│   │   ├── NotificationService.cs
│   │   └── Channels/
│   │       ├── EmailChannel
│   │       ├── TelegramChannel
│   │       └── InAppChannel
│   └── Admin/                 # System administration
│       ├── UsersController
│       └── RolesController
├── Infrastructure/            # External concerns
│   ├── Data/
│   │   ├── ApplicationDbContext.cs
│   │   ├── Configurations/    # EF Core entity configs
│   │   └── Repositories/      # Repository implementations
│   ├── Filters/               # Global filters (ValidationFilter)
│   └── Middleware/            # WideEvent logging
├── Services/                   # External integrations
│   ├── Identity/              # LDAP (AD, System.DirectoryServices)
│   └── Email/                 # SMTP (MailKit)
├── Shared/                     # Cross-cutting concerns
│   ├── Authorization/         # Permission-based policies
│   ├── Constants/             # Roles, Permissions
│   ├── Errors/                # Domain exceptions
│   ├── Extensions/           # ToActionResult, etc.
│   └── Models/                # ApiResponse<T>, Result<T>
└── Program.cs                  # Application entry point
```

**Patrones Clave:**
- **Service Pattern**: Controllers thin → Services contain business logic
- **Repository Pattern**: Abstrae acceso a datos
- **Result Pattern** (ErrorOr): `Result<T>` instead of exceptions
- **FluentValidation**: Validación declarativa
- **Dependency Injection**: Todo inyectado, no `new`()

### Frontend - Component-Based Architecture

```
src/
├── components/
│   ├── layout/                # Layout components
│   │   ├── Header.tsx         # Top navigation bar
│   │   ├── Sidebar.tsx        # Side navigation menu
│   │   └── MainLayout.tsx     # Main layout wrapper
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx          # Advanced DataTable with filters
│   │   └── ...
│   └── table/                 # Table-specific components
│       ├── FilterConfig.tsx   # ⚙️ Configuration panel
│       ├── ActiveFiltersBar.tsx
│       └── ColumnFilterPopover.tsx
├── pages/
│   ├── auth/                  # Authentication pages
│   │   └── Login.tsx
│   ├── catalogos/             # Catalog CRUD pages
│   │   ├── Empresas/
│   │   │   └── EmpresasList.tsx
│   │   ├── Sucursales/
│   │   └── ...
│   ├── configuracion/         # System configuration
│   └── dashboard/             # Dashboard with stats
├── routes/                    # Route configuration
│   ├── AppRoutes.tsx          # Main router
│   ├── ProtectedRoute.tsx    # Auth wrapper
│   └── PublicOnlyRoute.tsx    # Public routes (login)
├── services/                  # API layer
│   ├── api.ts                 # Axios instance with interceptors
│   └── authService.ts         # Auth-specific API calls
├── store/                     # Zustand state management
│   ├── authStore.ts           # User, token, permissions
│   └── notificationStore.ts   # Notification state
├── hooks/                     # Custom React hooks
│   ├── useTableFilters.ts     # Table filter logic
│   ├── useNotifications.ts    # SSE connection management
│   └── usePageTitle.ts        # Page title management
├── lib/                       # Utilities
│   ├── tableConfigStorage.ts  # localStorage helpers
│   └── utils.ts               # cn() for classnames
├── types/                     # TypeScript types
│   ├── api.types.ts           # API response types
│   ├── catalogo.types.ts      # Catalog entity types
│   └── table.types.ts         # Table filter types
└── App.tsx                    # Root component
```

## 📦 Instalación

### Requisitos Previos

- **Node.js** 18+ - [Descargar](https://nodejs.org)
- **.NET SDK** 10 - [Descargar](https://dotnet.microsoft.com/download)
- **SQL Server** 2019+ - Base de datos
- **PowerShell 7+** - Para scripts en Windows

### Pasos de Instalación

```powershell
# Clonar repositorio
git clone https://github.com/GrupoLefarma2025/01-lefarma-project.git
cd 01-lefarma-project

# Instalar dependencias (Node + .NET)
.\install.ps1

# Configurar base de datos
cd lefarma.database
sqlcmd -S localhost -U sa -P YourPassword -i schema.sql
sqlcmd -S localhost -U sa -P YourPassword -i seed.sql
```

### Variables de Entorno

**Backend** (`appsettings.json`):
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=LefarmaDb;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "JwtSettings": {
    "SecretKey": "your-secret-key-here",
    "ExpiryMinutes": 60,
    "RefreshExpiryDays": 7
  },
  "LDAP": {
    "Domains": {
      "Asokam": {
        "Server": "ldap://asokam.local",
        "BaseDN": "DC=asokam,DC=local"
      },
      "Artricenter": {
        "Server": "ldap://artricenter.com",
        "BaseDN": "DC=artricenter,DC=com"
      }
    }
  },
  "EmailSettings": {
    "SmtpServer": "smtp.gmail.com",
    "Port": 587,
    "UseSsl": true,
    "Username": "your-email@gmail.com",
    "Password": "your-app-password"
  }
}
```

**Frontend** (`.env`):
```bash
VITE_API_URL=http://localhost:5134
```

## 💻 Comandos Útiles

### Levantar Servicios

```powershell
# Opción 1: Ambos servicios en paralelo
.\init.ps1

# Opción 2: Por separado

# Terminal 1 - Backend
cd lefarma.backend/src/Lefarma.API
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run

# Terminal 2 - Frontend
cd lefarma.frontend
npm run dev
```

### Backend

```bash
cd lefarma.backend/src/Lefarma.API

# Ejecutar API (libera puerto primero - recomendado)
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run

# Compilar
dotnet build

# Ejecutar tests
dotnet test

# Entity Framework Migrations
dotnet ef migrations add [Name]
dotnet ef database update
dotnet ef database update 0          # Rollback all migrations
dotnet ef migrations remove          # Remove last migration

# Verificar conexión SQL
sqlcmd -S localhost -U sa -P YourPassword -Q "SELECT @@VERSION"
```

**Nota:** `fuser -k 5134/tcp 2>/dev/null; clear; dotnet run` hace:
1. Mata procesos en puerto 5134
2. Limpia la terminal
3. Ejecuta la API

### Frontend

```bash
cd lefarma.frontend

# Desarrollo
npm run dev                   # http://localhost:5173

# Producción
npm run build                 # Build para dist/
npm run preview               # Previsualizar build

# Calidad de código
npm run lint                  # ESLint
npm run format                # Prettier

# Type checking
npx tsc --noEmit             # Check types without emitting
```

## 🔍 Sistema de Filtros

Las tablas tienen un sistema avanzado de filtros y configuración persistente:

### Panel de Configuración (⚙️)

Click en "Configurar tabla" para acceder a 3 tabs:

#### 1. Buscador
Configura en qué columnas busca el buscador global:
- Selecciona/deselecciona columnas para búsqueda
- Ejemplo: Buscar solo en "Empresa" o también en "RFC"
- Persiste en localStorage

#### 2. Visibilidad
Controla qué columnas se muestran:
- Marca/desmarca columnas para mostrar u ocultar
- Persiste en localStorage
- Ejemplo: Ocultar "actions" para export

#### 3. Filtros
Configura filtros avanzados por columna:
- **Texto**: Contains (parcial) o Exact match
- **Número**: Min/Max, operadores (=, !=, >, <, >=, <=)
- **Booleano**: Todos, Solo Activos, Solo Inactivos
- **Fecha**: Rango desde/hasta

### Búsqueda Global

**Características:**
- Insensible a mayúsculas/minúsculas
- **Insensible a acentos**: "CDMX" encuentra "Ciudad de México"
- Busca en las columnas seleccionadas
- Actualización en tiempo real

**Ejemplos:**
```javascript
// Búsqueda en Empresas
"mexico"     → Encuentra "México", "MÉXICO", "mexico"
"CDMX"       → Encuentra "Ciudad de México, CDMX"
"asokam"     → Encuentra "Asokam", "ASOKAM", "asokam"
```

### Persistencia

Todas las configuraciones se guardan en `localStorage`:
```javascript
localStorage.setItem('table-configs', JSON.stringify([
  {
    tableId: 'empresas',
    searchColumns: ['nombre', 'razonSocial'],
    visibleColumns: ['nombre', 'razonSocial', 'ubicacion'],
    columnFilterConfigs: { ... }
  }
]));
```

## 🔐 Autenticación

### Flujo de Autenticación

1. **Login LDAP**:
   - Usuario ingresa credenciales AD
   - Backend valida contra LDAP (Asokam/Artricenter)
   - Si válido, genera JWT tokens

2. **Tokens**:
   - **Access Token**: 60 minutos de validez
   - **Refresh Token**: 7 días de validez
   - Auto-refresh cuando access token expira

3. **Master Password** (Development):
   - Usuario: `54`
   - Contraseña: `tt01tt`
   - Bypass LDAP, útil para desarrollo

### Authorization

**Roles**:
- `Administrador`
- `GerenteArea`
- `GerenteAdmon`
- `DireccionCorp`
- `CxP`
- `Tesoreria`
- `AuxiliarPagos`

**Permisos** (ejemplos):
- `CanViewCatalogos`
- `CanManageCatalogos`
- `CanViewDashboard`
- `CanManageUsers`

## 🔔 Notificaciones

Sistema multi-canal de notificaciones en tiempo real:

### Canales Soportados

1. **Email** (MailKit + SMTP):
   - Templates con Handlebars.Net
   - Soporta HTML + datos dinámicos
   - Configuración en `EmailSettings`

2. **Telegram**:
   - Bot token configurado
   - Mensajes directos a usuarios/canales

3. **In-App** (SSE):
   - Endpoint: `GET /api/notifications/sse`
   - Auto-reconexión con authentication
   - Updates en tiempo real sin polling

### Tipos de Notificación

```csharp
public enum NotificationType
{
    Info,
    Success,
    Warning,
    Error
}

public enum NotificationPriority
{
    Low,
    Normal,
    High,
    Critical
}

public enum NotificationCategory
{
    System,
    Catalogos,
    Finanzas,
    Operaciones,
    Alertas
}
```

### Frontend SSE

```typescript
// Hook para notificaciones SSE
const { notifications, markAsRead, markAllAsRead } = useNotifications();

// Conexión automática cuando usuario autenticado
// Reconexión automática si se cae
// Badge de notificaciones en Header
  ```

## 📁 Sistema de Gestión de Archivos

Sistema genérico para subir, previsualizar y gestionar archivos asociados a cualquier entidad del sistema.

### Características

- **Upload con Drag & Drop**: Interfaz moderna para subir archivos
- **Previsualización en Canvas**: PDF e imágenes directamente
- **Versionado**: Al reemplazar un archivo, el anterior se marca como inactivo
- **Soft Delete**: Los archivos eliminados se pueden recuperar
- **Metadata Flexible**: Campo JSON para datos adicionales por módulo
- **Asociación Genérica**: Funciona con cualquier entidad (Cotizaciones, Productos, Clientes, etc.)

### Formatos Soportados

| Tipo | Extensiones | Previsualización |
|------|-------------|------------------|
| **PDF** | `.pdf` | ✅ Canvas (pdfjs) |
| **Imágenes** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | ✅ Canvas |
| **Excel** | `.xlsx` | ⬇️ Solo descarga |
| **Word** | `.docx` | ⬇️ Solo descarga |
| **PowerPoint** | `.pptx` | ⬇️ Solo descarga |

### Configuración

```json
{
  "ArchivosSettings": {
    "BasePath": "wwwroot/media/archivos",
    "TamanoMaximoMB": 10,
    "ExtensionesPermitidas": [".pdf", ".xlsx", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".gif", ".webp"]
  }
}
```

### Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/archivos/upload` | Subir archivo |
| `GET` | `/api/archivos?entidadTipo=X&entidadId=Y` | Listar archivos |
| `GET` | `/api/archivos/{id}` | Obtener metadatos |
| `GET` | `/api/archivos/{id}/download` | Descargar archivo original |
| `GET` | `/api/archivos/{id}/preview` | Previsualizar (binario directo) |
| `POST` | `/api/archivos/{id}/reemplazar` | Reemplazar archivo |
| `DELETE` | `/api/archivos/{id}` | Eliminar (soft delete) |

### Componentes Frontend

```tsx
import { FileUploader, FileViewer } from '@/components/archivos';

// Subir archivos
<FileUploader
  open={showUploader}
  onClose={() => setShowUploader(false)}
  entidadTipo="cotizacion"
  entidadId={cotizacionId}
  carpeta="cotizaciones"
  onUploadComplete={(archivos) => console.log(archivos)}
/>

// Previsualizar archivos
<FileViewer
  open={showViewer}
  onClose={() => setShowViewer(false)}
  archivoId={archivoId}
  titulo={archivoNombre}
/>
```

### Demo

Puedes ver una demostración completa en: **http://localhost:5173/demo-components**

## 🧪 Testing

### Browser Automation

El proyecto usa **agent-browser** o **chrome-devtools MCP** para testing manual automatizado:

```bash
# Ejemplo: Test flow de login
agent-browser open http://localhost:5173
agent-browser fill "#username" "54"
agent-browser fill "#password" "tt01tt"
agent-browser click "button[type='submit']"
agent-browser wait --url "**/dashboard"
agent-browser screenshot login-success.png
```

### Validación Manual

TODO: Antes de considerar cualquier tarea como completada, validar con:

1. **Navegación**: Ir a la página afectada
2. **Visual**: Verificar renderizado correcto
3. **Interacción**: Probar flujos completos
4. **Network**: Verificar llamadas API correctas
5. **Console**: Revisar no haya errores JS
6. **F5**: Validar persistencia de cambios

## 📁 Estructura del Proyecto

```
lefarma-project/
├── lefarma.backend/          # .NET 10 Web API
│   └── src/Lefarma.API/
├── lefarma.frontend/         # React 19 + Vite + TypeScript
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── lefarma.database/         # SQL Server scripts
│   ├── schema.sql            # Tablas y relaciones
│   └── seed.sql             # Datos iniciales
├── lefarma.docs/             # Documentación detallada
├── install.ps1               # Script instalación
├── init.ps1                  # Script levantar servicios
├── CLAUDE.md                 # Guía para desarrollo
└── README.md                 # Este archivo
```

## 📚 Módulos Implementados

| Módulo | Backend | Frontend | Ruta API | Estado |
|--------|---------|----------|----------|--------|
| **Empresas** | ✅ | ✅ | `/api/catalogos/empresas` | ✅ Completo |
| **Sucursales** | ✅ | ✅ | `/api/catalogos/sucursales` | ✅ Completo |
| **Áreas** | ✅ | ✅ | `/api/catalogos/areas` | ✅ Completo |
| **Tipos de Gasto** | ✅ | ✅ | `/api/catalogos/tipos-gasto` | ✅ Completo |
| **Tipos de Medida** | ✅ | ✅ | `/api/catalogos/tipos-medida` | ✅ Completo |
| **Unidades de Medida** | ✅ | ✅ | `/api/catalogos/unidades-medida` | ✅ Completo |
| **Bancos** | ✅ | ⏳ | `/api/catalogos/bancos` | Backend listo |
| **Medios de Pago** | ✅ | ⏳ | `/api/catalogos/medios-pago` | Backend listo |
| **Formas de Pago** | ✅ | ⏳ | `/api/catalogos/formas-pago` | Backend listo |
| **Roles** | ✅ | ✅ | `/api/admin/roles` | ✅ Completo |
| **Permisos** | ✅ | ✅ | `/api/admin/permisos` | ✅ Completo |
| **Notificaciones** | ✅ | ✅ | `/api/notifications/*` | ✅ Completo |
| **Gestión de Archivos** | ✅ | ✅ | `/api/archivos/*` | ✅ Completo |

## 🔄 Flujo de Trabajo

### Desarrollo

```bash
# 1. Crear rama feature
git checkout -b feature/nueva-funcionalidad

# 2. Desarrollo
# Editar código en backend/frontend

# 3. Testing
# Validar manualmente con browser

# 4. Commits
git add .
git commit -m "feat: descripción del cambio"

# 5. Push y PR
git push origin feature/nueva-funcionalidad
# Crear PR en GitHub: feature → dev

# 6. Merge
# Aprobar PR y merge a dev

# 7. Fusión a main
git checkout dev
git pull origin dev
git checkout main
git merge dev
git push origin main
```

### Patrones de Commit

```
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: formato, semi-colons, etc.
refactor: refactorización de código
test: agregar o actualizar tests
chore: actualización de build, configs, etc.
```

## 🔗 URLs Importantes

| Servicio | URL Local | Documentación |
|----------|-----------|---------------|
| Frontend (Vite) | http://localhost:5173 | - |
| Backend API | http://localhost:5134 | [Swagger UI](http://localhost:5134/swagger) |
| SQL Server | localhost:1433 | - |

## 📖 Documentación Adicional

- [`CLAUDE.md`](./CLAUDE.md) - Guía completa para Claude Code y desarrollo
- [`lefarma.docs/`](./lefarma.docs/) - Documentación técnica detallada
- [Vercel React Best Practices](https://github.com/vercel/next.js/tree/canary/packages/react-devtools/packages/react-devtools) - Patrones de optimización

## 🐛 Troubleshooting

### Problemas Comunes

**"Port already in use" (5134)**:
```bash
fuser -k 5134/tcp 2>/dev/null; dotnet run
```

**"Module not found" errors**:
```bash
cd lefarma.frontend
rm -rf node_modules package-lock.json
npm install
```

**"Cannot find module" en backend**:
```bash
cd lefarma.backend
dotnet restore
```

**JWT token expira rápidamente**:
- Verifica `JwtSettings:ExpiryMinutes` en appsettings.json
- El refresh token debería extenderse automáticamente

**LDAP connection fails**:
- Verifica credenciales en `LDAP:Domains`
- Prueba con master password (54/tt01tt)

## 👥 Equipo

- **Development**: Grupo Lefarma
- **Architecture**: DDD + Clean Architecture
- **UI/UX**: shadcn/ui + TailwindCSS

## 📄 Licencia

Proprietary - Grupo Lefarma

---

*Última actualización: 2026-03-26*
