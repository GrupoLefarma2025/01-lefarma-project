/**
 * Utilidades del módulo Configuración:
 *  - normalización de tipoDato / clave
 *  - constructor visual ⇄ JSON Schema
 *  - valores dinámicos, validación y diff para el historial
 */

import type { ApiError } from '@/types/api.types';
import { checkPermission } from '@/utils/permissions';
import {
  TIPO_DATO_BACKEND,
  TIPOS_DATO,
  type DestinoConfig,
  type JsonSchemaNodo,
  type SchemaField,
  type TipoCampoConstructor,
  type TipoDatoConfig,
} from './types';

/* ------------------------------------------------------------------ */
/* Texto y claves                                                      */
/* ------------------------------------------------------------------ */

export const CLAVE_REGEX = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
export const NOMBRE_CAMPO_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Convierte texto libre a camelCase: "Días límite" → "diasLimite". */
export function aCamelCase(texto: string): string {
  const limpio = sinAcentos(texto).trim();
  if (!limpio) return '';

  // Respeta camelCase ya escrito; normaliza siglas en mayúsculas.
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(limpio)) {
    if (limpio === limpio.toUpperCase()) return limpio.toLowerCase();
    return limpio.charAt(0).toLowerCase() + limpio.slice(1);
  }

  const palabras = limpio.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!palabras) return '';
  const partes = palabras.split(/\s+/);
  const primera = partes[0].toLowerCase();
  const resto = partes.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  const resultado = [primera, ...resto].join('');
  if (!resultado) return '';
  return /^[a-z]/.test(resultado)
    ? resultado
    : `v${resultado.charAt(0).toUpperCase()}${resultado.slice(1)}`;
}

/** namespace + nombre → "viaticos.diasLimite". Sin namespace no inventa uno. */
export function construirClave(namespace: string, nombre: string): string {
  const ns = aCamelCase(namespace);
  const clave = aCamelCase(nombre);
  return ns && clave ? `${ns}.${clave}` : '';
}

export function validarClave(clave: string): string | null {
  if (!clave.trim()) return 'La clave es obligatoria.';
  if (clave.trim().length > 200) return 'La clave no puede exceder 200 caracteres.';
  if (!CLAVE_REGEX.test(clave.trim())) {
    return 'Usa al menos namespace.clave en minúsculas (ej. viaticos.diasLimite).';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Normalización de tipoDato                                           */
/* ------------------------------------------------------------------ */

const ALIAS_TIPO: Record<string, TipoDatoConfig> = {
  textocorto: 'texto_corto',
  texto: 'texto_corto',
  string: 'texto_corto',
  str: 'texto_corto',
  varchar: 'texto_corto',
  textolargo: 'texto_largo',
  text: 'texto_largo',
  textarea: 'texto_largo',
  rich: 'texto_largo',
  richtext: 'texto_largo',
  entero: 'entero',
  int: 'entero',
  integer: 'entero',
  long: 'entero',
  decimal: 'decimal',
  number: 'decimal',
  float: 'decimal',
  double: 'decimal',
  numeric: 'decimal',
  money: 'decimal',
  booleano: 'booleano',
  bool: 'booleano',
  boolean: 'booleano',
  fecha: 'fecha',
  date: 'fecha',
  hora: 'hora',
  time: 'hora',
  fechahora: 'fecha_hora',
  datetime: 'fecha_hora',
  timestamp: 'fecha_hora',
  seleccion: 'seleccion',
  select: 'seleccion',
  selector: 'seleccion',
  enum: 'seleccion',
  opcion: 'seleccion',
  opciones: 'seleccion',
  objeto: 'objeto',
  object: 'objeto',
  jsonobject: 'objeto',
  lista: 'lista',
  list: 'lista',
  array: 'lista',
  coleccion: 'lista',
  json: 'json',
  jsonb: 'json',
  cualquiercosa: 'json',
};

function firmaTipo(tipo: string): string {
  return sinAcentos(tipo).toLowerCase().replace(/[\s_\-.]/g, '');
}

/** Devuelve el tipo canónico o `null` si el backend usa un valor desconocido. */
export function normalizarTipoDato(tipo: string | null | undefined): TipoDatoConfig | null {
  if (!tipo) return null;
  const firma = firmaTipo(tipo);
  if (ALIAS_TIPO[firma]) return ALIAS_TIPO[firma];
  const directo = TIPOS_DATO.find(
    (t) => t.valor === tipo.trim().toLowerCase() || t.valor.replace(/_/g, '') === firma,
  );
  return directo ? directo.valor : null;
}

/** Tipo utilizable por la UI; los desconocidos se editan como JSON libre. */
export function tipoEfectivo(tipo: string | null | undefined): TipoDatoConfig {
  return normalizarTipoDato(tipo) ?? 'json';
}

/** Traduce el tipo de la UI al valor canónico que persiste el backend. */
export function tipoDatoBackend(tipo: string): string {
  const normalizado = normalizarTipoDato(tipo);
  return normalizado ? TIPO_DATO_BACKEND[normalizado] : tipo;
}

export function etiquetaTipo(tipo: string): string {
  const canonico = normalizarTipoDato(tipo);
  if (canonico) {
    return TIPOS_DATO.find((t) => t.valor === canonico)?.etiqueta ?? tipo;
  }
  return tipo || 'Desconocido';
}

/* ------------------------------------------------------------------ */
/* JSON helpers                                                        */
/* ------------------------------------------------------------------ */

export function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function jsonATexto(valor: unknown): string {
  if (valor === undefined) return '';
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

export type ResultadoJson =
  | { ok: true; valor: unknown }
  | { ok: false; error: string };

export function parsearJson(texto: string): ResultadoJson {
  if (!texto.trim()) return { ok: false, error: 'El JSON está vacío.' };
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'JSON inválido.' };
  }
}

/**
 * Valor inicial de un campo agregado a una lista. Es un valor estructural para
 * que el editor pueda abrir una fila nueva; la validación seguirá exigiendo que
 * el usuario lo complete cuando corresponda.
 */
export function valorPorDefecto(tipo: string, esquema?: JsonSchemaNodo | null): unknown {
  const t = tipoEfectivo(tipo);
  switch (t) {
    case 'texto_corto':
    case 'texto_largo':
    case 'fecha':
    case 'hora':
    case 'fecha_hora':
      return '';
    case 'entero':
    case 'decimal':
      return 0;
    case 'booleano':
      return false;
    case 'seleccion': {
      const opciones = opcionesDeEsquema(esquema ?? null);
      return opciones[0] ?? '';
    }
    case 'objeto':
      return {};
    case 'lista':
      return [];
    case 'json':
    default:
      return {};
  }
}

/**
 * Valor inicial al seleccionar un tipo en el formulario principal.
 * No inventa un dato de negocio: textos vacíos, números/booleanos sin elegir.
 */
export function valorInicialFormulario(tipo: string, esLista = false): unknown {
  if (esLista) return [];
  const t = tipoEfectivo(tipo);
  switch (t) {
    case 'booleano':
    case 'entero':
    case 'decimal':
      return null;
    case 'objeto':
      return {};
    case 'json':
      return '';
    default:
      return '';
  }
}

/** Normaliza lo que llega del backend para que los editores no truenen. */
export function valorDesdeServidor(tipo: string, valor: unknown): unknown {
  const t = tipoEfectivo(tipo);
  switch (t) {
    case 'texto_corto':
    case 'texto_largo':
      return valor === null || valor === undefined ? '' : String(valor);
    case 'entero': {
      if (valor === null || valor === undefined || valor === '') return null;
      const n = typeof valor === 'number' ? valor : Number(valor);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case 'decimal': {
      if (valor === null || valor === undefined || valor === '') return null;
      const n = typeof valor === 'number' ? valor : Number(valor);
      return Number.isFinite(n) ? n : null;
    }
    case 'booleano':
      return valor === true || valor === 'true' || valor === 1 || valor === '1';
    case 'fecha':
    case 'hora':
    case 'fecha_hora':
      return typeof valor === 'string' ? valor : '';
    case 'seleccion':
      return valor === null || valor === undefined ? '' : String(valor);
    case 'lista':
      return Array.isArray(valor) ? valor : [];
    case 'objeto':
      return esObjetoPlano(valor) ? valor : {};
    default:
      return valor === undefined ? null : valor;
  }
}

/** Resumen de una línea para la tabla. */
export function resumirValor(valor: unknown, maximo = 72): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'string') {
    if (!valor) return '""';
    return valor.length > maximo ? `${valor.slice(0, maximo)}…` : valor;
  }
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  if (typeof valor === 'number') return String(valor);
  if (Array.isArray(valor)) {
    const texto = JSON.stringify(valor);
    return texto.length > maximo ? `[${valor.length} elementos]` : texto;
  }
  try {
    const texto = JSON.stringify(valor);
    return texto.length > maximo ? `${texto.slice(0, maximo)}…` : texto;
  } catch {
    return String(valor);
  }
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatearFecha(valor: string | null | undefined, conHora = false): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return conHora ? FORMATO_FECHA_HORA.format(fecha) : FORMATO_FECHA.format(fecha);
}

/** Fecha de una entrada de bitácora (`fecha` legado o `fechaCreacion`). */
export function fechaBitacora(entrada: {
  fecha?: string;
  fechaCreacion?: string;
}): string {
  return entrada.fecha ?? entrada.fechaCreacion ?? '';
}

/** ISO → valor para <input type="datetime-local">. */
export function aDatetimeLocal(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    // Ya viene en formato local (sin zona): recorta a minutos.
    const match = valor.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return match ? match[1] : '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours(),
  )}:${pad(fecha.getMinutes())}`;
}

/** <input type="datetime-local"> → ISO UTC. */
export function desdeDatetimeLocal(valor: string): string {
  if (!valor) return '';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toISOString();
}

/** Fecha ISO → "YYYY-MM-DD" para <input type="date">. */
export function aFechaInput(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/** Hora ISO → "HH:mm" / "HH:mm:ss" para <input type="time">. */
export function aHoraInput(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  const match = valor.match(/(\d{2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : '';
}

/* ------------------------------------------------------------------ */
/* Constructor visual ⇄ JSON Schema                                    */
/* ------------------------------------------------------------------ */

export function nuevoIdCampo(): string {
  return crypto.randomUUID();
}

export function campoVacio(): SchemaField {
  return {
    id: nuevoIdCampo(),
    nombre: '',
    tipo: 'texto_corto',
    esLista: false,
    obligatorio: true,
    clavesAdicionales: false,
  };
}

function esquemaDeTipo(tipo: TipoCampoConstructor): JsonSchemaNodo {
  switch (tipo) {
    case 'texto_corto':
      return { type: 'string' };
    case 'texto_largo':
      return { type: 'string' };
    case 'entero':
      return { type: 'integer' };
    case 'decimal':
      return { type: 'number' };
    case 'booleano':
      return { type: 'boolean' };
    case 'fecha':
      return { type: 'string', format: 'date' };
    case 'hora':
      return { type: 'string', format: 'time' };
    case 'fecha_hora':
      return { type: 'string', format: 'date-time' };
    case 'json':
      return {};
    case 'objeto':
      return { type: 'object', properties: {}, additionalProperties: false };
    case 'seleccion':
      return { type: 'string', enum: [] };
    case 'lista':
    default:
      return { type: 'string' };
  }
}

/** Esquema de un tipo simple, sin objetos ni selecciones configuradas. */
export function esquemaBaseDeTipo(tipo: TipoCampoConstructor): JsonSchemaNodo {
  return esquemaDeTipo(tipo);
}

function esquemaOpciones(opciones: string[]): Array<{ value: string }> {
  return opciones.map((opcion) => ({ value: opcion }));
}

export function esquemaDeCampo(campo: SchemaField): JsonSchemaNodo {
  const base: JsonSchemaNodo = {};
  const descripcion = campo.descripcion?.trim();
  if (descripcion) base.description = descripcion;

  // Compatibilidad con el modelo anterior de "Lista" como tipo.
  if (campo.tipo === 'lista' && !campo.esLista) {
    return {
      ...base,
      type: 'array',
      items: esquemaDeItemLista(campo),
    };
  }

  let esquemaBase: JsonSchemaNodo;

  if (campo.tipo === 'objeto') {
    esquemaBase = {
      type: 'object',
      properties: Object.fromEntries(
        (campo.campos ?? []).map((hijo) => [hijo.nombre.trim(), esquemaDeCampo(hijo)]),
      ),
      required: (campo.campos ?? []).filter((hijo) => hijo.obligatorio).map((h) => h.nombre.trim()),
      additionalProperties: campo.clavesAdicionales ?? false,
    };
  } else if (campo.tipo === 'seleccion') {
    const opciones = (campo.opciones ?? []).map((o) => o.trim()).filter(Boolean);
    esquemaBase = { type: 'string', enum: opciones, opciones: esquemaOpciones(opciones) };
  } else {
    esquemaBase = esquemaDeTipo(campo.tipo);
  }

  if (campo.esLista) {
    return {
      ...base,
      type: 'array',
      items: esquemaBase,
    };
  }

  return { ...base, ...esquemaBase };
}

function esquemaDeItemLista(campo: SchemaField): JsonSchemaNodo {
  const itemTipo = campo.itemTipo ?? 'texto_corto';
  if (itemTipo === 'objeto') {
    return {
      type: 'object',
      properties: Object.fromEntries(
        (campo.campos ?? []).map((hijo) => [hijo.nombre.trim(), esquemaDeCampo(hijo)]),
      ),
      required: (campo.campos ?? []).filter((hijo) => hijo.obligatorio).map((h) => h.nombre.trim()),
      additionalProperties: campo.clavesAdicionales ?? false,
    };
  }
  if (itemTipo === 'seleccion') {
    const opciones = (campo.opciones ?? []).map((o) => o.trim()).filter(Boolean);
    return { type: 'string', enum: opciones, opciones: esquemaOpciones(opciones) };
  }
  if (itemTipo === 'lista') {
    return { type: 'array', items: { type: 'string' } };
  }
  return esquemaDeTipo(itemTipo);
}

/** Configuración editable de una variable para construir su JSON Schema. */
export interface ConfiguracionEsquema {
  tipo: string;
  /** Convierte la configuración base en un arreglo de ese tipo. */
  esLista?: boolean;
  campos: SchemaField[];
  opciones: string[];
  clavesAdicionales: boolean;
  itemTipo?: TipoCampoConstructor;
  itemCampos?: SchemaField[];
  itemOpciones?: string[];
  itemClavesAdicionales?: boolean;
}

/** Construye el JSON Schema completo de la variable. */
export function construirEsquema(config: ConfiguracionEsquema): JsonSchemaNodo | null {
  const t = tipoEfectivo(config.tipo);

  // Compatibilidad con el modelo anterior de listas con itemTipo.
  if (t === 'lista' && !config.esLista) {
    const itemTipo = config.itemTipo ?? 'texto_corto';
    if (itemTipo === 'objeto') {
      return {
        type: 'array',
        items: esquemaObjetoDesdeCampos(config.itemCampos ?? [], config.itemClavesAdicionales ?? false),
      };
    }
    if (itemTipo === 'seleccion') {
      const opciones = (config.itemOpciones ?? []).map((o) => o.trim()).filter(Boolean);
      return {
        type: 'array',
        items: { type: 'string', enum: opciones, opciones: esquemaOpciones(opciones) },
      };
    }
    return { type: 'array', items: esquemaDeTipo(itemTipo) };
  }

  let base: JsonSchemaNodo | null = null;

  if (t === 'objeto') {
    base = esquemaObjetoDesdeCampos(config.campos, config.clavesAdicionales);
  } else if (t === 'seleccion') {
    const limpias = config.opciones.map((o) => o.trim()).filter(Boolean);
    base = { type: 'string', enum: limpias, opciones: esquemaOpciones(limpias) };
  } else if (config.esLista) {
    base = esquemaDeTipo(t);
  }

  if (config.esLista) {
    return {
      type: 'array',
      items: base ?? esquemaDeTipo(t),
    };
  }

  return base;
}

function esquemaObjetoDesdeCampos(
  campos: SchemaField[],
  clavesAdicionales: boolean,
): JsonSchemaNodo {
  return {
    type: 'object',
    properties: Object.fromEntries(campos.map((c) => [c.nombre.trim(), esquemaDeCampo(c)])),
    required: campos.filter((c) => c.obligatorio).map((c) => c.nombre.trim()),
    additionalProperties: clavesAdicionales,
  };
}

export interface ItemListaConfig {
  tipo: TipoCampoConstructor;
  campos: SchemaField[];
  clavesAdicionales: boolean;
  opciones: string[];
}

/** Extrae la configuración del `items` de una lista existente. */
export function itemListaDeEsquema(esquema: unknown): ItemListaConfig {
  const nodo = esObjetoPlano(esquema) ? (esquema as JsonSchemaNodo) : null;
  const items =
    nodo && nodo.type === 'array' && esObjetoPlano(nodo.items)
      ? (nodo.items as JsonSchemaNodo)
      : { type: 'string' };
  const tipo = tipoDeNodo(items);
  return {
    tipo,
    campos: tipo === 'objeto' ? esquemaACampos(items) : [],
    clavesAdicionales: items.additionalProperties === true,
    opciones: opcionesDeNodo(items),
  };
}

function tipoDeNodo(nodo: JsonSchemaNodo): TipoCampoConstructor {
  if (nodo.type === 'object') return 'objeto';
  if (nodo.type === 'array') return 'lista';
  if (nodo.type === 'integer') return 'entero';
  if (nodo.type === 'number') return 'decimal';
  if (nodo.type === 'boolean') return 'booleano';
  if (nodo.type === 'string') {
    const tieneEnum = Array.isArray(nodo.enum) && nodo.enum.length > 0;
    const tieneOpciones = Array.isArray(nodo.opciones) && nodo.opciones.length > 0;
    if (tieneEnum || tieneOpciones) return 'seleccion';
    if (nodo.format === 'date') return 'fecha';
    if (nodo.format === 'time') return 'hora';
    if (nodo.format === 'date-time') return 'fecha_hora';
    return 'texto_corto';
  }
  if (!nodo.type) return 'json';
  return 'texto_corto';
}

function opcionesDeNodo(nodo: JsonSchemaNodo): string[] {
  if (Array.isArray(nodo.enum)) return nodo.enum.map((o) => String(o));
  if (Array.isArray(nodo.opciones)) {
    return nodo.opciones.map((opcion) => {
      if (typeof opcion === 'string') return opcion;
      if (esObjetoPlano(opcion)) {
        if (typeof opcion.value === 'string') return opcion.value;
        if (typeof opcion.label === 'string') return opcion.label;
      }
      return String(opcion);
    });
  }
  return [];
}

/** Tipo del editor para un nodo de esquema (para editores anidados). */
export function tipoEditorDeEsquema(nodo: JsonSchemaNodo | null | undefined): TipoDatoConfig {
  return nodo ? tipoDeNodo(nodo) : 'texto_corto';
}

/** Convierte un JSON Schema existente al modelo del constructor. */
export function esquemaACampos(esquema: unknown): SchemaField[] {
  if (!esObjetoPlano(esquema)) return [];
  const nodo = esquema as JsonSchemaNodo;
  if (nodo.type !== 'object' || !nodo.properties) return [];
  return Object.entries(nodo.properties).map(([nombre, propiedad]) => {
    const hijo = esObjetoPlano(propiedad) ? (propiedad as JsonSchemaNodo) : {};
    const obligatorio = (nodo.required ?? []).includes(nombre);
    const descripcion =
      typeof hijo.description === 'string' ? hijo.description : undefined;
    const esArray = hijo.type === 'array';
    const nodoBase = esArray && esObjetoPlano(hijo.items)
      ? (hijo.items as JsonSchemaNodo)
      : hijo;
    const tipoOriginal = tipoDeNodo(nodoBase);

    // El editor actual modela una lista como tipo base + casilla "Lista".
    // El único caso que conserva el tipo Lista es una lista de listas.
    if (esArray && tipoOriginal === 'lista') {
      return {
        id: nuevoIdCampo(),
        nombre,
        tipo: 'lista',
        esLista: false,
        obligatorio,
        descripcion,
        itemTipo: 'lista',
        campos: [],
        clavesAdicionales: false,
      } satisfies SchemaField;
    }

    const campo: SchemaField = {
      id: nuevoIdCampo(),
      nombre,
      tipo: tipoOriginal,
      esLista: esArray,
      obligatorio,
      descripcion,
      clavesAdicionales: nodoBase.additionalProperties === true,
    };

    if (tipoOriginal === 'seleccion') campo.opciones = opcionesDeNodo(nodoBase);
    if (tipoOriginal === 'objeto') campo.campos = esquemaACampos(nodoBase);
    return campo;
  });
}

export function opcionesDeEsquema(esquema: JsonSchemaNodo | null): string[] {
  if (!esquema) return [];
  return opcionesDeNodo(esquema);
}

export function clavesAdicionalesDeEsquema(esquema: JsonSchemaNodo | null): boolean {
  return esquema?.additionalProperties === true;
}

/**
 * Ajusta un valor al esquema actual: elimina claves no declaradas cuando
 * `additionalProperties` es false y depura recursivamente listas/objetos.
 * Evita que el backend rechace propiedades que ya no existen en el esquema.
 */
export function depurarValorSegunEsquema(
  valor: unknown,
  esquema: JsonSchemaNodo | null,
): unknown {
  if (!esquema || typeof esquema !== 'object') return valor;

  if (esquema.type === 'object') {
    if (!esObjetoPlano(valor)) return valor;
    const propiedades = esquema.properties ?? {};
    const permiteAdicionales = esquema.additionalProperties !== false;
    const salida: Record<string, unknown> = {};

    for (const [clave, hijoValor] of Object.entries(valor)) {
      const hijoEsquema = propiedades[clave];
      if (hijoEsquema) {
        salida[clave] = depurarValorSegunEsquema(hijoValor, hijoEsquema);
      } else if (permiteAdicionales) {
        salida[clave] = hijoValor;
      }
    }

    return salida;
  }

  if (esquema.type === 'array' && Array.isArray(valor) && esquema.items) {
    return valor.map((item) => depurarValorSegunEsquema(item, esquema.items ?? null));
  }

  return valor;
}

/** Valida el árbol del constructor; devuelve mensajes legibles. */
export function validarConstructor(campos: SchemaField[], ruta = ''): string[] {
  const errores: string[] = [];
  const vistos = new Set<string>();

  for (const campo of campos) {
    const nombre = campo.nombre.trim();
    const etiqueta = ruta ? `${ruta}.${nombre || '(sin nombre)'}` : nombre || '(sin nombre)';

    if (!nombre) {
      errores.push('Cada campo necesita un nombre.');
    } else if (!NOMBRE_CAMPO_REGEX.test(nombre)) {
      errores.push(`"${etiqueta}": el nombre solo admite letras, números y guion bajo.`);
    } else if (vistos.has(nombre)) {
      errores.push(`"${etiqueta}": el nombre está repetido en el mismo nivel.`);
    } else {
      vistos.add(nombre);
    }

    if (campo.tipo === 'seleccion') {
      const opciones = (campo.opciones ?? []).map((o) => o.trim()).filter(Boolean);
      if (opciones.length === 0) {
        errores.push(`"${etiqueta}": agrega al menos una opción de selección.`);
      }
      if (new Set(opciones).size !== opciones.length) {
        errores.push(`"${etiqueta}": hay opciones repetidas.`);
      }
    }

    if (campo.tipo === 'objeto') {
      if (!(campo.campos ?? []).length && !campo.clavesAdicionales) {
        errores.push(`"${etiqueta}": agrega al menos un campo o habilita claves adicionales.`);
      }
      errores.push(...validarConstructor(campo.campos ?? [], etiqueta));
    }

    if (campo.tipo === 'lista') {
      if (!campo.itemTipo) {
        errores.push(`"${etiqueta}": elige el tipo de los elementos de la lista.`);
      }
      if (campo.itemTipo === 'objeto') {
        if (!(campo.campos ?? []).length && !campo.clavesAdicionales) {
          errores.push(`"${etiqueta}": agrega campos al objeto de la lista.`);
        }
        errores.push(...validarConstructor(campo.campos ?? [], etiqueta));
      }
      if (campo.itemTipo === 'seleccion') {
        const opciones = (campo.opciones ?? []).map((o) => o.trim()).filter(Boolean);
        if (!opciones.length) {
          errores.push(`"${etiqueta}": la selección de la lista necesita opciones.`);
        }
      }
    }
  }

  return errores;
}

/* ------------------------------------------------------------------ */
/* Validación de valores contra el esquema                             */
/* ------------------------------------------------------------------ */

function validarContraEsquema(
  valor: unknown,
  esquema: JsonSchemaNodo,
  ruta: string,
  errores: string[],
): void {
  const etiqueta = ruta || 'valor';
  const tipo = esquema.type;

  if (tipo === 'object') {
    if (!esObjetoPlano(valor)) {
      errores.push(`"${etiqueta}": debe ser un objeto.`);
      return;
    }
    const propiedades = esquema.properties ?? {};
    for (const requerido of esquema.required ?? []) {
      if (valor[requerido] === undefined || valor[requerido] === null) {
        errores.push(`"${etiqueta}.${requerido}": es obligatorio.`);
      }
    }
    for (const [nombre, hijo] of Object.entries(propiedades)) {
      if (valor[nombre] === undefined) continue;
      validarContraEsquema(valor[nombre], hijo, `${ruta ? `${ruta}.` : ''}${nombre}`, errores);
    }
    return;
  }

  if (tipo === 'array') {
    if (!Array.isArray(valor)) {
      errores.push(`"${etiqueta}": debe ser una lista.`);
      return;
    }
    const items = esquema.items;
    if (items) {
      valor.forEach((item, indice) => {
        validarContraEsquema(item, items, `${etiqueta}[${indice}]`, errores);
      });
    }
    return;
  }

  if (tipo === 'string') {
    if (typeof valor !== 'string') {
      errores.push(`"${etiqueta}": debe ser texto.`);
      return;
    }
    if (Array.isArray(esquema.enum) && esquema.enum.length > 0) {
      const permitidos = esquema.enum.map((o) => String(o));
      if (!permitidos.includes(valor)) {
        errores.push(`"${etiqueta}": debe ser una de las opciones permitidas.`);
      }
    }
    return;
  }

  if (tipo === 'integer') {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      errores.push(`"${etiqueta}": debe ser un número entero.`);
    }
    return;
  }

  if (tipo === 'number') {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      errores.push(`"${etiqueta}": debe ser un número.`);
    }
    return;
  }

  if (tipo === 'boolean') {
    if (typeof valor !== 'boolean') {
      errores.push(`"${etiqueta}": debe ser verdadero o falso.`);
    }
  }
}

/** Valida el valor según el tipo de la variable. Devuelve mensajes. */
export function validarValorVariable(
  tipo: string,
  valor: unknown,
  esquema: JsonSchemaNodo | null,
): string[] {
  const t = tipoEfectivo(tipo);
  const errores: string[] = [];

  switch (t) {
    case 'texto_corto':
    case 'texto_largo':
      if (typeof valor !== 'string') errores.push('El valor debe ser texto.');
      break;
    case 'entero':
      if (typeof valor !== 'number' || !Number.isInteger(valor)) {
        errores.push('El valor debe ser un número entero.');
      }
      break;
    case 'decimal':
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        errores.push('El valor debe ser un número.');
      }
      break;
    case 'booleano':
      if (typeof valor !== 'boolean') errores.push('Selecciona Sí o No.');
      break;
    case 'fecha':
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        errores.push('Selecciona una fecha válida.');
      }
      break;
    case 'hora':
      if (typeof valor !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) {
        errores.push('Selecciona una hora válida.');
      }
      break;
    case 'fecha_hora':
      if (typeof valor !== 'string' || !valor || Number.isNaN(new Date(valor).getTime())) {
        errores.push('Selecciona una fecha y hora válidas.');
      }
      break;
    case 'seleccion': {
      if (typeof valor !== 'string' || !valor) {
        errores.push('Selecciona una opción.');
        break;
      }
      const opciones = opcionesDeEsquema(esquema);
      if (opciones.length > 0 && !opciones.includes(valor)) {
        errores.push('Selecciona una opción de la lista.');
      }
      break;
    }
    case 'objeto':
    case 'lista':
      if (!esquema) {
        errores.push('Define el esquema del valor en el paso anterior.');
      }
      break;
    case 'json':
      if (valor === undefined) errores.push('El valor JSON es obligatorio.');
      break;
  }

  if (esquema && (t === 'objeto' || t === 'lista')) {
    validarContraEsquema(valor, esquema, '', errores);
  }

  return errores;
}

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

export function tienePermiso(codigo: string): boolean {
  return checkPermission({ require: codigo });
}

/* ------------------------------------------------------------------ */
/* Errores / operaciones                                               */
/* ------------------------------------------------------------------ */

export function esCancelado(error: unknown): boolean {
  const e = error as { message?: string; name?: string };
  return (
    e?.message === 'REQUEST_CANCELED' ||
    e?.name === 'CanceledError' ||
    e?.name === 'AbortError'
  );
}

export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  if (!error) return porDefecto;
  if (typeof error === 'string') return error;
  const apiError = error as ApiError;
  if (typeof apiError.message === 'string' && apiError.message) {
    return apiError.message === 'REQUEST_CANCELED' ? porDefecto : apiError.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return porDefecto;
}

/** Descripciones de los errores de validación del backend. */
export function detallesError(error: unknown): string[] {
  const errores = (error as ApiError)?.errors;
  if (!Array.isArray(errores)) return [];
  return errores
    .map((detalle) => detalle?.description)
    .filter((descripcion): descripcion is string => Boolean(descripcion));
}

/** Mensaje + detalles de validación en una sola línea. */
export function mensajeErrorCompleto(error: unknown, porDefecto?: string): string {
  return [mensajeError(error, porDefecto), ...detallesError(error)]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Un fallo es reintentable si pudo haber sido un timeout o una caída
 * temporal: en ese caso se conserva el idOperacion para reintentar.
 */
export function esErrorReintentable(error: unknown): boolean {
  const status = (error as ApiError)?.statusCode;
  if (status === undefined) return true;
  if (status === 0) return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function esConflicto(error: unknown): boolean {
  return (error as ApiError)?.statusCode === 409;
}

export function nuevoIdOperacion(): string {
  return crypto.randomUUID();
}

/** Clave estable para rastrear el idOperacion de una acción. */
export function claveOperacionEstado(
  accion: 'desactivar' | 'reactivar',
  idVariable: number,
): string {
  return `${accion}:${idVariable}`;
}

/* ------------------------------------------------------------------ */
/* Diff para historial                                                 */
/* ------------------------------------------------------------------ */

export interface CambioDiff {
  ruta: string;
  antes: string;
  despues: string;
  tipo: 'cambio' | 'agregado' | 'eliminado';
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  idVariable: 'ID',
  clave: 'Clave',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  tipoDato: 'Tipo de dato',
  valor: 'Valor',
  esquema: 'Esquema',
  disponibleBackend: 'Backend',
  disponibleFrontend: 'Frontend',
  disponibleSql: 'SQL',
  disponibleIntegraciones: 'Integraciones',
  activo: 'Activo',
  version: 'Versión',
  fechaCreacion: 'Fecha de creación',
  fechaModificacion: 'Fecha de modificación',
  idOperacion: 'Operación',
  accion: 'Acción',
  idBitacora: 'Bitácora',
  idUsuario: 'Usuario',
};

function etiquetaRuta(ruta: string): string {
  if (!ruta) return 'General';
  return ruta
    .split('.')
    .map((segmento) => ETIQUETAS_CAMPO[segmento] ?? segmento)
    .join(' · ');
}

export function formatearValorDiff(valor: unknown): string {
  if (valor === undefined) return '—';
  if (valor === null) return 'null';
  if (typeof valor === 'string') return valor === '' ? '(vacío)' : valor;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return String(valor);
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

function mismoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function acumularDiff(a: unknown, b: unknown, ruta: string, salida: CambioDiff[]): void {
  if (mismoValor(a, b)) return;

  if (esObjetoPlano(a) && esObjetoPlano(b)) {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const clave of claves) {
      const rutaHija = ruta ? `${ruta}.${clave}` : clave;
      const antes = a[clave];
      const despues = b[clave];
      if (antes === undefined) {
        salida.push({
          ruta: etiquetaRuta(rutaHija),
          antes: '—',
          despues: formatearValorDiff(despues),
          tipo: 'agregado',
        });
      } else if (despues === undefined) {
        salida.push({
          ruta: etiquetaRuta(rutaHija),
          antes: formatearValorDiff(antes),
          despues: '—',
          tipo: 'eliminado',
        });
      } else {
        acumularDiff(antes, despues, rutaHija, salida);
      }
    }
    return;
  }

  salida.push({
    ruta: etiquetaRuta(ruta),
    antes: formatearValorDiff(a),
    despues: formatearValorDiff(b),
    tipo: 'cambio',
  });
}

export function calcularDiff(antes: unknown, despues: unknown): CambioDiff[] {
  const salida: CambioDiff[] = [];
  acumularDiff(antes, despues, '', salida);
  return salida;
}

const ETIQUETAS_ACCION: Record<string, string> = {
  crear: 'Creación',
  creacion: 'Creación',
  insertar: 'Creación',
  actualizar: 'Actualización',
  editar: 'Actualización',
  modificar: 'Actualización',
  desactivar: 'Desactivación',
  reactivar: 'Reactivación',
  activar: 'Reactivación',
  restaurar: 'Restauración',
  restaurarversion: 'Restauración',
};

export function etiquetaAccion(accion: string): string {
  const clave = sinAcentos(accion ?? '').toLowerCase().replace(/[\s_-]/g, '');
  return ETIQUETAS_ACCION[clave] ?? (accion || 'Cambio');
}

/** true cuando el destino del filtro de la lista está soportado. */
export function esDestino(valor: string): valor is DestinoConfig {
  return valor === 'backend' || valor === 'frontend' || valor === 'sql' || valor === 'integraciones';
}
