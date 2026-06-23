/* eslint-disable react-refresh/only-export-components */
import { type ReactNode, type ReactElement } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { useAuthStore } from '@/shared/auth/authStore';
import Login from '@/pages/auth/Login';
import BlockedPage from '@/pages/auth/BlockedPage';
import NotFound from '@/pages/NotFound';

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Resolvedor de índice de subárbol consciente de auth. Lógica idéntica para
 * cada app: usuarios autenticados aterrizan en `dashboard`; usuarios no
 * autenticados son redirigidos al login del subárbol con el destino deseado
 * preservado vía `?return=` (spec app-routing: "preserving the return URL").
 */
function AppSubtreeIndex({ loginPath }: { loginPath: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="dashboard" replace />;
  const from = location.pathname + location.search;
  return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
}

/**
 * Configuración para la fábrica genérica de rutas de app. Cada app (CxP, RH,
 * apps futuras) provee sus rutas de página y extras opcionales; la fábrica
 * maneja TODA la infraestructura (resolvedor de índice, wrapper de login,
 * wrapper protegido, MainLayout, bloqueado, NotFound).
 */
export interface AppRoutesConfig {
  /** Identificador estable, ej. 'cxp' | 'rh'. Deriva los paths por defecto. */
  appKey: string;
  /** Root mantiene un índice específico de app; el subárbol usa el resolvedor consciente de auth. */
  variant: 'root' | 'subtree';
  /** Sobrescribe el path de login por defecto (por defecto `/{appKey}/login`). */
  loginPath?: string;
  /** CxP setea true (login de 3 pasos); todas las demás apps por defecto false (2 pasos). */
  requireContextSelection?: boolean;
  /**
   * Elemento índice del variant root. CxP pasa <LandingRoute/> (landing Hero);
   * las apps sin landing por defecto redirigen al path de login.
   */
  rootIndexElement?: ReactElement;
  /**
   * Rutas protegidas FUERA de <MainLayout> (dentro de <ProtectedRoute>).
   * CxP usa esto para `select-empresa`.
   */
  preLayoutRoutes?: ReactNode;
  /** Rutas de páginas DENTRO de <MainLayout> — el grueso de las páginas de cada app. */
  routes: ReactNode;
  /**
   * Elemento layout que envuelve las rutas de páginas protegidas. Cada app pasa
   * su propio <MainLayout> configurado con items de sidebar y branding
   * específicos de la app. Debe renderizar un <Outlet/> para las rutas hijas.
   */
  layout: ReactElement;
  /**
   * Rutas públicas fuera de los wrappers estándar (ej. handoff-login,
   * ayuda pública). React Router v6+ usa matching basado en ranking, así que
   * la ubicación entre wrappers no afecta la resolución de rutas.
   */
  extraRoutes?: ReactNode;
}

/**
 * Fábrica genérica de rutas de app — la única fuente de verdad para el
 * scaffold estándar de subárbol. Reemplaza la anterior duplicación por-app
 * CxpRoutes/RhRoutes (PageLoader, SubtreeIndex, resolvedLoginPath, lógica de
 * variant, publicOnlyRoute, protectedRoute — todos idénticos entre apps).
 *
 * Cada módulo de app llama a esta fábrica con sus rutas de página; la fábrica
 * produce el Fragment de elementos <Route> que el shell inlinea vía el
 * patrón de llamada de función `{createAppRoutes({...})}` (requerido porque
 * createRoutesFromChildren de React Router rechaza hijos componentes
 * no-<Route> — ver el descubrimiento del invariante RR7).
 *
 * Todos los paths de rutas son RELATIVOS (sin slash inicial) para que el
 * módulo sirva tanto para montajes root como subárbol. Bajo el basename raíz
 * `/`, `dashboard` resuelve a `/dashboard`; dentro de <Route path="cxp">
 * resuelve a `/cxp/dashboard`.
 */
export function createAppRoutes(config: AppRoutesConfig): ReactNode {
  const {
    appKey,
    variant,
    loginPath,
    requireContextSelection = false,
    rootIndexElement,
    preLayoutRoutes,
    routes,
    layout,
    extraRoutes,
  } = config;

  const resolvedLoginPath = loginPath ?? (variant === 'root' ? '/login' : `/${appKey}/login`);

  const indexElement =
    variant === 'root' ? (
      rootIndexElement ?? <Navigate to={resolvedLoginPath} replace />
    ) : (
      <AppSubtreeIndex loginPath={resolvedLoginPath} />
    );

  const publicOnlyRoute =
    variant === 'root' ? (
      <PublicOnlyRoute />
    ) : (
      <PublicOnlyRoute authenticatedRedirect="dashboard" />
    );

  const protectedRoute =
    variant === 'root' ? (
      <ProtectedRoute />
    ) : (
      <ProtectedRoute unauthRedirect={resolvedLoginPath} />
    );

  return (
    <>
      <Route index element={indexElement} />

      <Route element={publicOnlyRoute}>
        <Route
          path="login"
          element={<Login requireContextSelection={requireContextSelection} redirectTo="dashboard" />}
        />
      </Route>

      {extraRoutes}

      <Route element={protectedRoute}>
        {preLayoutRoutes}
        <Route element={layout}>{routes}</Route>
      </Route>

      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
