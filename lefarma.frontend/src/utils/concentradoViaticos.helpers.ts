import type { MacroViatico } from '@/types/macroViatico.types';

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

const MESES_LARGOS = [
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

/**
 * Convierte una fecha ISO (o ISO con hora) a Date local sin pasar por UTC.
 * El API entrega `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm:ss`; `new Date(string)`
 * interpretaría la medianoche como UTC y en México cambiaría de día.
 */
export function parseFechaLocal(value?: string | null): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const alternativa = new Date(value);
    return Number.isNaN(alternativa.getTime()) ? null : alternativa;
  }

  const [, anio, mes, dia] = match;
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function fmtFecha(d: Date): string {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

export function fmtMesCorto(value?: string | null): string {
  const fecha = parseFechaLocal(value);
  if (!fecha) return '—';
  return `${MESES_CORTOS[fecha.getMonth()]}-${String(fecha.getFullYear()).slice(-2)}`;
}

/** Fecha larga en español, por ejemplo: "26 de julio del 2026". */
export function fmtFechaLarga(value?: string | null): string {
  const fecha = parseFechaLocal(value);
  if (!fecha) return '—';
  return `${fecha.getDate()} de ${MESES_LARGOS[fecha.getMonth()]} del ${fecha.getFullYear()}`;
}

export function texto(value?: string | null): string {
  const limpio = value?.trim();
  return limpio ? limpio : '—';
}

/**
 * Líneas de la columna Fecha del concentrado, con el mismo formato del Excel:
 * una fecha o dos líneas cuando el viaje termina otro día.
 */
export function fechaViajeLineas(
  inicio?: string | null,
  fin?: string | null,
): string[] {
  const fInicio = parseFechaLocal(inicio);
  const fFin = parseFechaLocal(fin);

  if (!fInicio && !fFin) return ['—'];
  if (!fInicio) return [fmtFecha(fFin as Date)];
  if (!fFin || fInicio.getTime() === fFin.getTime()) return [fmtFecha(fInicio)];

  return [fmtFecha(fInicio), `AL ${fmtFecha(fFin)}`];
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** En el Excel los costos vacíos o en cero se imprimen como "$ -". */
export function fmtMoneyCelda(n?: number | null): string {
  if (n == null || n === 0) return '$ -';
  return fmtMoney(n);
}

export function totalViatico(f: MacroViatico): number {
  return (
    (f.costoAutobus ?? 0) +
    (f.costoAvion ?? 0) +
    (f.costoGasolina ?? 0) +
    (f.costoCasetas ?? 0) +
    (f.costoHospedaje ?? 0) +
    (f.costoComida ?? 0) +
    (f.costoTaxi ?? 0)
  );
}

export interface CostosViatico {
  costoAutobus: number;
  costoAvion: number;
  costoGasolina: number;
  costoCasetas: number;
  costoHospedaje: number;
  costoComida: number;
  costoTaxi: number;
  total: number;
}

export function sumarCostos(filas: MacroViatico[]): CostosViatico {
  const totales: CostosViatico = {
    costoAutobus: 0,
    costoAvion: 0,
    costoGasolina: 0,
    costoCasetas: 0,
    costoHospedaje: 0,
    costoComida: 0,
    costoTaxi: 0,
    total: 0,
  };

  for (const fila of filas) {
    totales.costoAutobus += fila.costoAutobus ?? 0;
    totales.costoAvion += fila.costoAvion ?? 0;
    totales.costoGasolina += fila.costoGasolina ?? 0;
    totales.costoCasetas += fila.costoCasetas ?? 0;
    totales.costoHospedaje += fila.costoHospedaje ?? 0;
    totales.costoComida += fila.costoComida ?? 0;
    totales.costoTaxi += fila.costoTaxi ?? 0;
  }

  totales.total =
    totales.costoAutobus +
    totales.costoAvion +
    totales.costoGasolina +
    totales.costoCasetas +
    totales.costoHospedaje +
    totales.costoComida +
    totales.costoTaxi;

  return totales;
}

export type AgrupacionViatico = 'nombre' | 'gerencia' | 'fecha';

export const AGRUPACION_VIATICO_LABELS: Record<AgrupacionViatico, string> = {
  nombre: 'Nombre',
  gerencia: 'Gerencia',
  fecha: 'Fecha',
};

export function valorAgrupacion(
  fila: MacroViatico,
  agrupacion: AgrupacionViatico,
): string {
  switch (agrupacion) {
    case 'nombre':
      return texto(fila.nombre);
    case 'gerencia':
      return texto(fila.gerencia);
    case 'fecha':
      return fmtFechaLarga(fila.fecha);
  }
}

export function ordenarViaticos(
  filas: MacroViatico[],
  agrupacion: AgrupacionViatico,
): MacroViatico[] {
  return [...filas].sort((a, b) => {
    const grupo = valorAgrupacion(a, agrupacion).localeCompare(
      valorAgrupacion(b, agrupacion),
      'es',
      { sensitivity: 'base' },
    );
    if (grupo !== 0) return grupo;

    const renglonA = a.renglon ?? Number.MAX_SAFE_INTEGER;
    const renglonB = b.renglon ?? Number.MAX_SAFE_INTEGER;
    if (renglonA !== renglonB) return renglonA - renglonB;

    return a.folio.localeCompare(b.folio, 'es');
  });
}

export interface ConcentradoViaticosHeader {
  nombre: string;
  gerencia: string;
  fecha: string;
}

/** Un valor si todas las filas comparten el mismo; "VARIAS" si no; "—" si no hay. */
export function unicoOVarias(values: Array<string | null | undefined>): string {
  const limpios = values
    .map((value) => (value ?? '').trim())
    .filter((value) => value.length > 0);

  if (limpios.length === 0) return '—';

  const unicos = Array.from(new Set(limpios));
  return unicos.length === 1 ? unicos[0] : 'VARIAS';
}

export function buildHeader(filas: MacroViatico[]): ConcentradoViaticosHeader {
  return {
    nombre: unicoOVarias(filas.map((fila) => fila.nombre)),
    gerencia: unicoOVarias(filas.map((fila) => fila.gerencia)),
    fecha: unicoOVarias(filas.map((fila) => fmtFechaLarga(fila.fecha))),
  };
}

/**
 * Clave de selección del concentrado: mismo nombre, misma gerencia y misma
 * fecha. Se normaliza para que mayúsculas/espacios no permitan mezclar grupos.
 */
export function claveGrupoViatico(fila: MacroViatico): string {
  const nombre = (fila.nombre ?? '').trim().toLocaleLowerCase('es');
  const gerencia = (fila.gerencia ?? '').trim().toLocaleLowerCase('es');
  const fecha = (fila.fecha ?? '').trim().slice(0, 10);
  return `${nombre}|${gerencia}|${fecha}`;
}
