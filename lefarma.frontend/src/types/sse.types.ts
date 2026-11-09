export type SseEventType = 'connected' | 'user.updated' | 'configuracion.changed';
export type UpdateType = 'profile' | 'permissions';


export interface SseConnectedEvent {
  timestamp: string;
}

export interface SseUserInfo {
  id: number;
  username: string;
  nombre?: string;
  correo?: string;
  dominio?: string;
  roles: Array<{ idRol: number; nombreRol: string; descripcion?: string }>;
  permisos: Array<{ idPermiso: number; codigoPermiso: string; nombrePermiso: string; categoria?: string; recurso?: string; accion?: string }>;
}

export interface SseUserUpdatedEvent {
  type: UpdateType;
  user: SseUserInfo;
}

/**
 * El backend notifica que la configuración de frontend cambió. El evento NO
 * trae valores: solo la nueva revisión global; el cliente hace `sync`.
 */
export interface SseConfiguracionChangedEvent {
  revision: number;
}

export type SseEvent =
  | SseConnectedEvent
  | SseUserUpdatedEvent
  | SseConfiguracionChangedEvent;

export interface SseConnectionState {
  isConnected: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
}
