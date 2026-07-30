import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Perfil from '@/pages/Perfil';

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Perfil (shared profile page)', () => {
  it('renders the firma section and personal info without empresa/sucursal context', () => {
    renderWithRouter(<Perfil />);

    expect(screen.getByText('Firma Digital')).toBeInTheDocument();
    expect(screen.getByText(/Información Personal/i)).toBeInTheDocument();
  });

  it('does not render the Ubicación card when empresa/sucursal are absent', () => {
    renderWithRouter(<Perfil />);

    expect(screen.queryByText(/Ubicación Actual/i)).not.toBeInTheDocument();
  });
});
