export type SseEventType = 'connected' | 'user.updated';
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

export type SseEvent = SseConnectedEvent | SseUserUpdatedEvent;

export interface SseConnectionState {
  isConnected: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
}
