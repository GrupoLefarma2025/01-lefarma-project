import { describe, expect, it } from 'vitest';
import { configuracionMenuItems, shellMenuItems } from './menuItems';

describe('menuItems', () => {
  it('el hub solo muestra Inicio en su barra lateral', () => {
    expect(shellMenuItems.map((item) => item.title)).toEqual(['Inicio']);
  });

  it('el módulo de configuración conserva sus propias entradas', () => {
    expect(configuracionMenuItems.map((item) => item.title)).toEqual([
      'Inicio',
      'Configuración',
      'Telemetría',
    ]);
  });
});
