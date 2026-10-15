import { describe, expect, it } from 'vitest';
import { formatoHora12h, partirHoraMinuto } from './ColumnasTiempo';

describe('formatoHora12h', () => {
  it('medianoche es 12:00 AM', () => {
    expect(formatoHora12h('00:00')).toBe('12:00 AM');
  });

  it('mañana conserva la hora con AM', () => {
    expect(formatoHora12h('06:30')).toBe('06:30 AM');
  });

  it('mediodía es 12:00 PM', () => {
    expect(formatoHora12h('12:00')).toBe('12:00 PM');
  });

  it('la tarde resta 12 con PM', () => {
    expect(formatoHora12h('13:05')).toBe('01:05 PM');
    expect(formatoHora12h('23:59')).toBe('11:59 PM');
  });

  it('lo inválido se devuelve intacto', () => {
    expect(formatoHora12h('')).toBe('');
    expect(formatoHora12h('25:00')).toBe('25:00');
  });
});

describe('partirHoraMinuto', () => {
  it('parte HH:mm válido', () => {
    expect(partirHoraMinuto('06:30')).toEqual({ hora: '06', minuto: '30' });
  });

  it('lo inválido queda sin elegir', () => {
    expect(partirHoraMinuto('')).toEqual({ hora: '', minuto: '' });
    expect(partirHoraMinuto('6:30')).toEqual({ hora: '', minuto: '' });
  });
});
