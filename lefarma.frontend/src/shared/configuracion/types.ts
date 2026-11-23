import type { ApiResponse } from '@/types/api.types';

export const CONFIGURACION_STORAGE_KEY = 'lefarma.configuracion.v1';

export const CONFIGURACION_SCHEMA_VERSION = 1 as const;

export const CONFIGURACION_REQUEST_TIMEOUT_MS = 15000;

export type ConfiguracionSchemaVersion = typeof CONFIGURACION_SCHEMA_VERSION;

export type ConfiguracionTipoDato = string;

export interface ConfiguracionVariable {
  valor: unknown;
  tipoDato: ConfiguracionTipoDato;
  revision: number;
}

export interface ConfiguracionVariableDto extends ConfiguracionVariable {
  clave: string;
}

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

export interface ConfiguracionPersistedState {
  schemaVersion: ConfiguracionSchemaVersion;
  revision: number;
  variables: Record<string, ConfiguracionVariable>;
}

export interface ConfiguracionState {
  schemaVersion: ConfiguracionSchemaVersion;
  revision: number;
  variables: Record<string, ConfiguracionVariable>;
  hydrated: boolean;
}

export interface ConfiguracionActions {
  hydrate: (force?: boolean) => void;
  applyChanges: (snapshot: ConfiguracionSnapshot | null | undefined) => boolean;
}

export type ConfiguracionStore = ConfiguracionState & ConfiguracionActions;

export interface EnsureConfigOptions {
  force?: boolean;
  signal?: AbortSignal;
  throwOnError?: boolean;
}

export interface EnsureConfigResult {
  ok: boolean;
  error: unknown;
  fetched: string[];
  skipped: boolean;
}

export interface SyncNowOptions {
  signal?: AbortSignal;
  throwOnError?: boolean;
}

export interface SyncNowResult {
  ok: boolean;
  error: unknown;
  skipped: boolean;
}
