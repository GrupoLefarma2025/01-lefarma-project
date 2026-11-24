import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpcionCotizacion } from '../types/solicitud.types';

const api = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { put: api.put, post: api.post } }));

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
    cotizacion: {
      total?: number;
      total_cotizado?: number;
      total_estimado?: number;
      opciones: OpcionCotizacion[];
    };
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
    // El taxi conserva su importe de referencia (tipo_precio lo distingue);
    // solo el vuelo estimado se anula para bloquear la autorización.
    expect(body.cotizacion.opciones[1].precio).toBe(1093.81);
    expect(body.cotizacion.opciones[1].datos?.tipo_precio).toBe('estimado');
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

  it('un vuelo estimado viaja con precio null y su referencia aparte', async () => {
    const body = await guardar([
      opcion({
        tipo: 'vuelo',
        precio: 1546.14,
        fuente: 'estimado fase 1 (sin proveedor)',
        datos: { tipo_precio: 'estimado' },
      }),
      opcion({
        tipo: 'taxi',
        precio: 795.06,
        fuente: 'Tarifa taxi punto↔terminal (estimado)',
        datos: { tipo_precio: 'estimado' },
      }),
    ]);

    expect(body.cotizacion.opciones[0].precio).toBeNull();
    expect(body.cotizacion.opciones[0].datos?.precio_estimado).toBe(1546.14);
    expect(body.cotizacion).not.toHaveProperty('total_cotizado');
    expect(body.cotizacion.total_estimado).toBe(2341.2);
    expect(body.cotizacion.total).toBe(2341.2);
  });

  it('separa el precio real del vuelo de la referencia del taxi', async () => {
    const body = await guardar([
      opcion({
        tipo: 'vuelo',
        precio: 4974,
        fuente: 'kayak.com.mx',
        datos: { tipo_precio: 'cotizado' },
      }),
      opcion({
        tipo: 'taxi',
        precio: 795.06,
        fuente: 'Tarifa taxi punto↔terminal (estimado)',
        datos: { tipo_precio: 'estimado' },
      }),
    ]);

    expect(body.cotizacion.total_cotizado).toBe(4974);
    expect(body.cotizacion.total_estimado).toBe(795.06);
    expect(body.cotizacion.total).toBe(5769.06);
  });
});

describe('detectarPrecioPreview', () => {
  it('envía la opción y la señal de cancelación al endpoint de vista previa', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { detectado: false } } });
    const controller = new AbortController();
    const payload = {
      tipo: 'vuelo',
      linea: 'Aeromexico',
      url_compra: 'https://www.kayak.com.mx/flights/MEX-ZLO/2026-12-10',
      salida: '08:00',
      llegada: '09:34',
      datos: { tramo: 0, minutos_taxi_destino: 36 },
      solicitud_datos: { destinos: [] },
    };

    await solicitudesApi.detectarPrecioPreview(payload, controller.signal);

    expect(api.post).toHaveBeenCalledWith(
      '/viaticos/opciones/detectar-precio',
      payload,
      expect.objectContaining({ signal: controller.signal, timeout: 80_000 }),
    );
  });
});
