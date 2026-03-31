# Plan: Sistema Practico de Permisos — Cablear End-to-End

**Fecha:** 2026-03-30 (corregido 2026-03-31)
**Estado:** Ready

---

## Hallazgo Clave: La infraestructura YA EXISTE al 90%

El sistema de permisos esta construido casi por completo. El problema es que **no esta cableado**. Solo 2 de 29 controllers usan `[HasPermission]`, solo 2 de ~20 rutas tienen PermissionGuard, y el seeder solo tiene 12 de 22 permisos.

### Lo que YA EXISTE y funciona:

| Capa | Componente | Estado |
|------|-----------|--------|
| Backend Attribute | `HasPermissionAttribute` — shortcut para `[Authorize(Policy = "HasPermission_x")]` | Funcional |
| Backend Handler | `PermissionHandler` — lee claims `"permission"` del JWT | Funcional |
| Backend Constants | `Permissions` class — 22 permisos definidos (8 modulos) | Funcional |
| Backend Auto-register | Program.cs itera constants y registra policies automaticamente | Funcional |
| Backend JWT | Login carga permisos del usuario como claims `"permission"` | Funcional |
| Frontend Hook | `usePermission({ require, requireAny, exclude })` | Funcional |
| Frontend Function | `checkPermission(...)` fuera de React | Funcional |
| Frontend UI Guard | `<PermissionGuard>` (components/permissions/) show/hide | Funcional |
| Frontend Route Guard | `<PermissionGuard>` (components/auth/) redirect /bloqueado | Funcional |
| Frontend Sidebar | Filtra items por permiso via `checkPermission` | Funcional |
| Frontend Auth Store | Zustand store con user.permisos del login | Funcional |

### Lo que FALTA (las 3 brechas):

1. **Backend controllers:** Solo Empresas + Sucursales usan `[HasPermission]`. Los otros 12 controllers de Catalogos + Workflows + OrdenesCompra + Auth (usuarios/roles) solo tienen `[Authorize]` (autenticacion, sin permisos).
2. **Seeder:** Solo 12 de 22 permisos estan en el seed (faltan Tesoreria, Comprobaciones, Config, Workflows).
3. **Frontend routes:** Solo 2 rutas de ~20 tienen PermissionGuard (usuarios, roles). Las rutas de catalogos, workflows, configuracion estan sin proteccion.

---

## Task 1: Backend — Aplicar `[HasPermission]` a TODOS los controllers

**Archivos a modificar (12 controllers):**

| Controller | Permiso Clase (GET) | Permiso CUD (POST/PUT/DELETE) |
|-----------|---------------------|-------------------------------|
| `Catalogos/Areas/AreaController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/Gastos/GastosController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/Medidas/MedidasController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/FormasPago/FormasPagoController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/CentrosCosto/CentrosCostoController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/CuentasContables/CuentasContablesController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/EstatusOrden/EstatusOrdenController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/Proveedores/ProveedoresController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/RegimenesFiscales/RegimenesFiscalesController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/Bancos/BancosController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/MediosPago/MediosPagoController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Catalogos/UnidadesMedida/UnidadesMedidaController.cs` | `Permissions.Catalogos.View` | `Permissions.Catalogos.Manage` |
| `Config/Workflows/WorkflowsController.cs` | `Permissions.Workflows.View` | `Permissions.Workflows.Manage` |
| `Auth/Usuarios/UsuariosController.cs` | `Permissions.Usuarios.View` | `Permissions.Usuarios.Manage` |
| `Auth/Roles/RolesController.cs` | `Permissions.Usuarios.View` | `Permissions.Usuarios.Manage` |
| `OrdenesCompra/Captura/OrdenCompraController.cs` | `Permissions.OrdenesCompra.View` | `Permissions.OrdenesCompra.Create/Edit` por accion |
| `OrdenesCompra/Firmas/FirmasController.cs` | `Permissions.OrdenesCompra.Approve` | `Permissions.OrdenesCompra.Approve` |

**Patron (seguir el mismo de EmpresasController/SucursalesController):**

```csharp
[HasPermission(Permissions.Catalogos.View)]  // A nivel clase = GET
public class XController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() { ... }  // Hereda permiso de clase

    [HttpPost]
    [HasPermission(Permissions.Catalogos.Manage)]  // Override a nivel metodo
    public async Task<IActionResult> Create() { ... }
}
```

**No tocar (quedan con `[Authorize]` solo):**
- `AuthController` — login no necesita permisos
- `ProfileController` — perfil propio, cualquier autenticado
- `NotificationsController` — notificaciones propias
- `NotificationStreamController` — SSE propio
- `Help*Controller` — ayuda publica/autenticada
- `SystemConfigController` — TBD
- `ArchivosController` — upload general
- `AdminController` — TBD (si es admin-only, poner `[Authorize(Roles = "Administrador")]`)

**Criterio de aceptacion:**
- Todos los controllers de Catalogos requieren `catalogos.view` para GET y `catalogos.manage` para CUD
- Workflows requiere `workflows.view`/`workflows.manage`
- Usuarios/Roles requiere `usuarios.view`/`usuarios.manage`
- OrdenesCompra requiere permisos por accion
- Un endpoint GET de cualquier catalogo devuelve 403 si el usuario no tiene el permiso
- Los claims del JWT ya traen los permisos (se cargan en login) — no hay query extra

---

## Task 2: Backend — Completar Seeder con Permisos Faltantes

**Archivo a modificar:**
- `Infrastructure/Data/Seeding/DatabaseSeeder.cs`

**Permisos que faltan en el seed (10 nuevos, IDs 13-22):**

| ID | Codigo | Nombre | Categoria |
|----|--------|--------|-----------|
| 13 | `tesoreria.view` | Ver Tesoreria | Tesoreria |
| 14 | `tesoreria.pay` | Realizar Pagos | Tesoreria |
| 15 | `tesoreria.export` | Exportar Tesoreria | Tesoreria |
| 16 | `comprobaciones.view` | Ver Comprobaciones | Comprobaciones |
| 17 | `comprobaciones.create` | Crear Comprobaciones | Comprobaciones |
| 18 | `comprobaciones.validate` | Validar Comprobaciones | Comprobaciones |
| 19 | `config.view` | Ver Configuracion | Config |
| 20 | `config.manage` | Gestionar Configuracion | Config |
| 21 | `workflows.view` | Ver Workflows | Workflows |
| 22 | `workflows.manage` | Gestionar Workflows | Workflows |

**Asignaciones de roles (actualizar `SeedRolePermissionsAsync`):**

| Rol | Permisos adicionales (IDs) |
|-----|---------------------------|
| Capturista (1) | +13 (tesoreria.view), +16 (comprobaciones.view), +19 (config.view) |
| GerenteArea (2) | +13, +16, +19 |
| CxP (3) | +14, +16, +17, +18, +19, +21, +22 |
| GerenteAdmon (4) | +14, +16, +17, +18, +19, +20, +21, +22 |
| DireccionCorp (5) | +14, +16, +17, +18, +19, +20, +21, +22 |
| Tesoreria (6) | +13, +14, +15, +16 |
| AuxiliarPagos (7) | +13, +16 |
| Administrador (8) | +13, +14, +15, +16, +17, +18, +19, +20, +21, +22 (todos) |

**NOTA:** Como el seeder usa `if (await _context.Permisos.AnyAsync()) return;`, los nuevos permisos no se agregaran automaticamente en DBs existentes. Para este plan, solo actualizamos el seeder para nuevas instalaciones. En produccion se puede agregar un migration manual o endpoint de sync.

**Criterio de aceptacion:**
- El seeder crea 22 permisos (12 existentes + 10 nuevos)
- Los 8 roles tienen asignaciones completas
- Administrador tiene TODOS los permisos
- Los roles especificos tienen permisos coherentes con su funcion

---

## Task 3: Frontend — Proteger Rutas con PermissionGuard

**Archivo a modificar:**
- `routes/AppRoutes.tsx`

**Rutas a proteger (aplicar el patron de usuarios/roles que ya existe):**

```tsx
// Catalogos — todos requieren catalogos.view o catalogos.manage
<Route path="/catalogos/empresas" element={
  <PermissionGuard requireAny={['catalogos.view', 'catalogos.manage']}>
    <EmpresasList />
  </PermissionGuard>
} />
// ... (igual para todas las rutas de catalogos)

// Workflows
<Route path="/workflows" element={
  <PermissionGuard requireAny={['workflows.view', 'workflows.manage']}>
    <WorkflowsList />
  </PermissionGuard>
} />
<Route path="/workflows/:id/diagram" element={
  <PermissionGuard require="workflows.manage">
    <WorkflowDiagram />
  </PermissionGuard>
} />

// Configuracion
<Route path="/configuracion" element={
  <PermissionGuard requireAny={['config.view', 'config.manage']}>
    <ConfiguracionGeneral />
  </PermissionGuard>
} />

// Ordenes
<Route path="/ordenes/autorizaciones" element={
  <PermissionGuard require="ordenes.approve">
    <AutorizacionesOC />
  </PermissionGuard>
} />
```

**Rutas que NO necesitan guard:**
- `/dashboard` — cualquier autenticado
- `/seguridad/permisos` — solo lectura, cualquier autenticado (ya sin guard)
- `/perfil` — perfil propio
- `/notificaciones` — propias
- `/help*` — publica
- `/roadmap`, `/demo-components` — interno

**Sidebar — ya funciona:** Los items de Catalogos no tienen permiso individual porque todos usan el mismo `catalogos.view`. Opcionalmente se puede agregar `permission: { requireAny: ['catalogos.view', 'catalogos.manage'] }` al collapsible de Catalogos para ocultar toda la seccion si no tiene ningun permiso de catalogos. Pero no es critico — los endpoints ya protegen, y las rutas redirigen a /bloqueado.

**Criterio de aceptacion:**
- Las 11 rutas de catalogos requieren `catalogos.view` o `catalogos.manage`
- Workflows requiere `workflows.view`/`workflows.manage`
- Configuracion requiere `config.view`/`config.manage`
- Ordenes/Autorizaciones requiere `ordenes.approve`
- Un usuario sin `catalogos.view` que navega a `/catalogos/empresas` es redirigido a `/bloqueado`

---

## Resumen de Esfuerzo

| Tarea | Archivos | Complejidad | Tiempo Est. |
|-------|----------|-------------|-------------|
| Task 1: Aplicar `[HasPermission]` a controllers | ~16 controllers | Baja (patron repetitivo) | 20 min |
| Task 2: Completar seeder con permisos nuevos | 1 archivo | Baja | 10 min |
| Task 3: Proteger rutas frontend | 1 archivo | Baja | 10 min |

**Dependencias:** Task 2 (seeder) → Task 1 (controllers usan permisos que deben existir en DB). Task 3 es independiente.

**Orden sugerido:** Task 2 → Task 1 → Task 3

## Nota Arquitectonica

El sistema es **completamente dinamico**: los permisos se definen en la tabla `Permisos` de la DB, se asignan a roles via `RolesPermisos`, se cargan como claims en el JWT al hacer login, y tanto backend como frontend consultan esos claims. No hay listas hardcodeadas de permisos en la logica de autorizacion — los strings en `Permissions` class son solo constantes para evitar typos, no una lista de verificacion.
