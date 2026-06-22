import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShellLayout } from '@/apps/baseapp/ShellLayout';

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ShellLayout (base-app authenticated shell)', () => {
  it('Scenario: Authenticated user sees the shell — primary navigation + content region render', () => {
    renderWithRouter(
      <ShellLayout>
        <div>launcher-content</div>
      </ShellLayout>
    );

    // Primary navigation is present.
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    // The brand / shell identity is visible.
    expect(screen.getByText(/lefarma/i)).toBeInTheDocument();
    // The children (content region / launcher) render inside the shell.
    expect(screen.getByText('launcher-content')).toBeInTheDocument();
    // A content landmark exists.
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('exposes navigation links to the shell surfaces (home + profile)', () => {
    renderWithRouter(
      <ShellLayout>
        <div>content</div>
      </ShellLayout>
    );

    // The shell's primary nav links to its own surfaces. (base-app spec:
    // Excludes Administration UI — admin must NOT appear here.)
    expect(screen.getByRole('link', { name: /inicio/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
  });

  it('Scenario: No Global Context Assumption — shell renders without any context provider', () => {
    // The shell MUST render for an authenticated session that has no
    // empresa/sucursal/area context selected. Concretely: ShellLayout renders
    // without being wrapped in any context provider and without throwing.
    const renderResult = renderWithRouter(
      <ShellLayout>
        <div>no-context-content</div>
      </ShellLayout>
    );

    expect(renderResult.container.firstChild).not.toBeNull();
    expect(screen.getByText('no-context-content')).toBeInTheDocument();
  });

  it('Scenario: Excludes Administration UI — no admin route in the shell nav', () => {
    renderWithRouter(
      <ShellLayout>
        <div>content</div>
      </ShellLayout>
    );

    // The base-app shell MUST NOT surface user/role/permission administration
    // (base-app spec: "Excludes Administration UI"). Admin stays in the Gastos
    // build at its current location.
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /permisos/i })).not.toBeInTheDocument();
  });
});
