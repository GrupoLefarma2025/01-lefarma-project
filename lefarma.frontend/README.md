# Lefarma Frontend

Plataforma multi-app de Grupo Lefarma. React 19 + Vite 7 + TypeScript + shadcn/ui.

## Comandos

```bash
npm run dev      # Dev server (puerto 5173)
npm run build    # Build producción
npm run lint     # ESLint
npm run format   # Prettier
```

El backend corre aparte en el puerto **5174**. Vite proxyea `/api` → `http://localhost:5174`.

## Stack

- **React 19** + Vite 7 + TypeScript 5.9
- **shadcn/ui** (Radix UI) + Tailwind CSS
- **React Router 7** (function-call pattern, NO JSX)
- **Zustand** (estado global + persist en localStorage)
- **React Hook Form + Zod** (formularios)
- **TanStack Table** (tablas de datos)
- **lucide-react** (iconos)
- Alias `@` → `src/`

## Arquitectura multi-app

```
BaseAppRoutes (/)
├── /                  → redirect (auth→/hub, unauth→/login)
├── /login             → login global (2-step)
├── /hub               → Home launcher (lista de apps)     ← SHELL
├── /perfil            → Perfil del usuario                ← SHELL
├── /cxp/*             → CxP (Cuentas por Pagar)           ← APP
└── /rh/*              → RH (Recursos Humanos)             ← APP
```

Cada app tiene 3 archivos:

| Archivo                   | Rol                                                |
| ------------------------- | -------------------------------------------------- |
| `src/apps/<app>/<App>Routes.tsx` | Tabla de rutas (usa `createAppRoutes` factory) |
| `src/apps/<app>/menuItems.tsx`   | Configuración del sidebar                       |
| `src/apps/_registry.ts`          | Registro estático — fuente de verdad del launcher |

### Cómo agregar pantallas

> **Guía completa:** [`lefarma.docs/frontend/adding-screens.md`](../lefarma.docs/frontend/adding-screens.md)

**Agregar pantalla a CxP:**

1. Crear `src/pages/MiPantalla.tsx`
2. `src/apps/cxp/CxpRoutes.tsx` → import + `<Route path="mi-pantalla" element={<MiPantalla />} />`
3. `src/apps/cxp/menuItems.tsx` → `{ title: 'Mi Pantalla', icon: MiIcono, path: '/cxp/mi-pantalla' }`

**Agregar pantalla a RH:** mismo patrón, archivos en `src/apps/rh/`.

**Agregar pantalla al shell:** ruta directa en `BaseAppRoutes.tsx`, item en `src/apps/baseapp/menuItems.tsx`.

**Crear app nueva:**

1. `src/apps/_registry.ts` → agregar entry (aparece solo en `/hub`)
2. Crear `src/apps/<app>/` con `<App>Routes.tsx` + `menuItems.tsx`
3. `BaseAppRoutes.tsx` → montar el subtree

### Reglas críticas

1. **Paths en `<Route>` = RELATIVOS** (`"dashboard"`). La factory compone el prefijo `/cxp/`.
2. **Paths en menuItems = ABSOLUTOS** (`"/cxp/dashboard"`). El sidebar usa NavLink completo.
3. **`requireContextSelection: true` es SOLO para CxP** (login 3-step con empresa/sucursal/area).
4. **El sidebar oculta items sin permiso, pero NO bloquea la URL.** Usar `<PermissionGuard blockedPath="/cxp/bloqueado" ...>` para bloquear de verdad.
5. **Route modules se invocan como función**, no como JSX: `{CxpRoutes({ variant, loginPath })}` — NO `<CxpRoutes/>`. React Router 7 rechaza children que no son `<Route>`.
6. **La factory `createAppRoutes` maneja TODO el scaffolding** (login, guards, 404, bloqueado, layout). No recrear manualmente.

## Estructura

```
src/
├── apps/
│   ├── _registry.ts              # Registro de apps (fuente del launcher)
│   ├── baseapp/
│   │   ├── BaseAppRoutes.tsx     # Router raíz (shell + mounts de apps)
│   │   ├── menuItems.tsx         # Sidebar del shell
│   │   ├── Home.tsx              # Launcher (/hub)
│   │   └── Profile.tsx           # Perfil (/perfil)
│   ├── cxp/
│   │   ├── CxpRoutes.tsx         # Rutas CxP (usa createAppRoutes)
│   │   └── menuItems.tsx         # Sidebar CxP
│   └── rh/
│       ├── RhRoutes.tsx          # Rutas RH (usa createAppRoutes)
│       ├── menuItems.tsx         # Sidebar RH
│       └── pages/
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx        # Layout configurable (props: items, brandTitle, showContext, configPath)
│   │   ├── AppSidebar.tsx        # Sidebar configurable via props
│   │   ├── Header.tsx            # Header configurable (showContext, configPath)
│   │   └── sidebar-types.ts      # Tipos de menu items
│   ├── auth/
│   │   └── PermissionGuard.tsx   # Guard de permisos por ruta
│   └── ui/                       # shadcn/ui components
├── pages/                        # Páginas compartidas entre apps
├── shared/
│   ├── router/
│   │   ├── createAppRoutes.tsx   # Factory de rutas (el corazón del multi-app)
│   │   └── types.ts
│   ├── auth/
│   │   ├── authStore.ts          # Zustand store (JWT en localStorage)
│   │   ├── authService.ts        # API calls
│   │   └── RequireAuth.tsx       # Guard de autenticación
│   └── api/apiClient.ts          # Axios con interceptores
├── store/                        # Zustand stores
└── services/                     # API services
```

## SSO (Single Sign-On)

Un solo JWT en `localStorage` (`authStore`). Todas las apps leen del mismo store.
Login en cualquier app → autentica en todas. By design, no es un bug.

## Documentación adicional

- [`lefarma.docs/frontend/`](../lefarma.docs/frontend/) — componentes, rutas, servicios, tipos
- [`lefarma.docs/frontend/adding-screens.md`](../lefarma.docs/frontend/adding-screens.md) — guía completa de cómo agregar pantallas
- [`AGENTS.md`](../AGENTS.md) — convenciones del proyecto, secretos dev, comandos

---

## ESLint con type-checking

El proyecto usa `typescript-eslint`. Para reglas type-aware, ver configuración en `eslint.config.js`. Los plugins recomendados:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

// extends:
reactX.configs['recommended-typescript'],
reactDom.configs.recommended,
```
