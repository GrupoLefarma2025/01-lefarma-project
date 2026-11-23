import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

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

import { MultiStepLogin } from '@/components/baseapp/MultiStepLogin';
import { useAuthStore } from '@/shared/auth/authStore';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLogin(redirectTo = '/hub') {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <MultiStepLogin redirectTo={redirectTo} />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('MultiStepLogin — sin destello de credenciales', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: false,
      loginStep: 1,
      pendingUsername: null,
      availableDomains: [],
      requiresDomainSelection: false,
      displayName: null,
      isLoading: false,
      user: null,
      token: null,
    });
  });

  it('con sesión autenticada no pinta el formulario y navega al destino', () => {
    useAuthStore.setState({ isAuthenticated: true });

    renderLogin('/hub');

    expect(screen.queryByPlaceholderText('usuario')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/hub');
  });

  it('sin sesión hidratada espera y no pinta el formulario', () => {
    useAuthStore.setState({ isInitialized: false });

    renderLogin();

    expect(screen.queryByPlaceholderText('usuario')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('sin sesión ya hidratada sí muestra el paso de usuario', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('usuario')).toBeInTheDocument();
    expect(screen.getByText('Nombre de Usuario')).toBeInTheDocument();
  });
});
