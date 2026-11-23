import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

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

import { RequireAuth } from '@/shared/auth/RequireAuth';
import { useAuthStore } from '@/shared/auth/authStore';

function renderGuard(initialPath: string, props: { children?: ReactNode; loginPath?: string }) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <RequireAuth loginPath={props.loginPath}>
              {props.children ?? <div>secret-dashboard</div>}
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>LOGIN_DESTINATION</div>} />
        <Route path="/alt-login" element={<div>ALT_LOGIN_DESTINATION</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth — app-routing guard', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
  });

  it('Scenario: waits for session hydration instead of bouncing to login (F5 flash)', () => {
    useAuthStore.setState({ isInitialized: false, isAuthenticated: false });

    renderGuard('/perfil', {});

    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
    });

    expect(screen.getByText('secret-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('Scenario: Unauthenticated user is redirected to login via <Navigate>', () => {
    renderGuard('/perfil', {});

    expect(screen.getByText('LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });

  it('Scenario: Authenticated user passes through and no redirect occurs', () => {
    useAuthStore.setState({ isAuthenticated: true });

    renderGuard('/perfil', {});

    expect(screen.getByText('secret-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('Scenario: Guard checks authentication, not context selection (authed without empresa/sucursal/area context still passes)', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      empresa: null,
      sucursal: null,
      area: null,
    });

    renderGuard('/perfil', { children: <div>shell-home</div> });

    expect(screen.getByText('shell-home')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('honors a custom loginPath when provided', () => {
    renderGuard('/perfil', { loginPath: '/alt-login' });

    expect(screen.getByText('ALT_LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });
});
