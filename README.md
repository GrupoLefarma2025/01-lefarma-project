# Lefarma Project

Sistema de gestión farmacéutica con backend .NET 10 y frontend React/TypeScript. El proyecto sigue una arquitectura de monolito modular organizada en módulos basados en características (feature-based).

## Requisitos Previos

- **Node.js** 18+ - [Descargar](https://nodejs.org)
- **.NET SDK** 10 - [Descargar](https://dotnet.microsoft.com/download)
- **SQL Server** - Base de datos

## Instalación

### Primera vez o si no tienes dependencias

```powershell
.\install.ps1
```

Este script:

- Verifica que tengas Node.js y .NET SDK instalados
- Instala las dependencias del frontend (npm)
- Restaura las dependencias del backend (dotnet)

## Ejecutar el Proyecto

```powershell
.\init.ps1
```

Inicia ambos servicios en paralelo:

| Servicio | URL |
|----------|-----|
| Frontend (Vite) | <http://localhost:5173> |
| Backend API | <http://localhost:5000> |
| Swagger | <http://localhost:5000> |

Presiona `Ctrl+C` para detener ambos servicios.

## Arquitectura

### Backend (.NET 10)

La API sigue una arquitectura en capas basada en features:

```
Lefarma.API/
├── Domain/           # Entidades de negocio e interfaces
│   ├── Entities/     # Entidades EF Core
│   └── Interfaces/   # Interfaces de repositorios
├── Features/         # Módulos (Controllers, Services, DTOs, Validators)
│   └── Catalogos/    # Feature de catálogos
│       └── [Feature]/
│           ├── [Feature]Controller.cs
│           ├── [Feature]Service.cs
│           ├── I[Feature]Service.cs
│           ├── [Feature]Validator.cs
│           └── DTOs/
├── Infrastructure/   # Acceso a datos e infraestructura
│   └── Data/
│       ├── ApplicationDbContext.cs
│       ├── Configurations/  # Configuraciones EF Core
│       └── Repositories/    # Implementaciones de repositorios
├── Shared/           # Concerns transversales
│   ├── Exceptions/   # BusinessException
│   ├── Models/       # ApiResponse<T>
│   └── Extensions/   # Métodos de extensión
├── Filters/          # Filtros globales (ExceptionFilter)
└── Validators/       # Validadores compartidos
```

### Frontend (React + TypeScript)

```
src/
├── components/
│   ├── layout/       # Header, Sidebar, MainLayout
│   └── ui/           # Componentes estilo shadcn/ui
├── pages/
│   ├── auth/         # Login
│   ├── catalogos/    # Páginas de catálogos
│   └── configuracion/
├── routes/           # AppRoutes, PrivateRoute, PublicRoute
├── services/         # Cliente API (api.ts, authService.ts)
├── store/            # Stores de Zustand (authStore.ts)
├── hooks/            # Hooks personalizados (use-toast.ts)
├── types/            # Tipos TypeScript
├── lib/              # Utilidades (utils.ts)
└── App.tsx
```

## Stack Tecnológico

### Backend

| Tecnología | Uso |
|------------|-----|
| .NET 10 | Framework principal |
| C# 10 | Lenguaje (nullable reference types, implicit usings) |
| Entity Framework Core 10 | ORM con SQL Server |
| FluentValidation | Validación de requests |
| JWT | Autenticación configurada |
| Serilog | Logging (WideEvent) |
| Swashbuckle | Swagger/OpenAPI |

### Frontend

| Tecnología | Uso |
|------------|-----|
| React 19 | Framework UI |
| TypeScript | Tipado estático |
| Vite 7 | Build tool |
| TailwindCSS | Estilos (con tailwind-merge y clsx) |
| Radix UI | Primitivos UI (shadcn/ui style) |
| Zustand | Manejo de estado |
| React Router v7 | Enrutamiento |
| Axios | Cliente HTTP |
| React Hook Form + Zod | Formularios y validación |
| date-fns | Manejo de fechas |
| Lucide React | Iconos |
| react-hot-toast | Notificaciones |

## Módulos Backend (Catálogos)

| Módulo | Descripción | Ruta API |
|--------|-------------|----------|
| **Empresas** | Gestión de empresas del sistema | `api/catalogos/empresas` |
| **Sucursales** | Sucursales por empresa | `api/catalogos/sucursales` |
| **Áreas** | Áreas departamentales | `api/catalogos/areas` |
| **Tipos de Gasto** | Clasificación de gastos contables | `api/catalogos/tipos-gasto` |
| **Tipos de Medida** | Categorías de unidades (Longitud, Peso, etc.) | `api/catalogos/tipos-medida` |
| **Unidades de Medida** | Unidades específicas (Metro, kg, Litro, etc.) | `api/catalogos/unidades-medida` |

## Páginas Frontend

| Página | Ruta | Descripción |
|--------|------|-------------|
| **Login** | `/login` | Autenticación de usuarios |
| **Dashboard** | `/` | Página principal con estadísticas |
| **Perfil** | `/perfil` | Información del usuario actual |
| **Roles** | `/catalogos/roles` | Gestión de roles (en construcción) |
| **Permisos** | `/catalogos/permisos` | Gestión de permisos (en construcción) |
| **Configuración General** | `/configuracion` | Configuración del sistema |

## Componentes UI

Componentes disponibles estilo shadcn/ui:

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| Button | `button.tsx` | Botones con variantes |
| Card | `card.tsx` | Contenedores tipo tarjeta |
| Dialog | `dialog.tsx` | Modales y diálogos |
| Dropdown Menu | `dropdown-menu.tsx` | Menús desplegables |
| Form | `form.tsx` | Wrapper para formularios |
| Input | `input.tsx` | Campos de texto |
| Label | `label.tsx` | Etiquetas de formulario |
| Select | `select.tsx` | Selectores/dropdowns |
| Table | `table.tsx` | Tablas de datos |
| Toast | `toast.tsx` | Notificaciones |
| Toaster | `toaster.tsx` | Contenedor de toasts |
| Tooltip | `tooltip.tsx` | Tooltips informativos |

## Estructura del Proyecto

```text
lefarma-project/
├── lefarma.backend/          # API .NET 10
│   └── src/Lefarma.API/      # Proyecto principal
├── lefarma.frontend/         # Frontend React + Vite
├── lefarma.database/         # Scripts de base de datos
├── lefarma.docs/             # Documentación detallada
├── install.ps1               # Script de instalación
└── init.ps1                  # Script para levantar el proyecto
```

## Comandos Útiles

### Backend

```bash
cd lefarma.backend/src/Lefarma.API

# Ejecutar API (recomendado: libera puerto primero)
fuser -k 5000/tcp 2>/dev/null; clear; dotnet run

# Otros comandos
dotnet build                  # Compilar
dotnet test                   # Ejecutar tests
dotnet ef migrations add Name # Crear migración
dotnet ef database update     # Aplicar migraciones
```

**Nota:** El comando `fuser -k 5000/tcp 2>/dev/null; clear; dotnet run` hace 3 cosas en uno:
1. **Elimina cualquier proceso usando el puerto 5000** (evita error "port already in use")
2. **Limpia la terminal** (clear)
3. **Ejecuta la API** (dotnet run)

### Frontend

```bash
cd lefarma.frontend
npm run dev                   # Desarrollo
npm run build                 # Producción
npm run lint                  # Linter
npm run format                # Formatear código
```

## Documentación

Para información más detallada, consulta la documentación en [`lefarma.docs/`](lefarma.docs/):

### Backend

- [API Routes](lefarma.docs/backend/api-routes.md) - Endpoints REST y controladores
- [Entities](lefarma.docs/backend/entities.md) - Entidades de dominio y EF Core
- [Services](lefarma.docs/backend/services.md) - Servicios de negocio
- [DTOs](lefarma.docs/backend/dtos.md) - Objetos de transferencia de datos

### Frontend

- [Routes](lefarma.docs/frontend/routes.md) - Sistema de enrutamiento
- [Pages](lefarma.docs/frontend/pages.md) - Páginas y vistas
- [Components](lefarma.docs/frontend/components.md) - Componentes reutilizables
- [Services](lefarma.docs/frontend/services.md) - Cliente API y autenticación
- [Types](lefarma.docs/frontend/types.md) - Tipos TypeScript

### Desarrollo

- [Task System](lefarma.docs/task/README.md) - Sistema de tareas y PRDs
- [CLAUDE.md](CLAUDE.md) - Guía para Claude Code y desarrollo

## Patrones Clave

### Formato de Respuesta API

Todos los endpoints retornan `ApiResponse<T>`:

```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }
}
```

### Configuración API

- **Base URL**: `http://localhost:5000`
- **Swagger**: Disponible en Development
- **CORS**: Permite `http://localhost:5173`

### Estado en Frontend

- **Auth**: Zustand store (`authStore.ts`)
- **API Client**: Axios con interceptores para JWT
- **Forms**: React Hook Form + Zod resolvers
- **UI**: Radix UI primitives con TailwindCSS

---

*Última actualización: 2026-02-25*
