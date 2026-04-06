// ─── Empresa ─────────────────────────────────────────────────────────────────


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
}

// ─── Sucursal ─────────────────────────────────────────────────────────────────

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

// ─── Area ─────────────────────────────────────────────────────────────────────

export interface Area {
  idArea: number;
  idEmpresa: number;
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

// ─── Forma de Pago ────────────────────────────────────────────────────────────

export interface FormaPago {
  idFormaPago: number;
  nombre: string;
  descripcion?: string;
  clave?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

// ─── Unidad de Medida ─────────────────────────────────────────────────────────

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

// ─── Medida ───────────────────────────────────────────────────────────────────

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

// ─── Gasto ────────────────────────────────────────────────────────────────────

export interface Gasto {
  idGasto: number;
  nombre: string;
  nombreNormalizado?: string;
  descripcion?: string;
  clave?: string;
  concepto?: string;
  cuenta?: string;
  subCuenta?: string;
  analitica?: string;
  integracion?: string;
  cuentaCatalogo?: string;
  requiereComprobacionPago: boolean;
  requiereComprobacionGasto: boolean;
  permiteSinDatosFiscales: boolean;
  diasLimiteComprobacion: number;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
  unidadesMedida?: UnidadMedida[];
}
