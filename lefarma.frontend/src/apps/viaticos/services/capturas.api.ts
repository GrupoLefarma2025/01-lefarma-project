import { API } from '@/shared/api/apiClient';

export interface CapturaResultado {
  url: string | null;
  ok: boolean;
  archivo: string | null;
  error: string | null;
}

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

export interface CapturaBuscada {
  archivo: string | null;
  url_captura: string | null;
  datos: Record<string, unknown> | null;
  modelo: string | null;
  buscado_en: string | null;
  error: string | null;
}

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
