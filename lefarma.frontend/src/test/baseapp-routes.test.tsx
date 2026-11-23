import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/auth/authService';
import { BaseAppRoutes } from '@/apps/baseapp/BaseAppRoutes';

vi.mock('@/pages/Hero', () => ({
  default: () => <div>HERO_MARK</div>,
}));
vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>DASHBOARD_MARK</div>,
}));
vi.mock('@/pages/auth/Login', () => ({
  default: () => <div>LOGIN_MARK</div>,
}));

vi.mock('@/components/baseapp/MultiStepLogin', () => ({
  MultiStepLogin: () => <div>LOGIN_MARK</div>,
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
vi.mock('@/pages/auth/SelectEmpresaSucursal', () => ({
  default: () => <div>SELECT_EMPRESA_MARK</div>,
}));

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

describe('BaseAppRoutes — corrected shell navigation (nav-reorg)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Root Index Redirect (app-routing spec)', () => {
    it('unauthenticated "/" redirects to /login with no home content', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByText('CxP')).not.toBeInTheDocument();
    });

    it('authenticated "/" redirects to /hub with no home content at the index', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/');
      expect(screen.getByText('CxP')).toBeInTheDocument();
    });
  });

  describe('Global Login Route (app-routing spec)', () => {
    it('renders Login at /login for an unauthenticated session (outside RequireAuth)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/login');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
    });
  });

  describe('Hub launcher (base-app spec: Home Launcher)', () => {
    it('unauthenticated /hub is guarded by RequireAuth and redirects to /login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/hub');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByLabelText('CxP')).not.toBeInTheDocument();
    });

    it('authenticated /hub renders the launcher with the enabled CxP entry', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/hub');
      const cxpTile = screen.getByLabelText('CxP');
      expect(cxpTile).toBeInTheDocument();
      expect(cxpTile).toHaveAttribute('href', '/cxp/');
    });
  });

  describe('Profile route (base-app spec)', () => {
    it('authenticated /perfil renders Profile inside the shell', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/perfil');
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
      authService.setEmpresa({
        idEmpresa: 1,
        nombre: 'Empresa Test',
        codigo: 'EMP1',
        activo: true,
        puedeSeleccionarEmpresas: true,
      });
      authService.setSucursal({
        idSucursal: 1,
        idEmpresa: 1,
        nombre: 'Sucursal Test',
        codigo: 'SUC1',
        activo: true,
      });
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
    });

    it('authenticated /cxp index without empresa/sucursal redirects to select-empresa', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp');
      expect(screen.getByText('SELECT_EMPRESA_MARK')).toBeInTheDocument();
      expect(screen.queryByText('DASHBOARD_MARK')).not.toBeInTheDocument();
    });

    it('unauthenticated /cxp index redirects to the subtree /cxp/login', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
      renderAt('/cxp');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
      expect(screen.queryByText('DASHBOARD_MARK')).not.toBeInTheDocument();
    });

    it('authenticated /cxp/dashboard resolves within the subtree (no shell layout)', () => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp/dashboard');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
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
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
      renderAt('/cxp/dashboard');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByText('LOGIN_MARK')).not.toBeInTheDocument();
    });
  });
});
