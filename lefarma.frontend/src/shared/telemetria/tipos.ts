/**
 * Contrato de eventos de telemetría. Debe coincidir con
 * `Features/Telemetria/Ingesta/SobreTelemetriaDto.cs` y con la sección
 * «Contrato de eventos» del ADR 00001.
 */

export type TipoEvento = 'error' | 'clic' | 'mapa_calor' | 'visita';

export type TipoError =
  | 'arranque'
  | 'js'
  | 'promesa'
  | 'react'
  | 'http'
  | 'red';

interface EventoBase {
  tipo: TipoEvento;
  ocurridoEn: string;
  /** Ruta de la pantalla donde ocurrió, sin query string. */
  ruta: string;
}

export interface EventoError extends EventoBase {
  tipo: 'error';
  tipoError: TipoError;
  mensaje: string;
  stack?: string;
  url?: string;
  metodoHttp?: string;
  estadoHttp?: number;
  requestId?: string;
  navegador?: string;
  contexto?: string;
}

export interface EventoClic extends EventoBase {
  tipo: 'clic';
  elemento?: string;
  etiqueta?: string;
  tipoElemento?: string;
  x?: number;
  y?: number;
  viewportAncho?: number;
  viewportAlto?: number;
}

export interface EventoMapaCalor extends EventoBase {
  tipo: 'mapa_calor';
  celdas: number[];
  columnas: number;
  filas: number;
  tamanoCelda: number;
  viewportAncho: number;
  viewportAlto: number;
  scrollMax?: number;
  segundosVisibles?: number;
}

export interface EventoVisita extends EventoBase {
  tipo: 'visita';
  inicio?: string;
  fin?: string;
  segundos?: number;
  scrollMax?: number;
  navegador?: string;
  sistema?: string;
  viewportAncho?: number;
  viewportAlto?: number;
}

export type EventoTelemetria = EventoError | EventoClic | EventoMapaCalor | EventoVisita;

export interface SobreTelemetria {
  loteId: string;
  enviadoEn: string;
  visitaId?: string;
  versionApp?: string;
  eventos: EventoTelemetria[];
}
