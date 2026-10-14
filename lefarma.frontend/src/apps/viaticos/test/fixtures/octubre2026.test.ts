import { describe, expect, it } from 'vitest';
import {
  sumaCategoria,
  sumaCategorias,
  TOTALES_OCTUBRE_2026,
  VIAJES_OCTUBRE_2026,
} from './octubre2026';

describe('fixture de regresion octubre 2026', () => {
  it('congela los 20 viajes del concentrado y su numeracion original', () => {
    expect(VIAJES_OCTUBRE_2026).toHaveLength(20);
    expect(VIAJES_OCTUBRE_2026.map(v => v.no)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(VIAJES_OCTUBRE_2026[0]).toMatchObject({
      solicitante: 'CESAR MARTIN GARCIA ALONSO',
      origen: 'CDMX',
      destino: 'TOLUCA',
      total: 2110,
    });
    expect(VIAJES_OCTUBRE_2026[19]).toMatchObject({
      solicitante: 'CESAR MARTIN GARCIA ALONSO',
      destino: 'VERACRUZ XALAPA',
      total: 11741,
    });
  });

  it('cada viaje suma exactamente su columna Total del concentrado', () => {
    for (const viaje of VIAJES_OCTUBRE_2026) {
      expect(sumaCategorias(viaje), `viaje ${viaje.no}`).toBe(viaje.total);
    }
  });

  it('las 20 filas suman la fila de totales del concentrado', () => {
    for (const categoria of ['autobus', 'avion', 'hospedaje', 'comida', 'taxi'] as const) {
      expect(sumaCategoria(VIAJES_OCTUBRE_2026, categoria)).toBe(TOTALES_OCTUBRE_2026[categoria]);
    }
    expect(
      VIAJES_OCTUBRE_2026.reduce((suma, viaje) => suma + viaje.total, 0),
    ).toBe(TOTALES_OCTUBRE_2026.total);
  });

  it('distingue celda vacia (null) de cero', () => {
    // Un dia sin hospedaje es null, no 0: las salidas 1, 14 y 15 no lo tienen.
    expect(VIAJES_OCTUBRE_2026.filter(v => v.hospedaje === null).map(v => v.no)).toEqual([1, 14, 15]);
    // Los viajes 6, 9, 12 y 17 son solo avion (sin autobus).
    expect(VIAJES_OCTUBRE_2026.filter(v => v.autobus === null).map(v => v.no)).toEqual([6, 9, 12, 17]);
    expect(VIAJES_OCTUBRE_2026.some(v => Object.values(v).includes(0))).toBe(false);
  });
});