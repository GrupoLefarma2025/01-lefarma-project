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
}

/** Body de POST /viaticos/solicitudes (id_usuario_solicitante lo pone el token). */
export interface CrearSolicitudPayload {
  gerencia?: string;
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