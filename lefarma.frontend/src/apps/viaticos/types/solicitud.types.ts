// Tipos de solicitud de viaticos (backend:
// lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/SolicitudDtos.cs).

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
}

/**
 * `payload_json` de un evento `ajuste_aplicado`, ya deserializado. El backend
 * lo escribe al registrar un ajuste (AprobacionesController.NuevoEvento) con
 * exactamente estas claves en snake_case.
 *
 * Es opcional a proposito: mientras el backend no exponga el payload, o en
 * eventos que no son ajustes, llega `undefined`/`null` y la linea de tiempo
 * degrada a "sin detalle" en vez de romper. Ver `leerAjusteDeEvento`.
 */
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
  /** Contenido del evento; solo lo traen los `ajuste_aplicado`. */
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
  opciones: SolicitudOpcion[];
  eventos: SolicitudEvento[];
  /** Sistema que originó la solicitud ('viaticos' | 'educacion_medica'). */
  sistema_origen?: string | null;
  /** Folio legible del viaje (VIA-{sam}-{id}). */
  folio?: string | null;
  /** Nombre de quien solicita el viaje. */
  persona_solicitante?: string | null;
  /** Nombre de quien viaja. */
  persona_viajera?: string | null;
  /** Usuario que creó el registro (puede diferir del solicitante en integraciones). */
  id_usuario_creacion?: number;
  /** Número de puntos/destinos a visitar (snapshot al crear). */
  num_puntos?: number;
  /** Nombre del creador resuelto por el backend. */
  nombre_creador?: string | null;
}

/** Caseta de referencia que aparece en un tramo del cálculo de ruta. */
export interface CasetaCalculada {
  nombre: string;
  km: number;
  direccion: string;
  costo: number | null;
}

/** Tramo de la ruta calculada (la que manda tras el envío). */
export interface TramoCalculado {
  de: string;
  a: string;
  km: number | null;
  /** Tiempo de recorrido sin margen ("8h 35m"). */
  duracion: string | null;
  /** Tiempo de recorrido con el margen aplicado ("9h 27m"). */
  duracion_con_margen: string | null;
  salida_fecha: string | null;
  salida_hora: string | null;
  llegada_fecha: string | null;
  llegada_hora: string | null;
  /** Si la llegada estimada cumple la hora requerida del tramo. */
  alcanza: boolean | null;
  casetas: CasetaCalculada[];
}

/**
 * Cálculo de la ruta hecho al enviar la solicitud. Se guarda en
 * `datos.calculo` del snapshot y es la ruta que manda (la propuesta del
 * wizard queda como referencia).
 */
export interface CalculoViaje {
  generado_en: string;
  margen: number;
  modo_transporte: 'propio' | 'solicitado';
  km_total: number | null;
  horas_total: string | null;
  tramos: TramoCalculado[];
  /**
   * Cadena completa tal como se revisó antes de enviar: paradas con su punto
   * (origen, terminal, hotel, regreso) y su detalle. Es lo que pinta el
   * diagrama de "Ruta calculada" en el detalle del viaje.
   */
  ruta?: RutaCalculadaGuardada | null;
}

/** Parada de la ruta calculada, con su coordenada y el detalle de cómo se llega. */
export interface ParadaCalculada {
  lat: number;
  lng: number;
  nombre: string;
  tipo: 'origen' | 'punto' | 'hotel' | 'regreso' | 'terminal';
  detalle?: string;
}

/** Ruta calculada completa: paradas del mapa y nodos del diagrama. */
export interface RutaCalculadaGuardada {
  puntos: ParadaCalculada[];
  nodos: { titulo: string; detalles: string[]; chips?: string[] }[];
  /** Trazado por tipo de tramo, para pintar el mapa igual que se revisó. */
  segmentos?: { tipo: 'taxi' | 'transporte' | 'carretera'; puntos: [number, number][] }[];
}

/** Body de POST /viaticos/solicitudes (id_usuario_solicitante lo pone el token). */
export interface CrearSolicitudPayload {
  gerencia?: string;
  /** Sistema de origen; el backend usa 'viaticos' cuando se omite. */
  sistema_origen?: string;
  datos: Record<string, unknown>;
}

/**
 * Una opción del body de PUT /viaticos/solicitudes/{id}/opciones.
 * El backend exige url_compra y fuente, y solo admite precio null si la fuente
 * es estimada. capturas[] viaja entero: la primera tambien va en ruta_captura,
 * que es la columna que el backend guarda.
 */
export interface OpcionCotizacion {
  tipo: string;
  linea: string;
  precio: number | null;
  moneda: string;
  url_compra: string;
  fuente: string;
  fue_elegida: boolean;
  ruta_captura: string | null;
  capturas: string[];
}