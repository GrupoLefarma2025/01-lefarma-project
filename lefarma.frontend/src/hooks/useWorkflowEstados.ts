import { useEffect, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { WorkflowEstado } from '@/types/workflow.types';

// ponytail: module-level cache + in-flight dedup so every consumer shares one request (por proceso)
const cache = new Map<string, WorkflowEstado[]>();
const inflight = new Map<string, Promise<WorkflowEstado[]>>();

function cacheKey(codigoProceso?: string) {
  return codigoProceso ?? '*';
}

export function fetchWorkflowEstados(codigoProceso?: string): Promise<WorkflowEstado[]> {
  const key = cacheKey(codigoProceso);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;

  const url = codigoProceso
    ? `/config/workflows/estados?codigoProceso=${encodeURIComponent(codigoProceso)}`
    : '/config/workflows/estados';

  const request = API.get<ApiResponse<WorkflowEstado[]>>(url)
    .then((res) => {
      const data = res.data.success ? (res.data.data ?? []) : [];
      cache.set(key, data);
      return data;
    })
    .catch(() => {
      cache.set(key, []);
      return [] as WorkflowEstado[];
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function useWorkflowEstados(codigoProceso?: string) {
  const key = cacheKey(codigoProceso);
  const [estados, setEstados] = useState<WorkflowEstado[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));

  useEffect(() => {
    let cancelled = false;
    fetchWorkflowEstados(codigoProceso).then((data) => {
      if (!cancelled) {
        setEstados(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [codigoProceso]);

  return { estados, loading };
}
