import { useState, useCallback } from 'react';
import { API } from '@/services/api';
import type { WorkflowEstado } from '@/types/workflow.types';

export interface WorkflowCatalogs {
  roles: any[];
  usuarios: any[];
  tiposNotificacion: any[];
  estados: WorkflowEstado[];
  loadingRoles: boolean;
  loadingUsuarios: boolean;
  loadingTiposNotificacion: boolean;
  loadingEstados: boolean;
  loadRoles: () => Promise<void>;
  loadUsuarios: () => Promise<void>;
  loadTiposNotificacion: () => Promise<void>;
  loadEstados: () => Promise<void>;
  loadAll: () => Promise<void>;
}

export function useWorkflowCatalogs(): WorkflowCatalogs {
  const [roles, setRoles] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [tiposNotificacion, setTiposNotificacion] = useState<any[]>([]);
  const [estados, setEstados] = useState<WorkflowEstado[]>([]);
  
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [loadingTiposNotificacion, setLoadingTiposNotificacion] = useState(false);
  const [loadingEstados, setLoadingEstados] = useState(false);

  const loadRoles = useCallback(async () => {
    if (roles.length > 0) return;
    setLoadingRoles(true);
    try {
      const res = await API.get('/Admin/roles');
      setRoles(res.data?.data ?? []);
    } catch { /* silencioso */ }
    finally { setLoadingRoles(false); }
  }, [roles.length]);

  const loadUsuarios = useCallback(async () => {
    if (usuarios.length > 0) return;
    setLoadingUsuarios(true);
    try {
      const res = await API.get('/Admin/usuarios');
      setUsuarios(res.data?.data ?? []);
    } catch { /* silencioso */ }
    finally { setLoadingUsuarios(false); }
  }, [usuarios.length]);

  const loadTiposNotificacion = useCallback(async () => {
    if (tiposNotificacion.length > 0) return;
    setLoadingTiposNotificacion(true);
    try {
      const res = await API.get('/config/workflows/tipos-notificacion');
      setTiposNotificacion(res.data?.data ?? []);
    } catch { /* silencioso */ }
    finally { setLoadingTiposNotificacion(false); }
  }, [tiposNotificacion.length]);

  const loadEstados = useCallback(async () => {
    if (estados.length > 0) return;
    setLoadingEstados(true);
    try {
      const res = await API.get('/config/workflows/estados');
      setEstados(res.data?.data ?? []);
    } catch { /* silencioso */ }
    finally { setLoadingEstados(false); }
  }, [estados.length]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadRoles(),
      loadUsuarios(),
      loadTiposNotificacion(),
      loadEstados()
    ]);
  }, [loadRoles, loadUsuarios, loadTiposNotificacion, loadEstados]);

  return {
    roles,
    usuarios,
    tiposNotificacion,
    estados,
    loadingRoles,
    loadingUsuarios,
    loadingTiposNotificacion,
    loadingEstados,
    loadRoles,
    loadUsuarios,
    loadTiposNotificacion,
    loadEstados,
    loadAll
  };
}
