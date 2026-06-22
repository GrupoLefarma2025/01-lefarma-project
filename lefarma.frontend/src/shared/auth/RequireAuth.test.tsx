import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mutable auth state read by the mocked store on each render. Tests flip
// `isAuthenticated` directly. The `mock`-prefix lets Vitest's hoisted vi.mock
// factory legally reference this top-level binding.
const mockAuthState = { isAuthenticated: false };

vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: vi.fn(
    <T,>(selector: (state: { isAuthenticated: boolean }) => T): T =>
      selector(mockAuthState)
  ),
}));

import { RequireAuth } from '@/shared/auth/RequireAuth';

/**
 * jsdom's window.location is a non-mockable Location in many versions. We replace
 * it with a configurable stub so RequireAuth's `window.location.href = ...` can be
 * observed without triggering jsdom's "navigation not implemented" error.
 */
interface LocationStub {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  assign: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
}

function stubLocation(pathname: string, search = ''): LocationStub {
  const stub: LocationStub = {
    href: `http://localhost${pathname}${search}`,
    pathname,
    search,
    hash: '',
    origin: 'http://localhost',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  };
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: stub,
  });
  return stub;
}

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RequireAuth — app-routing guard', () => {
  let originalLocation: Location;
  let locationStub: LocationStub;

  beforeEach(() => {
    originalLocation = window.location;
    locationStub = stubLocation('/CxP/perfil');
    mockAuthState.isAuthenticated = false;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it('Scenario: Unauthenticated user is redirected to login and the return URL is preserved', () => {
    // Protected content that must never render for an unauthenticated session.
    renderWithRouter(
      <RequireAuth>
        <div>secret-dashboard</div>
      </RequireAuth>
    );

    // The guard redirects via full-page nav to the existing root login, carrying
    // the protected route's full path (incl. basename) as the `return` param.
    const expectedReturn = encodeURIComponent('/CxP/perfil');
    expect(locationStub.href).toBe(`/login?return=${expectedReturn}`);
    // Protected subtree must not be rendered.
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });

  it('Scenario: Authenticated user passes through and no redirect occurs', () => {
    mockAuthState.isAuthenticated = true;

    renderWithRouter(
      <RequireAuth>
        <div>secret-dashboard</div>
      </RequireAuth>
    );

    // No redirect: href stays at its initial value.
    expect(locationStub.href).toBe('http://localhost/CxP/perfil');
    // Children render normally.
    expect(screen.getByText('secret-dashboard')).toBeInTheDocument();
  });

  it('Scenario: Guard checks authentication, not context selection (authed without empresa/sucursal/area context still passes)', () => {
    // Authenticated, but NO empresa/sucursal/area context selected. The guard MUST
    // NOT block on context — context is deferred to per-app logic (base-app spec:
    // "No Global Context Assumption").
    mockAuthState.isAuthenticated = true;

    renderWithRouter(
      <RequireAuth>
        <div>shell-home</div>
      </RequireAuth>
    );

    expect(locationStub.href).toBe('http://localhost/CxP/perfil');
    expect(screen.getByText('shell-home')).toBeInTheDocument();
  });

  it('honors a custom loginPath when provided', () => {
    locationStub = stubLocation('/CxP/', '');

    renderWithRouter(
      <RequireAuth loginPath="/alt-login">
        <div>never</div>
      </RequireAuth>
    );

    expect(locationStub.href).toBe(`/alt-login?return=${encodeURIComponent('/CxP/')}`);
  });
});
