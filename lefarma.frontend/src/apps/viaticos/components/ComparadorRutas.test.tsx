import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComparadorRutas, compararOpcionesRuta } from './ComparadorRutas';
import type { SolicitudOpcion } from '../types/solicitud.types';

const opcion = (extra: Partial<SolicitudOpcion>): SolicitudOpcion => ({
  id_opcion: 1,
  tipo: 'vuelo',
  linea: 'Vuelo',
  precio: 1000,
  moneda: 'MXN',
  url_compra: null,
  fuente: 'proveedor',
  fue_elegida: true,
  ruta_captura: null,
  datos: {},
  ...extra,
});

describe('compararOpcionesRuta', () => {
  it('empareja por datos.tramo y calcula diferencia y porcentaje', () => {
    const filas = compararOpcionesRuta(
      [opcion({ id_opcion: 1, linea: 'Vuelo Uno', precio: 1000, datos: { tramo: 1 } })],
      [opcion({ id_opcion: -1, linea: 'Vuelo Uno', precio: 1120, datos: { tramo: 1 } })],
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('subio');
    expect(filas[0].diferencia).toBe(120);
    expect(filas[0].porcentaje).toBeCloseTo(12);
  });

  it('usa tipo/línea/url cuando falta el tramo', () => {
    const filas = compararOpcionesRuta(
      [opcion({ linea: 'Hotel Centro', tipo: 'hotel', precio: 900, datos: {} })],
      [opcion({ id_opcion: -1, linea: 'Hotel Centro', tipo: 'hotel', precio: 750, datos: {} })],
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('bajo');
    expect(filas[0].propuesta?.precio).toBe(750);
  });

  it('marca nueva y ya no disponible cuando no hay pareja', () => {
    const filas = compararOpcionesRuta(
      [opcion({ id_opcion: 1, linea: 'Vuelo Viejo', datos: { tramo: 3 } })],
      [opcion({ id_opcion: -1, linea: 'Vuelo Nuevo', datos: { tramo: 4 } })],
    );

    expect(filas.map((fila) => fila.estado)).toEqual(['no-disponible', 'nueva']);
  });
});

describe('ComparadorRutas', () => {
  it('muestra precios, estados y totales con diferencia', () => {
    const originales = [
      opcion({ id_opcion: 1, linea: 'Vuelo Uno', precio: 1000, datos: { tramo: 1 } }),
      opcion({ id_opcion: 2, linea: 'Hotel Dos', tipo: 'hotel', precio: 2000, datos: { tramo: 2 } }),
    ];
    const propuestas = [
      opcion({ id_opcion: -1, linea: 'Vuelo Uno', precio: 1120, datos: { tramo: 1 } }),
      opcion({ id_opcion: -2, linea: 'Hotel Dos', tipo: 'hotel', precio: 2000, datos: { tramo: 2 } }),
      opcion({ id_opcion: -3, linea: 'Taxi Nuevo', tipo: 'taxi', precio: 500, datos: { tramo: 3 } }),
    ];

    render(<ComparadorRutas opcionesOriginales={originales} opcionesPropuestas={propuestas} />);

    const comparador = screen.getByTestId('comparador-rutas');
    expect(within(comparador).getByText('Subió')).toBeInTheDocument();
    expect(within(comparador).getByText('Sin cambio')).toBeInTheDocument();
    expect(within(comparador).getByText('Nueva')).toBeInTheDocument();
    expect(within(comparador).getByText(/\+.*120\.00/)).toBeInTheDocument();
    expect(screen.getByTestId('comparador-total-original')).toHaveTextContent('$3,000.00');
    expect(screen.getByTestId('comparador-total-propuesto')).toHaveTextContent('$3,620.00');
    expect(screen.getByTestId('comparador-total-diferencia')).toHaveTextContent('+$620.00');
  });

  it('nunca inventa un total cuando falta un precio', () => {
    render(
      <ComparadorRutas
        opcionesOriginales={[opcion({ linea: 'Vuelo sin precio', precio: null, datos: { tramo: 1 } })]}
        opcionesPropuestas={[opcion({ id_opcion: -1, linea: 'Vuelo nuevo', precio: 500, datos: { tramo: 2 } })]}
      />,
    );

    expect(screen.getByTestId('comparador-total-original')).toHaveTextContent('Sin dato');
    expect(screen.getByTestId('comparador-total-propuesto')).toHaveTextContent('$500.00');
    expect(screen.getByTestId('comparador-total-diferencia')).toHaveTextContent('Sin dato');
    expect(screen.getAllByText('Sin dato', { selector: 'td' }).length).toBeGreaterThan(0);
  });

  it('abre las opciones descartadas del viajero', async () => {
    const usuario = userEvent.setup();
    const elegida = opcion({ id_opcion: 1, linea: 'Elegida', datos: { tramo: 1 } });
    const descartada = opcion({
      id_opcion: 2,
      linea: 'Descartada',
      fue_elegida: false,
      datos: { tramo: 1 },
    });

    render(
      <ComparadorRutas opcionesOriginales={[elegida, descartada]} opcionesPropuestas={[elegida]} />,
    );

    const boton = screen.getByRole('button', { name: /Ver opciones descartadas del viajero/ });
    expect(boton).toBeEnabled();
    await usuario.click(boton);

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Descartada')).toBeInTheDocument();
    expect(within(dialogo).queryByText('Elegida')).not.toBeInTheDocument();
  });

  it('deshabilita el botón con texto claro cuando no hay descartadas', () => {
    const elegida = opcion({ linea: 'Única elegida', datos: { tramo: 1 } });
    render(<ComparadorRutas opcionesOriginales={[elegida]} opcionesPropuestas={[elegida]} />);

    expect(
      screen.getByRole('button', { name: /Ver opciones descartadas del viajero/ }),
    ).toBeDisabled();
    expect(screen.getByText(/no dejó opciones descartadas/i)).toBeInTheDocument();
  });
});
