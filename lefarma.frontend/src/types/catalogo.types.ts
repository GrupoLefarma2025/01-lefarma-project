export interface Empresa {
  idEmpresa: number;
  nombre: string;
  descripcion?: string;
  clave?: string;
  razonSocial?: string;
  rfc?: string;
  direccion?: string;
  colonia?: string;
  ciudad?: string;
  estado?: string;
  codigoPostal?: string;
  telefono?: string;
  email?: string;
  paginaWeb?: string;
  numeroEmpleados?: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
  puedeSeleccionarEmpresas?: boolean;
}

export interface Sucursal {
  idSucursal: number;
  idEmpresa: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  clave?: string;
  claveContable?: string;
  direccion?: string;
  codigoPostal?: string;
  ciudad?: string;
  estado?: string;
  telefono?: string;
  latitud: number;
  longitud: number;
  numeroEmpleados: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface Area {
  idArea: number;
  idEmpresa: number;
  idSucursal?: number;
  idSupervisorResponsable?: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  clave?: string;
  numeroEmpleados: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface FormaPago {
  idFormaPago: number;
  nombre: string;
  descripcion?: string;
  clave?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface UnidadMedida {
  idUnidadMedida: number;
  idMedida?: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  abreviatura: string;
  activo: boolean;
  fechaCreacion?: string;
  fechaModificacion?: string;
}

export interface Medida {
  idMedida: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  descripcionNormalizada?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
  unidadesMedida?: UnidadMedida[];
}

export interface TipoImpuesto {
  idTipoImpuesto: number;
  nombre: string;
  clave: string;
  tasa: number;
  descripcion?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface TipoGasto {
  idTipoGasto: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  clave?: string;
  requiereComprobacionPago: boolean;
  requiereComprobacionGasto: boolean;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface Banco {
  idBanco: number;
  nombre: string;
  clave: string;
  codigoSwift?: string;
  activo: boolean;
}

export interface ProveedorCuentaBancaria {
  idCuenta: number;
  idProveedor: number;
  idFormaPago: number;
  idBanco?: number;
  formaPagoNombre?: string;
  bancoNombre?: string;
  numeroCuenta?: string;
  clabe?: string;
  numeroTarjeta?: string;
  beneficiario?: string;
  correoNotificacion?: string;
  activo: boolean;
  tieneOrdenes?: boolean;
}

export interface Moneda {
  idMoneda: number;
  codigo: string;
  nombre: string;
  simbolo: string;
  locale: string;
  tipoCambio: number;
  esDefault: boolean;
  activo: boolean;
}
