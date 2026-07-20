import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '@/pages/Dashboard';

// The api module lives at @/shared/api/apiClient (relocated in PR 1a);
// the mock targets that path so it covers Dashboard's API usage directly.
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

// PermissionElement.checkPermission reads permission codes from the JWT stored
// in localStorage (not the auth store). Build a minimal fake token carrying the
// codes the gated dashboard checks so the primary surface renders with no backend.
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

    // API is mocked to empty payloads; once loading resolves the primary
    // surface (historical totals + spend breakdown cards) renders deterministically.
    expect(await screen.findByText('Gasto Total')).toBeInTheDocument();
    expect(screen.getByText('Totales Historicos')).toBeInTheDocument();
  });
});
