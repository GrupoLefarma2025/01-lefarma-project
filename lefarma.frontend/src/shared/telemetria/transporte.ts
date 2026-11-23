import { API_BASE } from './config';
import type { EventoTelemetria, SobreTelemetria } from './tipos';

export type ResultadoEnvio = 'aceptado' | 'rechazado' | 'reintentar';

export function obtenerToken(): string | null {
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
}

export function idVisita(): string {
  try {
    const existente = sessionStorage.getItem('telemetria:visita');
    if (existente) {
      return existente;
    }
    const nueva = nuevoId();
    sessionStorage.setItem('telemetria:visita', nueva);
    return nueva;
  } catch {
    return 'sin-sesion';
  }
}

export function nuevoId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function crearLote(eventos: EventoTelemetria[]): SobreTelemetria {
  return {
    loteId: nuevoId(),
    enviadoEn: new Date().toISOString(),
    visitaId: idVisita(),
    versionApp: import.meta.env.VITE_APP_VERSION,
    eventos,
  };
}

export async function enviarLote(
  lote: SobreTelemetria,
  anonimo = false,
): Promise<ResultadoEnvio> {
  const token = obtenerToken();
  if (!anonimo && !token) {
    return 'reintentar';
  }

  try {
    const respuesta = await fetch(
      `${API_BASE}/telemetria/${anonimo ? 'eventos-anonimos' : 'eventos'}`,
      {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(lote),
      },
    );

    if (respuesta.status === 202) {
      return 'aceptado';
    }

    if ([400, 401, 403, 413, 415, 422].includes(respuesta.status)) {
      return 'rechazado';
    }

    return 'reintentar';
  } catch {
    return 'reintentar';
  }
}
