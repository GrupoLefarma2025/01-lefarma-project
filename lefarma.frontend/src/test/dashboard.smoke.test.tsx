import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '@/pages/Dashboard';

vi.mock('@/shared/api/apiClient', () => ({
  API: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: null } }),
    post: vi.fn(),
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

function fakeJwt(permissions: string[]): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ permission: permissions }));
  return `${header}.${payload}.sig`;
}

describe('Dashboard (smoke)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      'accessToken',
      fakeJwt(['menu.dashboard', 'dashboard.puede_ver_presupuesto'])
    );
  });

  it('renders the dashboard primary surface without live API data', async () => {
    render(<Dashboard />);

    expect(await screen.findByText('Gasto Total')).toBeInTheDocument();
    expect(screen.getByText('Totales Historicos')).toBeInTheDocument();
  });
});
