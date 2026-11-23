import { getVisitorToken, sigmaAuth } from '@/apps/sigma/store/sigmaAuth';

export const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
).replace(/\/+$/, '');

const VISITOR_HEADER = 'X-Sigma-Visitor';

type RequestMode = 'session' | 'visitor';

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

export function get<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'GET' });
}

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

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function postForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), {
    method: 'POST',
    body: formData,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'DELETE' });
}

export function visitorGet<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'GET' }, 'visitor');
}

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

export function visitorPostForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(
    resolveUrl(API_BASE_URL, path),
    { method: 'POST', body: formData },
    'visitor'
  );
}

export function visitorDel<T>(path: string): Promise<T> {
  return request<T>(resolveUrl(API_BASE_URL, path), { method: 'DELETE' }, 'visitor');
}
