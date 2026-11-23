import { describe, expect, it } from 'vitest';
import { combinarContexto } from './capturaErrores';

describe('combinarContexto', () => {
  it('siempre incluye la vista y el tamaño de pantalla aunque no haya detalle', () => {
    const contexto = JSON.parse(combinarContexto()) as Record<string, unknown>;

    expect(contexto.vista).toBeTypeOf('string');
    expect(contexto.viewport).toMatch(/^\d+x\d+$/);
    expect(contexto.pantalla).toMatch(/^\d+x\d+$/);
    expect(contexto.idioma).toBeTypeOf('string');
    expect(contexto.zona).toBeTypeOf('string');
    expect(contexto).toHaveProperty('red');
  });

  it('conserva el detalle propio del error junto al contexto de la vista', () => {
    const contexto = JSON.parse(
      combinarContexto(JSON.stringify({ componente: 'en DataTable', linea: 12 })),
    ) as Record<string, unknown>;

    expect(contexto.componente).toBe('en DataTable');
    expect(contexto.linea).toBe(12);
    expect(contexto.vista).toBeTypeOf('string');
  });

  it('guarda como texto el detalle que no es JSON válido y no se pasa de 4096', () => {
    const contexto = JSON.parse(combinarContexto('x'.repeat(6000))) as Record<string, unknown>;

    expect(contexto.detalle).toBe('x'.repeat(500));
    expect(combinarContexto('x'.repeat(6000)).length).toBeLessThanOrEqual(4096);
  });
});
