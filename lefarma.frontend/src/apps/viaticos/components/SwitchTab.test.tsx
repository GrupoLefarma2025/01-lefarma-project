import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SwitchTab } from './SwitchTab';

const OPCIONES = [
  { id: 'sucursal', titulo: 'Buscar por sucursal' },
  { id: 'mapa', titulo: 'Buscar por dirección' },
];

describe('SwitchTab', () => {
  it('marca la opción activa y desliza el thumb a su posición', () => {
    const { rerender } = render(
      <SwitchTab ariaLabel="Tipo de origen" value="sucursal" onChange={() => {}} options={OPCIONES} />,
    );
    expect(screen.getByRole('radio', { name: 'Buscar por sucursal' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Buscar por dirección' })).toHaveAttribute('aria-checked', 'false');

    rerender(<SwitchTab ariaLabel="Tipo de origen" value="mapa" onChange={() => {}} options={OPCIONES} />);
    expect(screen.getByRole('radio', { name: 'Buscar por dirección' })).toHaveAttribute('aria-checked', 'true');
  });

  it('cambia con clic', () => {
    const onChange = vi.fn();
    render(<SwitchTab ariaLabel="Tipo de origen" value="sucursal" onChange={onChange} options={OPCIONES} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Buscar por dirección' }));
    expect(onChange).toHaveBeenCalledWith('mapa');
  });

  it('las flechas mueven la selección', () => {
    const onChange = vi.fn();
    render(<SwitchTab ariaLabel="Tipo de origen" value="sucursal" onChange={onChange} options={OPCIONES} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Tipo de origen' });
    fireEvent.keyDown(grupo, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('mapa');
  });
});
