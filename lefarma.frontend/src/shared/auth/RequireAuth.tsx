import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * Guard de ruta para el shell del base-app raíz y cualquier subárbol de app
 * montado.
 *
 * Cuando la sesión NO está autenticada, el guard renderiza un `<Navigate>` al
 * `loginPath` configurado, preservando el destino deseado vía un query param
 * `?return=` (spec app-routing: Authentication Guard "preserving the return
 * URL"). El build del shell es un bundle único, así que una navegación in-app
 * es suficiente (sin recarga de página completa).
 *
 * La forma `?return=` se integra con el manejo existente de `safeReturn` de
 * `Login.tsx` (lee `window.location.search`, acepta paths absolutos same-origin
 * como guardia contra open-redirect). No se requieren cambios a `Login.tsx`
 * más allá del alcance del nav-reorg.
 *
 * El guard verifica SOLO AUTENTICACIÓN. Deliberadamente NO bloquea por
 * selección de contexto empresa/sucursal/area — eso se difiere a la lógica
 * por-app (ver spec base-app: "No Global Context Assumption").
 */
export interface RequireAuthProps {
  /** Subárbol protegido renderizado cuando está autenticado. */
  children: ReactNode;
  /**
   * Destino de login. Por defecto `/login` (login global del shell). Los
   * subárboles de app montados sobrescriben con su propio login (ej.
   * `/cxp/login`).
   */
  loginPath?: string;
}

export function RequireAuth({ children, loginPath = '/login' }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirección in-app dentro del shell de bundle único.
    //
    // Preserva el destino deseado para que la página de login pueda redirigir
    // de vuelta tras una autenticación exitosa (spec app-routing: Authentication
    // Guard "preserving the return URL"). `?return=` se integra con el manejo
    // existente de `safeReturn` de Login.tsx sin requerir cambios en Login.
    const from = location.pathname + location.search;
    return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <>{children}</>;
}
