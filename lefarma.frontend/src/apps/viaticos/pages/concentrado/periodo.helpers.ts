import type { SolicitudBandeja } from '../../types/aprobaciones.types';

/**
 * Filtro de fechas del concentrado de viáticos. Los rangos relativos se
 * calculan sobre la fecha local de hoy; el personalizado usa las fechas que
 * captura la persona y no se aplica hasta tener ambas.
 */
export type FiltroFecha =
  | 'todas'
  | 'hoy'
  | 'semana'
  | 'quincena'
  | 'quincena-pasada'
  | 'mes'
  | 'personalizado';

/** Campo contra el que se compara el rango elegido. */
export type CampoFecha = 'creacion' | 'modificacion' | 'viaje';

export const ETIQUETA_FILTRO_FECHA: Record<FiltroFecha, string> = {
  todas: 'Todas',
  hoy: 'Hoy',
  semana: 'Esta semana',
  quincena: 'Esta quincena',
  'quincena-pasada': 'Quincena pasada',
  mes: 'Este mes',
  personalizado: 'Por rango de fechas',
};

export const ETIQUETA_CAMPO_FECHA: Record<CampoFecha, string> = {
  modificacion: 'Última actualización',
  creacion: 'Fecha de creación',
  viaje: 'Fecha de viaje',
};

export interface RangoFechas {
  inicio: string;
  fin: string;
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** Fecha ISO (aaaa-mm-dd) -> dd/mm/aaaa para mostrarla. */
export function fechaCorta(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
}

/**
 * Rango del filtro en fechas ISO, calculado sobre la fecha local de
 * `referencia`. La semana corre de lunes a domingo y la quincena de
 * 1–15 / 16–fin de mes, igual que en /viaticos/mis-viajes.
 * Devuelve `null` cuando el rango personalizado aun no tiene ambas fechas.
 */
export function rangoDeFiltroFecha(
  filtro: FiltroFecha,
  referencia: Date,
  desde = '',
  hasta = '',
): RangoFechas | null {
  const ref = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  const y = ref.getFullYear();
  const m = ref.getMonth();

  // "Todas" no recorta por fecha: es el default del concentrado para que se
  // vean todas las enviadas, sin importar cuándo se crearon o se enviaron.
  if (filtro === 'todas') {
    return null;
  }
  if (filtro === 'personalizado') {
    return desde !== '' && hasta !== '' ? { inicio: desde, fin: hasta } : null;
  }
  if (filtro === 'hoy') {
    const dia = isoFecha(ref);
    return { inicio: dia, fin: dia };
  }
  if (filtro === 'semana') {
    // getDay(): 0 = domingo; la semana laboral empieza en lunes.
    const desplazamiento = ref.getDay() === 0 ? 6 : ref.getDay() - 1;
    const inicio = new Date(ref);
    inicio.setDate(ref.getDate() - desplazamiento);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    return { inicio: isoFecha(inicio), fin: isoFecha(fin) };
  }
  if (filtro === 'mes') {
    const ultimo = new Date(y, m + 1, 0).getDate();
    return { inicio: `${y}-${dosDigitos(m + 1)}-01`, fin: `${y}-${dosDigitos(m + 1)}-${dosDigitos(ultimo)}` };
  }
  if (filtro === 'quincena') {
    const prefijo = `${y}-${dosDigitos(m + 1)}`;
    return ref.getDate() <= 15
      ? { inicio: `${prefijo}-01`, fin: `${prefijo}-15` }
      : { inicio: `${prefijo}-16`, fin: `${prefijo}-${dosDigitos(new Date(y, m + 1, 0).getDate())}` };
  }
  // Quincena pasada: los 16–fin del mes anterior o los 1–15 del mes en curso.
  if (ref.getDate() <= 15) {
    const mesAnterior = new Date(y, m - 1, 1);
    const ay = mesAnterior.getFullYear();
    const am = mesAnterior.getMonth();
    const prefijo = `${ay}-${dosDigitos(am + 1)}`;
    const ultimo = new Date(ay, am + 1, 0).getDate();
    return { inicio: `${prefijo}-16`, fin: `${prefijo}-${dosDigitos(ultimo)}` };
  }
  const prefijo = `${y}-${dosDigitos(m + 1)}`;
  return { inicio: `${prefijo}-01`, fin: `${prefijo}-15` };
}

/** Día ISO de un valor del snapshot; `null` si no es una fecha aaaa-mm-dd. */
function diaIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const dia = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
}

/**
 * ¿La solicitud cae en el rango por fecha de creación? Compara solo el día:
 * la hora de creación no la elige el usuario.
 */
export function creacionEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  return diaEnRango(fila.fecha_creacion, rango);
}

/**
 * ¿La solicitud se tocó dentro del rango? Usa la última modificación, que es
 * lo que cambia al enviarla: una solicitud creada ayer y enviada hoy aparece
 * hoy. Sin el dato cae a la fecha de creación.
 */
export function modificacionEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  return diaEnRango(fila.fecha_modificacion ?? fila.fecha_creacion, rango);
}

/** Día ISO dentro del rango; sin rango no filtra. */
export function diaEnRango(valor: string | null | undefined, rango: RangoFechas | null): boolean {
  if (!rango) return true;
  const dia = diaIso(valor);
  return dia !== null && dia >= rango.inicio && dia <= rango.fin;
}

/**
 * ¿El viaje toca el rango? Se compara contra las fechas REALES del snapshot
 * (`fecha_salida`/`fecha_regreso`), no contra el texto ya formateado de
 * `fecha`. Basta con que el viaje pase por alguna fecha del rango: un viaje del
 * 18 al 22 cuenta como "hoy" si hoy es 20, y como "esta semana" si la semana
 * contiene alguno de sus días. Un viaje sin fechas legibles no se puede afirmar
 * que caiga en el rango y queda fuera.
 */
export function viajeEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  if (!rango) return true;
  const salida = diaIso(fila.fecha_salida) ?? diaIso(fila.fecha_regreso);
  const regreso = diaIso(fila.fecha_regreso) ?? diaIso(fila.fecha_salida);
  if (salida === null || regreso === null) return false;
  return salida <= rango.fin && regreso >= rango.inicio;
}
