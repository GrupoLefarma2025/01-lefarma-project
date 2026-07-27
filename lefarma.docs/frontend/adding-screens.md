# Guía: Agregar pantallas y apps al multi-app Lefarma

Esta guía explica paso a paso cómo agregar pantallas (páginas) a cada app existente (CxP, RH, shell) y cómo crear una app completamente nueva. Todos los ejemplos son copy-paste y reflejan los patrones reales del código.

---

## Tabla de contenidos

1. [Arquitectura de navegación (lectura obligatoria)](#1-arquitectura-de-navegación)
2. [Agregar una pantalla a CxP](#2-agregar-una-pantalla-a-cxp)
3. [Agregar una pantalla a RH](#3-agregar-una-pantalla-a-rh)
4. [Agregar una pantalla al shell](#4-agregar-una-pantalla-al-shell)
5. [Agregar un item al sidebar](#5-agregar-un-item-al-sidebar)
6. [Proteger una pantalla con permisos](#6-proteger-una-pantalla-con-permisos)
7. [Crear una app completamente nueva](#7-crear-una-app-completamente-nueva)
8. [Checklist rápido](#8-checklist-rápido)

---

## 1. Arquitectura de navegación

### Mapa mental

```
BaseAppRoutes (/)
├── /                  → redirect (auth→/hub, unauth→/login)
├── /login             → login global (2-step)
├── /hub               → Home launcher (lista de apps)     ← SHELL
├── /perfil            → Perfil del usuario                ← SHELL
├── /cxp/*             → CxP subtree (Cuentas por Pagar)   ← APP
│   ├── /cxp/login     → login CxP (3-step con empresa/sucursal/area)
│   ├── /cxp/dashboard → dashboard CxP
│   ├── /cxp/catalogos/...
│   └── ...
└── /rh/*              → RH subtree (Recursos Humanos)     ← APP
    ├── /rh/login      → login RH (2-step)
    └── /rh/dashboard  → dashboard RH
```

### Los 3 niveles

| Nivel        | Ruta base  | Archivo de rutas                    | Layout                                         |
| ------------ | ---------- | ----------------------------------- | ---------------------------------------------- |
| **Shell**    | `/`        | `src/apps/baseapp/BaseAppRoutes.tsx` | `MainLayout` con `shellMenuItems`              |
| **CxP**      | `/cxp/`    | `src/apps/cxp/CxpRoutes.tsx`        | `MainLayout` con `cxpMenuItems` + `showContext`|
| **RH**       | `/rh/`     | `src/apps/rh/RhRoutes.tsx`          | `MainLayout` con `rhMenuItems`                 |

### Archivos clave por app

Cada app tiene **3 archivos obligatorios**:

```
src/apps/<app>/
├── <App>Routes.tsx      # Tabla de rutas (usa createAppRoutes factory)
├── menuItems.tsx        # Configuración del sidebar
└── pages/               # (opcional) páginas específicas de la app
```

### La factory `createAppRoutes`

TODA la infraestructura (login, guards, layout, 404, bloqueado) la maneja un solo factory. Las apps solo declaran sus páginas:

```tsx
// Patrón que TODA app sigue:
createAppRoutes({
  appKey: 'cxp',              // identificador
  variant: 'subtree',         // siempre 'subtree' cuando se monta desde BaseAppRoutes
  loginPath,                  // viene de BaseAppRoutes
  requireContextSelection,    // true solo para CxP
  layout: <MainLayout ... />, // layout configurado con menuItems + branding
  routes: (                   // ← AQUI van las páginas
    <>
      <Route path="dashboard" element={<Dashboard />} />
      ...
    </>
  ),
});
```

> **REGLA CRÍTICA**: Los `path` en `routes` son **RELATIVOS** (sin `/` inicial).
> `"dashboard"` dentro de `<Route path="cxp">` se convierte en `/cxp/dashboard`.
> En el `menuItems` los paths son **ABSOLUTOS** (`/cxp/dashboard`).

---

## 2. Agregar una pantalla a CxP

### Step 1: Crear el componente de la página

```
src/pages/MiNuevaPantalla.tsx
```

```tsx
export default function MiNuevaPantalla() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi Pantalla</h1>
      <p className="text-muted-foreground">Contenido aquí.</p>
    </div>
  );
}
```

> **Convención del proyecto**: las páginas compartidas entre apps viven en
> `src/pages/`. Las páginas específicas de una app pueden vivir en
> `src/apps/<app>/pages/` (ej: `src/apps/rh/pages/RhDashboard.tsx`).

### Step 2: Registrar la ruta en `CxpRoutes.tsx`

Abrir `src/apps/cxp/CxpRoutes.tsx`:

```tsx
// 1. Agregar el import arriba:
import MiNuevaPantalla from '@/pages/MiNuevaPantalla';

// 2. Agregar el <Route> dentro del prop `routes`:
routes: (
  <>
    <Route path="dashboard" element={<Dashboard />} />
    {/* ... rutas existentes ... */}

    {/* ← NUEVA RUTA (path RELATIVO, sin /cxp/ inicial) */}
    <Route path="mi-pantalla" element={<MiNuevaPantalla />} />
  </>
),
```

La URL final será `/cxp/mi-pantalla` (React Router compone el prefijo `/cxp/` automáticamente).

### Step 3: Agregar al sidebar de CxP

Abrir `src/apps/cxp/menuItems.tsx`:

```tsx
import { LucideIconDeseada } from 'lucide-react';

export const cxpMenuItems: SidebarMenuItemConfig[] = [
  // ... items existentes ...

  // ← NUEVO ITEM (path ABSOLUTO, con /cxp/ inicial)
  {
    title: 'Mi Pantalla',
    icon: LucideIconDeseada,
    path: '/cxp/mi-pantalla',
  },
];
```

### Resultado

| Archivo tocado                              | Qué cambia                          |
| ------------------------------------------- | ----------------------------------- |
| `src/pages/MiNuevaPantalla.tsx`             | NEW — el componente                 |
| `src/apps/cxp/CxpRoutes.tsx`                | +1 import, +1 `<Route>`             |
| `src/apps/cxp/menuItems.tsx`                | +1 entrada en el array del sidebar  |

---

## 3. Agregar una pantalla a RH

Exactamente el mismo patrón que CxP, pero con archivos de RH:

### Step 1: Crear el componente

```
src/apps/rh/pages/RhEmpleados.tsx
```

```tsx
export function RhEmpleados() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
    </div>
  );
}
```

### Step 2: Registrar la ruta en `RhRoutes.tsx`

Abrir `src/apps/rh/RhRoutes.tsx`:

```tsx
// 1. Import
import { RhEmpleados } from './pages/RhEmpleados';

// 2. Ruta dentro de `routes`:
routes: (
  <>
    <Route path="dashboard" element={<RhDashboard />} />

    {/* ← NUEVA RUTA */}
    <Route path="empleados" element={<RhEmpleados />} />
  </>
),
```

URL final: `/rh/empleados`

### Step 3: Agregar al sidebar

Abrir `src/apps/rh/menuItems.tsx`:

```tsx
import { LayoutDashboard, HelpCircle, Users } from 'lucide-react';

export const rhMenuItems: SidebarMenuItemConfig[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/rh/dashboard' },

  // ← NUEVO ITEM
  { title: 'Empleados', icon: Users, path: '/rh/empleados' },

  { title: 'Ayuda', icon: HelpCircle, path: '/rh/help' },
];
```

---

## 4. Agregar una pantalla al shell

El shell es el nivel raíz (`/hub`, `/perfil`). Las páginas del shell se montan
directamente en `BaseAppRoutes.tsx`, sin la factory.

### Step 1: Crear el componente

```
src/apps/baseapp/Settings.tsx
```

```tsx
export function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
    </div>
  );
}
```

### Step 2: Registrar la ruta en `BaseAppRoutes.tsx`

Abrir `src/apps/baseapp/BaseAppRoutes.tsx`:

```tsx
// 1. Import
import { Settings } from './Settings';

// 2. Agregar la ruta DENTRO del <Route> que usa MainLayout + RequireAuth:
<Route
  element={
    <RequireAuth loginPath="/login">
      <MainLayout
        items={shellMenuItems}
        brandTitle="Grupo Lefarma"
        brandPath="/hub"
      />
    </RequireAuth>
  }
>
  <Route path="/hub" element={<Home />} />
  <Route path="/perfil" element={<Profile />} />
  {/* ← NUEVA RUTA */}
  <Route path="/configuracion" element={<Settings />} />
</Route>
```

> **Nota**: Las rutas del shell usan paths ABSOLUTOS (`/configuracion`) porque
> están en la raíz del route tree, no dentro de un subtree.

### Step 3: Agregar al sidebar del shell

Abrir `src/apps/baseapp/menuItems.tsx`:

```tsx
import { LayoutDashboard, User, Settings } from 'lucide-react';

export const shellMenuItems: SidebarMenuItemConfig[] = [
  { title: 'Inicio', icon: LayoutDashboard, path: '/hub' },
  { title: 'Perfil', icon: User, path: '/perfil' },
  // ← NUEVO ITEM
  { title: 'Configuración', icon: Settings, path: '/configuracion' },
];
```

---

## 5. Agregar un item al sidebar

### Item simple (link directo)

```tsx
{
  title: 'Mi Pantalla',
  icon: FileText,              // cualquier icono de lucide-react
  path: '/cxp/mi-pantalla',    // path ABSOLUTO
}
```

### Item con permiso

```tsx
{
  title: 'Usuarios',
  icon: Users,
  path: '/cxp/seguridad/usuarios',
  permission: { require: 'usuarios.ver_listado' },
}
```

### Item colapsable (grupo con sub-items)

```tsx
{
  title: 'Catálogos',
  icon: Database,
  isCollapsible: true,
  items: [
    { title: 'Empresas', icon: Building, path: '/cxp/catalogos/empresas', permission: { require: 'empresas.ver_listado' } },
    { title: 'Sucursales', icon: Store, path: '/cxp/catalogos/sucursales', permission: { require: 'sucursales.ver_listado' } },
  ],
}
```

### Estructura de tipos

```tsx
// src/components/layout/sidebar-types.ts
interface MenuItem {
  title: string;
  icon: ElementType;                    // componente de lucide-react
  path: string;
  permission?: PermissionCheckOptions;  // opcional
}

interface CollapsibleMenuItem {
  title: string;
  icon: ElementType;
  isCollapsible: true;
  items: MenuItem[];
  permission?: PermissionCheckOptions;
}

type SidebarMenuItemConfig = MenuItem | CollapsibleMenuItem;
```

### Tipos de permiso disponibles

```tsx
permission: { require: 'permiso.especifico' }      // un permiso exacto
permission: { requireAny: ['perm1', 'perm2'] }      // cualquiera de los dos
```

> Si un item tiene `permission` y el usuario no lo cumple, el item **no se
> muestra** en el sidebar. Pero la ruta sigue siendo accesible por URL directa.
> Para bloquear el acceso por URL, ver [sección 6](#6-proteger-una-pantalla-con-permisos).

---

## 6. Proteger una pantalla con permisos

El sidebar oculta items sin permiso, pero **no bloquea el acceso por URL**.
Para bloquear de verdad, envolver la ruta con `<PermissionGuard>`:

### Sin permiso (acceso libre)

```tsx
<Route path="dashboard" element={<Dashboard />} />
```

### Con permiso (bloquea acceso por URL)

```tsx
import { PermissionGuard } from '@/components/auth/PermissionGuard';

<Route
  path="catalogos/proveedores"
  element={
    <PermissionGuard
      blockedPath="/cxp/bloqueado"           // a dónde mandar si no tiene permiso
      requireAny={['proveedores.ver_listado']} // permiso necesario
    >
      <ProveedoresList />
    </PermissionGuard>
  }
/>
```

### Propiedades de PermissionGuard

| Prop         | Tipo       | Descripción                                         |
| ------------ | ---------- | --------------------------------------------------- |
| `require`    | `string`   | Un permiso exacto requerido                         |
| `requireAny` | `string[]` | Cualquiera de los permisos listados es suficiente   |
| `blockedPath`| `string`   | Ruta a la que redirigir si el permiso falla (`/cxp/bloqueado`, `/rh/bloqueado`) |

### Convención de `blockedPath` por app

- CxP: `/cxp/bloqueado`
- RH: `/rh/bloqueado`
- Shell: `/bloqueado`

La factory `createAppRoutes` ya registra automáticamente la ruta `bloqueado`
y la página `BlockedPage` para cada app. Solo necesitas pasar el path correcto.

---

## 7. Crear una app completamente nueva

Ejemplo: crear la app "Inventarios" en `/inv/`.

### Step 1: Registrar la app en el launcher

`src/apps/_registry.ts`:

```tsx
import { ReceiptText, Users, Package } from 'lucide-react';

export const appRegistry: AppRegistryEntry[] = [
  { id: 'cxp', label: 'CxP', path: '/cxp/', description: 'Órdenes de compra', icon: ReceiptText },
  { id: 'rh', label: 'Recursos Humanos', path: '/rh/', description: 'Gestión de personal', icon: Users },
  // ← NUEVA APP
  {
    id: 'inv',
    label: 'Inventarios',
    path: '/inv/',
    description: 'Control de inventario',
    icon: Package,
  },
];
```

> Esto hace que aparezca automáticamente como tile en `/hub`. No hay que tocar
> `Home.tsx` — lee el registry directamente.

### Step 2: Crear la carpeta de la app

```
src/apps/inventario/
├── InventarioRoutes.tsx
├── menuItems.tsx
└── pages/
    └── InventarioDashboard.tsx
```

### Step 3: Crear `menuItems.tsx`

```tsx
import { LayoutDashboard } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

export const inventarioMenuItems: SidebarMenuItemConfig[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/inv/dashboard' },
];
```

### Step 4: Crear `InventarioRoutes.tsx`

```tsx
import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { inventarioMenuItems } from './menuItems';
import { InventarioDashboard } from './pages/InventarioDashboard';

export function InventarioRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  return createAppRoutes({
    appKey: 'inventario',
    variant,
    loginPath,
    requireContextSelection: false,  // true SOLO si necesita empresa/sucursal/area (como CxP)
    layout: (
      <MainLayout
        items={inventarioMenuItems}
        brandTitle="Grupo Lefarma Inventarios"
        brandPath="/inv/dashboard"
      />
    ),
    routes: (
      <>
        <Route path="dashboard" element={<InventarioDashboard />} />
      </>
    ),
  });
}
```

### Step 5: Montar la app en `BaseAppRoutes.tsx`

```tsx
import { InventarioRoutes } from '@/apps/inventario/InventarioRoutes';

// Dentro del <Routes>, después del subtree de RH:
<Route path="inv" element={<Outlet />}>
  {InventarioRoutes({ variant: 'subtree', loginPath: '/inv/login' })}
</Route>
```

### Resultado

- La app aparece como tile en `/hub`
- `/inv/` redirige a `/inv/dashboard` (si auth) o `/inv/login` (si no auth)
- Login usa el flujo global de 2 pasos
- Sidebar con `inventarioMenuItems`
- 404 y bloqueado ya funcionan automágicamente

### Si la nueva app necesita contexto empresa/sucursal/area (como CxP)

```tsx
requireContextSelection: true,   // ← activa el step 3 del login
```

Y agregar la ruta de selección de empresa en `preLayoutRoutes`:

```tsx
preLayoutRoutes: <Route path="select-empresa" element={<SelectEmpresaSucursal />} />,
```

---

## 8. Checklist rápido

### Agregar pantalla a CxP

- [ ] `src/pages/MiPantalla.tsx` — crear componente
- [ ] `src/apps/cxp/CxpRoutes.tsx` — import + `<Route path="mi-pantalla" .../>`
- [ ] `src/apps/cxp/menuItems.tsx` — entrada con path `/cxp/mi-pantalla`
- [ ] (opcional) `<PermissionGuard blockedPath="/cxp/bloqueado" ...>` en la ruta

### Agregar pantalla a RH

- [ ] `src/apps/rh/pages/RhPantalla.tsx` — crear componente
- [ ] `src/apps/rh/RhRoutes.tsx` — import + `<Route path="pantalla" .../>`
- [ ] `src/apps/rh/menuItems.tsx` — entrada con path `/rh/pantalla`
- [ ] (opcional) `<PermissionGuard blockedPath="/rh/bloqueado" ...>` en la ruta

### Agregar pantalla al shell

- [ ] `src/apps/baseapp/MiPantalla.tsx` — crear componente
- [ ] `src/apps/baseapp/BaseAppRoutes.tsx` — `<Route path="/mi-pantalla" .../>` dentro del Route de MainLayout
- [ ] `src/apps/baseapp/menuItems.tsx` — entrada con path `/mi-pantalla`

### Crear app nueva

- [ ] `src/apps/_registry.ts` — agregar entry con `id`, `label`, `path`, `icon`
- [ ] `src/apps/<app>/menuItems.tsx` — configuración del sidebar
- [ ] `src/apps/<app>/<App>Routes.tsx` — tabla de rutas con `createAppRoutes`
- [ ] `src/apps/<app>/pages/` — al menos un dashboard
- [ ] `src/apps/baseapp/BaseAppRoutes.tsx` — montar el subtree con `<Route path="<prefix>" element={<Outlet/>}>`

---

## Reglas de oro

1. **Paths en rutas = RELATIVOS** (`"dashboard"`, no `"/cxp/dashboard"`). La factory compone el prefijo.
2. **Paths en menuItems = ABSOLUTOS** (`"/cxp/dashboard"`). El sidebar usa NavLink que necesita el path completo.
3. **`requireContextSelection: true` es SOLO para CxP.** Todas las demás apps usan `false` (login de 2 pasos).
4. **El sidebar oculta items sin permiso, pero no bloquea la URL.** Usar `<PermissionGuard>` para bloquear de verdad.
5. **La factory maneja TODO el scaffolding.** No crear login, guards, 404, ni bloqueado manualmente — ya están incluidos.
6. **El registry es la única fuente de verdad para el launcher.** Agregar un entry ahí es suficiente para que aparezca en `/hub`.
