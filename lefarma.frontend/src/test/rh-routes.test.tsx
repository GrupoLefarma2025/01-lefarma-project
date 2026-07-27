import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { BaseAppRoutes } from '@/apps/baseapp/BaseAppRoutes';

/**
 * RH (Recursos Humanos) subtree scaffold tests.
 *
 * Coverage (mirrors the baseapp-routes / cxp-app contract):
 * - RH subtree mounting: `/rh/*` resolves within the subtree; index auth→
 *   `dashboard`, unauth→`/rh/login` with `?return=` preserved.
 * - RH login: `/rh/login` renders <MultiStepLogin> wired with the 2-step
 *   global flow (no `step3` slot) — step 3 is CxP-only.
 * - Authed `/rh/dashboard` resolves inside the subtree.
 * - Return-URL preservation on unauthenticated protected-route hits.
 *
 * Mock strategy: heavy leaf pages reduce to deterministic text markers,
 * `MainLayout` becomes an `<Outlet/>` passthrough, and `PermissionGuard` is
 * bypassed so route resolution is isolated from page-implementation noise.
 *
 * NOTE on the MultiStepLogin probe: MultiStepLogin is NOT mocked to a static
 * <div> (that hides routing probes). Instead it is mocked to a probe that
 * captures both the props it was invoked with and the router location
 * (URL + `?return=`) via data attributes. This lets us assert the 2-step
 * wiring (no step3 slot) AND the redirect destination without rendering the
 * full MultiStepLogin form tree.
 */

vi.mock('@/pages/Hero', () => ({
  default: () => <div>HERO_MARK</div>,
}));
vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>DASHBOARD_MARK</div>,
}));
vi.mock('@/pages/Perfil', () => ({
  default: () => <div>CXP_PERFIL_MARK</div>,
}));
vi.mock('@/pages/catalogos/generales/Proveedores/ProveedoresList', () => ({
  default: () => <div>PROVEEDORES_MARK</div>,
}));
vi.mock('@/pages/ordenes/CrearOrdenCompra', () => ({
  default: () => <div>CREAR_ORDEN_MARK</div>,
}));
vi.mock('@/pages/NotFound', () => ({
  default: () => <div>NOT_FOUND_MARK</div>,
}));

// RhDashboard is the RH landing placeholder; reduce it to a routing marker so
// the test isolates URL→component resolution from page content.
vi.mock('@/apps/rh/pages/RhDashboard', () => ({
  RhDashboard: () => <div>RH_DASHBOARD_MARK</div>,
}));

// MultiStepLogin probe — captures invocation props + router location. NOT a
// static div. The factory now renders <MultiStepLogin> (not <Login>), so the
// probe targets the new shell component.
vi.mock('@/components/baseapp/MultiStepLogin', async () => {
  const { useLocation } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  // Declared inside the factory (PascalCase) so react-hooks/rules-of-hooks
  // recognizes it as a component — the `MultiStepLogin` property name would
  // otherwise trip the rule if it were a lowercase local.
  const MultiStepLoginProbe = (props: {
    redirectTo?: string;
    step3?: ReactNode;
    step3Label?: string;
    step3Description?: string;
  }) => {
    const loc = useLocation();
    const url = loc.pathname + loc.search;
    return (
      <div
        data-testid="login-probe"
        data-url={url}
        data-has-step3={String(props.step3 !== undefined)}
        data-redirect={props.redirectTo ?? 'undefined'}
      >
        LOGIN_PROBE {url}
      </div>
    );
  };
  return { MultiStepLogin: MultiStepLoginProbe };
});

// MainLayout pulls in the full sidebar/header tree; reduce it to a passthrough
// <Outlet/> so child routes still render without the layout dependencies.
vi.mock('@/components/layout/MainLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { MainLayout: () => <Outlet /> };
});

// PermissionGuard reads permissions from localStorage; bypass it so route
// resolution is not blocked by missing permission codes in the test session.
vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Stray API imports inside page modules must resolve; return empty payloads.
vi.mock('@/shared/api/apiClient', () => ({
  API: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: null } }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  proveedorApi: { autorizar: vi.fn(), rechazar: vi.fn(), bulkUpload: vi.fn() },
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BaseAppRoutes />
    </MemoryRouter>
  );
}

describe('BaseAppRoutes — RH (Recursos Humanos) subtree scaffold', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('RH subtree index (app-routing spec)', () => {
    it('unauthenticated /rh index redirects to /rh/login with the return URL preserved', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh');
      // The index bounced to the subtree login; the dashboard never rendered.
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
      expect(screen.queryByText('RH_DASHBOARD_MARK')).not.toBeInTheDocument();
      // Return destination preserved via ?return= (RhSubtreeIndex contract).
      expect(probe.getAttribute('data-url')).toBe(
        `/rh/login?return=${encodeURIComponent('/rh')}`
      );
    });

    it('authenticated /rh index lands on the RH Dashboard (auth-only gate, no prompt)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh');
      expect(screen.getByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      // No login surface for an authenticated session.
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });
  });

  describe('RH login — 2-step global flow (no context-selection step)', () => {
    it('renders MultiStepLogin at /rh/login for an unauthenticated session', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/login');
      // The login page is public (outside ProtectedRoute) — reachable unauth.
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
    });

    it('wires MultiStepLogin with no step3 slot (2-step flow; step 3 is CxP-only)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/login');
      const probe = screen.getByTestId('login-probe');
      // 2-step flow: RH omits the step3 slot, so MultiStepLogin authenticates
      // right after credentials (no empresa/sucursal/area collection).
      expect(probe.getAttribute('data-has-step3')).toBe('false');
      // Post-login target is the RH dashboard (subtree-relative).
      expect(probe.getAttribute('data-redirect')).toBe('dashboard');
    });
  });

  describe('RH dashboard route', () => {
    it('authenticated /rh/dashboard resolves within the subtree', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh/dashboard');
      expect(screen.getByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });

    it('unauthenticated /rh/dashboard redirects to /rh/login with the return URL preserved', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/dashboard');
      // ProtectedRoute bounced to the subtree login; dashboard gated.
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
      expect(screen.queryByText('RH_DASHBOARD_MARK')).not.toBeInTheDocument();
      // Return destination preserved (ProtectedRoute ?return= contract).
      expect(probe.getAttribute('data-url')).toBe(
        `/rh/login?return=${encodeURIComponent('/rh/dashboard')}`
      );
    });
  });

  describe('Cross-App Single Sign-On', () => {
    it('authenticated session reaches /rh/dashboard from the shell with no re-login', () => {
      // SSO contract: within the single-origin shell build, a session
      // established anywhere is honored by the RH subtree.
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh/dashboard');
      expect(screen.getByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });
  });
});
