/// <reference types="vite/client" />

declare const __APP_BUILD_TIME__: string

interface ImportMetaEnv {
  readonly VITE_TELEMETRIA_ACTIVA?: string
  readonly VITE_APP_VERSION?: string
}
