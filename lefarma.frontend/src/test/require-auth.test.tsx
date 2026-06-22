import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * gastos-migration PR2.1 + PR2.3 + PR2.5 RED tests.
 *
 * Coverage:
 * - authStore.loginStepTwo option `{ requireContextSelection }` (PR2.3):
 *     * default (no option) preserves 3-step flow + loads step-3 data.
 *     * `requireContextSelection:false` authenticates immediately, skips step-3
 *       load, leaves no partial context state.
 * - Login config-driven step count (PR2.1):
 *     * default (requireContextSelection=true) presents context step 3.
 *     * global (requireContextSelection=false, redirectTo='/hub') cleanly skips
 *       step 3 and redirects to /hub.
 * - RequireAuth subtree-aware redirect (PR2.1/PR2.5):
 *     * default loginPath redirects to /login.
 *     * custom loginPath '/gastos/login' redirects there.
 *     * authed session passes through (auth-only check).
 *
 * Mock strategy: real authStore + real router. Only the HTTP edges
 * (authService, apiClient) are mocked so store/UI behavior is exercised end-to-end.
 */

vi.mock('@/shared/auth/authService', () => ({
  authService: {
    loginStepOne: vi.fn().mockResolvedValue({
      domains: ['DC'],
      requiresDomainSelection: false,
      displayName: 'Test User',
    }),
    loginStepTwo: vi.fn().mockResolvedValue({
      accessToken: 'fake-token',
      refreshToken: 'fake-refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 1,
        username: 'testuser',
        nombre: 'Test User',
        correo: 'test@example.com',
        roles: [],
        permisos: [],
      },
    }),
    getEmpresas: vi.fn().mockResolvedValue([
      {
        idEmpresa: 1,
        nombre: 'Empresa Uno',
        codigo: 'E1',
        activo: true,
        puedeSeleccionarEmpresas: true,
      },
    ]),
    getSucursales: vi.fn().mockResolvedValue([
      {
        idSucursal: 11,
        idEmpresa: 1,
        nombre: 'Sucursal Uno',
        codigo: 'S1',
        activo: true,
      },
    ]),
    getAreas: vi.fn().mockResolvedValue([]),
    setEmpresa: vi.fn(),
    setSucursal: vi.fn(),
    setArea: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    getCurrentUser: vi.fn().mockReturnValue(null),
    getEmpresa: vi.fn().mockReturnValue(null),
    getSucursal: vi.fn().mockReturnValue(null),
    getArea: vi.fn().mockReturnValue(null),
    logout: vi.fn().mockResolvedValue(undefined),
  },
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

import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/auth/authService';
import Login from '@/pages/auth/Login';
import { RequireAuth } from '@/shared/auth/RequireAuth';

// ---------------------------------------------------------------------------
// PR2.3 — authStore.loginStepTwo option
// ---------------------------------------------------------------------------

describe('authStore.loginStepTwo — requireContextSelection option (PR2.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      isAuthenticated: false,
      loginStep: 1,
      pendingUsername: null,
      empresas: [],
      sucursales: [],
      areas: [],
      user: null,
      token: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('default (no options) preserves the 3-step flow and loads step-3 data', async () => {
    await useAuthStore.getState().loginStepOne('testuser');
    expect(useAuthStore.getState().loginStep).toBe(2);

    await useAuthStore.getState().loginStepTwo('pass', 'DC');

    const state = useAuthStore.getState();
    expect(authService.getEmpresas).toHaveBeenCalledTimes(1);
    expect(authService.getSucursales).toHaveBeenCalledTimes(1);
    expect(authService.getAreas).toHaveBeenCalledTimes(1);
    // Session NOT finalized — step 3 (context) still pending.
    expect(state.isAuthenticated).toBe(false);
    expect(state.loginStep).toBe(3);
    expect(state.empresas.length).toBeGreaterThan(0);
  });

  it('requireContextSelection:false authenticates immediately and skips step-3 load', async () => {
    await useAuthStore.getState().loginStepOne('testuser');

    await useAuthStore.getState().loginStepTwo('pass', 'DC', {
      requireContextSelection: false,
    });

    const state = useAuthStore.getState();
    // Step-3 data NEVER loaded — no partial context state leaks into global flow.
    expect(authService.getEmpresas).not.toHaveBeenCalled();
    expect(authService.getSucursales).not.toHaveBeenCalled();
    expect(authService.getAreas).not.toHaveBeenCalled();
    // Session authenticated right after credentials.
    expect(state.isAuthenticated).toBe(true);
    expect(state.loginStep).toBe(1);
    expect(state.empresas).toEqual([]);
    expect(state.sucursales).toEqual([]);
    expect(state.areas).toEqual([]);
    expect(state.pendingUsername).toBeNull();
    expect(state.token).toBe('fake-token');
    expect(state.user?.username).toBe('testuser');
  });
});

// ---------------------------------------------------------------------------
// PR2.1 — Login config-driven step count
// ---------------------------------------------------------------------------

describe('Login — config-driven step count (PR2.1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      isAuthenticated: false,
      loginStep: 1,
      pendingUsername: null,
      empresas: [],
      sucursales: [],
      areas: [],
      user: null,
      token: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('3-step default (requireContextSelection=true): presents context selection after step 2', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('usuario'), 'testuser');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByPlaceholderText('Ingresa tu contraseña')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ingresa tu contraseña'), 'pass');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Step-3 (Empresa) surface presented; not yet authenticated.
    await waitFor(() => {
      expect(useAuthStore.getState().loginStep).toBe(3);
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(screen.getByText('Empresa')).toBeInTheDocument();
  });

  it('2-step global (requireContextSelection=false, redirectTo="/hub"): cleanly skips context and lands on /hub', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login requireContextSelection={false} redirectTo="/hub" />} />
          <Route path="/hub" element={<div>HUB_LANDING</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('usuario'), 'testuser');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByPlaceholderText('Ingresa tu contraseña')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ingresa tu contraseña'), 'pass');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Authenticated + redirected to /hub; step-3 data never loaded.
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    expect(useAuthStore.getState().empresas).toEqual([]);
    expect(useAuthStore.getState().loginStep).toBe(1);
    // Navigation landed on the /hub route.
    expect(await screen.findByText('HUB_LANDING')).toBeInTheDocument();
    // Step-3 surface never appeared.
    expect(screen.queryByText('Empresa')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PR2.1 / PR2.5 — RequireAuth subtree-aware redirect
// ---------------------------------------------------------------------------

function renderGuard(initialPath: string, props: { children?: ReactNode; loginPath?: string }) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/CxP/perfil"
          element={
            <RequireAuth loginPath={props.loginPath}>
              {props.children ?? <div>PROTECTED_SURFACE</div>}
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>LOGIN_DESTINATION</div>} />
        <Route path="/gastos/login" element={<div>GASTOS_LOGIN_DESTINATION</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth — subtree-aware redirect (PR2.1/PR2.5)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false });
  });

  it('redirects unauthenticated session to default /login via <Navigate>', () => {
    renderGuard('/CxP/perfil', {});
    expect(screen.getByText('LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_SURFACE')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated session to custom /gastos/login via <Navigate>', () => {
    renderGuard('/CxP/perfil', { loginPath: '/gastos/login' });
    expect(screen.getByText('GASTOS_LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_SURFACE')).not.toBeInTheDocument();
  });

  it('auth-only check: authenticated session without context still passes through', () => {
    useAuthStore.setState({ isAuthenticated: true, empresa: null, sucursal: null, area: null });
    renderGuard('/CxP/perfil', {});
    expect(screen.getByText('PROTECTED_SURFACE')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('PR2 remediation: preserves the return URL via ?return= on redirect (spec: Authentication Guard)', () => {
    // Probe at the login destination that surfaces the router location so we
    // can assert the `?return=` query param carries the original protected path.
    function LoginProbe() {
      const loc = useLocation();
      return <div data-testid="login-probe">{loc.pathname + loc.search}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/CxP/gastos/dashboard']}>
        <Routes>
          <Route
            path="/CxP/gastos/dashboard"
            element={
              <RequireAuth loginPath="/CxP/login">
                <div>PROTECTED_DASHBOARD</div>
              </RequireAuth>
            }
          />
          <Route path="/CxP/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    // The redirect resolved to the login destination; the protected surface did not render.
    expect(screen.getByTestId('login-probe')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_DASHBOARD')).not.toBeInTheDocument();
    // The login destination received the original protected route via ?return=.
    expect(screen.getByTestId('login-probe').textContent).toBe(
      `/CxP/login?return=${encodeURIComponent('/CxP/gastos/dashboard')}`
    );
  });
});
