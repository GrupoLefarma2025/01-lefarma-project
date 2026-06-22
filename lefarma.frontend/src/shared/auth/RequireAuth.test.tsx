import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';

// Real authStore is used; tests flip `isAuthenticated` directly via setState.
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

/**
 * Foundation test: RequireAuth uses `<Navigate>` instead of
 * `window.location.href`. We assert the redirect by mounting the guard inside
 * a `MemoryRouter` with explicit destination routes — the destination route
 * renders when `<Navigate>` resolves, and the protected subtree never renders.
 */
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
    useAuthStore.setState({ isAuthenticated: false });
  });

  it('Scenario: Unauthenticated user is redirected to login via <Navigate>', () => {
    renderGuard('/perfil', {});

    // The /login destination route rendered via <Navigate to="/login" replace/>.
    expect(screen.getByText('LOGIN_DESTINATION')).toBeInTheDocument();
    // Protected subtree must not be rendered.
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });

  it('Scenario: Authenticated user passes through and no redirect occurs', () => {
    useAuthStore.setState({ isAuthenticated: true });

    renderGuard('/perfil', {});

    // Children render normally; no redirect to /login.
    expect(screen.getByText('secret-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('Scenario: Guard checks authentication, not context selection (authed without empresa/sucursal/area context still passes)', () => {
    // Authenticated, but explicitly NO empresa/sucursal/area context. The guard
    // MUST NOT block on context — context is deferred to per-app logic (base-app
    // spec: "No Global Context Assumption").
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
