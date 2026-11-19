import { getVisitorToken, sigmaAuth } from '@/apps/sigma/store/sigmaAuth';

/**
 * Cliente HTTP de SIGMA.
 *
 * - `get/post/postForm/del` apuntan a la API de Lefarma y adjuntan el token
 *   de la sesión.
 *
 * Los helpers devuelven el JSON completo del backend (no desenvuelven
 * `ApiResponse.data`): cada página decide cómo leer la envoltura.
 */

/** Base de la API de Lefarma (`VITE_API_URL`, por defecto `/api`). */
export const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
).replace(/\/+$/, '');

/** Cabecera con la que el acceso externo identifica al visitante sin sesión. */
const VISITOR_HEADER = 'X-Sigma-Visitor';

/** Modo de autenticación de una petición a la API de Lefarma. */
type RequestMode = 'session' | 'visitor';

/** Error HTTP con el status y el cuerpo devueltos por el backend. */
export class SigmaHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'SigmaHttpError';
    this.status = status;
    this.body = body;
  }
}

interface ErrorBody {
  message?: string;
  error?: string;
}

/** Antepone la base sólo cuando el path es absoluto (empieza con `/`). */
function resolveUrl(base: string, path: string): string {
  return path.startsWith('/') ? `${base}${path}` : path;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const candidate = body as ErrorBody;
    if (typeof candidate.message === 'string' && candidate.message) {
      return candidate.message;
    }
    if (typeof candidate.error === 'string' && candidate.error) {
      return candidate.error;
    }
  }
  return `Error HTTP ${status}`;
}

/**
 * Cabeceras de una petición a la API:
 * - `session`: `Authorization` si hay sesión; si no, cae a `X-Sigma-Visitor`.
 * - `visitor`: siempre `X-Sigma-Visitor`, nunca `Authorization`.
 */
function buildHeaders(init: RequestInit, mode: RequestMode): Headers {
  const headers = new Headers(init.headers);

  if (mode === 'session') {
    const token = sigmaAuth.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      return headers;
    }
  }

  const visitorToken = getVisitorToken();
  if (visitorToken) {
    headers.set(VISITOR_HEADER, visitorToken);
  }
  return headers;
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  mode: RequestMode = 'session'
): Promise<T> {
  const headers = buildHeaders(init, mode);

  // Sin caché: las pantallas de SIGMA muestran estado que cambia con cada acción.
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const body = await readBody(response);

  if (!response.ok) {
    throw new SigmaHttpError(
      errorMessage(body, response.status),
      response.status,
      body
    );
  }

  return body as T;
}

/** GET autenticado contra la API de Lefarma. */
export function get<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'GET' });
}

/** GET autenticado que devuelve el binario de la respuesta (por ejemplo un PDF). */
export async function getBlob(path: string): Promise<Blob> {
  const headers = buildHeaders(
    { headers: { accept: 'application/pdf' } },
    'session'
  );

  const response = await fetch(resolveUrl(API_BASE_URL, path), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await readBody(response);
    throw new SigmaHttpError(
      errorMessage(body, response.status),
      response.status,
      body
    );
  }

  return await response.blob();
}

/** POST JSON autenticado contra la API de Lefarma. */
export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * POST multipart autenticado. No fija `Content-Type` a mano: el navegador
 * genera el boundary de `multipart/form-data`.
 */
export function postForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), {
    method: 'POST',
    body: formData,
  });
}

/** DELETE autenticado contra la API de Lefarma. */
export function del<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'DELETE' });
}

/*
 * Variantes para el acceso externo (visitante sin sesión): mandan siempre
 * `X-Sigma-Visitor` y nunca `Authorization`, para que las páginas públicas no
 * dependan del fallback de `request`.
 */

/** GET como visitante (cabecera `X-Sigma-Visitor`, sin Authorization). */
export function visitorGet<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'GET' }, 'visitor');
}

/** POST JSON como visitante (cabecera `X-Sigma-Visitor`, sin Authorization). */
export function visitorPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(
    resolveUrl(API_BASE_URL, path),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    'visitor'
  );
}

/** POST multipart como visitante (cabecera `X-Sigma-Visitor`, sin Authorization). */
export function visitorPostForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(
    resolveUrl(API_BASE_URL, path),
    { method: 'POST', body: formData },
    'visitor'
  );
}

/** DELETE como visitante (cabecera `X-Sigma-Visitor`, sin Authorization). */
export function visitorDel<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'DELETE' }, 'visitor');
}
