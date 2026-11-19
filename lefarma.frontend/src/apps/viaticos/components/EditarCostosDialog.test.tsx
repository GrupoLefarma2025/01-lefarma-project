import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditarCostosDialog } from './EditarCostosDialog';
import type { CalculoViaje, SolicitudOpcion } from '../types/solicitud.types';

const calculo: CalculoViaje = {
  generado_en: '2026-11-05T12:00:00.000Z',
  margen: 0.1,
  modo_transporte: 'solicitado',
  km_total: 200,
  horas_total: '4h 24m',
  tramos: [
    {
      de: 'Ciudad de México',
      a: 'Aguascalientes',
      km: 500,
      duracion: '6h',
      duracion_con_margen: '6h 36m',
      salida_fecha: '2026-12-11',
      salida_hora: '08:00',
      llegada_fecha: '2026-12-11',
      llegada_hora: '14:00',
      alcanza: true,
      casetas: [],
      costo: 1000,
      moneda: 'MXN',
    },
  ],
  ruta: {
    puntos: [],
    nodos: [
      { titulo: 'Origen', detalles: ['Salida'] },
      { titulo: '1. Aguascalientes', detalles: ['Llegada'], costo: 1000 },
    ],
  },
};

const opcion = (extra: Partial<SolicitudOpcion>): SolicitudOpcion => ({
  id_opcion: 1,
  tipo: 'autobus',
  linea: 'Autobús',
  precio: 1000,
  moneda: 'MXN',
  url_compra: null,
  fuente: 'proveedor',
  fue_elegida: true,
  ruta_captura: null,
  datos: { tramo: 0 },
  ...extra,
});

const opciones: SolicitudOpcion[] = [
  opcion({ id_opcion: 1, linea: 'Autobús CDMX → Aguascalientes', precio: 1000 }),
  opcion({ id_opcion: 2, tipo: 'hotel', linea: 'Hotel centro', precio: 800, datos: { tramo: 1 } }),
  opcion({
    id_opcion: 3,
    linea: 'Alternativa descartada',
    precio: 700,
    fue_elegida: false,
  }),
];

describe('EditarCostosDialog', () => {
  it('parte de los importes vigentes y solo edita lo elegido', () => {
    render(
      <EditarCostosDialog
        calculo={calculo}
        opciones={opciones}
        onOpenChange={vi.fn()}
        onGuardar={vi.fn()}
      />,
    );

    expect(screen.getByTestId('costo-opcion-0')).toHaveValue(1000);
    expect(screen.getByTestId('costo-opcion-1')).toHaveValue(800);
    expect(screen.queryByTestId('costo-opcion-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('total-editar-costos')).toHaveTextContent('$1,800.00');
  });

  it('devuelve la propuesta con los precios capturados y los totales recalculados', async () => {
    const usuario = userEvent.setup();
    const onGuardar = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EditarCostosDialog
        calculo={calculo}
        opciones={opciones}
        onOpenChange={onOpenChange}
        onGuardar={onGuardar}
      />,
    );

    const campo = screen.getByTestId('costo-opcion-0');
    await usuario.clear(campo);
    await usuario.type(campo, '1200');

    expect(screen.getByTestId('total-editar-costos')).toHaveTextContent('$2,000.00');

    await usuario.click(screen.getByRole('button', { name: 'Usar estos costos' }));

    expect(onGuardar).toHaveBeenCalledTimes(1);
    const propuesta = onGuardar.mock.calls[0][0];
    expect(propuesta.opciones[0].precio).toBe(1200);
    expect(propuesta.calculo.tramos[0].costo).toBe(1200);
    expect(propuesta.calculo.ruta.nodos[1].costo).toBe(1200);
    expect(propuesta.resumen.total).toBe(2000);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('no deja guardar un precio vacío que no es estimado', async () => {
    const usuario = userEvent.setup();
    const onGuardar = vi.fn();

    render(
      <EditarCostosDialog
        calculo={calculo}
        opciones={opciones}
        onOpenChange={vi.fn()}
        onGuardar={onGuardar}
      />,
    );

    await usuario.clear(screen.getByTestId('costo-opcion-0'));

    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un precio válido');
    const guardar = screen.getByRole('button', { name: 'Usar estos costos' });
    expect(guardar).toBeDisabled();
    await usuario.click(guardar);
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('acepta dejar vacío un costo estimado', async () => {
    const usuario = userEvent.setup();
    const onGuardar = vi.fn();
    const estimada = [
      opcion({
        id_opcion: 1,
        linea: 'Autobús estimado',
        precio: null,
        fuente: 'estimado',
        datos: { tramo: 0, tipo_precio: 'estimado' },
      }),
    ];

    render(
      <EditarCostosDialog
        calculo={calculo}
        opciones={estimada}
        onOpenChange={vi.fn()}
        onGuardar={onGuardar}
      />,
    );

    const campo = screen.getByTestId('costo-opcion-0');
    expect(campo).toHaveValue(null);
    await usuario.type(campo, '950');
    await usuario.click(screen.getByRole('button', { name: 'Usar estos costos' }));

    expect(onGuardar).toHaveBeenCalledTimes(1);
    expect(onGuardar.mock.calls[0][0].opciones[0].precio).toBe(950);
  });
});
