import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';

vi.mock('@/pages/Hero', () => ({
  default: () => <div>HERO_MARK</div>,
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

import { ProtectedRoute } from '@/routes/LandingRoute';

function LoginProbe() {
  const loc = useLocation();
  return <div data-testid="login-probe">{loc.pathname + loc.search}</div>;
}

describe('ProtectedRoute — subtree return-URL preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
  });

  it('preserves the return URL via ?return= when redirecting an unauthenticated subtree route', () => {
    render(
      <MemoryRouter initialEntries={['/cxp/catalogos/proveedores']}>
        <Routes>
          <Route
            path="/cxp"
            element={<ProtectedRoute unauthRedirect="/cxp/login" />}
          >
            <Route path="catalogos/proveedores" element={<div>PROVEEDORES_CONTENT</div>} />
          </Route>
          <Route path="/cxp/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('PROVEEDORES_CONTENT')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-probe').textContent).toBe(
      `/cxp/login?return=${encodeURIComponent('/cxp/catalogos/proveedores')}`
    );
  });

  it('authenticated session passes through ProtectedRoute (no redirect, no ?return=)', () => {
    useAuthStore.setState({ isInitialized: true, isAuthenticated: true });

    render(
      <MemoryRouter initialEntries={['/cxp/catalogos/proveedores']}>
        <Routes>
          <Route
            path="/cxp"
            element={<ProtectedRoute unauthRedirect="/cxp/login" />}
          >
            <Route path="catalogos/proveedores" element={<div>PROVEEDORES_CONTENT</div>} />
          </Route>
          <Route path="/cxp/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('PROVEEDORES_CONTENT')).toBeInTheDocument();
    expect(screen.queryByTestId('login-probe')).not.toBeInTheDocument();
  });
});
