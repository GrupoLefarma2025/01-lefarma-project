import type { IncidenciaCalculada } from '@/types/solicitudPersonal.types';

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
