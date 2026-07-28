import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppRegistryEntry } from '@/apps/_registry';

// Home reads the registry directly; we control it per-test to exercise both the
// populated and empty states without depending on the real placeholder entries.
vi.mock('@/apps/_registry', async () => {
  const actual = await vi.importActual<typeof import('@/apps/_registry')>('@/apps/_registry');
  return { ...actual, appRegistry: [] as AppRegistryEntry[] };
});

// checkPermission se controla por test; usePermissionVersion real es inofensivo (store vacío).
vi.mock('@/utils/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/utils/permissions')>('@/utils/permissions');
  return { ...actual, checkPermission: vi.fn(() => true) };
});

import { Home } from '@/apps/baseapp/Home';
import { appRegistry } from '@/apps/_registry';
import { checkPermission } from '@/utils/permissions';

function setRegistry(entries: AppRegistryEntry[]) {
  // Mutate the array exported by the mock in place so Home, which imports the
  // same reference, observes the updated entries on its next render.
  (appRegistry as AppRegistryEntry[]).splice(0, appRegistry.length, ...entries);
}

const allSection = () =>
  screen.getByRole('heading', { name: /todas las apps/i }).closest('section')!;
const pinnedSection = () =>
  screen.getByRole('heading', { name: /fijadas/i }).closest('section')!;

describe('Home launcher (base-app)', () => {
  beforeEach(() => {
    setRegistry([]);
    vi.mocked(checkPermission).mockReturnValue(true);
    localStorage.removeItem('hub-pinned-apps');
    localStorage.removeItem('hub-app-order');
  });

  it('Scenario: Launcher lists registry apps — one tile per entry with a navigation affordance', () => {
    setRegistry([
      { id: 'cxp', label: 'CxP', path: '/cxp/' },
      { id: 'contabilidad', label: 'Contabilidad', path: '/contabilidad/' },
    ]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    const cxpLink = screen.getByRole('link', { name: /cxp/i });
    const contabilidadLink = screen.getByRole('link', { name: /contabilidad/i });
    expect(cxpLink).toHaveAttribute('href', '/cxp/');
    expect(contabilidadLink).toHaveAttribute('href', '/contabilidad/');
  });

  it('Scenario: Empty registry renders gracefully — empty state, no crash', () => {
    setRegistry([]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    expect(screen.getByText(/no hay aplicaciones disponibles|sin aplicaciones/i)).toBeInTheDocument();
  });

  it('Scenario: Adding an app entry is code-only — Home renders a newly added entry without component changes', () => {
    setRegistry([{ id: 'nomina', label: 'Nómina', path: '/nomina/' }]);

    const { rerender } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /nómina/i })).toBeInTheDocument();

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

    const item = screen.getByText(/cxp/i);
    expect(item).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cxp/i })).not.toBeInTheDocument();
  });

  it('Scenario: Tile gated by permission — hidden without it, visible with it', () => {
    setRegistry([
      { id: 'cxp', label: 'CxP', path: '/cxp/', permission: 'baseapp.hub.puede_ver_cxp' },
    ]);

    vi.mocked(checkPermission).mockReturnValue(false);
    const { rerender } = render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: /cxp/i })).not.toBeInTheDocument();
    expect(checkPermission).toHaveBeenCalledWith({ require: 'baseapp.hub.puede_ver_cxp' });

    vi.mocked(checkPermission).mockReturnValue(true);
    rerender(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /cxp/i })).toHaveAttribute('href', '/cxp/');
  });

  it('Scenario: Pinning — nothing by default; a pinned app shows in BOTH sections; pin order persists', () => {
    setRegistry([
      { id: 'cxp', label: 'CxP', path: '/cxp/' },
      { id: 'rh', label: 'Recursos Humanos', path: '/rh/' },
    ]);

    render(<MemoryRouter><Home /></MemoryRouter>);

    // Por defecto nada fijado: sin sección "Fijadas", todo en "Todas las apps".
    expect(screen.queryByRole('heading', { name: /fijadas/i })).not.toBeInTheDocument();
    expect(within(allSection()).getAllByRole('link')).toHaveLength(2);

    // Fijar RH → aparece "Fijadas" y RH queda en AMBAS secciones (duplicado).
    fireEvent.click(within(allSection()).getByRole('button', { name: 'Fijar Recursos Humanos' }));
    expect(screen.getByRole('heading', { name: /fijadas/i })).toBeInTheDocument();
    expect(within(pinnedSection()).getAllByRole('link')).toHaveLength(1);
    expect(within(allSection()).getAllByRole('link')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /recursos humanos/i })).toHaveLength(2);

    // Fijar CxP después → orden de fijado [rh, cxp] persiste y se refleja en "Fijadas".
    fireEvent.click(within(allSection()).getByRole('button', { name: 'Fijar CxP' }));
    expect(JSON.parse(localStorage.getItem('hub-pinned-apps') ?? '[]')).toEqual(['rh', 'cxp']);
    const pinnedLinks = within(pinnedSection()).getAllByRole('link');
    expect(pinnedLinks[0]).toHaveAttribute('href', '/rh/');
    expect(pinnedLinks[1]).toHaveAttribute('href', '/cxp/');

    // Desfijar RH → "Fijadas" conserva solo CxP; RH sigue en "Todas las apps".
    fireEvent.click(within(pinnedSection()).getByRole('button', { name: 'Desfijar Recursos Humanos' }));
    expect(within(pinnedSection()).getAllByRole('link')).toHaveLength(1);
    expect(within(pinnedSection()).getByRole('link')).toHaveAttribute('href', '/cxp/');
    expect(within(allSection()).getByRole('link', { name: /recursos humanos/i })).toBeInTheDocument();
  });
});
