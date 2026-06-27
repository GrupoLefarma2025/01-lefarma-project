import type { ApiError } from '@/types/api.types';

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Estrecha un error desconocido de un catch-clause a ApiError.
 * Recurre a un ApiError sintético cuando el valor no coincide con la forma esperada.
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof Error) {
    return { message: error.message, statusCode: 0 };
  }
  return { message: String(error), statusCode: 0 };
}
