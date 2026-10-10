import { describe, expect, it } from 'vitest';
import { DATOS_PRUEBA_SOLICITUD, VIATICOS_FIXTURES_ACTIVOS } from './solicitudV2.fixture';

const NOMBRES_REALES_PROHIBIDOS = ['CESAR', 'JUAN PABLO', 'SANTIAGO', 'ANGEL REMEDIOS', 'ROBERTO CRUZ', 'PADILLA'];

describe('fixtures de la solicitud (solo desarrollo)', () => {
  it('están apagados salvo bandera explícita de desarrollo', () => {
    // Sin VITE_VIATICOS_FIXTURES=1 nunca hay autofill en el formulario normal.
    expect(VIATICOS_FIXTURES_ACTIVOS).toBe(false);
  });

  it('no contienen nombres reales ni datos privados', () => {
    const texto = JSON.stringify(DATOS_PRUEBA_SOLICITUD);
    for (const nombre of NOMBRES_REALES_PROHIBIDOS) {
      expect(texto.toLocaleUpperCase('es-MX')).not.toContain(nombre);
    }
  });

  it('usan solo MXN y coordenadas válidas dentro de México', () => {
    expect(DATOS_PRUEBA_SOLICITUD.moneda).toBe('MXN');
    for (const punto of DATOS_PRUEBA_SOLICITUD.puntos) {
      expect(punto.latitud).toBeGreaterThanOrEqual(14);
      expect(punto.latitud).toBeLessThanOrEqual(33);
      expect(punto.longitud).toBeGreaterThanOrEqual(-119);
      expect(punto.longitud).toBeLessThanOrEqual(-86);
    }
  });
});
