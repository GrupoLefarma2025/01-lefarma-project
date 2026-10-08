// Vista TypeScript del contrato de cotizacion de viajes que devuelve el agente
// externo (ver schemas/cotizacionViajes.esquema.ts). El JSON pegado SIEMPRE se
// valida contra el schema antes de estrecharse a estos tipos: describen el
// subconjunto que el importador y la tabla necesitan, no el contrato completo.

export type ModoCotizacion = 'avion' | 'autobus' | 'hotel';

export interface CotizacionConsulta {
  origen: string;
  destino: string;
  fecha_salida: string;
  fecha_regreso: string | null;
  personas: number;
}

/** Una opción del contrato: conserva url_compra y capturas[] sin transformar. */
export interface CotizacionOpcion {
  transportista: string;
  modo: ModoCotizacion;
  salida: string;
  llegada: string;
  precio: number | null;
  moneda?: string;
  url_compra: string;
  capturas?: string[];
  fuente: string;
  consultado_en?: string;
}

export interface Cotizacion {
  version: string;
  consulta: CotizacionConsulta;
  /** Declaracion explicita de pi sobre que cubrio; nunca promete cobertura total. */
  cobertura_declarada: string;
  /** Transportistas buscados y no encontrados, con su motivo. */
  transportistas_no_encontrados: string[];
  opciones: CotizacionOpcion[];
}

/**
 * Desglose que solo el wizard conoce porque el motor de costos de ruta lo
 * calcula en memoria (nunca viaja al backend): gasolina, casetas, hospedaje,
 * comida y taxi de la propuesta elegida. `null` es "no se sabe" (p. ej. la
 * propuesta no usa auto, o ninguna persona tiene un valor conocido), nunca cero.
 */
export interface ConceptosMotor {
  gasolina: number | null;
  casetas: number | null;
  hospedaje: number | null;
  comida: number | null;
  taxi: number | null;
}

/**
 * Desglose por concepto que se persiste en `datos_json` al enviar la
 * solicitud, con los nombres EXACTOS que lee el backend (AprobacionDtos.cs:
 * `SolicitudBandejaDto`). `null` = "no se sabe" y 0 = "costo cero"; una clave
 * ausente y una `null` son equivalentes para el backend, que imprime "—" para
 * ambas en el concentrado FOR-008, JAMAS un $0.00 inventado.
 */
export interface DesgloseViaticos {
  autobus: number | null;
  avion: number | null;
  gasolina: number | null;
  casetas: number | null;
  comida: number | null;
  taxi: number | null;
  hospedaje: number | null;
  total: number | null;
}

/** Fila de la tabla de opciones: la opción cotizada mas la eleccion del usuario. */
export interface FilaCotizacion {
  clave: string;
  modo: ModoCotizacion;
  transportista: string;
  salida: string;
  llegada: string;
  precio: number | null;
  moneda: string;
  /** Requisito duro del usuario: la URL de compra viaja intacta al backend. */
  url_compra: string;
  /** Requisito duro del usuario: todas las capturas viajan intactas. */
  capturas: string[];
  fuente: string;
  estimado: boolean;
  seleccionada: boolean;
}