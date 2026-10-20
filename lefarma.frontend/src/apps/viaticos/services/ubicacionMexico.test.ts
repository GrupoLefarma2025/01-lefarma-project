import { describe, expect, it } from 'vitest';
import { dentroDeMexico } from './ubicacionMexico';

describe('dentroDeMexico', () => {
  it('acepta puntos de ciudades mexicanas', () => {
    expect(dentroDeMexico(19.4326, -99.1332)).toBe(true); // CDMX
    expect(dentroDeMexico(25.6866, -100.3161)).toBe(true); // Monterrey
    expect(dentroDeMexico(32.5149, -117.0382)).toBe(true); // Tijuana
    expect(dentroDeMexico(21.1619, -86.8515)).toBe(true); // Cancún
    expect(dentroDeMexico(20.9674, -89.5926)).toBe(true); // Mérida
    expect(dentroDeMexico(20.6597, -103.3496)).toBe(true); // Guadalajara
    expect(dentroDeMexico(23.2494, -106.4111)).toBe(true); // Mazatlán
    expect(dentroDeMexico(16.8531, -99.8237)).toBe(true); // Acapulco
    expect(dentroDeMexico(31.6904, -106.4245)).toBe(true); // Ciudad Juárez
    expect(dentroDeMexico(31.3086, -110.9422)).toBe(true); // Nogales
    expect(dentroDeMexico(28.7, -100.5231)).toBe(true); // Piedras Negras
    expect(dentroDeMexico(26.0508, -98.2978)).toBe(true); // Reynosa
    expect(dentroDeMexico(25.869, -97.5027)).toBe(true); // Matamoros
    expect(dentroDeMexico(32.6245, -115.4523)).toBe(true); // Mexicali
    expect(dentroDeMexico(18.5001, -88.2961)).toBe(true); // Chetumal
    expect(dentroDeMexico(20.5083, -86.9458)).toBe(true); // Cozumel
  });

  it('rechaza puntos fuera de México', () => {
    expect(dentroDeMexico(29.7604, -95.3698)).toBe(false); // Houston
    expect(dentroDeMexico(29.4241, -98.4936)).toBe(false); // San Antonio
    expect(dentroDeMexico(25.7617, -80.1918)).toBe(false); // Miami
    expect(dentroDeMexico(14.6349, -90.5069)).toBe(false); // Guatemala
    expect(dentroDeMexico(17.5046, -88.1962)).toBe(false); // Belice
    expect(dentroDeMexico(32.7157, -117.1611)).toBe(false); // San Diego
    expect(dentroDeMexico(31.7619, -106.485)).toBe(false); // El Paso
    expect(dentroDeMexico(25.9017, -97.4975)).toBe(false); // Brownsville
  });
});
