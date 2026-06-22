import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { AppRoutes } from '@/routes/AppRoutes';

/**
 * Gastos root route parity lock (gastos-migration PR1.1).
 *
 * Purpose: LOCK the current root-build routing behavior BEFORE the
 * AppRoutes -> <GastosRoutes variant="root"> refactor so that any regression
 * (absolute-path leakage, lost route, flipped landing) turns a green test red.
 *
 * These tests are written against the CURRENT pre-refactor code and MUST pass.
 * After PR1.2-PR1.4 they MUST stay green — that is the "root byte-identical"
 * proof (gastos-app spec: "Root build unchanged").
 *
 * Strategy: mock the heavy leaf page components to deterministic text markers
 * and the MainLayout guard to a plain <Outlet/> so the test isolates ROUTING
 * (URL -> component) from page-implementation noise. The auth store is driven
 * directly via setState to control authenticated vs unauthenticated sessions.
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
  default: () => <div>PERFIL_MARK</div>,
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
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('Gastos root routes (root byte-identical lock)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('unauthenticated session', () => {
    beforeEach(() => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
    });

    it('renders the Hero landing at "/" (root landing unchanged)', () => {
      renderAt('/');
      expect(screen.getByText('HERO_MARK')).toBeInTheDocument();
    });

    it('renders the Login page at "/login"', () => {
      renderAt('/login');
      expect(screen.getByText('LOGIN_MARK')).toBeInTheDocument();
    });

    it('does NOT render the Dashboard for an unauthenticated "/" hit', () => {
      renderAt('/');
      expect(screen.queryByText('DASHBOARD_MARK')).not.toBeInTheDocument();
    });
  });

  describe('authenticated session', () => {
    beforeEach(() => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
    });

    it('redirects authenticated "/" to the Dashboard', () => {
      renderAt('/');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
      expect(screen.queryByText('HERO_MARK')).not.toBeInTheDocument();
    });

    it('renders Dashboard at "/dashboard"', () => {
      renderAt('/dashboard');
      expect(screen.getByText('DASHBOARD_MARK')).toBeInTheDocument();
    });

    it('resolves "/catalogos/proveedores" (permission-wrapped route)', () => {
      renderAt('/catalogos/proveedores');
      expect(screen.getByText('PROVEEDORES_MARK')).toBeInTheDocument();
    });

    it('resolves "/ordenes/crear"', () => {
      renderAt('/ordenes/crear');
      expect(screen.getByText('CREAR_ORDEN_MARK')).toBeInTheDocument();
    });

    it('resolves "/perfil"', () => {
      renderAt('/perfil');
      expect(screen.getByText('PERFIL_MARK')).toBeInTheDocument();
    });

    it('falls through to NotFound for an unknown path', () => {
      renderAt('/this-route-does-not-exist');
      expect(screen.getByText('NOT_FOUND_MARK')).toBeInTheDocument();
    });
  });
});
