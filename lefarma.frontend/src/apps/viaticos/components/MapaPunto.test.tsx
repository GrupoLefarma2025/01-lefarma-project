import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MapaPunto } from './MapaPunto';

const handlers = vi.hoisted(() => ({ actual: {} as Record<string, (e: unknown) => void> }));

// jsdom no renderiza Leaflet; se sustituyen las primitivas por nodos planos.
// useMapEvents captura los manejadores para poder disparar clic derecho.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  ZoomControl: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 15 }),
  useMapEvents: (h: Record<string, (e: unknown) => void>) => {
    Object.assign(handlers.actual, h);
    return {};
  },
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) } }));

const PUNTO = { nombre: 'Matriz', latitud: 19.43, longitud: -99.13 };

function clicDerecho(lat = 19.5, lng = -99.5) {
  act(() => {
    handlers.actual.contextmenu({ latlng: { lat, lng } });
  });
}

beforeEach(() => {
  handlers.actual = {};
});

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

  it('clic derecho abre el menú contextual sin fijar el pin', () => {
    const onPunto = vi.fn();
    render(<MapaPunto punto={PUNTO} interactivo onPunto={onPunto} onMover={() => {}} onQuitar={() => {}} />);
    clicDerecho();
    expect(onPunto).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Poner pin aquí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Centrar aquí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar coordenadas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar pin' })).toBeInTheDocument();
  });

  it('poner pin desde el menú fija el pin en la posición del clic derecho', () => {
    const onPunto = vi.fn();
    render(<MapaPunto punto={null} interactivo onPunto={onPunto} onMover={() => {}} onQuitar={() => {}} />);
    clicDerecho(19.5, -99.5);
    // Sin pin no se ofrece quitarlo.
    expect(screen.queryByRole('button', { name: 'Quitar pin' })).not.toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: 'Poner pin aquí' }).click();
    });
    expect(onPunto).toHaveBeenCalledWith(19.5, -99.5);
    expect(screen.queryByRole('button', { name: 'Poner pin aquí' })).not.toBeInTheDocument();
  });

  it('quitar pin del menú avisa al padre y cierra el menú', () => {
    const onQuitar = vi.fn();
    render(<MapaPunto punto={PUNTO} interactivo onPunto={() => {}} onMover={() => {}} onQuitar={onQuitar} />);
    clicDerecho();
    expect(screen.getByRole('button', { name: 'Quitar pin' })).toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: 'Quitar pin' }).click();
    });
    expect(onQuitar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Centrar aquí' })).not.toBeInTheDocument();
  });

  it('un clic del menú (popup o botón ya desmontado) no fija el pin; un clic normal del mapa sí', () => {
    const onPunto = vi.fn();
    render(<MapaPunto punto={null} interactivo onPunto={onPunto} onMover={() => {}} />);
    const popup = document.createElement('div');
    popup.className = 'leaflet-popup';
    const boton = document.createElement('button');
    popup.appendChild(boton);
    document.body.appendChild(popup);
    try {
      act(() => {
        handlers.actual.click({ latlng: { lat: 19.9, lng: -99.9 }, originalEvent: { target: boton } });
      });
      expect(onPunto).not.toHaveBeenCalled();
    } finally {
      popup.remove();
    }
    // Botón ya desmontado (React quitó el menú antes de procesar el clic).
    const suelto = document.createElement('button');
    act(() => {
      handlers.actual.click({ latlng: { lat: 19.8, lng: -99.8 }, originalEvent: { target: suelto } });
    });
    expect(onPunto).not.toHaveBeenCalled();
    act(() => {
      handlers.actual.click({ latlng: { lat: 19.5, lng: -99.5 } });
    });
    expect(onPunto).toHaveBeenCalledWith(19.5, -99.5);
  });

  it('ignora los clics fuera de México', () => {
    const onPunto = vi.fn();
    render(<MapaPunto punto={null} interactivo onPunto={onPunto} onMover={() => {}} />);
    act(() => {
      handlers.actual.click({ latlng: { lat: 29.76, lng: -95.37 } }); // Houston
    });
    expect(onPunto).not.toHaveBeenCalled();
  });

  it('sin modo interactivo no hay menú de clic derecho', () => {
    render(<MapaPunto punto={PUNTO} interactivo={false} />);
    expect(handlers.actual.contextmenu).toBeUndefined();
  });
});
