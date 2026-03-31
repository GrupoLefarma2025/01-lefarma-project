# Summary: Sistema Practico de Permisos — Backend Tasks

**Fecha:** 2026-03-31
**Commits:** 2

---

## Task 2: Seeder — 10 permisos nuevos agregados

**Commit:** `55f74aa` — feat: add 10 missing permissions to seeder (tesoreria, comprobaciones, config, workflows)

Se agregaron permisos IDs 13-22:

| ID | Codigo | Nombre |
|----|--------|--------|
| 13 | tesoreria.view | Ver Tesoreria |
| 14 | tesoreria.pay | Realizar Pagos |
| 15 | tesoreria.export | Exportar Tesoreria |
| 16 | comprobaciones.view | Ver Comprobaciones |
| 17 | comprobaciones.create | Crear Comprobaciones |
| 18 | comprobaciones.validate | Validar Comprobaciones |
| 19 | config.view | Ver Configuracion |
| 20 | config.manage | Gestionar Configuracion |
| 21 | workflows.view | Ver Workflows |
| 22 | workflows.manage | Gestionar Workflows |

Asignaciones de roles actualizadas para los 8 roles con los nuevos permisos.

---

## Task 1: Controllers — HasPermission aplicado a 17 controllers

**Commit:** `59c81bc` — feat: apply HasPermission to all controllers (catalogos, workflows, usuarios, roles, ordenes, firmas)

### Catalogos (12 controllers) — `catalogos.view` / `catalogos.manage`
- AreasController, GastosController, MedidasController, FormasPagoController
- CentrosCostoController, CuentasContablesController, ProveedoresController
- RegimenesFiscalesController, BancosController, MediosPagoController, UnidadesMedidaController
- EstatusOrdenController (READ-ONLY, solo `catalogos.view`)

### Config (1 controller) — `workflows.view` / `workflows.manage`
- WorkflowsController (todos los CUD: workflows, pasos, acciones, condiciones, participantes, notificaciones)

### Auth (2 controllers) — `usuarios.view`
- UsuariosController (reemplazo de `[Authorize]` por `[HasPermission]`)
- RolesController (reemplazo de `[Authorize]` por `[HasPermission]`)

### OrdenesCompra (2 controllers)
- OrdenCompraController — class-level `ordenes.view`, POST `ordenes.create`, DELETE `ordenes.delete`
- FirmasController — class-level `ordenes.approve` (todos los endpoints son de firma/aprobacion)

---

## No tocados (correcto segun plan)
- AuthController (login), ProfileController, NotificationsController, NotificationStreamController
- HelpControllers, SystemConfigController, ArchivosController, AdminController

## Verificacion
- Build: 0 errores, 25 warnings (pre-existentes)
- Tests: IntegrationTests 1/1 passed
- Lefarma.Tests tiene error pre-existente (missing `Microsoft.AspNetCore.Mvc.Testing`)
