import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CeldaCaptura, MiniaturaCaptura, rutaApiCaptura } from './celdasCotizacion';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: api.get, post: vi.fn() } }));

const urlMock = vi.hoisted(() => ({ crear: vi.fn(), revocar: vi.fn() }));

beforeEach(() => {
  api.get.mockReset();
  urlMock.crear.mockReset();
  urlMock.revocar.mockReset();
  let contador = 0;
  urlMock.crear.mockImplementation(() => `blob:captura-${++contador}`);
  // jsdom no implementa createObjectURL/revokeObjectURL.
  (URL as unknown as Record<string, unknown>).createObjectURL = urlMock.crear;
  (URL as unknown as Record<string, unknown>).revokeObjectURL = urlMock.revocar;
});

describe('rutaApiCaptura', () => {
  it('traduce las rutas persistidas de captura al endpoint autenticado', () => {
    expect(rutaApiCaptura('/api/media/capturas-viaticos/uno.png')).toBe('/viaticos/capturas/uno.png');
    expect(rutaApiCaptura('/media/capturas-viaticos/uno.png')).toBe('/viaticos/capturas/uno.png');
    expect(rutaApiCaptura('capturas-viaticos/uno.png')).toBe('/viaticos/capturas/uno.png');
  });

  it('no toca URLs externas ni data URIs, que no llevan token', () => {
    expect(rutaApiCaptura('https://ejemplo.test/cap.png')).toBeNull();
    expect(rutaApiCaptura('data:image/png;base64,AAAA')).toBeNull();
  });
});

describe('CeldaCaptura', () => {
  it('pide la captura interna por el cliente autenticado y libera el object URL al desmontar', async () => {
    api.get.mockResolvedValue({ data: new Blob(['png'], { type: 'image/png' }) });

    const { unmount } = render(
      <CeldaCaptura ruta="/api/media/capturas-viaticos/uno.png" etiqueta="Volaris" />,
    );

    const miniatura = await screen.findByRole('img');
    expect(api.get).toHaveBeenCalledWith('/viaticos/capturas/uno.png', { responseType: 'blob' });
    expect(miniatura.getAttribute('src')).toBe('blob:captura-1');
    // La miniatura abre el visor modal, no una pestaña nueva.
    expect(miniatura.closest('button')).not.toBeNull();

    unmount();
    expect(urlMock.revocar).toHaveBeenCalledWith('blob:captura-1');
  });

  it('una captura externa o data URI se pinta directo, sin pasar por el API', async () => {
    render(<CeldaCaptura ruta="https://ejemplo.test/cap.png" etiqueta="Volaris" />);

    const miniatura = await screen.findByRole('img');
    expect(miniatura.getAttribute('src')).toBe('https://ejemplo.test/cap.png');
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByText('Cargando captura…')).not.toBeInTheDocument();
  });

  it('si el fetch falla muestra un error visible, nunca una imagen rota', async () => {
    api.get.mockRejectedValue(new Error('403'));

    render(<CeldaCaptura ruta="/api/media/capturas-viaticos/uno.png" etiqueta="Volaris" />);

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la captura.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sin ruta muestra el placeholder textual y no pide nada', () => {
    render(<CeldaCaptura ruta={undefined} etiqueta="Volaris" />);

    expect(screen.getByText('Sin captura')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('el importador (MiniaturaCaptura) usa el mismo fetch autenticado', async () => {
    api.get.mockResolvedValue({ data: new Blob(['png'], { type: 'image/png' }) });

    render(<MiniaturaCaptura ruta="/api/media/capturas-viaticos/dos.png" alt="Captura 1" />);

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/viaticos/capturas/dos.png', { responseType: 'blob' }),
    );
  });

  it('al hacer clic en la miniatura abre el visor modal con la captura', async () => {
    api.get.mockResolvedValue({ data: new Blob(['png'], { type: 'image/png' }) });

    render(<CeldaCaptura ruta="/api/media/capturas-viaticos/uno.png" etiqueta="Volaris" />);

    const miniatura = await screen.findByRole('img');
    fireEvent.click(miniatura.closest('button')!);

    expect((await screen.findAllByText('Captura · Volaris')).length).toBeGreaterThan(0);
    expect(await screen.findByAltText('captura-Volaris.png')).toBeInTheDocument();
  });

  it('una revisión nueva vuelve a pedir la captura aunque la ruta no cambie', async () => {
    api.get.mockResolvedValue({ data: new Blob(['png'], { type: 'image/png' }) });

    const { rerender } = render(
      <CeldaCaptura ruta="/api/media/capturas-viaticos/uno.png" etiqueta="Volaris" revision={0} />,
    );
    await screen.findByRole('img');

    rerender(
      <CeldaCaptura ruta="/api/media/capturas-viaticos/uno.png" etiqueta="Volaris" revision={1} />,
    );

    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/viaticos/capturas/uno.png?v=1', {
        responseType: 'blob',
      }),
    );
  });

  it('permite subir una captura manual y entrega el PNG elegido', () => {
    const onSubirCaptura = vi.fn();
    const { container } = render(
      <CeldaCaptura ruta={undefined} etiqueta="Volaris" onSubirCaptura={onSubirCaptura} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Subir captura de Volaris' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const archivo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'captura.png', {
      type: 'image/png',
    });

    fireEvent.change(input, { target: { files: [archivo] } });

    expect(onSubirCaptura).toHaveBeenCalledWith(archivo);
  });
});