import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PuntoMapaPicker } from './PuntoMapaPicker';

const mapaHandlers = vi.hoisted(() => ({ actual: {} as Record<string, (e: unknown) => void> }));
const mapaSetView = vi.hoisted(() => vi.fn());

// jsdom no renderiza Leaflet; se sustituyen las primitivas por nodos planos.
// useMapEvents captura los manejadores para poder disparar clic derecho.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  ZoomControl: () => null,
  Marker: () => null,
  Popup: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useMap: () => ({ setView: mapaSetView, flyTo: vi.fn(), getZoom: () => 15 }),
  useMapEvents: (h: Record<string, (e: unknown) => void>) => {
    Object.assign(mapaHandlers.actual, h);
    return {};
  },
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) } }));

const respuestaOk = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  vi.clearAllMocks();
  mapaHandlers.actual = {};
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('selector de punto en mapa', () => {
  it('ya no ofrece la dirección guiada por estado y municipio', () => {
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByText(/Dirección guiada/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Municipio')).not.toBeInTheDocument();
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
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: 'reforma 123' } });
    fireEvent.click(await screen.findByRole('option', { name: /Av\. Reforma 123/ }));
    expect(onChange).toHaveBeenCalledWith({ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 });
    // Estilo Google: el recuadro queda con el nombre del lugar elegido y el panel se cierra.
    expect(input).toHaveValue('Av. Reforma 123, CDMX');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('conserva estado y municipio del resultado cuando el backend los trae', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{ nombre: 'Av. Reforma 123, Toluca', latitud: 19.29, longitud: -99.65, estado: 'México', municipio: 'Toluca' }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), { target: { value: 'reforma 123' } });
    fireEvent.click(await screen.findByRole('option', { name: /Av\. Reforma 123/ }));
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Av. Reforma 123, Toluca', latitud: 19.29, longitud: -99.65, estado: 'México', municipio: 'Toluca',
    });
  });

  it('el botón ✕ borra el texto y el panel de resultados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');

    // Sin texto no hay botón de borrado.
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'reforma 123' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar búsqueda' }));

    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
  });

  it('teclado: flechas resaltan resultados y Enter elige el activo', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [
        { nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 },
        { nombre: 'Av. Reforma 456, Guadalajara', latitud: 20.6767, longitud: -103.3475 },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: 'reforma' } });
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    // Rueda: bajar del último vuelve al primero.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Escape cierra el panel sin borrar el texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: 'reforma' } });
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('reforma');
  });

  it('«Cerca de mí» agrega el viewbox de la ubicación a la búsqueda', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (exito: PositionCallback) =>
          exito({ coords: { latitude: 19.4326, longitude: -99.1332 } } as unknown as GeolocationPosition),
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({ success: true, data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);

    const boton = screen.getByRole('button', { name: /Cerca de mí/ });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), {
      target: { value: '20 de Noviembre 13' },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    // Caja de ~50 km alrededor de la ubicación (minLon,minLat,maxLon,maxLat).
    const params = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost').searchParams;
    expect(params.get('viewbox')).toBe('-99.5832,18.9826,-98.6832,19.8826');

    // Apagarlo vuelve a buscar sin sesgo.
    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
    const sinSesgo = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost').searchParams;
    expect(sinSesgo.get('viewbox')).toBeNull();
  });

  it('muestra un aviso cuando el navegador niega la ubicación', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_exito: PositionCallback, fallo: PositionErrorCallback) =>
          fallo({} as unknown as GeolocationPositionError),
      },
    });
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerca de mí/ }));
    expect(await screen.findByText(/No pudimos obtener tu ubicación/)).toBeInTheDocument();
  });

  it('oculta «Cerca de mí» cuando el navegador no ofrece geolocalización', () => {
    render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Cerca de mí/ })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    rerender(<PuntoMapaPicker value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={vi.fn()} onAgregar={onAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  it('ocultarMapa esconde el mapa pero conserva la búsqueda', async () => {
    const { rerender } = render(<PuntoMapaPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId('mapa')).toBeInTheDocument();
    rerender(<PuntoMapaPicker value={null} onChange={vi.fn()} ocultarMapa />);
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar dirección (OpenStreetMap)')).toBeInTheDocument();
  });

  it('modo flotante: la búsqueda queda sobre el mapa (mismo contenedor)', () => {
    render(<PuntoMapaPicker flotante value={null} onChange={vi.fn()} />);
    const mapa = screen.getByTestId('mapa');
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    const raiz = mapa.closest('div.relative');
    expect(raiz).not.toBeNull();
    expect(raiz).toContainElement(input);
  });

  it('modo flotante: Agregar flota sobre el mapa (sin resumen ni botones al pie)', () => {
    const onAgregar = vi.fn();
    const { rerender } = render(<PuntoMapaPicker flotante value={null} onChange={vi.fn()} onAgregar={onAgregar} />);
    const raiz = screen.getByTestId('mapa').closest('div.relative');
    expect(raiz).toContainElement(screen.getByRole('button', { name: 'Agregar' }));
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    expect(screen.queryByText(/^Punto:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Centrar' })).not.toBeInTheDocument();
    rerender(<PuntoMapaPicker flotante value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={vi.fn()} onAgregar={onAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  it('modo flotante: sin onAgregar no hay botón sobre el mapa; agregarDeshabilitado lo apaga', () => {
    const { rerender } = render(<PuntoMapaPicker flotante value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
    rerender(<PuntoMapaPicker flotante agregarDeshabilitado value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={vi.fn()} onAgregar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('clic derecho abre el menú sin tocar el pin; poner pin aquí lo fija', async () => {
    const onChange = vi.fn();
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    await act(async () => {
      mapaHandlers.actual.contextmenu({ latlng: { lat: 19.5, lng: -99.5 } });
    });
    expect(onChange).not.toHaveBeenCalled();
    // Sin pin no se ofrece quitarlo.
    expect(screen.queryByRole('button', { name: 'Quitar pin' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Poner pin aquí' }));
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Punto seleccionado en mapa',
      latitud: 19.5,
      longitud: -99.5,
    });
    expect(screen.queryByRole('button', { name: 'Poner pin aquí' })).not.toBeInTheDocument();
  });

  it('centrar aquí solo mueve el mapa, sin tocar el pin', async () => {
    const onChange = vi.fn();
    render(<PuntoMapaPicker value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={onChange} />);
    await act(async () => {
      mapaHandlers.actual.contextmenu({ latlng: { lat: 19.5, lng: -99.5 } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Centrar aquí' }));
    expect(mapaSetView).toHaveBeenCalledWith([19.5, -99.5], 15);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Centrar aquí' })).not.toBeInTheDocument();
  });

  it('con pin, quitarlo desde el menú lo limpia y cierra el menú', async () => {
    const onChange = vi.fn();
    render(<PuntoMapaPicker value={{ nombre: 'Punto', latitud: 19, longitud: -99 }} onChange={onChange} />);
    await act(async () => {
      mapaHandlers.actual.contextmenu({ latlng: { lat: 19.5, lng: -99.5 } });
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar pin' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('button', { name: 'Quitar pin' })).not.toBeInTheDocument();
  });

  it('un clic del menú (popup o botón ya desmontado) no mueve el pin; un clic normal del mapa sí', async () => {
    const onChange = vi.fn();
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    // Clic del menú: Leaflet puede reemitir el clic del mapa desde el popup.
    const popup = document.createElement('div');
    popup.className = 'leaflet-popup';
    const boton = document.createElement('button');
    popup.appendChild(boton);
    document.body.appendChild(popup);
    try {
      await act(async () => {
        mapaHandlers.actual.click({ latlng: { lat: 19.9, lng: -99.9 }, originalEvent: { target: boton } });
      });
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      popup.remove();
    }
    // Botón ya desmontado (React quitó el menú antes de procesar el clic).
    const suelto = document.createElement('button');
    await act(async () => {
      mapaHandlers.actual.click({ latlng: { lat: 19.8, lng: -99.8 }, originalEvent: { target: suelto } });
    });
    expect(onChange).not.toHaveBeenCalled();
    // Clic directo sobre el mapa (sin popup): sí fija el pin.
    await act(async () => {
      mapaHandlers.actual.click({ latlng: { lat: 19.5, lng: -99.5 } });
    });
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Punto seleccionado en mapa',
      latitud: 19.5,
      longitud: -99.5,
    });
  });

  it('ignora los clics fuera de México', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    await act(async () => {
      mapaHandlers.actual.click({ latlng: { lat: 29.76, lng: -95.37 } }); // Houston
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un clic en el mapa resuelve estado y municipio sin mover las coordenadas', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{
        nombre: 'Calle Independencia 10, Toluca',
        latitud: 19.29,
        longitud: -99.65,
        estado: 'México',
        municipio: 'Toluca',
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    await act(async () => {
      mapaHandlers.actual.click({ latlng: { lat: 19.29, lng: -99.65 } });
    });
    expect(onChange).toHaveBeenNthCalledWith(1, {
      nombre: 'Punto seleccionado en mapa',
      latitud: 19.29,
      longitud: -99.65,
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({
      nombre: 'Calle Independencia 10, Toluca',
      latitud: 19.29,
      longitud: -99.65,
      estado: 'México',
      municipio: 'Toluca',
    }));
    expect(String(fetchMock.mock.calls[0][0])).toContain('tipo=reversa');
  });

  it('rechaza coordenadas pegadas fuera de México', async () => {
    const onChange = vi.fn();
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), {
      target: { value: '29.7604, -95.3698' },
    });
    expect(await screen.findByText('Solo puedes usar coordenadas dentro de México.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('coordenadas pegadas: las nombra con la geocodificación inversa y normaliza el texto', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{
        nombre: 'Calle República de Bolivia 2, Centro, Ciudad de México',
        latitud: 19.4394779,
        longitud: -99.1331327,
        estado: 'Ciudad de México',
        municipio: 'Cuauhtémoc',
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: '19.4395, -99.1332' } });

    fireEvent.click(await screen.findByRole('option', { name: /Calle República de Bolivia 2/ }));
    // El punto usa EXACTAMENTE las coordenadas pegadas (no las del más cercano).
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Calle República de Bolivia 2, Centro, Ciudad de México',
      latitud: 19.4395,
      longitud: -99.1332,
      estado: 'Ciudad de México',
      municipio: 'Cuauhtémoc',
    });
    // El recuadro queda con las coordenadas normalizadas, sin nueva red.
    expect(input).toHaveValue('19.43950, -99.13320');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('tipo=reversa');
  });

  it('coordenadas pegadas sin geocodificación inversa conservan las coordenadas como nombre', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: '19.4395, -99.1332' } });

    fireEvent.click(await screen.findByRole('option', { name: /Lat 19\.43950/ }));
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Lat 19.43950, Lng -99.13320',
      latitud: 19.4395,
      longitud: -99.1332,
    });
    expect(input).toHaveValue('19.43950, -99.13320');
  });

  it('una liga larga de Google Maps fija el punto con sus coordenadas', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({ success: true, data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), {
      target: { value: 'https://www.google.com/maps/place/Hospital/@19.3905,-99.1213,17z' },
    });

    fireEvent.click(await screen.findByRole('option', { name: /Lat 19\.39050/ }));
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Lat 19.39050, Lng -99.12130',
      latitud: 19.3905,
      longitud: -99.1213,
    });
    // Solo se llamó a la geocodificación inversa, no a la búsqueda textual.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('tipo=reversa');
  });

  it('una liga corta la resuelve el backend y fija el punto', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respuestaOk({ success: true, data: 'https://www.google.com/maps/place/Hospital/@19.3905,-99.1213,17z' }))
      .mockResolvedValueOnce(respuestaOk({ success: true, data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), {
      target: { value: 'https://maps.app.goo.gl/AbC123' },
    });

    fireEvent.click(await screen.findByRole('option', { name: /Lat 19\.39050/ }));
    expect(onChange).toHaveBeenCalledWith({
      nombre: 'Lat 19.39050, Lng -99.12130',
      latitud: 19.3905,
      longitud: -99.1213,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('resolver-liga');
    expect(String(fetchMock.mock.calls[1][0])).toContain('tipo=reversa');
  });

  it('una liga ilegible deja un aviso sin inventar el punto', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Buscar dirección (OpenStreetMap)'), {
      target: { value: 'https://maps.app.goo.gl/rota' },
    });

    expect(await screen.findByText(/No pudimos leer esa liga/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Enter con un solo resultado lo elige directo', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk({
      success: true,
      data: [{ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PuntoMapaPicker value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Buscar dirección (OpenStreetMap)');
    fireEvent.change(input, { target: { value: 'reforma 123' } });
    await screen.findAllByRole('option');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ nombre: 'Av. Reforma 123, CDMX', latitud: 19.4326, longitud: -99.1332 });
  });
});
