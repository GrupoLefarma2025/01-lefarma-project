import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpcionesTransporte } from './OpcionesTransporte';
import type { CostosRutaOferta } from '../types/costosRuta.types';

const oferta = (id: string, modo: string, linea: string, precio: number, extra: Partial<CostosRutaOferta> = {}): CostosRutaOferta => ({
  id,
  modo,
  linea,
  servicio: 'Directo',
  persona: 'Viajero',
  tramo: 0,
  de: 'CDMX',
  a: 'Monterrey',
  salidaTxt: '23/11 06:00',
  salida: '2026-11-23T06:00',
  llegadaTxt: '23/11 07:30',
  duracion: '1h 30m',
  puertaAPuertaH: 1.5,
  precioTxt: `$${precio} MXN`,
  porPersona: true,
  costoGrupo: precio,
  costoPorPersona: precio,
  aTiempo: true,
  llegaTarde: false,
  minutosTarde: 0,
  noTomable: false,
  badge: '',
  nota: '',
  fuente: 'kayak.com.mx',
  estimado: false,
  tipoPrecio: 'cotizado',
  comprar: {
    url: `https://comprar.test/${id}`,
    sitio: 'Kayak',
    accion: 'Comprar',
    objetivo: 'vuelo',
    fecha: '2026-11-23',
  },
  ...extra,
});

describe('OpcionesTransporte', () => {
  it('muestra tabs con contador y 6 opciones, con "Ver todos"', async () => {
    const usuario = userEvent.setup();
    const ofertas = [
      oferta('a', 'avion', 'Aeromexico', 4100),
      oferta('b', 'avion', 'VivaAerobus', 3900),
      oferta('c', 'avion', 'Volaris', 4200),
      oferta('d', 'avion', 'Aeromexico', 4300),
      oferta('e', 'avion', 'VivaAerobus', 3800),
      oferta('f', 'bus', 'ETN', 900),
      oferta('g', 'avion', 'Aeromexico', 4400),
      oferta('h', 'avion', 'Volaris', 4500),
    ];

    render(
      <OpcionesTransporte
        ofertas={ofertas}
        onElegir={vi.fn()}
        modoInicial="avion"
      />,
    );

    expect(screen.getByRole('tab', { name: /Avión/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Autobús/ })).toHaveAttribute('aria-selected', 'false');
    // 6 tarjetas visibles de 7 vuelos.
    expect(screen.getAllByRole('button', { name: /^Elegir / })).toHaveLength(6);
    expect(screen.getByText('Ver todos (7)')).toBeInTheDocument();

    await usuario.click(screen.getByText('Ver todos (7)'));
    expect(screen.getAllByRole('button', { name: /^Elegir / })).toHaveLength(7);
    expect(screen.getByText('Ver menos')).toBeInTheDocument();
  });

  it('mezcla cercanía a la salida, precio y opciones anteriores', async () => {
    const usuario = userEvent.setup();
    const conHorario = (
      id: string,
      linea: string,
      precio: number,
      hora: string,
      extra: Partial<CostosRutaOferta> = {},
    ) => oferta(id, 'avion', linea, precio, {
      salida: `2026-12-01T${hora}:00`,
      salidaTxt: `01/12 ${hora}`,
      ...extra,
    });
    const ofertas = [
      conHorario('temprana', 'Temprana', 900, '09:00', { aTiempo: false, noTomable: true }),
      conHorario('cerca-1', 'Cerca 1', 1500, '10:30'),
      conHorario('cerca-2', 'Cerca 2', 1600, '11:00'),
      conHorario('barata', 'Barata', 500, '13:00'),
      conHorario('otra', 'Otra', 900, '12:30'),
      conHorario('tarde', 'Tarde', 400, '16:00', {
        aTiempo: false,
        llegaTarde: true,
        minutosTarde: 39,
      }),
    ];
    const botones = () => screen.getAllByRole('button', { name: /^Elegir / })
      .map((boton) => boton.getAttribute('aria-label') ?? '');

    render(
      <OpcionesTransporte
        ofertas={ofertas}
        onElegir={vi.fn()}
        modoInicial="avion"
        salidaReferencia="2026-12-01T10:21"
      />,
    );

    // Primero las dos más cercanas a las 10:21, luego la anterior (aunque
    // salga antes de la ventana) y después las más baratas.
    expect(botones()[0]).toContain('Cerca 1');
    expect(botones()[1]).toContain('Cerca 2');
    expect(botones()[2]).toContain('Temprana');
    expect(botones()[3]).toContain('Barata');
    expect(screen.getByText('Cerca')).toBeInTheDocument();
    expect(screen.getByText('Más barata')).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText('Criterio de orden'), 'barato');
    await waitFor(() => expect(botones()[0]).toContain('Barata'));
    expect(botones()[1]).toContain('Otra');

    await usuario.selectOptions(screen.getByLabelText('Criterio de orden'), 'hora');
    await waitFor(() => expect(botones()[2]).toContain('Otra'));
    expect(botones()[3]).toContain('Barata');
  });

  it('mientras consulta el precio real muestra "Confirmando" y no los estimados', () => {
    render(
      <OpcionesTransporte
        ofertas={[oferta('a', 'avion', 'Aeromexico', 1729, { tipoPrecio: 'estimado', estimado: true })]}
        onElegir={vi.fn()}
        modoInicial="avion"
        cargando
      />,
    );

    expect(screen.getByText('Confirmando precio real…')).toBeInTheDocument();
    expect(screen.queryByText('$1729 MXN')).not.toBeInTheDocument();
    expect(screen.queryByText('Elegir')).not.toBeInTheDocument();
  });

  it('si la consulta real falla, muestra las estimaciones con el aviso', () => {
    render(
      <OpcionesTransporte
        ofertas={[oferta('a', 'avion', 'Aeromexico', 1729, { tipoPrecio: 'estimado', estimado: true })]}
        onElegir={vi.fn()}
        modoInicial="avion"
        aviso="No se pudo consultar Kayak; se usan precios estimados."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar Kayak');
    expect(screen.getByText('$1729 MXN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Elegir / })).toBeInTheDocument();
  });

  it('pide la lista real del tab activo y marca la opción elegida', async () => {
    const usuario = userEvent.setup();
    const onSolicitarReales = vi.fn();
    const onElegir = vi.fn();

    render(
      <OpcionesTransporte
        ofertas={[
          oferta('a', 'avion', 'Aeromexico', 4100),
          oferta('b', 'bus', 'ETN', 900),
        ]}
        onElegir={onElegir}
        opcionElegidaId="a"
        modoInicial="avion"
        onSolicitarReales={onSolicitarReales}
      />,
    );

    await waitFor(() => expect(onSolicitarReales).toHaveBeenCalledWith('avion'));
    const elegir = screen.getByRole('button', { name: /^Elegir Aeromexico/ });
    expect(elegir).toHaveAttribute('aria-pressed', 'true');

    await usuario.click(screen.getByRole('tab', { name: /Autobús/ }));
    await waitFor(() => expect(onSolicitarReales).toHaveBeenCalledWith('bus'));
    await usuario.click(screen.getByRole('button', { name: /^Elegir ETN/ }));
    expect(onElegir).toHaveBeenCalled();
  });

  it('si el modo inicial no tiene opciones, cae al primer tab con datos', () => {
    render(
      <OpcionesTransporte
        ofertas={[oferta('a', 'bus', 'ETN', 900)]}
        onElegir={vi.fn()}
        modoInicial="avion"
      />,
    );

    expect(screen.getByRole('tab', { name: /Autobús/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('ETN')).toBeInTheDocument();
  });
});
