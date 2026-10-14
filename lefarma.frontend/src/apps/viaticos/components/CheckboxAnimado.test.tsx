import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxAnimado } from './CheckboxAnimado';

describe('CheckboxAnimado', () => {
  it('expone un checkbox accesible por su etiqueta', () => {
    render(
      <CheckboxAnimado id="demo" checked={false} onCheckedChange={() => {}}>
        Compartir viaje
      </CheckboxAnimado>,
    );
    expect(screen.getByLabelText('Compartir viaje')).toBeInTheDocument();
  });

  it('avisa el cambio al hacer clic en la etiqueta', () => {
    const onCheckedChange = vi.fn();
    render(
      <CheckboxAnimado id="demo" checked={false} onCheckedChange={onCheckedChange}>
        Compartir viaje
      </CheckboxAnimado>,
    );
    fireEvent.click(screen.getByText('Compartir viaje'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('se puede operar con el teclado', () => {
    function Demo() {
      const [checked, setChecked] = useState(false);
      return (
        <CheckboxAnimado id="demo" checked={checked} onCheckedChange={setChecked}>
          Compartir viaje
        </CheckboxAnimado>
      );
    }
    render(<Demo />);
    const input = screen.getByLabelText('Compartir viaje');
    input.focus();
    fireEvent.click(input);
    expect(input).toBeChecked();
  });
});
