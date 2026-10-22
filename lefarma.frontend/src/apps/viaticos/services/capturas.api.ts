import { API } from '@/shared/api/apiClient';

/**
 * Resultado por URL del endpoint `POST /api/viaticos/capturas`. El backend
 * devuelve `archivo` (ruta relativa tipo `capturas-viaticos/x.png`) solo
 * cuando logró el PNG; si falló, viene `ok: false` con `error`.
 */
export interface CapturaResultado {
  url: string | null;
  ok: boolean;
  archivo: string | null;
  error: string | null;
}

/**
 * Captura PNGs de URLs de proveedor. El backend las toma con Playwright y
 * publica el archivo en `wwwroot/media/capturas-viaticos`.
 *
 * El timeout es largo a proposito: cada captura tarda 5-20 s y el cliente
 * por defecto corta a los 30 s.
 */
export async function capturarUrls(
  items: { url: string; nombre: string }[],
): Promise<CapturaResultado[]> {
  if (items.length === 0) return [];
  const respuesta = await API.post(
    '/viaticos/capturas',
    { urls: items },
    { timeout: 180_000 },
  );
  const datos = (respuesta.data as { data?: CapturaResultado[] } | undefined)?.data;
  return Array.isArray(datos) ? datos : [];
}
