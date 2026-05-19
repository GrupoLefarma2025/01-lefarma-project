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
 * Narrows an unknown catch-clause error to ApiError.
 * Falls back to a synthetic ApiError when the value doesn't match the shape.
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof Error) {
    return { message: error.message, statusCode: 0 };
  }
  return { message: String(error), statusCode: 0 };
}
