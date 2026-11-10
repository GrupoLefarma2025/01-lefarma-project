/**
 * Cliente HTTP del módulo Configuración (solo endpoints administrativos).
 *
 * Todas las peticiones llevan timeout propio de 15 s y aceptan un
 * AbortSignal para cancelar al cerrar/desmontar. El `idOperacion` lo genera
 * el llamador y debe reutilizarse al reintentar una operación incierta.
 */

import type { AxiosResponse } from 'axios';
import apiClient from '@/shared/api/apiClient';
import type { ApiError, ApiResponse } from '@/types/api.types';
import type {
  ActualizarVariablePayload,
  BitacoraDetalle,
  BitacoraVariable,
  CambioEstadoPayload,
  CrearIntegracionPayload,
  CrearVariablePayload,
  FiltrosVariables,
  IntegracionCliente,
  IntegracionCreada,
  RestaurarVariablePayload,
  VariableConfiguracion,
} from '../types';

const BASE = '/configuracion';
export const TIMEOUT_MS = 15000;

function desenvuelve<T>(respuesta: AxiosResponse<ApiResponse<T>>): T {
  const cuerpo = respuesta.data;

  if (cuerpo && typeof cuerpo === 'object' && 'success' in cuerpo && typeof cuerpo.success === 'boolean') {
    if (!cuerpo.success) {
      const error: ApiError = {
        message: cuerpo.message || 'La operación no se completó.',
        errors: cuerpo.errors,
        statusCode: 400,
      };
      throw error;
    }
    return cuerpo.data;
  }

  // Tolerancia a endpoints que aún no envuelven la respuesta.
  return cuerpo as unknown as T;
}

function paramsDeFiltros(filtros: FiltrosVariables): Record<string, string> {
  const params: Record<string, string> = {};
  if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();
  if (filtros.tipo) params.tipo = filtros.tipo;
  if (filtros.destino) params.destino = filtros.destino;
  if (filtros.activo === true) params.activo = 'true';
  if (filtros.activo === false) params.activo = 'false';
  return params;
}

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export async function listarVariables(
  filtros: FiltrosVariables,
  signal?: AbortSignal,
): Promise<VariableConfiguracion[]> {
  const respuesta = await apiClient.get<ApiResponse<VariableConfiguracion[]>>(
    `${BASE}/variables`,
    { params: paramsDeFiltros(filtros), signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta) ?? [];
}

export async function obtenerVariable(
  id: number,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.get<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables/${id}`,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function crearVariable(
  payload: CrearVariablePayload,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.post<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function actualizarVariable(
  id: number,
  payload: ActualizarVariablePayload,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.put<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables/${id}`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function desactivarVariable(
  id: number,
  payload: CambioEstadoPayload,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.post<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables/${id}/desactivar`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function reactivarVariable(
  id: number,
  payload: CambioEstadoPayload,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.post<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables/${id}/reactivar`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

export async function listarHistorial(
  id: number,
  signal?: AbortSignal,
): Promise<BitacoraVariable[]> {
  const respuesta = await apiClient.get<ApiResponse<BitacoraVariable[]>>(
    `${BASE}/variables/${id}/historial`,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta) ?? [];
}

export async function obtenerEntradaHistorial(
  id: number,
  idBitacora: number,
  signal?: AbortSignal,
): Promise<BitacoraDetalle> {
  const respuesta = await apiClient.get<ApiResponse<BitacoraDetalle>>(
    `${BASE}/variables/${id}/historial/${idBitacora}`,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function restaurarVariable(
  id: number,
  payload: RestaurarVariablePayload,
  signal?: AbortSignal,
): Promise<VariableConfiguracion> {
  const respuesta = await apiClient.post<ApiResponse<VariableConfiguracion>>(
    `${BASE}/variables/${id}/restaurar`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

/* ------------------------------------------------------------------ */
/* Integraciones                                                       */
/* ------------------------------------------------------------------ */

export async function listarIntegraciones(signal?: AbortSignal): Promise<IntegracionCliente[]> {
  const respuesta = await apiClient.get<ApiResponse<IntegracionCliente[]>>(
    `${BASE}/integraciones-clientes`,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta) ?? [];
}

export async function crearIntegracion(
  payload: CrearIntegracionPayload,
  signal?: AbortSignal,
): Promise<IntegracionCreada> {
  const respuesta = await apiClient.post<ApiResponse<IntegracionCreada>>(
    `${BASE}/integraciones-clientes`,
    payload,
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta);
}

export async function revocarIntegracion(
  id: number,
  signal?: AbortSignal,
): Promise<IntegracionCliente | null> {
  const respuesta = await apiClient.post<ApiResponse<IntegracionCliente | null>>(
    `${BASE}/integraciones-clientes/${id}/revocar`,
    {},
    { signal, timeout: TIMEOUT_MS },
  );
  return desenvuelve(respuesta) ?? null;
}
