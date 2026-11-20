import { describe, expect, it } from 'vitest';
import { colorCalor, numero, porcentaje, rangoDeDias, recortar } from './utils';

describe('utils de telemetría', () => {
  it('deja transparente la celda sin movimientos', () => {
    expect(colorCalor(0, 10)).toBe('transparent');
  });

  it('llega a la intensidad máxima en la celda más caliente', () => {
    expect(colorCalor(10, 10)).toBe('rgba(235, 108, 54, 0.90)');
  });

  it('calcula el rango de días hacia atrás', () => {
    const { desde, hasta } = rangoDeDias(7);
    const dias = (hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(dias)).toBe(7);
  });

  it('formatea números y porcentajes en español', () => {
    expect(numero(1234)).toBe('1,234');
    expect(numero(null)).toBe('0');
    expect(porcentaje(1, 4)).toBe('25%');
    expect(porcentaje(1, 0)).toBe('0%');
  });

  it('recorta textos largos y respeta los vacíos', () => {
    expect(recortar('abcdef', 5)).toBe('abcd…');
    expect(recortar('corto', 40)).toBe('corto');
    expect(recortar(null)).toBe('—');
  });
});
