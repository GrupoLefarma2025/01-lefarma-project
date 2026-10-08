// Contrato de la bandeja de autorizaciones del admin de viaticos
// (backend: lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/AprobacionDtos.cs).

import type { SolicitudEvento, SolicitudOpcion } from './solicitud.types';

/**
 * Una fila de `GET /api/viaticos/solicitudes`.
 * `destino` llega null cuando el snapshot `datos_json` de la solicitud no lo
 * tiene; `nombre_solicitante` llega vacio si el directorio no pudo resolverlo.
 *
 * El servidor proyecta ademas el encabezado del FOR-008 (`origen` y el rango
 * `fecha` ya compuesto) y el desglose por concepto. Son OPCIONALES porque el
 * listado puede no traerlos y los fixtures de la bandeja no los declaran;
 * `null` y `undefined` se imprimen como "—" en el concentrado, nunca "$0.00".
 * `total` es nullable: `null` significa "no se conoce" (el backend no encontro
 * `$.total` en el snapshot) y la bandeja lo imprime como "—", nunca como
 * "$0.00".
 */
export interface SolicitudBandeja {
  id_solicitud: number;
  id_usuario_solicitante: number;
  nombre_solicitante: string;
  periodo: string;
  gerencia: string;
  destino: string | null;
  estado: string;
  /** Origen de la ruta (`$.origen`); `null`/`undefined` imprime "—". */
  origen?: string | null;
  /** Rango del viaje: "05/10/2026 AL 09/10/2026". */
  fecha?: string | null;
  autobus?: number | null;
  avion?: number | null;
  gasolina?: number | null;
  casetas?: number | null;
  vehiculo_propio?: number | null;
  hospedaje?: number | null;
  comida?: number | null;
  taxi?: number | null;
  total: number | null;
  fecha_creacion: string;
}

/**
 * Filtros del GET de la bandeja. Un valor vacio o `undefined` se omite de la
 * query string: el backend trata `null` como "sin filtro".
 */
export interface FiltrosBandeja {
  periodo?: string;
  estado?: string;
  gerencia?: string;
}

/**
 * Estados por los que pasa una solicitud. Solo `enviada` es autorizable: el
 * backend responde 409 en cualquier otro (ver AprobacionesController).
 */
export const ESTADO_ENVIADA = 'enviada';

export const ESTADOS_SOLICITUD = [
  'borrador',
  'enviada',
  'autorizada',
  'autorizada_con_ajustes',
  'rechazada',
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/** Etiqueta legible por estado; lo desconocido se devuelve tal cual. */
const ETIQUETA_POR_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  autorizada: 'Autorizada',
  autorizada_con_ajustes: 'Autorizada con ajustes',
  rechazada: 'Rechazada',
};

export function estadoTexto(estado: string): string {
  return ETIQUETA_POR_ESTADO[estado] ?? estado;
}

/** Variante de badge por estado; lo desconocido se queda neutral. */
export const VARIANTE_POR_ESTADO: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    borrador: 'secondary',
    enviada: 'default',
    autorizada: 'outline',
    autorizada_con_ajustes: 'outline',
    rechazada: 'destructive',
  };

/** Body de POST /api/viaticos/solicitudes/{id}/ajustes. `motivo` es obligatorio. */
export interface AjusteSolicitudPayload {
  id_opcion: number;
  campo: string;
  valor_anterior: string;
  valor_nuevo: string;
  motivo: string;
}

/** Permiso que exige TODA accion del editor de ajustes. */
export const PERMISO_AJUSTAR = 'viaticos.ajustar';

/**
 * Estados en los que el backend acepta un ajuste: AprobacionesController
 * responde 409 en cualquier otro. El editor replica la regla para no ofrecer
 * un boton que solo va a fallar.
 */
export const ESTADOS_AJUSTABLES: readonly string[] = [
  'autorizada',
  'autorizada_con_ajustes',
];

export function esAjustable(estado: string): boolean {
  return ESTADOS_AJUSTABLES.includes(estado);
}

// -------- valores de `campo` que escribe el editor --------

export const CAMPO_VUELO_ELEGIDO = 'vuelo_elegido';
export const CAMPO_PRECIO_PARTIDA = 'precio_partida';
export const CAMPO_PARTIDA_AGREGADA = 'partida_agregada';
export const CAMPO_PARTIDA_QUITADA = 'partida_quitada';

const ETIQUETA_POR_CAMPO: Record<string, string> = {
  [CAMPO_VUELO_ELEGIDO]: 'Vuelo elegido',
  [CAMPO_PRECIO_PARTIDA]: 'Precio de la partida',
  [CAMPO_PARTIDA_AGREGADA]: 'Partida agregada',
  [CAMPO_PARTIDA_QUITADA]: 'Partida quitada',
};

/** Etiqueta legible de `campo`; lo desconocido se devuelve tal cual. */
export function campoTexto(campo: string): string {
  return ETIQUETA_POR_CAMPO[campo] ?? campo;
}

/**
 * Sentinelas de `valor_anterior` / `valor_nuevo`. Son texto y no `null` a
 * proposito: el backend guarda columnas string y la linea de tiempo tiene que
 * poder distinguir "no habia nada" de "el motivo quedo vacio".
 */
export const SIN_PRECIO = '(sin precio de proveedor)';
export const SIN_VUELO_ELEGIDO = '(sin vuelo elegido)';
export const PARTIDA_QUITADA = '(se quitó)';

/** Importe ya formateado en la moneda dada. */
export function importeFormateado(valor: number, moneda: string | null): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda ?? 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Importe en es-MX, o `SIN_PRECIO` cuando la opcion es un estimado. */
export function precioTexto(opcion: SolicitudOpcion): string {
  return opcion.precio === null
    ? SIN_PRECIO
    : importeFormateado(opcion.precio, opcion.moneda);
}

/** "linea · $1,200.00": identifica la partida dentro del rastro. */
export function describirPartida(opcion: SolicitudOpcion): string {
  return `${opcion.linea} · ${precioTexto(opcion)}`;
}

/**
 * Numero como texto estable para el rastro: sin notacion cientifica y con dos
 * decimales cuando no es entero, para que `valor_anterior` y `valor_nuevo` se
 * puedan comparar caracter por caracter.
 */
export function importeTexto(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
}

/**
 * Lee un importe escrito por el admin. Devuelve `null` —no 0 ni NaN— cuando el
 * texto no es un numero, para que un campo vacio no se guarde como un precio
 * de cero.
 */
export function analizarImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/[$\s,]/g, '');
  if (limpio === '') return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

// -------- construccion del payload --------

export interface DatosAjusteVuelo {
  /** Opcion que el admin quiere dejar como vuelo elegido. */
  alternativa: SolicitudOpcion;
  /** Vuelo que el solicitante habia elegido; null si la solicitud no tiene. */
  elegidaActual: SolicitudOpcion | null;
}

export interface DatosAjustePrecio {
  partida: SolicitudOpcion;
  /** Importe ya capturado del input del admin. */
  nuevoImporte: string;
}

export interface DatosAjustePartidaNueva {
  concepto: string;
  monto: string;
}

export interface DatosAjusteQuitar {
  partida: SolicitudOpcion;
}

/** Las cuatro acciones del editor, discriminadas por `tipo`. */
export type AccionAjuste =
  | { tipo: 'vuelo'; datos: DatosAjusteVuelo }
  | { tipo: 'precio'; datos: DatosAjustePrecio }
  | { tipo: 'agregar'; datos: DatosAjustePartidaNueva }
  | { tipo: 'quitar'; datos: DatosAjusteQuitar };

/**
 * Traduce una accion al body de POST /ajustes, o devuelve `null` si todavia no
 * se puede confirmar. `null` es la unica fuente de verdad del boton Guardar:
 * un motivo vacio, un concepto sin monto o un vuelo identico al actual dejan la
 * accion sin payload, y sin payload no hay forma de pulsar Guardar.
 *
 * Regla que no se negocia: `valor_anterior` describe SIEMPRE lo que habia y
 * `valor_nuevo` lo que queda. Agregar una partida es el unico caso donde no
 * habia valor anterior, y por eso manda `''` explicito y no un texto inventado.
 */
export function construirPayloadAjuste(
  accion: AccionAjuste,
  motivo: string,
): AjusteSolicitudPayload | null {
  const motivoLimpio = motivo.trim();
  if (motivoLimpio === '') return null;

  switch (accion.tipo) {
    case 'vuelo': {
      const { alternativa, elegidaActual } = accion.datos;
      const valorAnterior = elegidaActual
        ? describirPartida(elegidaActual)
        : SIN_VUELO_ELEGIDO;
      const valorNuevo = describirPartida(alternativa);
      // Cambiar por algo identico no es un cambio: sin valor distinto no hay
      // rastro util y no se registra nada.
      if (valorAnterior === valorNuevo) return null;
      return {
        id_opcion: alternativa.id_opcion,
        campo: CAMPO_VUELO_ELEGIDO,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        motivo: motivoLimpio,
      };
    }
    case 'precio': {
      const { partida, nuevoImporte } = accion.datos;
      const importe = analizarImporte(nuevoImporte);
      if (importe === null || importe < 0) return null;
      const valorAnterior =
        partida.precio === null ? SIN_PRECIO : importeTexto(partida.precio);
      const valorNuevo = importeTexto(importe);
      if (valorAnterior === valorNuevo) return null;
      return {
        id_opcion: partida.id_opcion,
        campo: CAMPO_PRECIO_PARTIDA,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        motivo: motivoLimpio,
      };
    }
    case 'agregar': {
      const { concepto, monto } = accion.datos;
      const conceptoLimpio = concepto.trim();
      const importe = analizarImporte(monto);
      if (conceptoLimpio === '' || importe === null || importe <= 0) return null;
      return {
        // id_opcion 0 lo persiste el backend como NULL: la partida no
        // corresponde a ninguna opcion cotizada, la invento el admin.
        id_opcion: 0,
        campo: CAMPO_PARTIDA_AGREGADA,
        valor_anterior: '',
        valor_nuevo: `${conceptoLimpio} · ${importeFormateado(importe, 'MXN')}`,
        motivo: motivoLimpio,
      };
    }
    case 'quitar': {
      const { partida } = accion.datos;
      return {
        id_opcion: partida.id_opcion,
        campo: CAMPO_PARTIDA_QUITADA,
        valor_anterior: describirPartida(partida),
        valor_nuevo: PARTIDA_QUITADA,
        motivo: motivoLimpio,
      };
    }
  }
}

// -------- linea de tiempo --------

export const EVENTO_AJUSTE_APLICADO = 'ajuste_aplicado';

/** Un ajuste ya normalizado para pintar en la linea de tiempo. */
export interface AjusteLineaTiempo {
  id_evento: number;
  id_usuario: number;
  fecha_creacion: string;
  /**
   * false cuando el backend aun no expone `payload`: se sabe que hubo un
   * ajuste y quien lo hizo, pero no que cambio. Se muestra como tal en vez de
   * inventar un valor.
   */
  hayDetalle: boolean;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  motivo: string;
}

/**
 * Normaliza los eventos de tipo `ajuste_aplicado` a filas de linea de tiempo.
 * Los demas tipos (creada, enviada, autorizada, rechazada) no son ajustes y se
 * descartan. Un payload ausente o con campos vacios degrada a `hayDetalle:
 * false` en lugar de romper el render.
 */
export function lineaTiempoAjustes(eventos: SolicitudEvento[]): AjusteLineaTiempo[] {
  return eventos
    .filter((evento) => evento.tipo === EVENTO_AJUSTE_APLICADO)
    .map((evento) => {
      const payload = evento.payload ?? null;
      const hayDetalle =
        payload !== null &&
        typeof payload.campo === 'string' &&
        payload.campo.trim() !== '' &&
        typeof payload.motivo === 'string' &&
        payload.motivo.trim() !== '';
      return {
        id_evento: evento.id_evento,
        id_usuario: evento.id_usuario,
        fecha_creacion: evento.fecha_creacion,
        hayDetalle,
        campo: hayDetalle ? (payload!.campo as string) : '',
        valorAnterior: hayDetalle ? (payload!.valor_anterior ?? '') : '',
        valorNuevo: hayDetalle ? (payload!.valor_nuevo ?? '') : '',
        motivo: hayDetalle ? (payload!.motivo as string) : '',
      };
    })
    .reverse();
}