import { useEffect, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { WorkflowEstado } from '@/types/workflow.types';

// ponytail: module-level cache + in-flight dedup so every consumer shares one request
let cache: WorkflowEstado[] | null = null;
let inflight: Promise<WorkflowEstado[]> | null = null;

export function fetchWorkflowEstados(): Promise<WorkflowEstado[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados')
    .then((res) => {
      cache = res.data.success ? (res.data.data ?? []) : [];
      return cache;
    })
    .catch(() => {
      cache = [];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useWorkflowEstados() {
  const [estados, setEstados] = useState<WorkflowEstado[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    if (cache) {
      setEstados(cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchWorkflowEstados().then((data) => {
      if (!cancelled) {
        setEstados(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { estados, loading };
}
