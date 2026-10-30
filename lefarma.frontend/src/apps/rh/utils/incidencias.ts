import type {
  IncidenciaCalculada,
  IncidenciaChecadoResponse,
  TipoSolicitudResponse,
} from '@/types/solicitudPersonal.types';

export const TIPOS_INCIDENCIA = [
  { value: 'TARDANZA_ENTRADA', label: 'Retardo entrada' },
  { value: 'TARDANZA_SALIDA', label: 'Retardo salida' },
  { value: 'OMISION_ENTRADA', label: 'Omisión entrada' },
  { value: 'OMISION_SALIDA', label: 'Omisión salida' },
  { value: 'SALIDA_ANTICIPADA', label: 'Salida anticipada' },
];

export const getTipoIncidenciaLabel = (value: string): string =>
  TIPOS_INCIDENCIA.find((t) => t.value === value)?.label ?? value;

export function periodoTexto(periodo?: string | null): string {
  switch (periodo?.toLowerCase()) {
    case 'quincena':
      return 'la quincena';
    case 'semana':
      return 'la semana';
    default:
      return 'el mes';
  }
}

export function textoAcumulacion(inc: IncidenciaCalculada): string {
  const cantidad = inc.cantidadAcumulada ?? 1;
  const posicion = inc.posicionAcumulacion ?? null;
  const periodo = inc.etiquetaPeriodo ? ` · ${inc.etiquetaPeriodo}` : '';

  if (inc.generaDescuento) {
    if (cantidad > 1 && posicion) {
      return `${posicion}.º acumulado${periodo}`;
    }
    return `Genera descuento${periodo}`;
  }
  if (cantidad > 1 && posicion) {
    return `${posicion}.º de ${cantidad}${periodo}`;
  }
  return '—';
}

/** Explicación corta y visible de la acumulación (no tooltip). */
export function textoAcumulacionDetalle(inc: IncidenciaCalculada): string | null {
  const cantidad = inc.cantidadAcumulada ?? 1;
  if (cantidad <= 1 || !inc.posicionAcumulacion) return null;
  return inc.generaDescuento
    ? `Completa los ${cantidad}: genera 1 descuento`
    : `Al llegar a ${cantidad} se genera 1 descuento`;
}

export function tooltipIncidencia(
  inc: IncidenciaCalculada,
  justificada?: boolean,
  enTramite?: boolean
): string {
  const cantidad = inc.cantidadAcumulada ?? 1;
  const posicion = inc.posicionAcumulacion ?? null;
  const periodo = inc.etiquetaPeriodo ? ` (${inc.etiquetaPeriodo})` : '';

  if (justificada || enTramite) {
    return `${inc.nombre}${periodo}: día ${justificada ? 'justificado' : 'en trámite'}, no cuenta para la acumulación de descuentos.`;
  }
  if (cantidad > 1 && posicion) {
    const detalle = inc.generaDescuento
      ? `Este día completa los ${cantidad} y genera 1 descuento.`
      : `Al llegar a ${cantidad} se genera 1 descuento.`;
    return `${inc.nombre}${periodo}: este es el ${posicion}.º de ${cantidad}. ${detalle}`;
  }
  return `${inc.nombre}${periodo}: cada día genera 1 descuento.`;
}

export interface ResumenDescuentoIncidencia {
  genera: boolean;
  texto: string;
  detalle: string | null;
}

/**
 * Resumen de descuento para una incidencia de un día, con la misma lógica
 * que la vista de detalle por empleado.
 */
export function resumenDescuentoIncidencia(
  incidencias: IncidenciaCalculada[],
  justificada?: boolean,
  enTramite?: boolean
): ResumenDescuentoIncidencia {
  if (justificada || enTramite) {
    return {
      genera: false,
      texto: justificada ? 'Justificado, no cuenta' : 'En trámite, no cuenta',
      detalle: null,
    };
  }

  const conDescuento = incidencias.find((i) => i.generaDescuento);
  if (conDescuento) {
    return {
      genera: true,
      texto: textoAcumulacion(conDescuento),
      detalle: textoAcumulacionDetalle(conDescuento),
    };
  }

  const informativa =
    incidencias.find((i) => i.generaDescuentoTeorico && !i.generaDescuento) ??
    incidencias.find((i) => i.posicionAcumulacion);
  if (informativa) {
    return {
      genera: false,
      texto: textoAcumulacion(informativa),
      detalle: textoAcumulacionDetalle(informativa),
    };
  }

  return { genera: false, texto: '—', detalle: null };
}

/* ------------------------------------------------------------------------- */
/* Preselección del tipo de solicitud al justificar una incidencia de checado */
/* ------------------------------------------------------------------------- */

const UMBRAL_RETARDO_MINUTOS = 20;

/** Prioridad con la que el motor de reglas calcula las incidencias del día. */
const PRIORIDAD_TIPO_INCIDENCIA: Record<string, number> = {
  SALIDA_ANTICIPADA: 50,
  OMISION_SALIDA: 40,
  OMISION_ENTRADA: 30,
  TARDANZA_ENTRADA: 20,
};

type IncidenciaParaPreseleccion = Pick<
  IncidenciaChecadoResponse,
  | 'incidenciasCalculadas'
  | 'incidenciaEntrada'
  | 'incidenciaSalida'
  | 'msgError'
  | 'entrada'
  | 'salida'
  | 'entro'
  | 'salio'
>;

export interface TipoSolicitudIncidenciaPreseleccion {
  categoria: string;
  idTipoSolicitud: number;
  clave: string;
}

interface ClaveTipoSolicitud {
  clave: string;
  categoria: string;
}

const normalizarTexto = (valor: string) =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Minutos desde medianoche de un TimeSpan serializado ("HH:mm:ss"). */
function horaEnMinutos(valor?: string | null): number | null {
  if (!valor) return null;
  const [horas, minutos, segundos] = valor.split(':');
  const h = Number(horas);
  const m = Number(minutos);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const s = Number(segundos ?? 0);
  return h * 60 + m + (Number.isFinite(s) ? s / 60 : 0);
}

function minutosEntre(fin?: string | null, inicio?: string | null): number | null {
  const valorFin = horaEnMinutos(fin);
  const valorInicio = horaEnMinutos(inicio);
  if (valorFin == null || valorInicio == null) return null;
  return valorFin - valorInicio;
}

/**
 * Un retardo de entrada es "mayor a 20 min" cuando supera el umbral, con la
 * misma truncación que usa el backend ((int)TotalMinutes). Si no hay horas
 * para calcularlo, se usa el nombre de la regla como respaldo.
 */
function esRetardoMayor(
  incidenciaCalculada: IncidenciaCalculada,
  incidencia: IncidenciaParaPreseleccion
): boolean {
  const minutos = minutosEntre(incidencia.entro, incidencia.entrada);
  if (minutos != null && minutos > 0) {
    return Math.trunc(minutos) > UMBRAL_RETARDO_MINUTOS;
  }
  return normalizarTexto(incidenciaCalculada.nombre).includes('mayor');
}

function resolverClaveTipoSolicitud(
  incidenciaCalculada: IncidenciaCalculada,
  incidencia: IncidenciaParaPreseleccion
): ClaveTipoSolicitud | null {
  switch (incidenciaCalculada.tipoIncidencia) {
    case 'TARDANZA_ENTRADA':
      return esRetardoMayor(incidenciaCalculada, incidencia)
        ? { clave: 'RETARDO_MAYOR_20', categoria: '1' }
        : { clave: 'RETARDO_MENOR_20', categoria: '1' };
    case 'OMISION_ENTRADA':
      return { clave: 'OMISION_CHECADO_ENTRADA', categoria: '1' };
    case 'OMISION_SALIDA':
      return { clave: 'OMISION_CHECADO_SALIDA', categoria: '1' };
    case 'SALIDA_ANTICIPADA':
      return { clave: 'SALIDA_TEMPRANA_SIN_REPOSICION', categoria: '2' };
    default:
      // TARDANZA_SALIDA no tiene tipo de solicitud equivalente en el catálogo.
      return null;
  }
}

function coincidePorNombre(clave: string, nombre: string): boolean {
  const n = normalizarTexto(nombre);
  switch (clave) {
    case 'RETARDO_MENOR_20':
      return n.includes('retard') && (n.includes('menor') || n.includes('menos de'));
    case 'RETARDO_MAYOR_20':
      return n.includes('retard') && (n.includes('mayor') || n.includes('mas de'));
    case 'OMISION_CHECADO_ENTRADA':
      return n.includes('omisi') && n.includes('entrada');
    case 'OMISION_CHECADO_SALIDA':
      return n.includes('omisi') && n.includes('salida');
    case 'SALIDA_TEMPRANA_SIN_REPOSICION':
      return n.includes('salida temprana') && !n.includes('con reposici');
    default:
      return false;
  }
}

function buscarTipoSolicitud(
  tipos: TipoSolicitudResponse[],
  { clave, categoria }: ClaveTipoSolicitud
): TipoSolicitudResponse | null {
  const activos = tipos.filter((t) => t.activo !== false);
  const porClave = activos.find((t) => t.clave?.toUpperCase() === clave);
  if (porClave) return porClave;

  return (
    activos
      .filter((t) => t.categoria === categoria)
      .find((t) => coincidePorNombre(clave, t.nombre)) ?? null
  );
}

function prioridadCandidata(
  incidenciaCalculada: IncidenciaCalculada,
  incidencia: IncidenciaParaPreseleccion
): number {
  if (incidenciaCalculada.tipoIncidencia === 'TARDANZA_ENTRADA') {
    return esRetardoMayor(incidenciaCalculada, incidencia) ? 21 : 11;
  }
  return PRIORIDAD_TIPO_INCIDENCIA[incidenciaCalculada.tipoIncidencia] ?? 0;
}

/**
 * Respaldos con las columnas legacy de la vista de checado, que ya no se
 * llenan. Solo se usan si la API no trae incidencias calculadas.
 */
function candidatasLegacy(incidencia: IncidenciaParaPreseleccion): IncidenciaCalculada[] {
  const entrada = normalizarTexto(incidencia.incidenciaEntrada ?? '');
  const salida = normalizarTexto(incidencia.incidenciaSalida ?? '');
  const msgError = normalizarTexto(incidencia.msgError ?? '');
  const resultado: IncidenciaCalculada[] = [];

  const crear = (tipoIncidencia: string, nombre: string): IncidenciaCalculada => ({
    tipoIncidencia,
    nombre,
    generaDescuento: false,
  });

  if (entrada.includes('retard')) {
    resultado.push(crear('TARDANZA_ENTRADA', incidencia.incidenciaEntrada ?? ''));
  }
  if (salida.includes('retard')) {
    resultado.push(crear('TARDANZA_SALIDA', incidencia.incidenciaSalida ?? ''));
  }
  if (salida.includes('anticip') || salida.includes('temprana')) {
    resultado.push(crear('SALIDA_ANTICIPADA', incidencia.incidenciaSalida ?? ''));
  }

  const esOmision =
    msgError.includes('omisi') || entrada.includes('omisi') || salida.includes('omisi');
  if (esOmision) {
    const nombre = incidencia.msgError ?? 'Omisión de checado';
    const tieneEntrada = incidencia.entro != null;
    const tieneSalida = incidencia.salio != null;

    if (!tieneSalida) resultado.push(crear('OMISION_SALIDA', nombre));
    if (!tieneEntrada) resultado.push(crear('OMISION_ENTRADA', nombre));
    if (tieneEntrada && tieneSalida) resultado.push(crear('OMISION_ENTRADA', nombre));
  }

  return resultado;
}

/**
 * Resuelve qué tipo de solicitud corresponde a una incidencia de checado.
 *
 * Usa las incidencias calculadas por el motor (fuente real) y elige la de
 * mayor prioridad configurada cuando el día tiene varias. La resolución del
 * tipo es por clave del catálogo, con respaldo por nombre.
 */
export function resolverTipoSolicitudIncidencia(
  incidencia: IncidenciaParaPreseleccion,
  tipos: TipoSolicitudResponse[]
): TipoSolicitudIncidenciaPreseleccion | null {
  const calculadas = incidencia.incidenciasCalculadas ?? [];
  const candidatas = calculadas.length > 0 ? calculadas : candidatasLegacy(incidencia);

  const ordenadas = [...candidatas].sort(
    (a, b) => prioridadCandidata(b, incidencia) - prioridadCandidata(a, incidencia)
  );

  for (const candidata of ordenadas) {
    const clave = resolverClaveTipoSolicitud(candidata, incidencia);
    if (!clave) continue;

    const tipo = buscarTipoSolicitud(tipos, clave);
    if (tipo) {
      return {
        categoria: tipo.categoria,
        idTipoSolicitud: tipo.idTipoSolicitud,
        clave: tipo.clave,
      };
    }
  }

  return null;
}
