import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PuntoMapaPicker } from './PuntoMapaPicker';

const api = vi.hoisted(() => ({ getEstadosCatalogo: vi.fn() }));
const municipiosApi = vi.hoisted(() => ({ getMunicipios: vi.fn() }));
vi.mock('@/apps/educacion-medica/services/educacionMedica.api', () => ({
  educacionMedicaApi: {
    regiones: { getEstadosCatalogo: api.getEstadosCatalogo },
  },
}));
vi.mock('../services/municipios.api', () => ({
  municipiosApi: { getMunicipios: municipiosApi.getMunicipios },
}));

// jsdom no renderiza Leaflet; se sustituyen las primitivas por nodos planos.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ setView: vi.fn(), flyTo: vi.fn() }),
  useMapEvents: () => ({}),
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) } }));

const estados = [
  { codigoEstado: 15, nombreEstado: 'México', idRegion: null, nombreRegion: null },
  { codigoEstado: 9, nombreEstado: 'Ciudad de México', idRegion: null, nombreRegion: null },
];
const municipios = [
  { idMunicipio: 101, codigoEstado: 15, nombre: 'Toluca', claveMunicipio: '106', latitud: 19.29, longitud: -99.65 },
  { idMunicipio: 102, codigoEstado: 15, nombre: 'Metepec', claveMunicipio: '108', latitud: 19.25, longitud: -99.6 },
];

const respuestaOk = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  vi.clearAllMocks();
  api.getEstadosCatalogo.mockResolvedValue({ data: { success: true, data: estados } });
  municipiosApi.getMunicipios.mockResolvedValue({ data: { success: true, data: municipios } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('selector de punto en mapa', () => {
  it('cascada estado → municipio: getMunicipios recibe el codigoEstado elegido', async () => {
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    const estado = await screen.findByLabelText('Estado');
    await waitFor(() => expect(screen.getByRole('option', { name: 'México' })).toBeInTheDocument());
    fireEvent.change(estado, { target: { value: '15' } });
    await waitFor(() => expect(municipiosApi.getMunicipios).toHaveBeenCalledWith(15));
    expect(screen.getByRole('option', { name: 'Toluca' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Metepec' })).toBeInTheDocument();
  });

  it('la búsqueda global respeta el debounce (no dispara a medio teclear)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk([]));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), { target: { value: 'reforma' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/viaticos/geocodificar');
    expect(String(fetchMock.mock.calls[0][0])).toContain('tipo=global');
    expect(String(fetchMock.mock.calls[0][0])).toContain('texto=reforma');
  });

  it('throttle: no dispara más de una petición por segundo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk([]));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: 'reforma' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Segunda búsqueda a los 400 ms: espera a cumplir 1 s desde la anterior.
    fireEvent.change(input, { target: { value: 'reforma 123' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('selecciona un resultado global y fija el marcador con sus coordenadas', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), { target: { value: 'reforma 123' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Av. Reforma 123, CDMX' }));
    expect(onChange).toHaveBeenCalledWith({ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 });
  });

  it('la búsqueda guiada envía estado, municipio y calle a Nominatim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk([]));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    const estado = await screen.findByLabelText('Estado');
    await waitFor(() => expect(screen.getByRole('option', { name: 'México' })).toBeInTheDocument());
    fireEvent.change(estado, { target: { value: '15' } });
    const municipio = await screen.findByLabelText('Municipio');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Toluca' })).toBeInTheDocument());
    fireEvent.change(municipio, { target: { value: '101' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Av. Reforma 123'), { target: { value: 'Av. Reforma 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el mapa' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const params = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost').searchParams;
    expect(params.get('tipo')).toBe('cascada');
    expect(params.get('estado')).toBe('México');
    expect(params.get('municipio')).toBe('Toluca');
    expect(params.get('texto')).toBe('Av. Reforma 123');
  });

  it('no inventa coordenadas cuando no hay resultados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk([]));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), { target: { value: 'zzzz' } });
    expect(await screen.findByText(/Sin resultados/)).toBeInTheDocument();
  });

  it('maneja el fallo de red sin inventar coordenadas', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), { target: { value: 'reforma' } });
    expect(await screen.findByText(/No se pudo buscar la dirección/)).toBeInTheDocument();
  });

  it('Agregar confirma solo cuando hay un punto', async () => {
    const onAgregar = vi.fn();
    const { rerender } = render(<PuntoMapaPicker value={null} onChange={vi.fn()} onAgregar={onAgregar} />);
    await screen.findByLabelText('Estado');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    rerender(<PuntoMapaPicker value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={vi.fn()} onAgregar={onAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(onAgregar).toHaveBeenCalledTimes(1);
  });
});