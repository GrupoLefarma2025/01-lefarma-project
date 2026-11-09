import { describe, expect, it } from 'vitest';
import {
  calcularTiempoAtencion,
  calcularTiempoLaboralMs,
  formatDuracion,
} from './tiempoAtencion';

const minutos = (n: number) => n * 60_000;

describe('calcularTiempoLaboralMs', () => {
  it('cuenta minutos dentro del mismo día laboral', () => {
    const desde = new Date(2026, 10, 5, 9, 0);
    const hasta = new Date(2026, 10, 5, 9, 5);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(minutos(5));
  });

  it('viernes 18:29 a lunes 08:01 da 2 minutos laborales', () => {
    const desde = new Date(2026, 10, 6, 18, 29);
    const hasta = new Date(2026, 10, 9, 8, 1);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(minutos(2));
  });

  it('no cuenta el tiempo fuera del horario ni los fines de semana', () => {
    const desde = new Date(2026, 10, 6, 19, 0);
    const hasta = new Date(2026, 10, 9, 8, 0);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(0);
  });

  it('un sábado completo no genera tiempo laboral', () => {
    const desde = new Date(2026, 10, 7, 10, 0);
    const hasta = new Date(2026, 10, 7, 10, 30);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(0);
  });

  it('cruza mes y solo cuenta el lunes', () => {
    const desde = new Date(2026, 9, 31, 18, 0);
    const hasta = new Date(2026, 10, 2, 9, 0);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(minutos(60));
  });

  it('devuelve 0 si la fecha final es anterior o igual', () => {
    const desde = new Date(2026, 10, 5, 12, 0);
    const hasta = new Date(2026, 10, 5, 11, 0);

    expect(calcularTiempoLaboralMs(desde, hasta)).toBe(0);
  });
});

describe('calcularTiempoAtencion', () => {
  it('devuelve tiempo real y laboral', () => {
    const desde = new Date(2026, 10, 6, 18, 29);
    const hasta = new Date(2026, 10, 9, 8, 1);
    const resultado = calcularTiempoAtencion(desde, hasta);

    expect(resultado.laboralMs).toBe(minutos(2));
    expect(resultado.realMs).toBe(hasta.getTime() - desde.getTime());
  });
});

describe('formatDuracion', () => {
  it('formatea cero', () => {
    expect(formatDuracion(0)).toBe('0 min');
  });

  it('formatea minutos', () => {
    expect(formatDuracion(minutos(2))).toBe('2 min');
  });

  it('formatea días, horas y minutos', () => {
    const dosDiasTreceHorasTreintaYDosMinutos =
      2 * 86_400_000 + 13 * 3_600_000 + 32 * 60_000;

    expect(formatDuracion(dosDiasTreceHorasTreintaYDosMinutos)).toBe('2 d 13 h 32 min');
  });

  it('incluye segundos solo cuando se piden', () => {
    expect(formatDuracion(65_000, true)).toBe('1 min 5 s');
    expect(formatDuracion(65_000, false)).toBe('1 min');
  });
});
