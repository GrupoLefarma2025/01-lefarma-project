// ─── Comprobante / Factura types ─────────────────────────────────────────────

export interface ComprobanteConceptoResponse {
  idConcepto: number;
  numeroConcepto: number;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  tasaIva?: number | null;
  cantidadAsignada: number;
  importeAsignado: number;
  cantidadPendiente: number;
  importePendiente: number;
}

export interface ComprobanteResponse {
  idComprobante: number;
  categoria: string;           // 'gasto' | 'pago'
  tipoComprobante: string;     // cfdi | ticket | nota | recibo | manual | spei | cheque | ...
  esCfdi: boolean;
  uuidCfdi?: string | null;
  rfcEmisor?: string | null;
  nombreEmisor?: string | null;
  total: number;
  estado: number; // 0=Pendiente, 1=Parcial, 2=Aplicado, 3=Rechazado
  estadoDescripcion: string;
  fechaCreacion: string;
  referenciaPago?: string | null;
  fechaPago?: string | null;
  montoPago?: number | null;
  conceptos: ComprobanteConceptoResponse[];
}

// ─── CFDI Preview ─────────────────────────────────────────────────────────────

export interface CfdiConceptoPreviewDto {
  numero: number;
  claveProdServ?: string | null;
  claveUnidad?: string | null;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  descuento: number;
  importe: number;
  tasaIva?: number | null;
  importeIva?: number | null;
}

export interface CfdiPreviewResponse {
  uuid?: string | null;
  version?: string | null;
  serie?: string | null;
  folioCfdi?: string | null;
  fechaEmision?: string | null;
  rfcEmisor?: string | null;
  nombreEmisor?: string | null;
  rfcReceptor?: string | null;
  nombreReceptor?: string | null;
  usoCfdi?: string | null;
  metodoPago?: string | null;
  formaPago?: string | null;
  moneda: string;
  subtotal: number;
  descuento: number;
  totalIva: number;
  totalRetenciones: number;
  total: number;
  conceptos: CfdiConceptoPreviewDto[];
  // Validación SAT
  satContactado?: boolean | null;
  satEstado?: string | null;       // "Vigente" | "Cancelado" | "No Encontrado"
  satCodigoEstatus?: string | null;
  satCancelacion?: string | null;
}

// ─── Partidas pendientes ───────────────────────────────────────────────────────

export interface PartidaPendienteResponse {
  idPartida: number;
  numeroPartida: number;
  descripcionPartida: string;
  folioOrden: string;
  cantidad: number;
  precioUnitario: number;
  cantidadFacturada: number;
  importeFacturado: number;
  cantidadPendiente: number;
  importePendiente: number;
  estadoFacturacion: number; // 0=Pendiente, 1=Parcial, 2=Completa
}

// ─── Facturación por partida ──────────────────────────────────────────────────

export interface ComprobanteAsignacionResponse {
  idAsignacion: number;
  idComprobante: number;
  tipoComprobante: string;
  uuidCfdi?: string | null;
  cantidadAsignada: number;
  importeAsignado: number;
  fechaAsignacion: string;
  notas?: string | null;
}

export interface PartidaFacturacionResponse {
  idPartida: number;
  estadoFacturacion: number;
  cantidadFacturada: number;
  importeFacturado: number;
  asignaciones: ComprobanteAsignacionResponse[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface SubirComprobanteRequest {
  idOrden: number;
  idEmpresa: number;
  idUsuario: number;
  idPasoWorkflow?: number | null;
  tipoComprobante: string;
  totalManual?: number | null;
  notas?: string | null;
}

export interface AsignacionItemRequest {
  idConcepto?: number | null;
  idPartida: number;
  cantidadAsignada: number;
  importeAsignado: number;
  notas?: string | null;
}

export interface AsignarPartidasRequest {
  asignaciones: AsignacionItemRequest[];
}
