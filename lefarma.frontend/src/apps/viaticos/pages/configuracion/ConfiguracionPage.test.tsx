import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfiguracionPage } from './ConfiguracionPage';
import { CONFIG_VIATICOS_STORAGE_KEY } from '../../services/configViaticos';

vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
});

describe('ConfiguracionPage', () => {
  it('guarda las tarifas de comida y el horario de transporte', () => {
    render(<ConfiguracionPage />);
    fireEvent.change(screen.getByLabelText('Comida 1/2 día (MXN)'), { target: { value: '180' } });
    fireEvent.change(screen.getByLabelText('Comida día completo (MXN)'), { target: { value: '360' } });
    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '17:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    const guardada = JSON.parse(localStorage.getItem(CONFIG_VIATICOS_STORAGE_KEY) ?? '{}');
    expect(guardada).toMatchObject({
      comidaMedia: '180',
      comidaCompleta: '360',
      horaEntrada: '08:00',
      horaSalida: '17:00',
    });
  });
});
