import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type QueryValue = string | null | undefined;

export function useQueryState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParams = useCallback(
    (updates: Record<string, QueryValue>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return { searchParams, setParams };
}

export function numericParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
