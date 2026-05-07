// ─── Partida (Response) ──────────────────────────────────────────────────────

export interface OrdenCompraPartidaResponse {
  idPartida: number;
  numeroPartida: number;
  descripcion: string;
  cantidad: number;
  idUnidadMedida: number;
  unidadMedidaNombre?: string | null;
  precioUnitario: number;
  descuento: number;
  porcentajeIva: number;
  totalRetenciones: number;
  otrosImpuestos: number;
  deducible: boolean;
  total: number;
  idProveedor?: number | null;
  idCuentaBancaria?: number | null;
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
  empresaNombre?: string | null;
  idSucursal: number;
  sucursalNombre?: string | null;
  idArea: number;
  areaNombre?: string | null;
  idTipoGasto: number;
  idEstado: number;
  estadoNombre?: string | null;
  estadoColor?: string | null;
  idWorkflow?: number | null;
  idPasoActual?: number | null;
  idProveedor?: number | null;
  idsCuentasBancarias?: number[] | null;
  idsFormaPago?: number[] | null;
  numeroMensualidades?: number | null;
  sinDatosFiscales: boolean;
  razonSocialProveedor?: string | null;
  rfcProveedor?: string | null;
  codigoPostalProveedor?: string | null;
  personaContacto?: string | null;
  idUsuarioCreador?: number;
  solicitanteNombre?: string | null;
  solicitantePuesto?: string | null;
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
  idMoneda?: number | null;
  monedaCodigo?: string | null;
  monedaSimbolo?: string | null;
  tipoCambioAplicado: number;
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
  idCuentaBancaria?: number | null;
  requiereFactura?: boolean;
  tipoComprobante?: string | null;
}

// ─── Create Orden de Compra (Request) ────────────────────────────────────────

export interface CreateOrdenCompraRequest {
  idEmpresa: number;
  idSucursal: number;
  idArea: number;
  idTipoGasto: number | null;
  fechaLimitePago: string;
  idProveedor?: number | null;
idsCuentasBancarias?: number[] | null;
  idsFormaPago?: number[] | null;
  numeroMensualidades?: number | null;
  sinDatosFiscales: boolean;
  notaFormaPago?: string | null;
  notasGenerales?: string | null;
  idMoneda?: number | null;
  tipoCambioAplicado?: number;
  partidas: CreatePartidaRequest[];
}

// ─── Orden de Compra List Request ────────────────────────────────────────────

export interface OrdenCompraListRequest {
  idEmpresa?: number | null;
  idSucursal?: number | null;
  idEstado?: number | null;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
