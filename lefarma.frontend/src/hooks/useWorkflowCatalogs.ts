import { useState, useCallback } from 'react';
import { API } from '@/services/api';
import type { WorkflowEstado } from '@/types/workflow.types';

export interface WorkflowRolCatalogo {
  idRol: number;
  nombreRol: string;
  descripcion?: string;
}

export interface WorkflowUsuarioCatalogo {
  idUsuario: number;
  nombreCompleto?: string;
  correo?: string;
}

export interface WorkflowTipoNotificacionCatalogo {
  idTipoNotificacion: number;
  idTipo?: number;
  codigoTipo?: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  colorTema?: string;
}

export interface WorkflowCatalogs {
  roles: WorkflowRolCatalogo[];
  usuarios: WorkflowUsuarioCatalogo[];
  tiposNotificacion: WorkflowTipoNotificacionCatalogo[];
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
  const [roles, setRoles] = useState<WorkflowRolCatalogo[]>([]);
  const [usuarios, setUsuarios] = useState<WorkflowUsuarioCatalogo[]>([]);
  const [tiposNotificacion, setTiposNotificacion] = useState<WorkflowTipoNotificacionCatalogo[]>([]);
  const [estados, setEstados] = useState<WorkflowEstado[]>([]);
  
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [loadingTiposNotificacion, setLoadingTiposNotificacion] = useState(false);
  const [loadingEstados, setLoadingEstados] = useState(false);

  const loadRoles = useCallback(async () => {
    if (roles.length > 0) return;
    setLoadingRoles(true);
    try {
      const res = await API.get<{ data: WorkflowRolCatalogo[] }>('/Admin/roles');
      setRoles(res.data?.data ?? []);
    } catch {
      // Silencioso: los catálogos se cargan bajo demanda
    } finally { setLoadingRoles(false); }
  }, [roles.length]);

  const loadUsuarios = useCallback(async () => {
    if (usuarios.length > 0) return;
    setLoadingUsuarios(true);
    try {
      const res = await API.get<{ data: WorkflowUsuarioCatalogo[] }>('/Admin/usuarios');
      setUsuarios(res.data?.data ?? []);
    } catch {
      // Silencioso: los catálogos se cargan bajo demanda
    } finally { setLoadingUsuarios(false); }
  }, [usuarios.length]);

  const loadTiposNotificacion = useCallback(async () => {
    if (tiposNotificacion.length > 0) return;
    setLoadingTiposNotificacion(true);
    try {
      const res = await API.get<{ data: WorkflowTipoNotificacionCatalogo[] }>('/config/workflows/tipos-notificacion');
      setTiposNotificacion(res.data?.data ?? []);
    } catch {
      // Silencioso: los catálogos se cargan bajo demanda
    } finally { setLoadingTiposNotificacion(false); }
  }, [tiposNotificacion.length]);

  const loadEstados = useCallback(async () => {
    if (estados.length > 0) return;
    setLoadingEstados(true);
    try {
      const res = await API.get<{ data: WorkflowEstado[] }>('/config/workflows/estados');
      setEstados(res.data?.data ?? []);
    } catch {
      // Silencioso: los catálogos se cargan bajo demanda
    } finally { setLoadingEstados(false); }
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
