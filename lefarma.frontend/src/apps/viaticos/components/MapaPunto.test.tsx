import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapaPunto } from './MapaPunto';

// jsdom no renderiza Leaflet; se sustituyen las primitivas por nodos planos.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ setView: vi.fn() }),
  useMapEvents: () => ({}),
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) } }));

const PUNTO = { nombre: 'Matriz', latitud: 19.43, longitud: -99.13 };

describe('MapaPunto', () => {
  it('muestra el punto con su nombre', () => {
    render(<MapaPunto punto={PUNTO} interactivo onPunto={() => {}} onMover={() => {}} />);
    expect(screen.getByTestId('mapa')).toBeInTheDocument();
    expect(screen.getByTestId('marcador')).toHaveTextContent('Matriz');
  });

  it('sin punto no hay marcador', () => {
    render(<MapaPunto punto={null} interactivo={false} />);
    expect(screen.getByTestId('mapa')).toBeInTheDocument();
    expect(screen.queryByTestId('marcador')).not.toBeInTheDocument();
  });
});
