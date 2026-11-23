import type { SolicitudBandeja } from '../../types/aprobaciones.types';

export type FiltroFecha =
  | 'todas'
  | 'hoy'
  | 'semana'
  | 'quincena'
  | 'quincena-pasada'
  | 'mes'
  | 'personalizado';

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

export function fechaCorta(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
}

export function rangoDeFiltroFecha(
  filtro: FiltroFecha,
  referencia: Date,
  desde = '',
  hasta = '',
): RangoFechas | null {
  const ref = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  const y = ref.getFullYear();
  const m = ref.getMonth();

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

function diaIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const dia = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
}

export function creacionEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  return diaEnRango(fila.fecha_creacion, rango);
}

export function modificacionEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  return diaEnRango(fila.fecha_modificacion ?? fila.fecha_creacion, rango);
}

export function diaEnRango(valor: string | null | undefined, rango: RangoFechas | null): boolean {
  if (!rango) return true;
  const dia = diaIso(valor);
  return dia !== null && dia >= rango.inicio && dia <= rango.fin;
}

export function viajeEnRango(fila: SolicitudBandeja, rango: RangoFechas | null): boolean {
  if (!rango) return true;
  const salida = diaIso(fila.fecha_salida) ?? diaIso(fila.fecha_regreso);
  const regreso = diaIso(fila.fecha_regreso) ?? diaIso(fila.fecha_salida);
  if (salida === null || regreso === null) return false;
  return salida <= rango.fin && regreso >= rango.inicio;
}
