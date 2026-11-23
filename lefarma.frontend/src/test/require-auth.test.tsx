import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

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
    expect(authService.getEmpresas).not.toHaveBeenCalled();
    expect(authService.getSucursales).not.toHaveBeenCalled();
    expect(authService.getAreas).not.toHaveBeenCalled();
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

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
    expect(useAuthStore.getState().empresas).toEqual([]);
    expect(useAuthStore.getState().loginStep).toBe(1);
    expect(await screen.findByText('HUB_LANDING')).toBeInTheDocument();
    expect(screen.queryByText('Empresa')).not.toBeInTheDocument();
  });
});

function renderGuard(initialPath: string, props: { children?: ReactNode; loginPath?: string }) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <RequireAuth loginPath={props.loginPath}>
              {props.children ?? <div>PROTECTED_SURFACE</div>}
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>LOGIN_DESTINATION</div>} />
        <Route path="/cxp/login" element={<div>CXP_LOGIN_DESTINATION</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth — subtree-aware redirect', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false });
  });

  it('waits for hydration and does not redirect a stored session to login', () => {
    useAuthStore.setState({ isInitialized: false, isAuthenticated: false });
    renderGuard('/perfil', {});

    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_SURFACE')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ isInitialized: true, isAuthenticated: true });
    });

    expect(screen.getByText('PROTECTED_SURFACE')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated session to default /login via <Navigate>', () => {
    renderGuard('/perfil', {});
    expect(screen.getByText('LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_SURFACE')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated session to custom /cxp/login via <Navigate>', () => {
    renderGuard('/perfil', { loginPath: '/cxp/login' });
    expect(screen.getByText('CXP_LOGIN_DESTINATION')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_SURFACE')).not.toBeInTheDocument();
  });

  it('auth-only check: authenticated session without context still passes through', () => {
    useAuthStore.setState({ isAuthenticated: true, empresa: null, sucursal: null, area: null });
    renderGuard('/perfil', {});
    expect(screen.getByText('PROTECTED_SURFACE')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_DESTINATION')).not.toBeInTheDocument();
  });

  it('preserves the return URL via ?return= on redirect (spec: Authentication Guard)', () => {
    function LoginProbe() {
      const loc = useLocation();
      return <div data-testid="login-probe">{loc.pathname + loc.search}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/cxp/dashboard']}>
        <Routes>
          <Route
            path="/cxp/dashboard"
            element={
              <RequireAuth loginPath="/login">
                <div>PROTECTED_DASHBOARD</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-probe')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_DASHBOARD')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-probe').textContent).toBe(
      `/login?return=${encodeURIComponent('/cxp/dashboard')}`
    );
  });
});
