import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from './TimePicker';

describe('TimePicker', () => {
  it('muestra la hora actual como texto legible y no usa input nativo', () => {
    render(<TimePicker id="hora" value="06:30" onChange={() => {}} />);
    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('06:30')).not.toBeInTheDocument();
  });

  it('permite cambiar hora y minutos por teclado y reporta HH:mm', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<TimePicker id="hora" value="06:30" onChange={onChange} />);
    await usuario.click(screen.getByLabelText('Hora'));
    await usuario.click(screen.getByRole('option', { name: '08' }));
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('expone el error de forma accesible', () => {
    render(<TimePicker id="hora" value="" onChange={() => {}} error="Indica la hora." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Indica la hora.');
  });

  it('aclara que el formato de 24 horas es provisional', () => {
    render(<TimePicker id="hora" value="06:30" onChange={() => {}} />);
    expect(screen.getByText(/24 horas.*provisional/)).toBeInTheDocument();
  });
});
