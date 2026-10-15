import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WizardStepper } from './WizardStepper';

const PASOS = [
  { id: 1, titulo: 'Persona' },
  { id: 2, titulo: 'Transporte' },
  { id: 3, titulo: 'Origen' },
];

describe('WizardStepper', () => {
  it('marca el paso actual y conserva los testids de los indicadores', () => {
    render(<WizardStepper pasos={PASOS} actual={2} />);
    expect(screen.getByTestId('indicador-paso-2')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('indicador-paso-1')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('indicador-paso-3')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Persona')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
    expect(screen.getByText('Origen')).toBeInTheDocument();
  });

  it('distingue completado con marca accesible y pendiente sin ella', () => {
    render(<WizardStepper pasos={PASOS} actual={3} />);
    expect(screen.getByTestId('indicador-paso-1')).toHaveTextContent(/completado/i);
    expect(screen.getByTestId('indicador-paso-2')).toHaveTextContent(/completado/i);
    expect(screen.getByTestId('indicador-paso-3')).not.toHaveTextContent(/completado/i);
  });

  it('carga el raíl hasta lo alcanzado y llena el segmento actual en loop', () => {
    const { rerender } = render(<WizardStepper pasos={PASOS} actual={1} />);
    // Primer paso: el raíl está vacío y el segmento 1→2 se llena en loop.
    expect(screen.getByTestId('wizard-rail-fill')).toHaveStyle({ transform: 'scaleX(0)' });
    expect(screen.getByTestId('wizard-rail-pulse').parentElement).toHaveStyle({ left: '0%', width: '50%' });

    rerender(<WizardStepper pasos={PASOS} actual={2} />);
    expect(screen.getByTestId('wizard-rail-fill')).toHaveStyle({ transform: 'scaleX(0.5)' });
    // La barra corre justo en el segmento 2→3.
    expect(screen.getByTestId('wizard-rail-pulse').parentElement).toHaveStyle({ left: '50%', width: '50%' });

    // Último paso: raíl completo y sin barra (ya no hay a dónde ir).
    rerender(<WizardStepper pasos={PASOS} actual={3} />);
    expect(screen.getByTestId('wizard-rail-fill')).toHaveStyle({ transform: 'scaleX(1)' });
    expect(screen.queryByTestId('wizard-rail-pulse')).not.toBeInTheDocument();
  });

  it('deja volver a los pasos superados pero no a los pendientes ni al actual', () => {
    const onSelect = vi.fn();
    render(<WizardStepper pasos={PASOS} actual={3} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al paso 1: Persona' }));
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al paso 2: Transporte' }));
    expect(onSelect).toHaveBeenCalledWith(2);
    // El actual y los pendientes no son botones.
    expect(screen.queryByRole('button', { name: /Volver al paso 3/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('indicador-paso-3')).toHaveAttribute('aria-current', 'step');
  });

  it('sin onSelect ningún paso es clicable', () => {
    render(<WizardStepper pasos={PASOS} actual={3} />);
    expect(screen.queryByRole('button', { name: /Volver al paso/ })).not.toBeInTheDocument();
  });

  it('marca donde te quedaste con número punteado al volver atrás', () => {
    const onSelect = vi.fn();
    render(<WizardStepper pasos={PASOS} actual={1} alcanzado={3} onSelect={onSelect} />);
    // El 2 ya se visitó: palomita y salto hacia adelante.
    expect(screen.getByTestId('indicador-paso-2')).toHaveTextContent(/completado/i);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al paso 2: Transporte' }));
    expect(onSelect).toHaveBeenCalledWith(2);
    // El 3 es donde te quedaste: número azul punteado, no palomita.
    const pausa = screen.getByRole('button', { name: 'Ir al paso 3: Origen' });
    expect(pausa).toBeInTheDocument();
    expect(screen.getByTestId('indicador-paso-3')).toHaveTextContent(/donde te quedaste/i);
    expect(screen.getByTestId('indicador-paso-3')).not.toHaveTextContent(/completado/i);
    expect(screen.getByTestId('indicador-paso-3').querySelector('.z-10')).toHaveClass('border-dashed');
    fireEvent.click(pausa);
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
