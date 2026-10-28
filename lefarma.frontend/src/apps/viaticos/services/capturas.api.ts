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

/**
 * Adjunta un PNG tomado FUERA del backend (captura manual del usuario o del
 * navegador del agente). El backend lo publica en la carpeta configurada en
 * `CapturasSettings:OutputPath` y devuelve la misma ruta publica que la captura
 * automatica (`capturas-viaticos/<nombre>.png`).
 *
 * El `Content-Type` no se fija a mano: axios pone el boundary del multipart.
 */
export async function adjuntarCaptura(
  archivo: File,
  nombre: string,
): Promise<CapturaResultado | null> {
  const datos = new FormData();
  datos.append('Nombre', nombre);
  datos.append('Archivo', archivo, archivo.name || `${nombre}.png`);

  const respuesta = await API.post('/viaticos/capturas/adjuntar', datos, {
    timeout: 60_000,
  });
  return (respuesta.data as { data?: CapturaResultado } | undefined)?.data ?? null;
}

/**
 * Resultado de `POST /api/viaticos/capturas/buscar`: la captura de la pagina de
 * RESULTADOS del proveedor (no la portada) y los datos del viaje que el agente
 * logro extraer.
 */
export interface CapturaBuscada {
  archivo: string | null;
  url_captura: string | null;
  datos: Record<string, unknown> | null;
  modelo: string | null;
  buscado_en: string | null;
  error: string | null;
}

/**
 * Pide al agente (OpenCode + Playwright MCP, via backend) abrir la URL de la
 * oferta, llenar el buscador del sitio con `contexto` (origen, destino y fecha)
 * y capturar los RESULTADOS con el costo. Puede tardar minutos: el timeout es
 * de 15 min.
 */
export async function buscarCaptura(
  url: string,
  contexto?: string,
): Promise<CapturaBuscada> {
  const respuesta = await API.post(
    '/viaticos/capturas/buscar',
    { url, contexto: contexto ?? null },
    { timeout: 900_000 },
  );
  const cuerpo = respuesta.data as
    | { success?: boolean; message?: string; data?: CapturaBuscada }
    | undefined;
  if (!cuerpo?.success || !cuerpo.data) {
    throw new Error(cuerpo?.message ?? 'No se pudo buscar la oferta en el sitio.');
  }
  return cuerpo.data;
}
