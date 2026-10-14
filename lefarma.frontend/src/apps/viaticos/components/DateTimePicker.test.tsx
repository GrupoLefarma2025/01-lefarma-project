import { describe, expect, it, vi } from 'vitest';
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

describe('DateTimePicker', () => {
  it('muestra fecha y hora en un solo campo, o el placeholder si está vacío', () => {
    const { rerender } = render(<DateTimePicker {...PROPS} />);
    expect(screen.getByRole('button', { name: /10 de noviembre de 2026.*06:30 AM/ })).toBeInTheDocument();
    rerender(<DateTimePicker {...PROPS} fecha="" hora="" />);
    expect(screen.getByRole('button', { name: 'Elige fecha y hora de salida' })).toBeInTheDocument();
  });

  it('elegir día avisa la fecha y cierra si ya había hora', async () => {
    const onFecha = vi.fn();
    const usuario = userEvent.setup();
    render(<DateTimePicker {...PROPS} onFecha={onFecha} />);
    await usuario.click(screen.getByRole('button', { name: /10 de noviembre de 2026/ }));
    const grupoDia = screen.getByRole('group', { name: 'Día' });
    const dia15 = within(grupoDia)
      .getAllByRole('button')
      .find((b) => b.textContent === '15');
    expect(dia15).toBeDefined();
    await usuario.click(dia15!);
    const hoy = new Date();
    const esperado = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-15`;
    expect(onFecha).toHaveBeenCalledWith(esperado);
    // Completo: el panel se cierra solo.
    expect(screen.queryByRole('group', { name: 'Hora' })).not.toBeInTheDocument();
  });

  it('elegir hora sin fecha deja el panel abierto para seguir con el día', async () => {
    const onHora = vi.fn();
    const usuario = userEvent.setup();
    render(<DateTimePicker {...PROPS} fecha="" hora="" onHora={onHora} />);
    await usuario.click(screen.getByRole('button', { name: 'Elige fecha y hora de salida' }));
    const grupoHora = screen.getByRole('group', { name: 'Hora' });
    await usuario.click(within(grupoHora).getByRole('button', { name: '06' }));
    expect(onHora).toHaveBeenCalledWith('06:00');
    // Falta la fecha: sigue abierto.
    expect(screen.getByRole('group', { name: 'Minutos' })).toBeInTheDocument();
  });

  it('indica que la hora se muestra en 12 horas', () => {
    render(<DateTimePicker {...PROPS} />);
    expect(screen.getByText(/12 horas.*AM\/PM/)).toBeInTheDocument();
  });
});
