# Lefarma Project Documentation

Documentación completa del proyecto Lefarma - Sistema de gestión para farmacéutica.

## Estructura del Proyecto

```
lefarma-project/
├── lefarma.backend/          # API .NET 10
├── lefarma.frontend/         # React + TypeScript + Vite
├── lefarma.database/         # Scripts de base de datos
└── lefarma.docs/            # Esta documentación
```

## Índice de Documentación

### Documentación General

| Documento | Descripción |
|-----------|-------------|
| [PROJECT.md](./PROJECT.md) | README original del proyecto con overview completo |
| [SPECS.md](./SPECS.md) | Resumen de todas las características construidas |
| [SYSTEM_DOCUMENTATION_PLAN.md](./SYSTEM_DOCUMENTATION_PLAN.md) | Estándar oficial de documentación técnica (Sistemas) |
| [USER_DOCUMENTATION_PLAN.md](./USER_DOCUMENTATION_PLAN.md) | Estándar oficial de documentación para usuarios finales |
| [DOCUMENTATION_PROMPT.md](./DOCUMENTATION_PROMPT.md) | Prompt maestro para ejecutar el plan de documentación |
| [workflow/REQUIREMENTS.md](./workflow/REQUIREMENTS.md) | Requerimientos del sistema |
| [workflow/ROADMAP.md](./workflow/ROADMAP.md) | Roadmap de desarrollo |

### Backend (.NET 10)

| Documento | Descripción |
|-----------|-------------|
| [backend/api-routes.md](./backend/api-routes.md) | Endpoints REST, controladores y rutas |
| [backend/entities.md](./backend/entities.md) | Entidades de dominio y EF Core |
| [backend/services.md](./backend/services.md) | Servicios de negocio e interfaces |
| [backend/dtos.md](./backend/dtos.md) | Objetos de transferencia de datos |

### Frontend (React + TypeScript)

| Documento | Descripción |
|-----------|-------------|
| [frontend/routes.md](./frontend/routes.md) | Sistema de enrutamiento y protección de rutas |
| [frontend/pages.md](./frontend/pages.md) | Páginas y vistas de la aplicación |
| [frontend/components.md](./frontend/components.md) | Componentes reutilizables (UI + Layout) |
| [frontend/services.md](./frontend/services.md) | Servicios API y autenticación |
| [frontend/types.md](./frontend/types.md) | Tipos TypeScript y interfaces |

### Especificaciones Técnicas (specs/)

| Documento | Descripción |
|-----------|-------------|
| [specs/2025-03-20-notification-system-design.md](./specs/2025-03-20-notification-system-design.md) | Sistema de notificaciones multi-canal |
| [specs/2026-03-24-table-filters-design.md](./specs/2026-03-24-table-filters-design.md) | Filtros de tabla |
| [specs/2026-03-25-help-redesign-design.md](./specs/2026-03-25-help-redesign-design.md) | Rediseño del módulo de ayuda |
| [specs/2026-03-25-sistema-gestion-archivos-design.md](./specs/2026-03-25-sistema-gestion-archivos-design.md) | Sistema de gestión de archivos |

### Planes de Implementación (plans/)

| Documento | Descripción |
|-----------|-------------|
| [plans/2025-03-20-notification-system.md](./plans/2025-03-20-notification-system.md) | Plan de implementación del sistema de notificaciones |
| [plans/2025-03-20-formas-pago-catalog.md](./plans/2025-03-20-formas-pago-catalog.md) | Catálogo de formas de pago |
| [plans/2026-03-24-fix-typescript-build-errors.md](./plans/2026-03-24-fix-typescript-build-errors.md) | Corrección de errores de TypeScript |
| [plans/2026-03-24-table-filters.md](./plans/2026-03-24-table-filters.md) | Implementación de filtros de tabla |
| [plans/2026-03-25-help-system.md](./plans/2026-03-25-help-system.md) | Plan del sistema de ayuda |
| [plans/2026-03-25-help-redesign-plan.md](./plans/2026-03-25-help-redesign-plan.md) | Plan de rediseño del sistema de ayuda |
| [plans/2026-03-25-sistema-gestion-archivos-plan.md](./plans/2026-03-25-sistema-gestion-archivos-plan.md) | Plan del sistema de gestión de archivos |
| [plans/2026-03-26-excel-preview-sheetjs.md](./plans/2026-03-26-excel-preview-sheetjs.md) | Preview de Excel con SheetJS |

### Reportes (reports/)

| Documento | Descripción |
|-----------|-------------|
| [reports/verification-report.md](./reports/verification-report.md) | Reporte de verificación |
| [reports/catalogos-comparativo.md](./reports/catalogos-comparativo.md) | Comparativo de catálogos |
| [reports/debugging-sse.md](./reports/debugging-sse.md) | Debugging de SSE |
| [reports/final-status-report.md](./reports/final-status-report.md) | Reporte de estado final |
| [reports/fixes-applied.md](./reports/fixes-applied.md) | Correcciones aplicadas |
| [reports/investigation-summary.md](./reports/investigation-summary.md) | Resumen de investigación |

### Investigación (research/)

| Documento | Descripción |
|-----------|-------------|
| [research/stack.md](./research/stack.md) | Stack tecnológico del proyecto |

### Sistema de Tasks (task/)

La carpeta [`task/`](./task/) contiene los **PRDs y archivos de tareas** para desarrollo de módulos.

| Elemento | Descripción |
|----------|-------------|
| `task/001-sincronizacion-usuario-sse.md` | Sincronización de usuario via SSE |
| `task/021-sistema-gestion-archivos.md` | Sistema de gestión de archivos |

### Planes de Documentación

| Documento | Descripción |
|-----------|-------------|
| [SYSTEM_DOCUMENTATION_PLAN.md](./SYSTEM_DOCUMENTATION_PLAN.md) | Estándar de documentación técnica (Sistemas) |
| [USER_DOCUMENTATION_PLAN.md](./USER_DOCUMENTATION_PLAN.md) | Estándar de documentación para usuarios finales |

### Artículos de Ayuda (articles/)

Artículos en formato HTML listos para el sistema de ayuda.

| Documento | Descripción |
|-----------|-------------|
| [articles/SYSTEM_Catalogos_Generales.html](./articles/SYSTEM_Catalogos_Generales.html) | Documentación técnica de Catálogos (Empresas, Sucursales, Áreas) |
| [articles/SYSTEM_Workflow.html](./articles/SYSTEM_Workflow.html) | Documentación técnica del Motor de Workflows |
| [articles/USER_Catalogos_Lefarma.html](./articles/USER_Catalogos_Lefarma.html) | Manual de usuario integral de TODOS los catálogos |
| [articles/USER_Workflow.html](./articles/USER_Workflow.html) | Guía de configuración de flujos de trabajo (Administradores) |

### Notificaciones (notificaciones/)

Documentación específica del sistema de notificaciones.

| Documento | Descripción |
|-----------|-------------|
| [notificaciones/README.md](./notificaciones/README.md) | Guía del sistema de notificaciones multi-canal |
| [notificaciones/PASOS_PARA_PROBAR.md](./notificaciones/PASOS_PARA_PROBAR.md) | Pasos para verificar el sistema |
| [notificaciones/REPORTE_VALIDACION.md](./notificaciones/REPORTE_VALIDACION.md) | Reporte final de validación |


### Documentación Interna (Documentacion/)

Carpeta con documentación técnica detallada del sistema (NO MODIFICAR).

## Stack Tecnológico

### Backend
- .NET 10 con C# 10
- Entity Framework Core 10
- SQL Server
- FluentValidation
- Serilog (WideEvent logging)
- JWT Authentication
- Swagger/OpenAPI

### Frontend
- React 19
- TypeScript 5
- Vite 7
- TailwindCSS
- Radix UI (shadcn/ui)
- Zustand (estado)
- React Router v7
- Axios
- React Hook Form + Zod

## Comandos de Desarrollo

### Backend
```bash
cd lefarma.backend/src/Lefarma.API
dotnet run
```

### Frontend
```bash
cd lefarma.frontend
npm run dev
```

### Ambos (PowerShell)
```powershell
./init.ps1
```

---

*Última actualización: 2026-03-27*
