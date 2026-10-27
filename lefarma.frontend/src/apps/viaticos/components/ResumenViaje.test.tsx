import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ResumenViaje } from './ResumenViaje';
import type { ResumenViajeDatos } from '../services/resumenViaje';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mapa-punto">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  // El mapa del globo engancha Ctrl + rueda con useMap.
  useMap: () => ({ getContainer: () => document.createElement('div'), getZoom: () => 12, setZoom: () => undefined }),
}));

const base: ResumenViajeDatos = {
  motivo: 'Visita de seguimiento',
  modoTransporte: 'solicitado',
  compartido: false,
  acompanantes: [],
  origen: {
    punto: {
      nombre: 'Punto seleccionado en mapa',
      latitud: 19.48239,
      longitud: -99.10327,
      municipio: 'Tlalpan',
      estado: 'Ciudad de México',
    },
  },
  destinos: [
    {
      id: 'd1',
      etiqueta: 'Villa de Cos',
      punto: { nombre: 'Villa de Cos', latitud: 23.3, longitud: -102.3 },
      debeEstarFecha: '2026-10-24',
      debeEstarHora: '16:41',
      saleFecha: '',
      saleHora: '',
    },
  ],
  retorno: { destino: 'origen', punto: null },
  rango: { inicio: '2026-10-20', fin: '2026-10-24' },
};

describe('ResumenViaje', () => {
  it('muestra estado/municipio y coordenadas del origen, sin el nombre genérico', () => {
    render(<ResumenViaje {...base} />);
    const origen = screen.getByText('Origen').parentElement!;
    expect(origen).toHaveTextContent('Tlalpan, Ciudad de México · 19.48239, -99.10327');
    expect(screen.queryByText(/Punto seleccionado en mapa/)).not.toBeInTheDocument();
  });

  it('el regreso se titula Regreso y, si vuelve al origen, muestra ubicación, coordenadas y (origen)', () => {
    render(<ResumenViaje {...base} />);
    const regreso = screen.getByText('Regreso').parentElement!;
    expect(regreso).toHaveTextContent('Tlalpan, Ciudad de México · 19.48239, -99.10327 (origen)');
  });

  it('el regreso a otro punto muestra nombre/municipio y coordenadas', () => {
    render(
      <ResumenViaje
        {...base}
        retorno={{ destino: 'otro', punto: { nombre: 'Hotel Central', latitud: 19.43, longitud: -99.13, municipio: 'Cuauhtémoc', estado: 'Ciudad de México' } }}
      />,
    );
    const regreso = screen.getByText('Regreso').parentElement!;
    expect(regreso).toHaveTextContent('Cuauhtémoc, Ciudad de México · 19.43000, -99.13000');
  });

  it('muestra el viaje compartido y sus acompañantes', () => {
    render(<ResumenViaje {...base} compartido acompanantes={['Ana Pérez', 'Luis Ruiz']} />);
    expect(screen.getByText('Compartido con Ana Pérez, Luis Ruiz')).toBeInTheDocument();
  });

  it('las coordenadas del destino también abren el mapa de referencia', async () => {
    const usuario = userEvent.setup();
    render(<ResumenViaje {...base} />);
    const botones = screen.getAllByRole('button', { name: /Ver .* en el mapa/ });
    await usuario.click(botones[1]);
    expect(await screen.findByTestId('mapa-punto')).toBeInTheDocument();
  });
});
