import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { useAuthStore } from '@/shared/auth/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { shellMenuItems } from './menuItems';
import { Home } from './Home';
import { Profile } from './Profile';
import { CxpRoutes } from '@/apps/cxp/CxpRoutes';
import { RhRoutes } from '@/apps/rh/RhRoutes';
import Login from '@/pages/auth/Login';

/**
 * Árbol de rutas para el shell del base-app raíz — el modelo de navegación
 * corregido (spec app-routing: "Root Index Redirect" + "Global Login Route" +
 * "App Subtree Mounting"; spec base-app: "Authenticated Shell Layout" +
 * "Home Launcher").
 *
 * El shell se sirve desde el basename raíz (`/`), el cual React Router compone
 * automáticamente. Así `/` coincide con `/`, `/hub` coincide con `/hub`, y
 * `cxp/dashboard` (anidado bajo el wrapper `cxp`) coincide con `/cxp/dashboard`.
 *
 * Modelo de navegación (nav-reorg):
 * - `/` es una REDIRECCIÓN — auth→`/hub`, sin auth→`/login`. No renderiza
 *   ninguna superficie home (spec base-app: "Index route is not a home
 *   surface").
 * - `/login` es el login GLOBAL — fuera de `RequireAuth` para que sesiones no
 *   autenticadas puedan alcanzarlo. Usa el flujo de 2 pasos (sin selección de
 *   contexto) y redirige a `/hub` al éxito (spec app-routing: "Global Login
 *   Route").
 * - `/hub` + `/perfil` son páginas del shell renderizadas dentro de
 *   `MainLayout` con `shellMenuItems` y sin contexto (`showContext` por
 *   defecto false). Esto le da al shell el mismo aspecto de sidebar + header
 *   que las apps.
 * - `cxp/*` monta el subárbol CxP vía el módulo reutilizable `<CxpRoutes>`
 *   (Decisión de diseño 1). El subárbol conserva su propio manejo de auth
 *   (ProtectedRoute + CxpSubtreeIndex) y su propia config de MainLayout.
 *
 * El subárbol CxP se invoca vía el patrón FUNCTION-CALL
 * `{CxpRoutes({ variant: 'subtree', loginPath: '/cxp/login' })}` porque
 * React Router rechaza hijos componentes no-`<Route>` de `<Routes>` (ver
 * el JSDoc de CxpRoutes.tsx para la justificación completa).
 */
export function BaseAppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      {/* Redirect del índice — nunca renderiza un home (spec app-routing). */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/hub' : '/login'} replace />}
      />

      {/* Login global — público (fuera de RequireAuth), 2 pasos, aterriza en /hub. */}
      <Route
        path="/login"
        element={<Login requireContextSelection={false} redirectTo="/hub" />}
      />

      {/* Ruta del layout shell — protegida, usa MainLayout con el sidebar del shell. */}
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
      </Route>

      {/*
        CxP subtree (cxp-app spec: "CxP Subtree Mounting"). The wrapper
        renders an <Outlet/> for the subtree children produced by the reusable
        CxpRoutes module. The subtree owns its auth handling
        (ProtectedRoute for protected routes, CxpSubtreeIndex for the index)
        and its own MainLayout config. Wrapping this subtree in a shell-level
        RequireAuth would be incorrect: it would also guard `/cxp/login`
        (public) and produce a redirect loop, defeating the per-app login.
      */}
      <Route path="cxp" element={<Outlet />}>
        {CxpRoutes({ variant: 'subtree', loginPath: '/cxp/login' })}
      </Route>

      {/*
        RH (Recursos Humanos) subtree — mirrors the CxP subtree mount. The
        wrapper renders an <Outlet/> for the subtree children produced by the
        reusable RhRoutes module. The subtree owns its auth handling
        (ProtectedRoute for protected routes, RhSubtreeIndex for the index) and
        shares the same MainLayout as CxP. RH login uses the 2-step global
        flow (no context-selection step). See CxpRoutes/RhRoutes JSDoc for
        the function-call invocation rationale.
      */}
      <Route path="rh" element={<Outlet />}>
        {RhRoutes({ variant: 'subtree', loginPath: '/rh/login' })}
      </Route>
    </Routes>
  );
}
