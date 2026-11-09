import type { ApiResponse } from '@/types/api.types';

/**
 * Clave de localStorage del cache de configuración de frontend.
 * v1 = esquema actual ({ schemaVersion, revision, variables }).
 */
export const CONFIGURACION_STORAGE_KEY = 'lefarma.configuracion.v1';

export const CONFIGURACION_SCHEMA_VERSION = 1 as const;

/** Timeout duro de las peticiones de configuración (consultar / sync). */
export const CONFIGURACION_REQUEST_TIMEOUT_MS = 15000;

export type ConfiguracionSchemaVersion = typeof CONFIGURACION_SCHEMA_VERSION;

/**
 * Tipo declarado por el backend. Se mantiene como string para no acoplar el
 * frontend a la lista de tipos que agregue el backend.
 */
export type ConfiguracionTipoDato = string;

/** Variable de configuración ya aplicada en el store. */
export interface ConfiguracionVariable {
  valor: unknown;
  tipoDato: ConfiguracionTipoDato;
  revision: number;
}

/** Variable tal como la devuelve el endpoint de frontend. */
export interface ConfiguracionVariableDto extends ConfiguracionVariable {
  clave: string;
}

/** Respuesta (payload de `data`) de consultar y sync. */
export interface ConfiguracionSnapshot {
  revisionActual: number;
  variables: ConfiguracionVariableDto[];
  eliminadas: string[];
}

export type ConfiguracionApiResponse = ApiResponse<ConfiguracionSnapshot>;

export interface ConfiguracionConsultaVariable {
  clave: string;
  revision?: number;
}

export interface ConfiguracionConsultaRequest {
  variables: ConfiguracionConsultaVariable[];
}

export interface ConfiguracionSyncRequest {
  desde: number;
  claves: string[];
}

/** Forma persistida en localStorage. */
export interface ConfiguracionPersistedState {
  schemaVersion: ConfiguracionSchemaVersion;
  revision: number;
  variables: Record<string, ConfiguracionVariable>;
}

/** Estado del store Zustand. */
export interface ConfiguracionState {
  schemaVersion: ConfiguracionSchemaVersion;
  revision: number;
  variables: Record<string, ConfiguracionVariable>;
  hydrated: boolean;
}

export interface ConfiguracionActions {
  /** Hidrata desde localStorage. Idempotente salvo `force` (tests). */
  hydrate: (force?: boolean) => void;
  /**
   * Aplica una respuesta del backend de forma atómica y monótona.
   * Devuelve `true` solo si cambió algo (evita renders innecesarios).
   */
  applyChanges: (snapshot: ConfiguracionSnapshot | null | undefined) => boolean;
}

export type ConfiguracionStore = ConfiguracionState & ConfiguracionActions;

/** Opciones de `ensureConfig`. */
export interface EnsureConfigOptions {
  /** Fuerza consultar aunque la clave ya esté en caché. */
  force?: boolean;
  /** Aborta la petición (o la abandona si el lote ya no tiene consumidores). */
  signal?: AbortSignal;
  /** Si es true, la promesa rechaza en vez de devolver `ok: false`. */
  throwOnError?: boolean;
}

export interface EnsureConfigResult {
  ok: boolean;
  error: unknown;
  /** Claves realmente pedidas al backend en este ciclo. */
  fetched: string[];
  /** No se consultó (sin sesión, sin claves o ya estaban en caché). */
  skipped: boolean;
}

export interface SyncNowOptions {
  signal?: AbortSignal;
  throwOnError?: boolean;
}

export interface SyncNowResult {
  ok: boolean;
  error: unknown;
  /** No se llamó al backend (sin sesión o sin claves cacheadas/registradas). */
  skipped: boolean;
}
