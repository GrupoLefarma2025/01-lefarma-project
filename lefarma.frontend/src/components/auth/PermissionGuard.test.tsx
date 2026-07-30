import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

// Stray API imports inside the module graph must resolve; return empty payloads.
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

import { PermissionGuard } from '@/components/auth/PermissionGuard';

/**
 * Verify PermissionGuard `blockedPath` parameterization.
 *
 * The CxP route table threads `resolvedBlockedPath` (per variant) through all
 * `<PermissionGuard>` usages in CxpRoutes.tsx. The routing tests
 * (baseapp-routes.test.tsx) mock out PermissionGuard entirely, leaving the
 * parameterization untested. This suite exercises the REAL PermissionGuard
 * component (NOT mocked) and asserts the redirect target responds to
 * `blockedPath` (app-routing spec: "Permission checks preserved under subtree
 * mounting").
 *
 * Permission control: `checkPermission` reads JWT claims from localStorage.
 * With no token, `codes.size === 0` → always returns false → permission denied.
 * With a token carrying the required claim → permission granted.
 */

function BlockedProbe() {
  const loc = useLocation();
  return <div data-testid="blocked-probe">{loc.pathname}</div>;
}

function renderGuard(props: {
  blockedPath?: string;
  requireAny?: string[];
  children?: ReactNode;
}) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <PermissionGuard
              blockedPath={props.blockedPath}
              requireAny={props.requireAny ?? ['test.perm']}
            >
              {props.children ?? <div>PROTECTED_CONTENT</div>}
            </PermissionGuard>
          }
        />
        <Route path="/bloqueado" element={<BlockedProbe />} />
        <Route path="/cxp/bloqueado" element={<BlockedProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PermissionGuard — blockedPath parameterization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('root default (blockedPath=undefined) redirects to /bloqueado when permission fails', () => {
    // No JWT in localStorage → checkPermission returns false → redirect.
    // blockedPath defaults to '/bloqueado' (default behavior).
    renderGuard({});

    expect(screen.getByTestId('blocked-probe')).toHaveTextContent('/bloqueado');
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument();
  });

  it('subtree override (blockedPath=/cxp/bloqueado) redirects there when permission fails', () => {
    // Subtree variant threads '/cxp/bloqueado' — under the root basename this
    // resolves to '/cxp/bloqueado', NOT '/bloqueado' (the leakage that the
    // subtree-scoped blockedPath prevents). The redirect target must honor the prop.
    renderGuard({ blockedPath: '/cxp/bloqueado' });

    expect(screen.getByTestId('blocked-probe')).toHaveTextContent('/cxp/bloqueado');
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument();
  });

  it('renders children when the permission check passes', () => {
    // Craft a fake JWT carrying the required permission claim.
    const payload = { permission: ['test.perm'] };
    const token = `header.${btoa(JSON.stringify(payload))}.signature`;
    localStorage.setItem('accessToken', token);

    renderGuard({ children: <div>PROTECTED_CONTENT</div> });

    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
    expect(screen.queryByTestId('blocked-probe')).not.toBeInTheDocument();
  });
});
