import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapaCalorTab } from './MapaCalorTab';
import { telemetriaApi } from '../services/telemetriaApi';

vi.mock('../services/telemetriaApi', () => ({
  telemetriaApi: {
    rutas: vi.fn(),
    mapaCalor: vi.fn(),
  },
}));

const rutasMock = vi.mocked(telemetriaApi.rutas);
const mapaMock = vi.mocked(telemetriaApi.mapaCalor);

const ahora = new Date('2026-11-20T12:00:00.000Z');

describe('MapaCalorTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rutasMock.mockResolvedValue([{ ruta: '/hub', clics: 9, errores: 1, visitas: 2 }]);
    mapaMock.mockResolvedValue({
      ruta: '/hub',
      columnas: 2,
      filas: 2,
      tamanoCelda: 32,
      totalMovimientos: 9,
      visitas: 2,
      celdas: [0, 1, 3, 5],
    });
  });

  it('pinta una celda por valor de la rejilla y respeta la escala', async () => {
    render(<MapaCalorTab desde={ahora} hasta={ahora} />);

    const rejilla = await screen.findByRole('img', { name: /mapa de calor de \/hub/i });
    expect(rejilla.children).toHaveLength(4);

    const celdas = Array.from(rejilla.children) as HTMLElement[];
    expect(celdas[0].style.backgroundColor).toBe('transparent');
    expect(celdas[1].style.backgroundColor).toBe('rgba(235, 108, 54, 0.28)');
    expect(celdas[3].style.backgroundColor).toBe('rgba(235, 108, 54, 0.9)');
  });

  it('avisa cuando la ruta no tiene movimientos en el periodo', async () => {
    mapaMock.mockRejectedValueOnce(new Error('sin datos'));

    render(<MapaCalorTab desde={ahora} hasta={ahora} />);

    expect(
      await screen.findByText(/no hay movimientos del puntero para esa ruta/i),
    ).toBeTruthy();
    expect(screen.queryByRole('img', { name: /mapa de calor/i })).toBeNull();
  });
});
