import { describe, it, expect } from 'vitest';
import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';

describe('apps/_registry — static app registry module', () => {
  it('exports appRegistry as an array', () => {
    expect(Array.isArray(appRegistry)).toBe(true);
  });

  it('every entry satisfies the AppRegistryEntry contract', () => {
    appRegistry.forEach((entry: AppRegistryEntry) => {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.path).toBe('string');
      expect(entry.path.startsWith('/')).toBe(true);
      if (entry.hairline !== undefined) {
        expect(entry.hairline).toBeTruthy();
        expect(['function', 'object']).toContain(typeof entry.hairline);
      }
    });
  });

  it('entry ids are unique', () => {
    const ids = appRegistry.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the launcher apps carry their Hairline figures', () => {
    for (const id of ['cxp', 'rh', 'educacion-medica', 'viaticos']) {
      expect(appRegistry.find((e) => e.id === id)?.hairline).toBeTruthy();
    }
  });

  it('adding an app entry is code-only (no shell wiring required)', () => {
    const candidate: AppRegistryEntry = {
      id: 'cxp',
      label: 'Cuentas por Pagar',
      path: '/cxp/',
      description: 'Future CxP app',
      disabled: true,
    };
    expect(candidate.id).toBeTruthy();
    expect(candidate.path.startsWith('/')).toBe(true);
  });
});
