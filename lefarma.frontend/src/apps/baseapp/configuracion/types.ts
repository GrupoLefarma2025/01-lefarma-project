/**
 * Tipos del módulo Configuración (variables globales e integraciones).
 *
 * El backend devuelve `tipoDato` como texto libre; la UI trabaja con estos
 * valores canónicos y `normalizarTipoDato()` tolera alias/legado.
 */

export interface ApiErrorLocal {
  message: string;
  statusCode?: number;
}

/* ------------------------------------------------------------------ */
/* Tipos de dato                                                       */
/* ------------------------------------------------------------------ */

export type TipoDatoConfig =
  | 'texto_corto'
  | 'texto_largo'
  | 'entero'
  | 'decimal'
  | 'booleano'
  | 'fecha'
  | 'hora'
  | 'fecha_hora'
  | 'seleccion'
  | 'objeto'
  | 'lista'
  | 'json';

export type TonoTipo =
  | 'sky'
  | 'cyan'
  | 'amber'
  | 'orange'
  | 'emerald'
  | 'rose'
  | 'pink'
  | 'violet'
  | 'indigo'
  | 'blue'
  | 'teal'
  | 'slate';

export interface TipoDatoDefinicion {
  valor: TipoDatoConfig;
  etiqueta: string;
  descripcion: string;
  /** Explicación funcional para elegir el tipo correcto. */
  explicacion: string;
  /** Valor de referencia mostrado como ayuda, nunca como valor inicial. */
  ejemplo: string;
  /** Control que verá el usuario al capturar el valor. */
  editor: string;
  tono: TonoTipo;
}

export const TIPOS_DATO: TipoDatoDefinicion[] = [
  {
    valor: 'texto_corto',
    etiqueta: 'Texto corto',
    descripcion: 'Una línea de texto',
    explicacion: 'Nombres, correos, códigos o frases breves.',
    ejemplo: 'avisos@grupolefarma.com',
    editor: 'Campo de una línea',
    tono: 'sky',
  },
  {
    valor: 'texto_largo',
    etiqueta: 'Texto largo',
    descripcion: 'Párrafo o descripción',
    explicacion: 'Instrucciones, mensajes legales o explicaciones extensas.',
    ejemplo: 'Cuando el importe supere el límite autorizado…',
    editor: 'Área de texto',
    tono: 'cyan',
  },
  {
    valor: 'entero',
    etiqueta: 'Entero',
    descripcion: 'Número sin decimales',
    explicacion: 'Cantidades, días, límites o contadores.',
    ejemplo: '45',
    editor: 'Número entero',
    tono: 'amber',
  },
  {
    valor: 'decimal',
    etiqueta: 'Decimal',
    descripcion: 'Número con decimales',
    explicacion: 'Montos, porcentajes, tasas o medidas.',
    ejemplo: '19.99',
    editor: 'Número decimal',
    tono: 'orange',
  },
  {
    valor: 'booleano',
    etiqueta: 'Booleano',
    descripcion: 'Sí o no',
    explicacion: 'Activa o desactiva una regla o comportamiento.',
    ejemplo: 'Sí',
    editor: 'Selección Sí / No',
    tono: 'emerald',
  },
  {
    valor: 'fecha',
    etiqueta: 'Fecha',
    descripcion: 'Día, mes y año',
    explicacion: 'Un día sin hora ni zona horaria.',
    ejemplo: '2026-11-04',
    editor: 'Calendario',
    tono: 'rose',
  },
  {
    valor: 'hora',
    etiqueta: 'Hora',
    descripcion: 'Hora del día',
    explicacion: 'Una hora sin fecha, por ejemplo, un horario límite.',
    ejemplo: '18:30',
    editor: 'Selector de hora',
    tono: 'pink',
  },
  {
    valor: 'fecha_hora',
    etiqueta: 'Fecha y hora',
    descripcion: 'Fecha con hora',
    explicacion: 'Un momento exacto para vigencias, cierres o eventos.',
    ejemplo: '2026-11-04 18:30',
    editor: 'Calendario y hora',
    tono: 'violet',
  },
  {
    valor: 'seleccion',
    etiqueta: 'Selección',
    descripcion: 'Una opción de una lista',
    explicacion: 'Obliga a elegir entre opciones previamente definidas.',
    ejemplo: 'quincenal',
    editor: 'Lista de opciones',
    tono: 'indigo',
  },
  {
    valor: 'objeto',
    etiqueta: 'Objeto',
    descripcion: 'Estructura con campos',
    explicacion: 'Agrupa varios datos relacionados con nombre, tipo y valor.',
    ejemplo: '{ moneda, habilitado, tasas }',
    editor: 'Constructor de campos',
    tono: 'blue',
  },
  {
    valor: 'lista',
    etiqueta: 'Lista',
    descripcion: 'Colección de elementos',
    explicacion: 'Varios elementos del mismo tipo; se activa con la casilla de lista.',
    ejemplo: '[45, 60, 90]',
    editor: 'Elementos repetibles',
    tono: 'teal',
  },
  {
    valor: 'json',
    etiqueta: 'JSON',
    descripcion: 'JSON libre validado',
    explicacion: 'Datos avanzados que no encajan en un tipo estructurado.',
    ejemplo: '{ "pagos": [{ "monto": 100 }] }',
    editor: 'Editor de código JSON',
    tono: 'slate',
  },
];

/** Tipos que se eligen como base; la lista se activa con una casilla. */
export const TIPOS_DATO_SELECCIONABLES = TIPOS_DATO.filter(
  (tipo) => tipo.valor !== 'lista',
);

export const ETIQUETA_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_DATO.map((t) => [t.valor, t.etiqueta]),
);

/**
 * Valores canónicos que persiste el backend
 * (`ConfiguracionTiposDato`). La UI usa nombres en español y traduce al enviar.
 */
export const TIPO_DATO_BACKEND: Record<TipoDatoConfig, string> = {
  texto_corto: 'string',
  texto_largo: 'text',
  entero: 'integer',
  decimal: 'decimal',
  booleano: 'boolean',
  fecha: 'date',
  hora: 'time',
  fecha_hora: 'datetime',
  seleccion: 'enum',
  objeto: 'object',
  lista: 'array',
  json: 'json',
};

/* ------------------------------------------------------------------ */
/* Destinos                                                            */
/* ------------------------------------------------------------------ */

export type DestinoConfig = 'backend' | 'frontend' | 'sql' | 'integraciones';

export type CampoDestino =
  | 'disponibleBackend'
  | 'disponibleFrontend'
  | 'disponibleSql'
  | 'disponibleIntegraciones';

export interface DestinoDefinicion {
  clave: DestinoConfig;
  campo: CampoDestino;
  etiqueta: string;
  descripcion: string;
}

export const DESTINOS: DestinoDefinicion[] = [
  {
    clave: 'backend',
    campo: 'disponibleBackend',
    etiqueta: 'Backend',
    descripcion: 'Consumible desde la API',
  },
  {
    clave: 'frontend',
    campo: 'disponibleFrontend',
    etiqueta: 'Frontend',
    descripcion: 'Expuesto a la interfaz',
  },
  {
    clave: 'sql',
    campo: 'disponibleSql',
    etiqueta: 'SQL',
    descripcion: 'Lectura desde base de datos',
  },
  {
    clave: 'integraciones',
    campo: 'disponibleIntegraciones',
    etiqueta: 'Integraciones',
    descripcion: 'Clientes externos con API key',
  },
];

/* ------------------------------------------------------------------ */
/* DTOs                                                                */
/* ------------------------------------------------------------------ */

export interface VariableConfiguracion {
  idVariable: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  tipoDato: string;
  valor: unknown;
  esquema: unknown | null;
  disponibleBackend: boolean;
  disponibleFrontend: boolean;
  disponibleSql: boolean;
  disponibleIntegraciones: boolean;
  activo: boolean;
  version: number;
  fechaCreacion: string;
  fechaModificacion: string;
}

/**
 * Entrada de bitácora tal como la devuelve el listado del backend
 * (`BitacoraResumenResponse`). Los snapshots solo llegan en el detalle.
 */
export interface BitacoraVariable {
  idBitacora: number;
  idVariable?: number;
  clave?: string;
  idOperacion?: string;
  accion: string;
  idBitacoraOrigen: number | null;
  /** El backend expone `fechaCreacion`; `fecha` se conserva por compatibilidad. */
  fecha?: string;
  fechaCreacion?: string;
  idUsuario: number | null;
  datosAnteriores?: unknown | null;
  datosNuevos?: unknown;
}

/** Detalle completo de una revisión (`BitacoraDetalleResponse`). */
export interface BitacoraDetalle extends BitacoraVariable {
  idOperacion: string;
  datosAnteriores: unknown | null;
  datosNuevos: unknown;
}

export interface IntegracionCliente {
  idIntegracion: number;
  nombre: string;
  prefijoLlave: string;
  clavesPermitidas?: string[] | null;
  activo: boolean;
  fechaCreacion?: string | null;
  fechaExpiracion?: string | null;
  ultimaUtilizacion?: string | null;
}

export interface IntegracionCreada extends IntegracionCliente {
  /** La llave completa solo llega en la respuesta de creación. */
  llave: string;
}

/* ------------------------------------------------------------------ */
/* Payloads                                                            */
/* ------------------------------------------------------------------ */

export interface CrearVariablePayload {
  clave: string;
  nombre: string;
  descripcion: string | null;
  tipoDato: string;
  valor: unknown;
  esquema: unknown | null;
  disponibleBackend: boolean;
  disponibleFrontend: boolean;
  disponibleSql: boolean;
  disponibleIntegraciones: boolean;
  idOperacion: string;
}

export interface ActualizarVariablePayload {
  nombre: string;
  descripcion: string | null;
  valor: unknown;
  esquema: unknown | null;
  disponibleBackend: boolean;
  disponibleFrontend: boolean;
  disponibleSql: boolean;
  disponibleIntegraciones: boolean;
  versionEsperada: number;
  idOperacion: string;
}

export interface CambioEstadoPayload {
  versionEsperada: number;
  idOperacion: string;
}

export interface RestaurarVariablePayload {
  idBitacoraOrigen: number;
  versionEsperada: number;
  idOperacion: string;
}

export interface CrearIntegracionPayload {
  nombre: string;
  fechaExpiracion?: string;
  clavesPermitidas?: string[];
}

export interface FiltrosVariables {
  buscar?: string;
  tipo?: string;
  destino?: DestinoConfig | '';
  activo?: boolean | '';
}

/* ------------------------------------------------------------------ */
/* JSON Schema (subconjunto que consume el constructor visual)         */
/* ------------------------------------------------------------------ */

export interface JsonSchemaNodo {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | string;
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  opciones?: unknown[];
  properties?: Record<string, JsonSchemaNodo>;
  required?: string[];
  items?: JsonSchemaNodo;
  additionalProperties?: boolean | JsonSchemaNodo;
  [clave: string]: unknown;
}

export type TipoCampoConstructor =
  | 'texto_corto'
  | 'texto_largo'
  | 'entero'
  | 'decimal'
  | 'booleano'
  | 'fecha'
  | 'hora'
  | 'fecha_hora'
  | 'seleccion'
  | 'objeto'
  | 'lista'
  | 'json';

/** Modelo editable del constructor de objetos (solo UI, no se envía). */
export interface SchemaField {
  id: string;
  nombre: string;
  tipo: TipoCampoConstructor;
  /** Convierte el campo en una lista del tipo seleccionado. */
  esLista?: boolean;
  obligatorio: boolean;
  descripcion?: string;
  opciones?: string[];
  /** Compatibilidad con el modelo anterior de listas. */
  itemTipo?: TipoCampoConstructor;
  campos?: SchemaField[];
  clavesAdicionales?: boolean;
}

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

export const PERMISOS_CONFIGURACION = {
  ver: 'configuracion.view',
  crear: 'configuracion.create',
  actualizar: 'configuracion.update',
  historial: 'configuracion.history',
  restaurar: 'configuracion.restore',
  apiKeys: 'configuracion.api_keys',
} as const;
