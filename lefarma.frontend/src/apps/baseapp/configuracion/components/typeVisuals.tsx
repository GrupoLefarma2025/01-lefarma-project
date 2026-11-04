import type { ComponentType, CSSProperties } from 'react';
import {
  AlignLeftIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ClockIcon,
  FileCodeIcon,
  HashIcon,
  ListFilterIcon,
  SigmaIcon,
  SquareCodeIcon,
  ToggleLeftIcon,
  TypeIcon,
} from '@animateicons/react/lucide';
import type { TipoDatoConfig, TonoTipo } from '../types';

type AnimatedIcon = ComponentType<{
  size?: number;
  className?: string;
  isAnimated?: boolean;
  style?: CSSProperties;
}>;

export const ICONOS_TIPO: Record<TipoDatoConfig, AnimatedIcon> = {
  texto_corto: TypeIcon,
  texto_largo: AlignLeftIcon,
  entero: HashIcon,
  decimal: SigmaIcon,
  booleano: ToggleLeftIcon,
  fecha: CalendarDaysIcon,
  hora: ClockIcon,
  fecha_hora: CalendarClockIcon,
  seleccion: ListFilterIcon,
  objeto: SquareCodeIcon,
  lista: ListFilterIcon,
  json: FileCodeIcon,
};

export interface TonoVisual {
  /** Tarjeta normal. */
  tarjeta: string;
  /** Tarjeta seleccionada. */
  seleccionada: string;
  /** Contenedor del icono. */
  icono: string;
  /** Contenedor del icono cuando la tarjeta está seleccionada. */
  iconoSeleccionado: string;
  /** Etiqueta pequeña de tipo. */
  chip: string;
}

export const TONOS_TIPO: Record<TonoTipo, TonoVisual> = {
  sky: {
    tarjeta: 'border-sky-200/80 bg-sky-50/40 hover:border-sky-300 hover:bg-sky-50',
    seleccionada: 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20',
    icono: 'border-sky-200 bg-white text-sky-600',
    iconoSeleccionado: 'border-sky-500 bg-sky-500 text-white',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  cyan: {
    tarjeta: 'border-cyan-200/80 bg-cyan-50/40 hover:border-cyan-300 hover:bg-cyan-50',
    seleccionada: 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20',
    icono: 'border-cyan-200 bg-white text-cyan-600',
    iconoSeleccionado: 'border-cyan-500 bg-cyan-500 text-white',
    chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  },
  amber: {
    tarjeta: 'border-amber-200/80 bg-amber-50/40 hover:border-amber-300 hover:bg-amber-50',
    seleccionada: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20',
    icono: 'border-amber-200 bg-white text-amber-600',
    iconoSeleccionado: 'border-amber-500 bg-amber-500 text-white',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  orange: {
    tarjeta: 'border-orange-200/80 bg-orange-50/40 hover:border-orange-300 hover:bg-orange-50',
    seleccionada: 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20',
    icono: 'border-orange-200 bg-white text-orange-600',
    iconoSeleccionado: 'border-orange-500 bg-orange-500 text-white',
    chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  },
  emerald: {
    tarjeta:
      'border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50',
    seleccionada: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20',
    icono: 'border-emerald-200 bg-white text-emerald-600',
    iconoSeleccionado: 'border-emerald-500 bg-emerald-500 text-white',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  rose: {
    tarjeta: 'border-rose-200/80 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50',
    seleccionada: 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20',
    icono: 'border-rose-200 bg-white text-rose-600',
    iconoSeleccionado: 'border-rose-500 bg-rose-500 text-white',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  pink: {
    tarjeta: 'border-pink-200/80 bg-pink-50/40 hover:border-pink-300 hover:bg-pink-50',
    seleccionada: 'border-pink-500 bg-pink-50 ring-2 ring-pink-500/20',
    icono: 'border-pink-200 bg-white text-pink-600',
    iconoSeleccionado: 'border-pink-500 bg-pink-500 text-white',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  },
  violet: {
    tarjeta: 'border-violet-200/80 bg-violet-50/40 hover:border-violet-300 hover:bg-violet-50',
    seleccionada: 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20',
    icono: 'border-violet-200 bg-white text-violet-600',
    iconoSeleccionado: 'border-violet-500 bg-violet-500 text-white',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  indigo: {
    tarjeta: 'border-indigo-200/80 bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50',
    seleccionada: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20',
    icono: 'border-indigo-200 bg-white text-indigo-600',
    iconoSeleccionado: 'border-indigo-500 bg-indigo-500 text-white',
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  blue: {
    tarjeta: 'border-blue-200/80 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50',
    seleccionada: 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20',
    icono: 'border-blue-200 bg-white text-blue-600',
    iconoSeleccionado: 'border-blue-500 bg-blue-500 text-white',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  teal: {
    tarjeta: 'border-teal-200/80 bg-teal-50/40 hover:border-teal-300 hover:bg-teal-50',
    seleccionada: 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20',
    icono: 'border-teal-200 bg-white text-teal-600',
    iconoSeleccionado: 'border-teal-500 bg-teal-500 text-white',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  slate: {
    tarjeta: 'border-slate-200/80 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50',
    seleccionada: 'border-slate-500 bg-slate-50 ring-2 ring-slate-500/20',
    icono: 'border-slate-200 bg-white text-slate-600',
    iconoSeleccionado: 'border-slate-500 bg-slate-500 text-white',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  },
};
