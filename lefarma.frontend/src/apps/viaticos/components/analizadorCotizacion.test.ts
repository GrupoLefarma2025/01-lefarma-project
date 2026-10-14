import { describe, expect, it } from 'vitest';
import { desgloseConceptos } from './analizadorCotizacion';
import type { FilaCotizacion } from '../types/cotizacion.types';

/** Fila de cotizacion completa; cada caso cambia solo lo que le importa. */
const fila = (parcial: Partial<FilaCotizacion>): FilaCotizacion => ({
  clave: 'fila',
  modo: 'avion',
  transportista: 'Aerolinea',
  salida: '2026-11-10T06:05:00-06:00',
  llegada: '2026-11-10T07:35:00-06:00',
  precio: 1000,
  moneda: 'MXN',
  url_compra: 'https://ejemplo.test/compra',
  capturas: [],
  fuente: 'ejemplo.test',
  estimado: false,
  seleccionada: false,
  ...parcial,
});

describe('desgloseConceptos', () => {
  it('suma por modo solo las filas elegidas: avion, autobus y hotel', () => {
    const desglose = desgloseConceptos([
      fila({ modo: 'avion', precio: 2450.5, seleccionada: true }),
      fila({ modo: 'avion', precio: 1899, seleccionada: false }),
      fila({ modo: 'autobus', precio: 700, seleccionada: true }),
      fila({ modo: 'hotel', precio: 3180, seleccionada: true }),
    ]);

    expect(desglose).toEqual({
      avion: 2450.5,
      autobus: 700,
      hospedaje: 3180,
      gasolina: null,
      casetas: null,
      comida: null,
      taxi: null,
      total: 2450.5 + 700 + 3180,
    });
  });

  it('un modo sin filas elegidas queda null, nunca 0', () => {
    const desglose = desgloseConceptos([fila({ modo: 'avion', seleccionada: true })]);

    expect(desglose.autobus).toBeNull();
    expect(desglose.hospedaje).toBeNull();
    expect(desglose.total).toBe(1000);
  });

  it('una fila elegida sin precio deja el concepto entero en null, no suma parcial', () => {
    const desglose = desgloseConceptos([
      fila({ modo: 'avion', precio: 2450.5, seleccionada: true }),
      fila({ modo: 'avion', precio: null, fuente: 'estimado', seleccionada: true }),
    ]);

    expect(desglose.avion).toBeNull();
    // El unico concepto con dato tambien es desconocido: total es null.
    expect(desglose.total).toBeNull();
  });

  it('un precio 0 es un costo cero conocido, distinto de null', () => {
    const desglose = desgloseConceptos([fila({ modo: 'autobus', precio: 0, seleccionada: true })]);

    expect(desglose.autobus).toBe(0);
    expect(desglose.total).toBe(0);
  });

  it('propaga gasolina, casetas, comida y taxi del motor y los suma al total solo si son conocidos', () => {
    const conMotor = desgloseConceptos([fila({ modo: 'avion', precio: 1000, seleccionada: true })], {
      gasolina: 250,
      casetas: 50,
      hospedaje: null,
      comida: 600,
      taxi: 120,
    });
    expect(conMotor.gasolina).toBe(250);
    expect(conMotor.casetas).toBe(50);
    expect(conMotor.comida).toBe(600);
    expect(conMotor.taxi).toBe(120);
    expect(conMotor.total).toBe(1000 + 250 + 50 + 600 + 120);

    const sinMotor = desgloseConceptos([fila({ modo: 'avion', precio: 1000, seleccionada: true })]);
    expect(sinMotor.gasolina).toBeNull();
    expect(sinMotor.casetas).toBeNull();
    expect(sinMotor.comida).toBeNull();
    expect(sinMotor.taxi).toBeNull();
    expect(sinMotor.total).toBe(1000);
  });

  it('comida y taxi del motor siguen la regla: null es desconocido y 0 es un costo cero conocido', () => {
    const desglose = desgloseConceptos([], {
      gasolina: null,
      casetas: null,
      hospedaje: null,
      comida: 0,
      taxi: null,
    });
    expect(desglose.comida).toBe(0);
    expect(desglose.taxi).toBeNull();
    // Unico concepto conocido: comida 0. Conocido, asi que el total no es null.
    expect(desglose.total).toBe(0);
  });

  it('el hospedaje del motor es respaldo del cotizado de pi, nunca un segundo sumando', () => {
    // Sin hotel de pi: manda la tarifa tabulador del motor.
    const soloMotor = desgloseConceptos([fila({ modo: 'avion', precio: 1000, seleccionada: true })], {
      gasolina: null,
      casetas: null,
      hospedaje: 1500,
      comida: null,
      taxi: null,
    });
    expect(soloMotor.hospedaje).toBe(1500);
    expect(soloMotor.total).toBe(2500);

    // Con hotel cotizado y elegido: gana el precio real de pi, sin sumar el
    // estimado tabulador del motor encima.
    const conPi = desgloseConceptos([fila({ modo: 'hotel', precio: 3180, seleccionada: true })], {
      gasolina: null,
      casetas: null,
      hospedaje: 1500,
      comida: null,
      taxi: null,
    });
    expect(conPi.hospedaje).toBe(3180);
    expect(conPi.total).toBe(3180);
  });

  it('sin ningun concepto conocido el total es null, no un $0.00 inventado', () => {
    expect(desgloseConceptos([]).total).toBeNull();
  });
});