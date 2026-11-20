import { describe, expect, it } from 'vitest';
import { limpiarEtiqueta } from './capturaClics';

describe('limpiarEtiqueta', () => {
  it('quita los importes del texto visible', () => {
    expect(limpiarEtiqueta('Pagar $12,500.00 ahora')).toBe('Pagar $… ahora');
    expect(limpiarEtiqueta('Total $ 1,234.5')).toBe('Total $…');
  });

  it('quita los folios con numeral', () => {
    expect(limpiarEtiqueta('Ver detalle #4821')).toBe('Ver detalle #');
  });

  it('reemplaza números largos (fechas, identificadores)', () => {
    expect(limpiarEtiqueta('Orden 20251120 vencida')).toBe('Orden # vencida');
  });

  it('conserva números cortos que sí describen la acción', () => {
    expect(limpiarEtiqueta('Paso 2 de 3')).toBe('Paso 2 de 3');
  });

  it('normaliza espacios y recorta al máximo', () => {
    expect(limpiarEtiqueta('  Guardar   cambios  ')).toBe('Guardar cambios');
    expect(limpiarEtiqueta('x'.repeat(200))).toHaveLength(80);
  });
});
