import type { ApiError } from '@/types/api.types';

/**
 * Casts an unknown catch-clause error to ApiError.
 * Safe because the API interceptor always rejects with ApiError.
 */
export function toApiError(error: unknown): ApiError {
  return error as ApiError;
}
