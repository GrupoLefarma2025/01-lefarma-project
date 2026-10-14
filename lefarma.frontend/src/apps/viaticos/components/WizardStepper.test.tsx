import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
