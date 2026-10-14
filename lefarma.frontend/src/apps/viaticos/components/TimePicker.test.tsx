import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from './TimePicker';

describe('TimePicker', () => {
  it('muestra la hora elegida en el botón y un marcador cuando está vacío', () => {
    const { rerender } = render(<TimePicker id="hora" value="06:30" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '06:30 AM' })).toBeInTheDocument();
    rerender(<TimePicker id="hora" value="" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '--:--' })).toBeInTheDocument();
  });

  it('abre el panel centrado en el valor y completa HH:mm al elegir', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<TimePicker id="hora" value="06:30" onChange={onChange} />);
    await usuario.click(screen.getByRole('button', { name: '06:30 AM' }));
    const grupoHora = screen.getByRole('group', { name: 'Hora' });
    await usuario.click(within(grupoHora).getByRole('button', { name: '08' }));
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('completa con 00 la parte faltante', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<TimePicker id="hora" value="" onChange={onChange} />);
    await usuario.click(screen.getByRole('button', { name: '--:--' }));
    const grupoMinutos = screen.getByRole('group', { name: 'Minutos' });
    await usuario.click(within(grupoMinutos).getByRole('button', { name: '45' }));
    expect(onChange).toHaveBeenCalledWith('00:45');
  });

  it('el botón Listo cierra sin cambiar', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<TimePicker id="hora" value="06:30" onChange={onChange} />);
    await usuario.click(screen.getByRole('button', { name: '06:30 AM' }));
    expect(screen.getByRole('group', { name: 'Hora' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Listo, cerrar' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Hora' })).not.toBeInTheDocument();
  });

  it('expone el error de forma accesible', () => {
    render(<TimePicker id="hora" value="" onChange={() => {}} error="Indica la hora." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Indica la hora.');
  });

  it('indica que la hora se muestra en 12 horas', () => {
    render(<TimePicker id="hora" value="06:30" onChange={() => {}} />);
    expect(screen.getByText(/12 horas.*AM\/PM/)).toBeInTheDocument();
  });

  it('se puede operar con teclado', async () => {
    const usuario = userEvent.setup();
    render(<TimePicker id="hora" value="06:30" onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: '06:30 AM' });
    trigger.focus();
    await usuario.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: 'Minutos' })).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Minutos' })).not.toBeInTheDocument();
  });
});
