import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RutaViajeTimeline, type NodoRutaTimeline } from './RutaViajeTimeline';

const nodo = (extra: Partial<NodoRutaTimeline> = {}): NodoRutaTimeline => ({
  id: 'nodo-1',
  titulo: '2. Zapopan',
  detalles: ['Llegada 14:00'],
  chips: ['120 km'],
  ...extra,
});

describe('RutaViajeTimeline', () => {
  it('muestra el importe en pesos y el enlace de compra accesible', () => {
    render(
      <RutaViajeTimeline
        nodos={[
          nodo({
            costo: 1234.5,
            urlCompra: 'https://comprar.test/boleto',
          }),
        ]}
      />,
    );

    expect(screen.getByText('$1,234.50')).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: 'Ir a compra' });
    expect(enlace).toHaveAttribute('href', 'https://comprar.test/boleto');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noreferrer');
  });

  it('no dibuja enlace cuando la opción no trae URL', () => {
    render(
      <RutaViajeTimeline
        nodos={[
          nodo({ costo: 520, urlCompra: null }),
          nodo({ id: 'nodo-2', titulo: 'Regreso', costo: null, urlCompra: '   ' }),
        ]}
      />,
    );

    expect(screen.getByText('$520.00')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ir a compra' })).not.toBeInTheDocument();
  });

  it('no inventa importe cuando el nodo no tiene costo', () => {
    render(<RutaViajeTimeline nodos={[nodo({ costo: null })]} />);

    expect(screen.queryByText(/MXN|\$/)).not.toBeInTheDocument();
  });

  it('en modo compacto deja las terminales y taxis bajo un detalle', () => {
    render(
      <RutaViajeTimeline
        compacto
        nodos={[
          nodo({ id: 'origen', titulo: 'Origen', detalles: ['Ciudad de México'] }),
          nodo({ id: 'terminal', titulo: 'Central del Norte', detalles: ['En taxi desde CDMX'] }),
          nodo({ id: 'destino', titulo: '1. Puebla', detalles: ['Llegada 15:21'] }),
          nodo({ id: 'hotel', titulo: 'Hotel Colonial', detalles: ['Noche 01 → 02'] }),
          nodo({ id: 'regreso', titulo: 'Regreso', detalles: ['Vuelta al origen'] }),
        ]}
      />,
    );

    expect(screen.getByText('Origen')).toBeInTheDocument();
    expect(screen.getByText('1. Puebla')).toBeInTheDocument();
    expect(screen.getByText('Hotel Colonial')).toBeInTheDocument();
    const detalle = screen.getByText('Ver 1 parada de traslado').closest('details');
    expect(detalle).not.toHaveAttribute('open');
    expect(screen.getByText('Central del Norte').closest('details')).toBe(detalle);
  });
});
