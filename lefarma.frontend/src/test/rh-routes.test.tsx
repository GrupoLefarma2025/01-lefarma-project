import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { BaseAppRoutes } from '@/apps/baseapp/BaseAppRoutes';

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

vi.mock('@/apps/rh/pages/RhDashboard', () => ({
  RhDashboard: () => <div>RH_DASHBOARD_MARK</div>,
}));

vi.mock('@/apps/rh/pages/MisIncidenciasPage', () => ({
  default: () => <div>RH_MIS_INCIDENCIAS_MARK</div>,
}));

vi.mock('@/components/baseapp/MultiStepLogin', async () => {
  const { useLocation } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
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

vi.mock('@/components/layout/MainLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { MainLayout: () => <Outlet /> };
});

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
      expect(screen.queryByText('RH_DASHBOARD_MARK')).not.toBeInTheDocument();
      expect(probe.getAttribute('data-url')).toBe(
        `/rh/login?return=${encodeURIComponent('/rh')}`
      );
    });

    it('authenticated /rh index lands on the RH Dashboard (auth-only gate, no prompt)', async () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh');
      expect(await screen.findByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });
  });

  describe('RH login — 2-step global flow (no context-selection step)', () => {
    it('renders MultiStepLogin at /rh/login for an unauthenticated session', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/login');
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
    });

    it('wires MultiStepLogin with no step3 slot (2-step flow; step 3 is CxP-only)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/login');
      const probe = screen.getByTestId('login-probe');
      expect(probe.getAttribute('data-has-step3')).toBe('false');
      expect(probe.getAttribute('data-redirect')).toBe('dashboard');
    });
  });

  describe('RH dashboard route', () => {
    it('authenticated /rh/dashboard resolves within the subtree', async () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh/dashboard');
      expect(await screen.findByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });

    it('unauthenticated /rh/dashboard redirects to /rh/login with the return URL preserved', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/rh/dashboard');
      const probe = screen.getByTestId('login-probe');
      expect(probe).toBeInTheDocument();
      expect(screen.queryByText('RH_DASHBOARD_MARK')).not.toBeInTheDocument();
      expect(probe.getAttribute('data-url')).toBe(
        `/rh/login?return=${encodeURIComponent('/rh/dashboard')}`
      );
    });
  });

  describe('RH mis incidencias route (self-service, no permission guard)', () => {
    it('authenticated /rh/mis-incidencias resolves within the subtree', async () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh/mis-incidencias');
      expect(await screen.findByText('RH_MIS_INCIDENCIAS_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });
  });

  describe('Cross-App Single Sign-On', () => {
    it('authenticated session reaches /rh/dashboard from the shell with no re-login', async () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/rh/dashboard');
      expect(await screen.findByText('RH_DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
    });
  });
});
