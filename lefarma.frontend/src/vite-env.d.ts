/// <reference types="vite/client" />

// Injected at build time by vite.config.ts (define)
declare const __APP_BUILD_TIME__: string

interface ImportMetaEnv {
  /** 'false' apaga la telemetría en el build. Por omisión está encendida. */
  readonly VITE_TELEMETRIA_ACTIVA?: string
  /** Versión del frontend, inyectada por vite.config.ts. */
  readonly VITE_APP_VERSION?: string
}
