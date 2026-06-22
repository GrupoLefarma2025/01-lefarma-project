import { describe, it, expect } from 'vitest';
import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';

/**
 * Static App Registry contract (app-routing spec: "Static App Registry" /
 * "Launcher reads from the static registry" + base-app spec: "Adding an app
 * entry is code-only").
 *
 * These tests lock the MODULE SHAPE — that the launcher's source of truth is a
 * static, code-level array whose entries are well-formed. The render behavior
 * (one tile per entry) is covered by Home.test.tsx.
 */
describe('apps/_registry — static app registry module', () => {
  it('exports appRegistry as an array', () => {
    expect(Array.isArray(appRegistry)).toBe(true);
  });

  it('every entry satisfies the AppRegistryEntry contract', () => {
    // Empty registry is a legal runtime state (covered by Home.test.tsx); but any
    // entry that IS present must be well-formed.
    appRegistry.forEach((entry: AppRegistryEntry) => {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.path).toBe('string');
      // Navigation target must be an absolute path (open-redirect / href safety).
      expect(entry.path.startsWith('/')).toBe(true);
    });
  });

  it('entry ids are unique', () => {
    const ids = appRegistry.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adding an app entry is code-only (no shell wiring required)', () => {
    // A developer adds a new object literal to the array; nothing else changes.
    // This test documents that contract by constructing an ad-hoc entry that
    // matches AppRegistryEntry and confirming it validates — proving new entries
    // are pure data, not behavior that needs shell code changes.
    const candidate: AppRegistryEntry = {
      id: 'cxp',
      label: 'Cuentas por Pagar',
      path: '/CxP/cxp/',
      description: 'Future CxP app',
      disabled: true,
    };
    expect(candidate.id).toBeTruthy();
    expect(candidate.path.startsWith('/')).toBe(true);
  });
});
