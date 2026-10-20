import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTimePicker } from './DateTimePicker';

const PROPS = {
  id: 'salida',
  fecha: '2026-11-10',
  hora: '06:30',
  onFecha: () => {},
  onHora: () => {},
  placeholder: 'Elige fecha y hora de salida',
};

/** Reloj congelado: «ahorita» es jueves 15 de octubre de 2026, 16:35. */
const AHORA = new Date(2026, 9, 15, 16, 35, 0);

/** Envoltura con estado, como en el asistente: refleja cada cambio del picker. */
function Combinado({ inicialFecha = '', inicialHora = '', desde = null }: { inicialFecha?: string; inicialHora?: string; desde?: { fecha: string; hora: string } | null }) {
  const [fecha, setFecha] = useState(inicialFecha);
  const [hora, setHora] = useState(inicialHora);
  return (
    <DateTimePicker
      id="salida"
      fecha={fecha}
      hora={hora}
      desde={desde}
      onFecha={setFecha}
      onHora={setHora}
      placeholder="Elige fecha y hora de salida"
    />
  );
}

function botonDeDia(texto: string): HTMLElement {
  const grupoDia = screen.getByRole('group', { name: 'Día' });
  const boton = within(grupoDia).getAllByRole('button').find((b) => b.textContent === texto);
  expect(boton).toBeDefined();
  return boton!;
}

describe('DateTimePicker', () => {
  beforeEach(() => {
    // Solo se congela el reloj (Date); los timers reales siguen para userEvent.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra fecha y hora en un solo campo, o el placeholder si está vacío', () => {
    const { rerender } = render(<DateTimePicker {...PROPS} />);
    expect(screen.getByRole('button', { name: /10 de noviembre de 2026.*06:30 AM/ })).toBeInTheDocument();
    rerender(<DateTimePicker {...PROPS} fecha="" hora="" />);
    expect(screen.getByRole('button', { name: 'Elige fecha y hora de salida' })).toBeInTheDocument();
  });

  it('al elegir un día sin hora preselecciona la hora actual', async () => {
    const usuario = userEvent.setup();
    render(<Combinado />);
    await usuario.click(screen.getByRole('button', { name: 'Elige fecha y hora de salida' }));
    await usuario.click(screen.getByRole('button', { name: /next month/i }));
    await usuario.click(botonDeDia('15'));
    // El reloj congelado marca 16:35; el día elegido es futuro.
    expect(screen.getByRole('button', { name: /15 de noviembre de 2026.*04:35 PM/ })).toBeInTheDocument();
  });

  it('elegir un día futuro con hora ya elegida cierra el panel', async () => {
    const onFecha = vi.fn();
    const usuario = userEvent.setup();
    render(<DateTimePicker {...PROPS} onFecha={onFecha} />);
    await usuario.click(screen.getByRole('button', { name: /10 de noviembre de 2026/ }));
    // Un mes adelante siempre hay días futuros, sin depender del día de hoy.
    await usuario.click(screen.getByRole('button', { name: /next month/i }));
    await usuario.click(botonDeDia('15'));
    expect(onFecha).toHaveBeenCalledWith('2026-11-15');
    expect(screen.queryByRole('group', { name: 'Hora' })).not.toBeInTheDocument();
  });

  it('elegir el día con una hora ya capturada cierra el panel sin tocar hora y minuto', async () => {
    const usuario = userEvent.setup();
    render(<Combinado inicialHora="06:30" />);
    await usuario.click(screen.getByRole('button', { name: /Elige fecha y hora de salida.*06:30 AM/ }));
    await usuario.click(screen.getByRole('button', { name: /next month/i }));
    await usuario.click(botonDeDia('15'));
    expect(screen.queryByRole('group', { name: 'Día' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /15 de noviembre de 2026.*06:30 AM/ })).toBeInTheDocument();
  });

  it('elegir hoy con una hora ya pasada limpia la hora y no cierra', async () => {
    const usuario = userEvent.setup();
    render(<Combinado inicialHora="08:30" />);
    await usuario.click(screen.getByRole('button', { name: /Elige fecha y hora de salida.*08:30 AM/ }));
    await usuario.click(botonDeDia('15'));
    // 08:30 ya pasó (son las 16:35): la hora se limpia y hay que elegirla otra vez.
    expect(screen.getByRole('button', { name: /15 de octubre de 2026.*--:--/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Minutos' })).toBeInTheDocument();
  });

  it('no cierra hasta que haya día, hora y minuto explícito', async () => {
    const usuario = userEvent.setup();
    render(<Combinado />);
    await usuario.click(screen.getByRole('button', { name: 'Elige fecha y hora de salida' }));
    await usuario.click(within(screen.getByRole('group', { name: 'Hora' })).getByRole('button', { name: '08' }));
    // Hora sin minuto explícito: sigue abierto.
    expect(screen.getByRole('group', { name: 'Minutos' })).toBeInTheDocument();
    await usuario.click(within(screen.getByRole('group', { name: 'Minutos' })).getByRole('button', { name: '30' }));
    // Falta el día: sigue abierto.
    expect(screen.getByRole('group', { name: 'Día' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /next month/i }));
    await usuario.click(botonDeDia('15'));
    expect(screen.queryByRole('group', { name: 'Día' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /15 de noviembre de 2026.*08:30 AM/ })).toBeInTheDocument();
  });

  it('con la fecha de hoy no ofrece días, horas ni minutos pasados', async () => {
    const usuario = userEvent.setup();
    render(<Combinado inicialFecha="2026-10-15" />);
    await usuario.click(screen.getByRole('button', { name: /15 de octubre de 2026/ }));
    expect(botonDeDia('14')).toBeDisabled();
    expect(botonDeDia('16')).not.toBeDisabled();
    const grupoHora = screen.getByRole('group', { name: 'Hora' });
    expect(within(grupoHora).getByRole('button', { name: '15' })).toBeDisabled();
    expect(within(grupoHora).getByRole('button', { name: '16' })).not.toBeDisabled();
    expect(within(grupoHora).getByRole('button', { name: '23' })).not.toBeDisabled();
    // La hora actual arranca en el minuto actual, no en :00 (no se elige un horario pasado).
    await usuario.click(within(grupoHora).getByRole('button', { name: '16' }));
    expect(screen.getByRole('button', { name: /15 de octubre de 2026.*04:35 PM/ })).toBeInTheDocument();
    const grupoMinutos = screen.getByRole('group', { name: 'Minutos' });
    expect(within(grupoMinutos).getByRole('button', { name: '30' })).toBeDisabled();
    expect(within(grupoMinutos).getByRole('button', { name: '35' })).not.toBeDisabled();
    expect(within(grupoMinutos).getByRole('button', { name: '40' })).not.toBeDisabled();
  });

  it('con «desde» no ofrece días ni horas anteriores al mínimo', async () => {
    const usuario = userEvent.setup();
    render(<Combinado desde={{ fecha: '2026-11-20', hora: '10:30' }} />);
    await usuario.click(screen.getByRole('button', { name: 'Elige fecha y hora de salida' }));
    await usuario.click(screen.getByRole('button', { name: /next month/i }));
    // Días anteriores al mínimo quedan bloqueados.
    expect(botonDeDia('19')).toBeDisabled();
    await usuario.click(botonDeDia('20'));
    // La hora se autocompleta con la actual (16:35) y el panel se cierra.
    await usuario.click(screen.getByRole('button', { name: /20 de noviembre de 2026.*04:35 PM/ }));
    const grupoHora = screen.getByRole('group', { name: 'Hora' });
    expect(within(grupoHora).getByRole('button', { name: '09' })).toBeDisabled();
    expect(within(grupoHora).getByRole('button', { name: '11' })).not.toBeDisabled();
  });

  it('si al abrir ya estaba completo, corregir la hora cierra el panel', async () => {
    const usuario = userEvent.setup();
    render(<Combinado inicialFecha="2026-10-16" inicialHora="08:30" />);
    await usuario.click(screen.getByRole('button', { name: /16 de octubre de 2026.*08:30 AM/ }));
    await usuario.click(within(screen.getByRole('group', { name: 'Hora' })).getByRole('button', { name: '09' }));
    expect(screen.queryByRole('group', { name: 'Hora' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /16 de octubre de 2026.*09:30 AM/ })).toBeInTheDocument();
  });

  it('elegir hora sin fecha deja el panel abierto para seguir con el día', async () => {
    const onHora = vi.fn();
    const usuario = userEvent.setup();
    render(<DateTimePicker {...PROPS} fecha="" hora="" onHora={onHora} />);
    await usuario.click(screen.getByRole('button', { name: 'Elige fecha y hora de salida' }));
    const grupoHora = screen.getByRole('group', { name: 'Hora' });
    await usuario.click(within(grupoHora).getByRole('button', { name: '06' }));
    // Sin minuto capturado se usa el minuto actual ya preseleccionado.
    expect(onHora).toHaveBeenCalledWith('06:35');
    // Falta la fecha: sigue abierto.
    expect(screen.getByRole('group', { name: 'Minutos' })).toBeInTheDocument();
  });

  it('indica que la hora se muestra en 12 horas', () => {
    render(<DateTimePicker {...PROPS} />);
    expect(screen.getByText(/12 horas.*AM\/PM/)).toBeInTheDocument();
  });
});
