import type { CostosRutaHotel, CostosRutaOferta, PuntoSeleccion } from './costosRuta.types';

/**
 * Modelo del asistente nuevo de solicitud de viáticos (wizard v2).
 *
 * Contratos PROVISIONALES pendientes de decisión de negocio (fase posterior):
 * - `RetornoV2` solo pide la hora de vuelta (llegada requerida) y a dónde se
 *   vuelve (origen u otro punto): la salida del regreso no se captura.
 * - El rango total del viaje se DERIVA de la cronología (`rangoDelViaje`), no se
 *   captura como primer paso.
 * - `quincena`, «activo» y la fecha que filtran día/semana/mes se documentan en
 *   sus páginas; aquí solo viajan los datos crudos.
 * - Moneda del prototipo: solo MXN (`MONEDA_PERMITIDA` en el adaptador).
 */

// ---- Paso 1: persona -------------------------------------------------------

export type ModoPersonaV2 = 'mia' | 'otra';

export interface PasoPersonaV2 {
  modo: ModoPersonaV2;
  /** Empleado elegido del directorio cuando `modo` es `otra`. */
  empleadoId: number | null;
  /** Nombre resuelto (sesión o catálogo). No se vuelve a pedir por teclado. */
  nombre: string;
  motivo: string;
}

// ---- Paso 2: transporte y viaje compartido ----------------------------------

export type ModoTransporteV2 = 'propio' | 'solicitado';

export interface AcompananteV2 {
  directorioId: number;
  nombreCompleto: string;
  correo: string | null;
}

export interface PasoTransporteV2 {
  modo: ModoTransporteV2;
  compartir: boolean;
  acompanantes: AcompananteV2[];
}

// ---- Paso 3: origen ----------------------------------------------------------

export interface OrigenV2 {
  punto: PuntoSeleccion | null;
  fechaSalida: string;
  horaSalida: string;
}

// ---- Paso 4: destinos + hospedaje ---------------------------------------------

export type ZonaHospedaje = 'anterior' | 'actual';

export interface HospedajeV2 {
  necesario: boolean;
  zona: ZonaHospedaje;
  fechaEntrada: string;
  fechaSalida: string;
  hotel: CostosRutaHotel | null;
}

/** Foto congelada de lo cotizado para un tramo: lo que vio la persona usuaria. */
export interface CotizacionTramoV2 {
  ofertas: CostosRutaOferta[];
  rutaArmada: {
    tramos: { de: string; a: string; km: number; litros: number; casetas: number; subtotalMagna: number }[];
    totales: { km: number; litros: number; casetas: number; subtotalMagna: number };
  } | null;
  hoteles: CostosRutaHotel[];
  /** Cuándo se cotizó (ISO). Una recotización NO reescribe esta foto. */
  cotizadoEn: string;
  necesitaRecalculo: boolean;
  elegidaId: string | null;
  /** Solo aplica cuando la elegida es avión; no altera el precio cotizado. */
  equipajeDocumentado: boolean;
}

export interface DestinoV2 {
  id: string;
  punto: PuntoSeleccion | null;
  /** Nombre propio de la pestaña; vacío usa municipio/estado o el nombre del punto. */
  etiqueta?: string;
  debeEstarFecha: string;
  debeEstarHora: string;
  saleFecha: string;
  saleHora: string;
  hospedaje: HospedajeV2;
  cotizacion: CotizacionTramoV2 | null;
}

// ---- Paso 5: retorno -----------------------------------------------------------

/** A dónde se vuelve: al punto de origen o a otro punto del mapa. */
export type DestinoRetornoV2 = 'origen' | 'otro';

export interface RetornoV2 {
  necesario: boolean;
  llegadaRequeridaFecha: string;
  llegadaRequeridaHora: string;
  destino: DestinoRetornoV2;
  /** Solo cuando `destino` es 'otro'. */
  punto: PuntoSeleccion | null;
}

// ---- Paso 6: gastos --------------------------------------------------------------

export interface GastoExtraV2 {
  id: string;
  concepto: string;
  monto: number | null;
}

export interface GastosV2 {
  comidas: number | null;
  extras: GastoExtraV2[];
}

// ---- Foto para revisión / Mis viajes / Concentrado ------------------------------

/**
 * Instantánea inmutable de una opción tal como se cotizó: la revisión autoriza
 * la opción ELEGIDA, nunca un reemplazo. Una recotización genera otra foto.
 */
export interface OfertaCongelada {
  id: string;
  modo: string;
  linea: string;
  salidaTxt: string;
  llegadaTxt: string;
  precioTxt: string;
  costoGrupo: number;
  fuente: string;
  estimado: boolean;
}

export interface TramoCongelado {
  tramoId: string;
  de: string;
  a: string;
  ofertas: OfertaCongelada[];
  elegidaId: string | null;
  cotizadoEn: string;
  expirada: boolean;
}
