import type { CalendarioItem } from '../../types/educacionMedica.types';

export type VistaCalendario = 'dia' | 'semana' | 'mes' | 'especialista' | 'ejecutivo';

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_SEMANA_LARGOS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const HORAS = Array.from({ length: 12 }, (_, indice) => indice + 7);

const dosDigitos = (valor: number) => String(valor).padStart(2, '0');

export const fechaIso = (fecha: Date) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;

export const hoyIso = () => fechaIso(new Date());

export const fechaInicialCalendario = () => {
  const hoy = new Date();
  const dia = hoy.getDay();
  if (dia === 6) return fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
  if (dia === 0) return fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2));
  return fechaIso(hoy);
};

export const parseFecha = (fecha: string) => new Date(`${fecha}T00:00:00`);

export const sumarDias = (fecha: string, dias: number) => {
  const dia = parseFecha(fecha);
  dia.setDate(dia.getDate() + dias);
  return fechaIso(dia);
};

export const lunesDe = (fecha: string) => {
  const dia = parseFecha(fecha);
  const desplazamiento = (dia.getDay() + 6) % 7;
  dia.setDate(dia.getDate() - desplazamiento);
  return fechaIso(dia);
};

export const inicioMes = (fecha: string) => `${fecha.slice(0, 7)}-01`;

export const finMes = (fecha: string) => {
  const dia = parseFecha(inicioMes(fecha));
  dia.setMonth(dia.getMonth() + 1, 0);
  return fechaIso(dia);
};

export const sumarMeses = (fecha: string, meses: number) => {
  const dia = parseFecha(inicioMes(fecha));
  dia.setMonth(dia.getMonth() + meses);
  return fechaIso(dia);
};

export const diasSemanaDe = (fecha: string) => {
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice));
};

export const diasLaboralesDe = (fecha: string) => {
  const lunes = lunesDe(fecha);
  return Array.from({ length: 5 }, (_, indice) => sumarDias(lunes, indice));
};

export const cuadriculaMes = (fecha: string) => {
  const inicio = lunesDe(inicioMes(fecha));
  return Array.from({ length: 42 }, (_, indice) => sumarDias(inicio, indice));
};

export const rangoVista = (fecha: string, vista: VistaCalendario) => {
  if (vista === 'dia') return { desde: fecha, hasta: fecha };
  if (vista === 'mes') {
    const dias = cuadriculaMes(fecha);
    return { desde: dias[0], hasta: dias[dias.length - 1] };
  }
  const dias = diasLaboralesDe(fecha);
  return { desde: dias[0], hasta: dias[4] };
};

export const fechaCorta = (fecha: string) => {
  const dia = parseFecha(fecha);
  return `${DIAS_SEMANA[(dia.getDay() + 6) % 7]} ${dia.getDate()}`;
};

export const fechaLarga = (fecha: string) => {
  const dia = parseFecha(fecha);
  return `${DIAS_SEMANA_LARGOS[(dia.getDay() + 6) % 7]} ${dia.getDate()} de ${MESES[dia.getMonth()]} de ${dia.getFullYear()}`;
};

export const fechaCompacta = (fecha: string) => {
  const dia = parseFecha(fecha);
  return `${DIAS_SEMANA[(dia.getDay() + 6) % 7]} ${dia.getDate()} ${MESES[dia.getMonth()].slice(0, 3)} ${dia.getFullYear()}`;
};

export const etiquetaPeriodo = (fecha: string, vista: VistaCalendario) => {
  const dia = parseFecha(fecha);
  if (vista === 'dia') return fechaLarga(fecha);
  if (vista === 'mes') {
    return `${MESES[dia.getMonth()].charAt(0).toUpperCase()}${MESES[dia.getMonth()].slice(1)} ${dia.getFullYear()}`;
  }
  const dias = diasLaboralesDe(fecha);
  const inicio = parseFecha(dias[0]);
  const fin = parseFecha(dias[4]);
  if (inicio.getMonth() === fin.getMonth()) {
    return `${inicio.getDate()} – ${fin.getDate()} de ${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
  }
  return `${inicio.getDate()} ${MESES[inicio.getMonth()].slice(0, 3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
};

export const esFinDeSemana = (fecha: string) => {
  const dia = parseFecha(fecha).getDay();
  return dia === 0 || dia === 6;
};

export const horaNumero = (hora?: string | null) => (hora ? Number(hora.slice(0, 2)) : null);

export const fmtHora = (hora?: string | null) => (hora ? hora.slice(0, 5) : null);

export const iniciales = (nombre?: string | null) => {
  if (!nombre) return '—';
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
};

const TONOS_AVATAR = [
  'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
];

export const tonoAvatar = (nombre?: string | null) => {
  if (!nombre) return TONOS_AVATAR[0];
  const suma = nombre.split('').reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return TONOS_AVATAR[suma % TONOS_AVATAR.length];
};

export type TonoEvento = 'taller' | 'visita' | 'extra' | 'conflicto' | 'bloqueado';

export const tonoEvento = (item: CalendarioItem): TonoEvento => {
  if (item.conflictos.length > 0) return 'conflicto';
  if (item.bloqueado) return 'bloqueado';
  if (item.esExtraordinario) return 'extra';
  if (item.idTaller) return 'taller';
  return 'visita';
};

export const estiloEvento: Record<
  TonoEvento,
  { card: string; chip: string; punto: string; barra: string }
> = {
  taller: {
    card: 'border-orange-200/80 bg-orange-50/90 text-orange-950 hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-100',
    chip: 'border-orange-200/80 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200',
    punto: 'bg-orange-500',
    barra: 'bg-orange-400',
  },
  visita: {
    card: 'border-sky-200/80 bg-sky-50/90 text-sky-950 hover:border-sky-300 hover:bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-100',
    chip: 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
    punto: 'bg-sky-500',
    barra: 'bg-sky-400',
  },
  extra: {
    card: 'border-violet-200/80 bg-violet-50/90 text-violet-950 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-100',
    chip: 'border-violet-200/80 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
    punto: 'bg-violet-500',
    barra: 'bg-violet-400',
  },
  conflicto: {
    card: 'border-rose-200/80 bg-rose-50/90 text-rose-950 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-100',
    chip: 'border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200',
    punto: 'bg-rose-500',
    barra: 'bg-rose-400',
  },
  bloqueado: {
    card: 'border-amber-200/80 bg-amber-50/80 text-amber-950 hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100',
    chip: 'border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
    punto: 'bg-amber-500',
    barra: 'bg-amber-400',
  },
};

export const estadoEtiqueta: Record<string, string> = {
  SinTaller: 'Sin taller',
  Programado: 'Programado',
  EnCurso: 'En curso',
  Realizado: 'Realizado',
  Cancelado: 'Cancelado',
  Pendiente: 'Pendiente',
};

export const coincideBusqueda = (item: CalendarioItem, busqueda: string) => {
  const texto = busqueda.trim().toLowerCase();
  if (!texto) return true;
  return [
    item.hospital,
    item.region,
    item.gerencia,
    item.nombreEjecutivo,
    item.nombreEspecialista,
    item.tema,
    item.producto,
    item.institucion,
  ]
    .filter(Boolean)
    .some((valor) => String(valor).toLowerCase().includes(texto));
};

export const fechaMedia = (fecha: string) => {
  const dia = parseFecha(fecha);
  return `${dia.getDate()} ${MESES[dia.getMonth()].slice(0, 3)}`;
};

export const fmtMoneda = (valor: number | null | undefined) =>
  valor == null
    ? '—'
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }).format(valor);
export const claveEvento = (item: { idRutaVisita: number; idTaller: number | null }) =>
  item.idTaller ? `taller-${item.idTaller}` : `visita-${item.idRutaVisita}`;
