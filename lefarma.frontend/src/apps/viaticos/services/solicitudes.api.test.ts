import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpcionCotizacion } from '../types/solicitud.types';

const api = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { put: api.put } }));

import { solicitudesApi } from './solicitudes.api';

const opcion = (over: Partial<OpcionCotizacion> = {}): OpcionCotizacion => ({
  tipo: 'vuelo',
  linea: 'Vuelo',
  precio: 1000,
  moneda: 'MXN',
  url_compra: null,
  fuente: 'proveedor',
  fue_elegida: true,
  ruta_captura: null,
  capturas: [],
  ...over,
});

const guardar = async (opciones: OpcionCotizacion[]) => {
  await solicitudesApi.guardarOpciones(1, opciones);
  return api.put.mock.calls.at(-1)![1] as {
    cotizacion: { total?: number };
  };
};

describe('guardarOpciones', () => {
  beforeEach(() => {
    api.put.mockReset();
    api.put.mockResolvedValue({ data: { success: true } });
  });

  it('suma solo las opciones elegidas, no todas las alternativas', async () => {
    const body = await guardar([
      opcion({ linea: 'Bus', precio: 1720, fue_elegida: true }),
      opcion({ linea: 'Vuelo', precio: 2220, fue_elegida: true }),
      opcion({ linea: 'Renta', precio: 5205, fue_elegida: false }),
      opcion({ linea: 'Renta SUV', precio: 5705, fue_elegida: false }),
    ]);

    expect(body.cotizacion.total).toBe(3940);
  });

  it('suma la fila de taxi elegida al total', async () => {
    const body = await guardar([
      opcion({ tipo: 'autobus', linea: 'Bus', precio: 1720, fue_elegida: true }),
      opcion({
        tipo: 'taxi',
        linea: 'Taxi punto ↔ terminal',
        precio: 1093.81,
        fuente: 'Tarifa taxi punto↔terminal (estimado)',
        fue_elegida: true,
      }),
      opcion({ tipo: 'renta', linea: 'Renta', precio: 5205, fue_elegida: false }),
    ]);

    expect(body.cotizacion.total).toBe(2813.81);
  });

  it('omite el total si no hay opciones elegidas con precio', async () => {
    const body = await guardar([
      opcion({ linea: 'Bus', precio: null, fue_elegida: true }),
      opcion({ linea: 'Vuelo', precio: 2220, fue_elegida: false }),
    ]);

    expect(body.cotizacion).not.toHaveProperty('total');
  });

  it('omite el total cuando las elegidas mezclan monedas', async () => {
    const body = await guardar([
      opcion({ linea: 'Vuelo MXN', precio: 2220, moneda: 'MXN', fue_elegida: true }),
      opcion({ linea: 'Hotel USD', precio: 180, moneda: 'USD', fue_elegida: true }),
    ]);

    expect(body.cotizacion).not.toHaveProperty('total');
  });
});
