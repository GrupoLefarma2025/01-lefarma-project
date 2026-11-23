import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/auth/Login';
import { useAuthStore } from '@/shared/auth/authStore';

vi.mock('@/shared/api/apiClient', () => ({
  API: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: null } }),
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          domains: ['DC'],
          requiresDomainSelection: false,
          displayName: 'Test User',
        },
      },
    }),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  proveedorApi: {
    autorizar: vi.fn(),
    rechazar: vi.fn(),
    bulkUpload: vi.fn(),
  },
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Login (smoke)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.getState().resetLoginFlow();
  });

  it('renders the username step of the login form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('usuario')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
  });

  it('accepts a username and advances to the password step via mocked auth', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const usernameInput = screen.getByPlaceholderText('usuario');
    await user.type(usernameInput, 'testuser');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByPlaceholderText('Ingresa tu contraseña')).toBeInTheDocument();
  });
});
