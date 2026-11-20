import { describe, expect, it } from 'vitest';
import { calcularHuella } from './huella';

describe('calcularHuella', () => {
  it('devuelve 16 caracteres hexadecimales', () => {
    const huella = calcularHuella('http', 'HTTP 500 en GET /api/x', undefined, '/viaticos');
    expect(huella).toMatch(/^[0-9a-f]{16}$/);
  });

  it('es estable para la misma entrada', () => {
    const primera = calcularHuella('js', 'Error de prueba', 'at foo (a.js:1)', '/rh');
    const segunda = calcularHuella('js', 'Error de prueba', 'at foo (a.js:1)', '/rh');
    expect(primera).toBe(segunda);
  });

  it('ignora los números del mensaje', () => {
    const primera = calcularHuella('js', 'Fallo 404 en la fila 12', undefined, '/rh');
    const segunda = calcularHuella('js', 'Fallo 500 en la fila 97', undefined, '/rh');
    expect(primera).toBe(segunda);
  });

  it('distingue el tipo de error', () => {
    const js = calcularHuella('js', 'Mismo mensaje', undefined, '/rh');
    const promesa = calcularHuella('promesa', 'Mismo mensaje', undefined, '/rh');
    expect(js).not.toBe(promesa);
  });

  it('normaliza los identificadores de la ruta', () => {
    const primera = calcularHuella('http', 'HTTP 404', undefined, '/viaticos/123');
    const segunda = calcularHuella('http', 'HTTP 404', undefined, '/viaticos/456');
    expect(primera).toBe(segunda);
  });
});
