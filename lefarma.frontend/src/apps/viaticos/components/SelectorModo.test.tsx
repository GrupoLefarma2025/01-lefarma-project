import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectorModo } from './SelectorModo';

const OPCIONES = [
  { id: 'mia', titulo: 'Para mí' },
  { id: 'otra', titulo: 'Para alguien más' },
];

describe('SelectorModo', () => {
  it('marca la opción elegida con aria-pressed y cambia con clic', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<SelectorModo ariaLabel="Persona viajera" value="mia" onChange={onChange} options={OPCIONES} />);
    expect(screen.getByRole('radio', { name: 'Para mí' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Para alguien más' })).toHaveAttribute('aria-checked', 'false');
    await usuario.click(screen.getByRole('radio', { name: 'Para alguien más' }));
    expect(onChange).toHaveBeenCalledWith('otra');
  });

  it('no limpia la elección al pulsar la opción activa', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<SelectorModo ariaLabel="Persona viajera" value="mia" onChange={onChange} options={OPCIONES} />);
    await usuario.click(screen.getByRole('radio', { name: 'Para mí' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('se opera con el teclado (flechas y espaciadora)', async () => {
    const onChange = vi.fn();
    const usuario = userEvent.setup();
    render(<SelectorModo ariaLabel="Persona viajera" value="mia" onChange={onChange} options={OPCIONES} />);
    screen.getByRole('radio', { name: 'Para mí' }).focus();
    await usuario.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Para alguien más' })).toHaveFocus();
    await usuario.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('otra');
  });

  it('muestra la descripción de la opción elegida', () => {
    render(
      <SelectorModo
        ariaLabel="Transporte"
        value="propio"
        onChange={() => {}}
        options={[
          { id: 'propio', titulo: 'Carro propio', descripcion: 'Siempre usa Magna.' },
          { id: 'solicitado', titulo: 'Solicitar transporte' },
        ]}
      />,
    );
    expect(screen.getByText('Siempre usa Magna.')).toBeInTheDocument();
  });
});
