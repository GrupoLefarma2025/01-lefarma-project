import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '@/apps/baseapp/Profile';

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Profile (base-app profile page)', () => {
  it('Scenario: Authenticated user opens profile — the profile page renders', () => {
    renderWithRouter(<Profile />);

    expect(screen.getByRole('heading', { name: /perfil/i })).toBeInTheDocument();
  });

  it('renders inside the shell without requiring context selection', () => {
    const { container } = renderWithRouter(<Profile />);
    expect(container.firstChild).not.toBeNull();
  });
});
