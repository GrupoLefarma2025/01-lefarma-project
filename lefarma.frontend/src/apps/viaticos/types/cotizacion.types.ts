export type ModoCotizacion = 'avion' | 'autobus' | 'hotel';

export interface CotizacionConsulta {
  origen: string;
  destino: string;
  fecha_salida: string;
  fecha_regreso: string | null;
  personas: number;
}

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
  cobertura_declarada: string;
  transportistas_no_encontrados: string[];
  opciones: CotizacionOpcion[];
}

export interface ConceptosMotor {
  gasolina: number | null;
  casetas: number | null;
  hospedaje: number | null;
  comida: number | null;
  taxi: number | null;
}

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

export interface FilaCotizacion {
  clave: string;
  modo: ModoCotizacion;
  transportista: string;
  salida: string;
  llegada: string;
  precio: number | null;
  moneda: string;
  url_compra: string;
  capturas: string[];
  fuente: string;
  estimado: boolean;
  seleccionada: boolean;
}