// ─── Partida (Response) ──────────────────────────────────────────────────────

export interface OrdenCompraPartidaResponse {
  idPartida: number;
  numeroPartida: number;
  descripcion: string;
  cantidad: number;
  idUnidadMedida: number;
  precioUnitario: number;
  descuento: number;
  porcentajeIva: number;
  totalRetenciones: number;
  otrosImpuestos: number;
  deducible: boolean;
  total: number;
  idProveedor?: number | null;
  idsCuentasBancarias?: string | null; // JSON string array, ej: "[1,2,3]"
  requiereFactura: boolean;
  tipoComprobante?: string | null;
  cantidadFacturada?: number | null;
  importeFacturado?: number | null;
  estadoFacturacion: number;
}

// ─── Orden de Compra (Response) ──────────────────────────────────────────────

export interface OrdenCompraResponse {
  idOrden: number;
  folio: string;
  idEmpresa: number;
  idSucursal: number;
  idArea: number;
  idTipoGasto: number;
  estado: string;
  idPasoActual?: number | null;
  // Proveedor
  idProveedor?: number | null;
  idsCuentasBancarias?: number[] | null;
  sinDatosFiscales: boolean;
  notaFormaPago?: string | null;
  notasGenerales?: string | null;
  idCentroCosto?: number | null;
  centroCostoNombre?: string | null;
  cuentaContable?: number | null;
  cuentaContableNumero?: string | null;
  cuentaContableDescripcion?: string | null;
  requiereComprobacionPago: boolean;
  requiereComprobacionGasto: boolean;
  fechaSolicitud: string;
  fechaLimitePago: string;
  subtotal: number;
  totalIva: number;
  total: number;
  partidas: OrdenCompraPartidaResponse[];
}

// ─── Create Partida (Request) ────────────────────────────────────────────────

export interface CreatePartidaRequest {
  descripcion: string;
  cantidad: number;
  idUnidadMedida: number;
  precioUnitario: number;
  descuento: number;
  porcentajeIva: number;
  totalRetenciones: number;
  otrosImpuestos: number;
  deducible: boolean;
  idProveedor?: number | null;
  idsCuentasBancarias?: number[] | null;
  requiereFactura?: boolean;
  tipoComprobante?: string | null;
}

// ─── Create Orden de Compra (Request) ────────────────────────────────────────

export interface CreateOrdenCompraRequest {
  idEmpresa: number;
  idSucursal: number;
  idArea: number;
  idTipoGasto: number;
  fechaLimitePago: string;
  // Proveedor
  idProveedor?: number | null;
  idsCuentasBancarias?: number[] | null;
  sinDatosFiscales: boolean;
  notaFormaPago?: string | null;
  notasGenerales?: string | null;
  partidas: CreatePartidaRequest[];
}

// ─── Orden de Compra List Request ────────────────────────────────────────────

export interface OrdenCompraListRequest {
  idEmpresa?: number | null;
  idSucursal?: number | null;
  estado?: string | null;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
