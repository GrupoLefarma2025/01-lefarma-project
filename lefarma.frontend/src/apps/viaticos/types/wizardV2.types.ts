import type { CostosRutaHotel, CostosRutaOferta, PuntoSeleccion } from './costosRuta.types';

export type ModoPersonaV2 = 'mia' | 'otra';

export interface PasoPersonaV2 {
  modo: ModoPersonaV2;
  empleadoId: number | null;
  nombre: string;
  motivo: string;
}

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

export interface OrigenV2 {
  punto: PuntoSeleccion | null;
  fechaSalida: string;
  horaSalida: string;
}

export type ZonaHospedaje = 'anterior' | 'actual';

export interface HospedajeV2 {
  necesario: boolean;
  zona: ZonaHospedaje;
  fechaEntrada: string;
  fechaSalida: string;
  hotel: CostosRutaHotel | null;
}

export interface CotizacionTramoV2 {
  ofertas: CostosRutaOferta[];
  rutaArmada: {
    tramos: { de: string; a: string; km: number; litros: number; subtotalMagna: number }[];
    totales: { km: number; litros: number; subtotalMagna: number };
  } | null;
  hoteles: CostosRutaHotel[];
  cotizadoEn: string;
  necesitaRecalculo: boolean;
  elegidaId: string | null;
  equipajeDocumentado: boolean;
}

export interface DestinoV2 {
  id: string;
  punto: PuntoSeleccion | null;
  etiqueta?: string;
  debeEstarFecha: string;
  debeEstarHora: string;
  saleFecha: string;
  saleHora: string;
  hospedaje: HospedajeV2;
  cotizacion: CotizacionTramoV2 | null;
}

export type DestinoRetornoV2 = 'origen' | 'otro';

export interface RetornoV2 {
  necesario: boolean;
  llegadaRequeridaFecha: string;
  llegadaRequeridaHora: string;
  destino: DestinoRetornoV2;
  punto: PuntoSeleccion | null;
}

export interface GastoExtraV2 {
  id: string;
  concepto: string;
  monto: number | null;
}

export interface GastosV2 {
  comidas: number | null;
  extras: GastoExtraV2[];
}

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
