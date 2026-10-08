import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SelectorRutaModal } from './SelectorRutaModal';
import type { PuntoSeleccion } from '../types/costosRuta.types';

const api = vi.hoisted(() => ({ getEstadosCatalogo: vi.fn() }));
const municipiosApi = vi.hoisted(() => ({ getMunicipios: vi.fn() }));
const geo = vi.hoisted(() => ({
  polylinea: vi.fn(),
  clics: [] as Array<(evento: { latlng: { lat: number; lng: number } }) => void>,
  setView: vi.fn(),
}));

vi.mock('@/apps/educacion-medica/services/educacionMedica.api', () => ({
  educacionMedicaApi: { regiones: { getEstadosCatalogo: api.getEstadosCatalogo } },
}));
vi.mock('../services/municipios.api', () => ({
  municipiosApi: { getMunicipios: municipiosApi.getMunicipios },
}));

// jsdom no renderiza Leaflet: se sustituyen las primitivas por nodos planos,
// pero se registran las posiciones de la polylinea y los manejadores de clic.
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  const mapa = { setView: geo.setView, flyTo: vi.fn() };
  return {
    MapContainer: ({ children, className }: { children?: ReactNode; className?: string }) =>
      React.createElement('div', { 'data-testid': 'mapa', className }, children),
    TileLayer: () => null,
    // El icono es HTML (L.divIcon): se inyecta para poder leer el número del badge.
    Marker: ({ icon }: { icon?: { html?: string } }) =>
      React.createElement('div', {
        'data-testid': 'marcador',
        dangerouslySetInnerHTML: { __html: icon?.html ?? '' },
      }),
    Popup: ({ children }: { children?: ReactNode }) => React.createElement('span', null, children),
    Polyline: ({ positions }: { positions: unknown }) => {
      geo.polylinea(positions);
      return React.createElement('div', { 'data-testid': 'polylinea' });
    },
    useMap: () => mapa,
    useMapEvents: (handlers: {
      click?: (evento: { latlng: { lat: number; lng: number } }) => void;
    }) => {
      React.useEffect(() => {
        if (handlers?.click) geo.clics.push(handlers.click);
      }, []);
      return mapa;
    },
  };
});
vi.mock('leaflet', () => ({ default: { divIcon: (opciones: unknown) => opciones } }));

const punto = (nombre: string, latitud: number, longitud: number): PuntoSeleccion => ({
  nombre,
  latitud,
  longitud,
});

const TRES = [punto('Origen', 19.1, -99.1), punto('Taller', 19.2, -99.2), punto('Cliente', 19.3, -99.3)];

/** Últimas posiciones entregadas a la polylinea. */
const posicionesPolylinea = (): [number, number][] => geo.polylinea.mock.calls.at(-1)![0];

/** Solo los marcadores de la secuencia: llevan el número 1..N como texto. */
const numerosMarcador = (): string[] =>
  screen
    .getAllByTestId('marcador')
    .map((el) => el.textContent?.trim() ?? '')
    .filter((texto) => /^\d+$/.test(texto));

/** El mapa de la ruta es el primero que se monta; su manejador de clic va primero. */
const clicEnMapa = (lat: number, lng: number) => {
  const manejador = geo.clics[0];
  expect(manejador).toBeTypeOf('function');
  act(() => { manejador!({ latlng: { lat, lng } }); });
};

const montar = (props: Partial<React.ComponentProps<typeof SelectorRutaModal>> = {}) => {
  const onChange = vi.fn();
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <SelectorRutaModal
      puntos={TRES}
      onChange={onChange}
      onConfirm={onConfirm}
      open
      onOpenChange={onOpenChange}
      {...props}
    />,
  );
  return { onChange, onConfirm, onOpenChange };
};

beforeEach(() => {
  vi.clearAllMocks();
  geo.polylinea.mockClear();
  geo.clics.length = 0;
  geo.setView.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) }));
  api.getEstadosCatalogo.mockResolvedValue({
    data: {
      success: true,
      data: [{ codigoEstado: 15, nombreEstado: 'México', idRegion: null, nombreRegion: null }],
    },
  });
  municipiosApi.getMunicipios.mockResolvedValue({
    data: { success: true, data: [{ idMunicipio: 101, codigoEstado: 15, nombreMunicipio: 'Toluca' }] },
  });
});

describe('SelectorRutaModal', () => {
  it('dibuja la polylinea con los 3 puntos en orden y los marcadores numerados', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    expect(posicionesPolylinea()).toEqual([
      [19.1, -99.1],
      [19.2, -99.2],
      [19.3, -99.3],
    ]);
    expect(numerosMarcador()).toEqual(['1', '2', '3']);
  });

  it('el contenedor de leaflet de la ruta recibe altura propia (no queda en 0)', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    // Leaflet mide el div .leaflet-container que renderiza MapContainer: si la
    // altura vive solo en el wrapper exterior, el mapa se mide en 0 de alto.
    const seccion = screen.getByText('Ruta en el mapa').closest('section')!;
    const contenedor = seccion.querySelector('[data-testid="mapa"]')!;
    expect(contenedor.className).toMatch(/\bh-\d+\b/);
  });

  it('un clic en el mapa inserta el punto N+1 y no reemplaza el punto 1', async () => {
    montar({ puntos: [punto('Origen', 19.1, -99.1)] });
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    clicEnMapa(19.5, -99.5);
    await waitFor(() => expect(posicionesPolylinea()).toHaveLength(2));
    // El punto 1 sigue ahí: la secuencia grew, no se sobrescribió.
    expect(posicionesPolylinea()).toEqual([
      [19.1, -99.1],
      [19.5, -99.5],
    ]);
    expect(screen.getByTestId('punto-0')).toHaveTextContent('Origen');
    expect(screen.getByTestId('punto-1')).toHaveTextContent('Punto 2');
    expect(numerosMarcador()).toEqual(['1', '2']);
  });

  it('Subir reordena la secuencia y redibuja la polylinea', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Subir punto 3' }));
    await waitFor(() =>
      expect(posicionesPolylinea()).toEqual([
        [19.1, -99.1],
        [19.3, -99.3],
        [19.2, -99.2],
      ]),
    );
    expect(screen.getByTestId('punto-1')).toHaveTextContent('Cliente');
  });

  it('Eliminar deja la polylinea con 2 coordenadas', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar punto 2' }));
    await waitFor(() =>
      expect(posicionesPolylinea()).toEqual([
        [19.1, -99.1],
        [19.3, -99.3],
      ]),
    );
  });

  it('Cancelar no muta al padre y Confirmar entrega la secuencia completa', async () => {
    const { onChange, onConfirm, onOpenChange } = montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onChange).toHaveBeenCalledWith(TRES);
    expect(onConfirm).toHaveBeenCalledWith(TRES);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Confirmar entrega el orden reordenado, no el orden inicial', async () => {
    const { onChange } = montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Subir punto 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onChange).toHaveBeenCalledWith([TRES[0], TRES[2], TRES[1]]);
  });

  it('las dos vías de búsqueda están visibles y ninguna está deshabilitada', async () => {
    montar();
    const global = screen.getByRole('tab', { name: 'Buscador global' });
    const cascada = screen.getByRole('tab', { name: 'Por estado y municipio' });
    expect(global).toBeEnabled();
    expect(cascada).toBeEnabled();

    // La cascada es opcional: se puede usar igual que el buscador global.
    await screen.findByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.click(cascada);
    expect(await screen.findByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Buscador global' })).toBeEnabled();
  });

  it('la lista de puntos es navegable por teclado', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    const primero = screen.getByTestId('punto-0');
    primero.focus();
    expect(primero).toHaveFocus();
    fireEvent.keyDown(primero, { key: 'ArrowDown' });
    expect(screen.getByTestId('punto-1')).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId('punto-1'), { key: 'ArrowUp' });
    expect(primero).toHaveFocus();
  });

  it('Editar renombra el punto y el mapa lo conserva', async () => {
    montar();
    await waitFor(() => expect(geo.polylinea).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Editar punto 2' }));
    fireEvent.change(screen.getByLabelText('Nombre del punto 2'), { target: { value: 'Taller centro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto 2' }));
    expect(screen.getByTestId('punto-1')).toHaveTextContent('Taller centro');
    // Reordenar conserva los nombres editados.
    fireEvent.click(screen.getByRole('button', { name: 'Subir punto 2' }));
    expect(screen.getByTestId('punto-0')).toHaveTextContent('Taller centro');
  });
});
