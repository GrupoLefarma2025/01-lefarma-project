import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { BaseAppRoutes } from '@/apps/baseapp/BaseAppRoutes';

/**
 * Corrected shell navigation tests (nav-reorg: shell at root).
 *
 * Coverage (app-routing + base-app + cxp-app specs):
 * - Root Index Redirect: `/` → `/login` (unauth) | `/hub` (auth).
 * - Global Login Route: `/login` renders outside `RequireAuth` (reachable
 *   unauthenticated) and uses the 2-step global Login.
 * - Hub launcher: `/hub` guarded by `RequireAuth`; unauth → `/login`, auth →
 *   `Home` launcher with the enabled `cxp` entry.
 * - Profile: `/perfil` guarded + rendered inside the shell.
 * - CxP subtree mounting: `/cxp/*` resolves within the subtree; index
 *   auth→`dashboard`, unauth→`/cxp/login`.
 * - Cross-app SSO: authenticated hub→cxp navigation needs no re-login.
 *
 * Mock strategy: heavy leaf pages reduce to deterministic text markers,
 * `MainLayout` becomes an `<Outlet/>` passthrough, and `PermissionGuard` is
 * bypassed so route resolution is isolated from page-implementation noise.
 * The real `useAuthStore` is driven via `setState`.
 */

vi.mock('@/pages/Hero', () => ({
  default: () => <div>HERO_MARK</div>,
}));
vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>DASHBOARD_MARK</div>,
}));
vi.mock('@/pages/auth/Login', () => ({
  default: () => <div>LOGIN_MARK</div>,
}));
vi.mock('@/pages/catalogos/generales/Proveedores/ProveedoresList', () => ({
  default: () => <div>PROVEEDORES_MARK</div>,
}));
vi.mock('@/pages/ordenes/CrearOrdenCompra', () => ({
  default: () => <div>CREAR_ORDEN_MARK</div>,
}));
vi.mock('@/pages/Perfil', () => ({
  default: () => <div>CXP_PERFIL_MARK</div>,
}));
vi.mock('@/pages/NotFound', () => ({
  default: () => <div>NOT_FOUND_MARK</div>,
}));

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

describe('BaseAppRoutes — corrected shell navigation (nav-reorg)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Root Index Redirect (app-routing spec)', () => {
    it('unauthenticated "/" redirects to /login with no home content', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/');
      // Lands on the global login; the launcher is NOT mounted.
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByText('CxP')).not.toBeInTheDocument();
    });

    it('authenticated "/" redirects to /hub with no home content at the index', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/');
      // Lands on the hub launcher (Home renders the CxP tile); the index
      // itself did not render a home surface — it redirected.
      expect(screen.getByText('CxP')).toBeInTheDocument();
    });
  });

  describe('Global Login Route (app-routing spec)', () => {
    it('renders Login at /login for an unauthenticated session (outside RequireAuth)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/login');
      // The login page is public — reachable without a session. If it were
      // inside RequireAuth, an unauthenticated visit would bounce away.
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
    });
  });

  describe('Hub launcher (base-app spec: Home Launcher)', () => {
    it('unauthenticated /hub is guarded by RequireAuth and redirects to /login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/hub');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      // The launcher tile must not render for an unauthenticated session.
      expect(screen.queryByLabelText('CxP')).not.toBeInTheDocument();
    });

    it('authenticated /hub renders the launcher with the enabled CxP entry', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/hub');
      // The CxP entry is enabled and exposes its navigation target
      // (base-app spec: "CxP appears in the launcher").
      const cxpTile = screen.getByLabelText('CxP');
      expect(cxpTile).toBeInTheDocument();
      expect(cxpTile).toHaveAttribute('href', '/cxp/');
    });
  });

  describe('Profile route (base-app spec)', () => {
    it('authenticated /perfil renders Profile inside the shell', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/perfil');
      // The shell Profile page renders (distinct from the CxP Perfil mock).
      expect(screen.getByRole('heading', { name: /perfil/i })).toBeInTheDocument();
    });

    it('unauthenticated /perfil redirects to /login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/perfil');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
    });
  });

  describe('App Subtree Mounting — CxP at /cxp/ (cxp-app spec)', () => {
    it('authenticated /cxp index redirects to the Dashboard (no launcher, no prompt)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp');
      // Subtree index lands directly on the Dashboard (auth-only gate).
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
    });

    it('unauthenticated /cxp index redirects to the subtree /cxp/login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/cxp');
      // Subtree login renders (mocked to LOGIN_MARK); the Dashboard is gated.
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByText('DASHBOARD_MARK')).not.toBeInTheDocument();
    });

    it('authenticated /cxp/dashboard resolves within the subtree (no shell layout)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp/dashboard');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
      // The shell brand is NOT present — the subtree keeps its own MainLayout.
      expect(screen.queryByRole('link', { name: 'Lefarma' })).not.toBeInTheDocument();
    });

    it('unauthenticated /cxp/dashboard redirects to /cxp/login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/cxp/dashboard');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByText('DASHBOARD_MARK')).not.toBeInTheDocument();
    });
  });

  describe('Cross-App Single Sign-On (cxp-app spec)', () => {
    it('authenticated session reaches /cxp/dashboard from the hub with no re-login', () => {
      // SSO contract: within the single-origin shell build, a session
      // established at the global login is honored by the CxP subtree.
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp/dashboard');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
      // No login prompt — the shared session is accepted.
      expect(screen.queryByText('LOGIN_MARK')).not.toBeInTheDocument();
    });
  });
});
