import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppRegistryEntry } from '@/apps/_registry';

// Home reads the registry directly; we control it per-test to exercise both the
// populated and empty states without depending on the real placeholder entries.
vi.mock('@/apps/_registry', async () => {
  const actual = await vi.importActual<typeof import('@/apps/_registry')>('@/apps/_registry');
  return { ...actual, appRegistry: [] as AppRegistryEntry[] };
});

import { Home } from '@/apps/baseapp/Home';
import { appRegistry } from '@/apps/_registry';

function setRegistry(entries: AppRegistryEntry[]) {
  // Mutate the array exported by the mock in place so Home, which imports the
  // same reference, observes the updated entries on its next render.
  (appRegistry as AppRegistryEntry[]).splice(0, appRegistry.length, ...entries);
}

describe('Home launcher (base-app)', () => {
  beforeEach(() => {
    setRegistry([]);
  });

  it('Scenario: Launcher lists registry apps — one tile per entry with a navigation affordance', () => {
    setRegistry([
      { id: 'cxp', label: 'CxP', path: '/cxp/' },
      { id: 'contabilidad', label: 'Contabilidad', path: '/contabilidad/' },
    ]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    // One launcher entry per registry item.
    const cxpLink = screen.getByRole('link', { name: /cxp/i });
    const contabilidadLink = screen.getByRole('link', { name: /contabilidad/i });
    expect(cxpLink).toBeInTheDocument();
    expect(contabilidadLink).toBeInTheDocument();
    // Each entry exposes navigation to that app's path.
    expect(cxpLink).toHaveAttribute('href', '/cxp/');
    expect(contabilidadLink).toHaveAttribute('href', '/contabilidad/');
  });

  it('Scenario: Empty registry renders gracefully — empty state, no crash', () => {
    setRegistry([]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    // Graceful empty state rather than a blank/broken surface.
    expect(screen.getByText(/no hay aplicaciones disponibles|sin aplicaciones/i)).toBeInTheDocument();
  });

  it('Scenario: Adding an app entry is code-only — Home renders a newly added entry without component changes', () => {
    setRegistry([{ id: 'nomina', label: 'Nómina', path: '/nomina/' }]);

    const { rerender } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /nómina/i })).toBeInTheDocument();

    // "Add" another entry (simulating a developer appending to the registry) and
    // re-render: the new tile appears with zero changes to Home itself.
    setRegistry([
      { id: 'nomina', label: 'Nómina', path: '/nomina/' },
      { id: 'activos', label: 'Activos Fijos', path: '/activos/' },
    ]);
    rerender(<MemoryRouter><Home /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /nómina/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /activos fijos/i })).toBeInTheDocument();
  });

  it('renders a disabled entry without a navigable href', () => {
    setRegistry([{ id: 'cxp', label: 'CxP', path: '/cxp/', disabled: true }]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    // A disabled app is shown but must not expose a live navigation target.
    const item = screen.getByText(/cxp/i);
    expect(item).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cxp/i })).not.toBeInTheDocument();
  });
});
