import type { SolicitudEvento, SolicitudOpcion } from './solicitud.types';

export interface SolicitudBandeja {
  id_solicitud: number;
  folio?: string | null;
  id_usuario_solicitante: number;
  nombre_solicitante: string;
  periodo: string;
  gerencia: string;
  destino: string | null;
  estado: string;
  origen?: string | null;
  fecha?: string | null;
  fecha_salida?: string | null;
  fecha_regreso?: string | null;
  autobus?: number | null;
  avion?: number | null;
  gasolina?: number | null;
  casetas?: number | null;
  vehiculo_propio?: number | null;
  hospedaje?: number | null;
  comida?: number | null;
  taxi?: number | null;
  total: number | null;
  total_cotizado?: number | null;
  total_estimado?: number | null;
  precios_pendientes?: number;
  tipo_transporte?: TipoTransporteConcentrado;
  persona_nombre?: string | null;
  motivo?: string | null;
  puesto?: string | null;
  fecha_nacimiento?: string | null;
  trayectos?: TrayectoBandeja[];
  fecha_creacion: string;
  fecha_modificacion?: string | null;
  recalculada?: boolean;
}

export type TipoTransporteConcentrado =
  | 'aereo'
  | 'autobus'
  | 'propio'
  | 'solicitado'
  | 'sin-clasificar';

export interface TrayectoBandeja {
  fecha?: string | null;
  hora?: string | null;
  origen?: string | null;
  destino?: string | null;
}

export interface FiltrosBandeja {
  periodo?: string;
  estado?: string;
  gerencia?: string;
}

export const ESTADO_ENVIADA = 'enviada';

export const ESTADOS_SOLICITUD = [
  'borrador',
  'enviada',
  'autorizada',
  'autorizada_con_ajustes',
  'rechazada',
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

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

export const VARIANTE_POR_ESTADO: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    borrador: 'secondary',
    enviada: 'default',
    autorizada: 'outline',
    autorizada_con_ajustes: 'outline',
    rechazada: 'destructive',
  };

export interface AjusteSolicitudPayload {
  id_opcion: number;
  campo: string;
  valor_anterior: string;
  valor_nuevo: string;
  motivo: string;
}

export const PERMISO_AJUSTAR = 'viaticos.ajustar';

export const ESTADOS_AJUSTABLES: readonly string[] = [
  'autorizada',
  'autorizada_con_ajustes',
];

export function esAjustable(estado: string): boolean {
  return ESTADOS_AJUSTABLES.includes(estado);
}

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

export function campoTexto(campo: string): string {
  return ETIQUETA_POR_CAMPO[campo] ?? campo;
}

export const SIN_PRECIO = '(sin precio de proveedor)';
export const SIN_VUELO_ELEGIDO = '(sin vuelo elegido)';
export const PARTIDA_QUITADA = '(se quitó)';

export function importeFormateado(valor: number, moneda: string | null): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda ?? 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function tipoPrecioOpcion(
  opcion: Pick<SolicitudOpcion, 'datos' | 'fuente'>,
): string {
  const guardado = opcion.datos?.tipo_precio;
  if (typeof guardado === 'string' && guardado.trim() !== '') {
    return guardado.trim().toLowerCase();
  }
  return /estimad/i.test(opcion.fuente ?? '') ? 'estimado' : 'cotizado';
}

export function esOpcionCotizada(
  opcion: Pick<SolicitudOpcion, 'datos' | 'fuente'>,
): boolean {
  return tipoPrecioOpcion(opcion) === 'cotizado';
}

export function precioReferenciaOpcion(
  opcion: Pick<SolicitudOpcion, 'precio' | 'datos' | 'fuente'>,
): number | null {
  const guardado = opcion.datos?.precio_estimado;
  if (typeof guardado === 'number' && Number.isFinite(guardado)) return guardado;
  if (!esOpcionCotizada(opcion) && typeof opcion.precio === 'number' && Number.isFinite(opcion.precio)) {
    return opcion.precio;
  }
  return null;
}

export function esVueloPendientePrecio(
  opcion: Pick<SolicitudOpcion, 'tipo' | 'fue_elegida' | 'precio' | 'datos' | 'fuente'>,
): boolean {
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  if (!opcion.fue_elegida || (tipo !== 'vuelo' && tipo !== 'avion')) return false;
  return !esOpcionCotizada(opcion) || opcion.precio === null;
}

export function precioTexto(opcion: SolicitudOpcion): string {
  if (esOpcionCotizada(opcion) && opcion.precio !== null) {
    return importeFormateado(opcion.precio, opcion.moneda);
  }
  const referencia = precioReferenciaOpcion(opcion);
  return referencia === null
    ? SIN_PRECIO
    : `Referencia ${importeFormateado(referencia, opcion.moneda)} (estimado)`;
}

export function describirPartida(opcion: SolicitudOpcion): string {
  return `${opcion.linea} · ${precioTexto(opcion)}`;
}

export function importeTexto(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
}

export function analizarImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/[$\s,]/g, '');
  if (limpio === '') return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

export interface DatosAjusteVuelo {
  alternativa: SolicitudOpcion;
  elegidaActual: SolicitudOpcion | null;
}

export interface DatosAjustePrecio {
  partida: SolicitudOpcion;
  nuevoImporte: string;
}

export interface DatosAjustePartidaNueva {
  concepto: string;
  monto: string;
}

export interface DatosAjusteQuitar {
  partida: SolicitudOpcion;
}

export type AccionAjuste =
  | { tipo: 'vuelo'; datos: DatosAjusteVuelo }
  | { tipo: 'precio'; datos: DatosAjustePrecio }
  | { tipo: 'agregar'; datos: DatosAjustePartidaNueva }
  | { tipo: 'quitar'; datos: DatosAjusteQuitar };

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

export const EVENTO_AJUSTE_APLICADO = 'ajuste_aplicado';

export interface AjusteLineaTiempo {
  id_evento: number;
  id_usuario: number;
  fecha_creacion: string;
  hayDetalle: boolean;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  motivo: string;
}

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