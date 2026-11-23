export interface SolicitudOpcion {
  id_opcion: number;
  tipo: string;
  linea: string;
  precio: number | null;
  moneda: string | null;
  url_compra: string | null;
  fuente: string;
  fue_elegida: boolean;
  ruta_captura: string | null;
  datos?: DatosOpcion | null;
}

export interface DatosOpcion {
  tramo?: number;
  de?: string;
  a?: string;
  combustible?: number;
  casetas_estimadas?: number;
  source?: string;
  tipo_precio?: string;
  precio_estimado?: number | null;
  deteccion_estado?: string;
  deteccion_mensaje?: string;
  [clave: string]: unknown;
}

export interface AjusteEventoPayload {
  campo?: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  motivo?: string;
  id_opcion?: number | null;
}

export interface SolicitudEvento {
  id_evento: number;
  tipo: string;
  id_usuario: number;
  fecha_creacion: string;
  payload?: AjusteEventoPayload | null;
}

export interface Solicitud {
  id_solicitud: number;
  id_usuario_solicitante: number;
  periodo: string;
  gerencia: string;
  estado: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_modificacion: string;
  datos: unknown;
  total_cotizado?: number | null;
  total_estimado?: number | null;
  total?: number | null;
  opciones: SolicitudOpcion[];
  eventos: SolicitudEvento[];
  sistema_origen?: string | null;
  folio?: string | null;
  persona_solicitante?: string | null;
  persona_viajera?: string | null;
  id_usuario_creacion?: number;
  num_puntos?: number;
  nombre_creador?: string | null;
}

export interface CasetaCalculada {
  nombre: string;
  km: number;
  direccion: string;
  costo: number | null;
}

export interface TramoCalculado {
  de: string;
  a: string;
  km: number | null;
  duracion: string | null;
  duracion_con_margen: string | null;
  salida_fecha: string | null;
  salida_hora: string | null;
  llegada_fecha: string | null;
  llegada_hora: string | null;
  alcanza: boolean | null;
  casetas: CasetaCalculada[];
  costo?: number | null;
  moneda?: string | null;
  url_compra?: string | null;
  linea?: string | null;
}

export interface CalculoViaje {
  generado_en: string;
  margen: number;
  modo_transporte: 'propio' | 'solicitado';
  km_total: number | null;
  horas_total: string | null;
  tramos: TramoCalculado[];
  ruta?: RutaCalculadaGuardada | null;
}

export interface ParadaCalculada {
  lat: number;
  lng: number;
  nombre: string;
  tipo: 'origen' | 'punto' | 'hotel' | 'regreso' | 'terminal';
  detalle?: string;
}

export interface RutaCalculadaGuardada {
  puntos: ParadaCalculada[];
  nodos: {
    titulo: string;
    detalles: string[];
    chips?: string[];
    costo?: number | null;
    url_compra?: string | null;
    fase?: 'ida' | 'regreso';
  }[];
  segmentos?: { tipo: 'taxi' | 'transporte' | 'carretera'; puntos: [number, number][] }[];
}

export interface ResumenCostosRuta {
  autobus: number | null;
  avion: number | null;
  gasolina: number | null;
  casetas: number | null;
  hospedaje: number | null;
  comida: number | null;
  taxi: number | null;
  total: number | null;
}

export interface PropuestaRuta {
  calculo: CalculoViaje;
  opciones: OpcionCotizacion[];
  resumen: ResumenCostosRuta;
}

export interface CrearSolicitudPayload {
  gerencia?: string;
  sistema_origen?: string;
  datos: Record<string, unknown>;
}

export interface CrearSolicitudDesdeEducacionMedicaPayload {
  id_ruta: number;
  id_seleccion_mensual?: number | null;
  id_ruta_visitas: number[];
  gerencia?: string;
  datos: Record<string, unknown>;
}

export interface SolicitudDesdeEducacionMedicaResponse {
  id_solicitud: number;
  folio: string | null;
  reutilizado: boolean;
}

export interface SolicitudOrigenEmResumen {
  id_solicitud: number;
  folio: string | null;
  estado: string;
  num_puntos: number;
  total: number | null;
  total_cotizado?: number | null;
  total_estimado?: number | null;
  fecha_creacion: string;
  id_ruta_visitas: number[];
}

export interface OpcionCotizacion {
  tipo: string;
  linea: string;
  precio: number | null;
  moneda: string;
  url_compra: string | null;
  fuente: string;
  fue_elegida: boolean;
  ruta_captura: string | null;
  capturas: string[];
  datos?: DatosOpcion | null;
}

export interface PrecioRealPayload {
  linea?: string | null;
  precio: number;
  moneda?: string | null;
  fuente: string;
  url_compra: string;
  ruta_captura?: string | null;
  salida?: string | null;
  llegada?: string | null;
}

export interface PrecioDetectadoDto {
  tipo: string;
  linea: string;
  precio: number;
  moneda: string;
  fuente?: string | null;
  url_compra?: string | null;
  detalle?: string | null;
  salida?: string | null;
  llegada?: string | null;
  dias_llegada?: number;
  duracion_min?: number | null;
  asientos?: number | null;
  noches?: number | null;
  patrocinado?: boolean;
}

export interface DeteccionPrecioResponse {
  aplicado: boolean;
  mensaje?: string | null;
  motivo?: string | null;
  fuente?: string | null;
  ruta_captura?: string | null;
  elegido?: PrecioDetectadoDto | null;
  opciones: PrecioDetectadoDto[];
}

export interface DeteccionPrecioPreviewPayload {
  tipo: string;
  linea: string;
  url_compra: string;
  salida?: string | null;
  llegada?: string | null;
  datos?: Record<string, unknown> | null;
  solicitud_datos?: Record<string, unknown> | null;
  capturar?: boolean;
  nombre?: string | null;
}

export interface DeteccionPrecioPreviewResponse {
  detectado: boolean;
  motivo?: string | null;
  fuente?: string | null;
  ruta_captura?: string | null;
  elegido?: PrecioDetectadoDto | null;
  opciones: PrecioDetectadoDto[];
}
