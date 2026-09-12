import type { Ruta, RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';

export const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

export function diaSemana(fecha: string): string {
  const dt = new Date(`${fecha}T00:00:00`);
  return DIAS[dt.getDay()];
}

export function agruparPorDia(visitas: RutaVisita[]): { fecha: string; visitas: RutaVisita[] }[] {
  const grupos = new Map<string, RutaVisita[]>();
  for (const visita of [...visitas].sort((a, b) => a.fechaVisita.localeCompare(b.fechaVisita) || a.orden - b.orden)) {
    const lista = grupos.get(visita.fechaVisita) ?? [];
    lista.push(visita);
    grupos.set(visita.fechaVisita, lista);
  }
  return [...grupos.entries()].map(([fecha, visitasDia]) => ({ fecha, visitas: visitasDia }));
}

export function semanaIso(fecha: string): number {
  const dt = new Date(`${fecha}T00:00:00`);
  const target = new Date(dt.valueOf());
  const dayNr = (dt.getDay() + 6) % 7; // lunes = 0
  target.setDate(target.getDate() - dayNr + 3); // jueves de la semana ISO
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
}

export function contarViajesForaneos(visitas: RutaVisita[]): number {
  const vistos = new Set<string>();
  const foraneas: { fecha: string; idRegion: number | null }[] = [];
  for (const v of visitas) {
    if (!v.esForanea) continue;
    const clave = `${v.fechaVisita}|${v.idRegion ?? ''}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    foraneas.push({ fecha: v.fechaVisita, idRegion: v.idRegion });
  }
  foraneas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.idRegion ?? 0) - (b.idRegion ?? 0));
  if (foraneas.length === 0) return 0;

  const dayNumber = (f: string) => Math.floor(new Date(`${f}T00:00:00`).getTime() / 86400000);
  let viajes = 1;
  for (let i = 1; i < foraneas.length; i++) {
    const consecutivo = dayNumber(foraneas[i].fecha) === dayNumber(foraneas[i - 1].fecha) + 1;
    const mismaRegion = foraneas[i].idRegion === foraneas[i - 1].idRegion;
    if (!consecutivo || !mismaRegion) viajes++;
  }
  return viajes;
}

export type NivelCarga = 'normal' | 'lleno' | 'excedido';

// 3/3 es válido (lleno); 4/3 es problema (excedido). Nunca "excedido" por lleno.
export function nivelCarga(actual: number, maximo: number): NivelCarga {
  if (actual > maximo) return 'excedido';
  if (actual === maximo) return 'lleno';
  return 'normal';
}

// Para el día calendario, la semántica de negocio es distinta: 3/3 = lleno es el
// objetivo del día (verde); un día con visitas pero incompleto se marca rojo para
// que se note la capacidad desaprovechada; vacío = neutro.
export type EstadoDia = 'vacio' | 'incompleto' | 'lleno' | 'excedido';

export function estadoDelDia(actual: number, maximo: number): EstadoDia {
  if (actual === 0) return 'vacio';
  if (actual > maximo) return 'excedido';
  if (actual === maximo) return 'lleno';
  return 'incompleto';
}

export const CLASES_ESTADO_DIA: Record<EstadoDia, string> = {
  vacio: 'bg-muted/60 text-muted-foreground',
  incompleto: 'bg-red-50 text-red-700',
  lleno: 'bg-emerald-50 text-emerald-700',
  excedido: 'bg-red-100 text-red-800',
};

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return `${dia} ${MESES_CORTOS[(mes ?? 1) - 1]}`;
}

export function rangoSemanal(fechas: string[]): string {
  if (fechas.length === 0) return '';
  const ordenadas = [...fechas].sort();
  const primera = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  return primera === ultima ? fechaCorta(primera) : `${fechaCorta(primera)} – ${fechaCorta(ultima)}`;
}

export type EstadoVersion = 'Draft' | 'Confirmada' | 'Cancelada' | 'Archivada';

export function estadoDeVersion(rutasDeVersion: Ruta[]): EstadoVersion {
  if (rutasDeVersion.some((r) => r.estado === 'Draft')) return 'Draft';
  if (rutasDeVersion.some((r) => r.estado === 'Confirmada')) return 'Confirmada';
  if (rutasDeVersion.some((r) => r.estado === 'Cancelada')) return 'Cancelada';
  return 'Archivada';
}

export interface DragItem {
  tipo: 'visita';
  visita: RutaVisita;
}

export interface DragNuevo {
  tipo: 'nuevo';
  idSeleccionHospital: number;
  nombre: string;
}

export type DragPayload = DragItem | DragNuevo;
