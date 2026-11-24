import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrecioRealDialog } from './PrecioRealDialog';
import type { Solicitud, SolicitudOpcion } from '../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  registrarPrecioReal: vi.fn(),
  generar: vi.fn(),
  subirCaptura: vi.fn(),
}));

vi.mock('../services/solicitudes.api', () => ({
  solicitudesApi: { registrarPrecioReal: mocks.registrarPrecioReal },
}));

vi.mock('../services/evidencias.api', () => ({
  evidenciasApi: { generar: mocks.generar, subirCaptura: mocks.subirCaptura },
}));

vi.mock('./celdasCotizacion', () => ({
  useCapturaAutenticada: () => ({ url: 'blob:captura', error: null }),
}));

const opcion: SolicitudOpcion = {
  id_opcion: 108,
  tipo: 'vuelo',
  linea: 'Vuelo (estimado)',
  precio: null,
  moneda: 'MXN',
  url_compra: 'https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20',
  fuente: 'estimado fase 1 (sin proveedor)',
  fue_elegida: true,
  ruta_captura: 'capturas-viaticos/viaje31-op108.png',
  datos: { tipo_precio: 'estimado', precio_estimado: 1546.14 },
};

const solicitud = { id_solicitud: 31 } as Solicitud;

describe('PrecioRealDialog', () => {
  it('guarda el precio real con la captura existente y la fuente de la URL', async () => {
    const usuario = userEvent.setup();
    const onGuardado = vi.fn();
    mocks.registrarPrecioReal.mockResolvedValue({
      data: { success: true, message: 'ok', data: solicitud },
    });

    render(
      <PrecioRealDialog
        abierto
        onOpenChange={vi.fn()}
        solicitudId={31}
        opcion={opcion}
        onGuardado={onGuardado}
      />
    );

    expect(screen.getByText(/Referencia actual/)).toHaveTextContent('$1,546.14');
    await usuario.type(screen.getByLabelText('Aerolínea / línea'), 'Aeroméxico 08:00–09:34');
    await usuario.type(screen.getByLabelText('Precio real'), '4974');
    await usuario.click(screen.getByRole('button', { name: 'Guardar precio real' }));

    await waitFor(() => expect(mocks.registrarPrecioReal).toHaveBeenCalledTimes(1));
    expect(mocks.registrarPrecioReal).toHaveBeenCalledWith(
      31,
      108,
      expect.objectContaining({
        linea: 'Aeroméxico 08:00–09:34',
        precio: 4974,
        moneda: 'MXN',
        fuente: 'kayak.com.mx',
        url_compra: 'https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20',
        ruta_captura: 'capturas-viaticos/viaje31-op108.png',
      })
    );
    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith(solicitud));
  });

  it('no permite guardar sin captura', async () => {
    const usuario = userEvent.setup();

    render(
      <PrecioRealDialog
        abierto
        onOpenChange={vi.fn()}
        solicitudId={31}
        opcion={{ ...opcion, ruta_captura: null }}
        onGuardado={vi.fn()}
      />
    );

    await usuario.type(screen.getByLabelText('Precio real'), '4974');
    expect(screen.getByRole('button', { name: 'Guardar precio real' })).toBeDisabled();
    expect(screen.getByText(/Sin captura/)).toBeDefined();
  });

  it('prellena el precio y el horario que detectó el agente', () => {
    render(
      <PrecioRealDialog
        abierto
        onOpenChange={vi.fn()}
        solicitudId={31}
        opcion={opcion}
        datosAgente={{
          transportista: 'Aeroméxico',
          salida: '08:00',
          llegada: '09:34',
          precio: 4974,
          moneda: 'MXN',
        }}
        onGuardado={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Precio real')).toHaveValue(4974);
    expect(screen.getByLabelText('Aerolínea / línea')).toHaveValue('Aeroméxico 08:00–09:34');
    expect(screen.getByText(/Agente: \$4,974\.00/)).toBeDefined();
  });
});
