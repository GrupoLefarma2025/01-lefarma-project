/* eslint-disable react-refresh/only-export-components -- helpers puros de comparación conviven con el componente */
import { useMemo, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { importeFormateado } from '../types/aprobaciones.types';
import type { SolicitudOpcion } from '../types/solicitud.types';
import { BoletoViajeDialog } from './BoletoViajeDialog';

/** Resultado de comparar una opción del viajero contra la versión propuesta. */
export type EstadoComparacion =
  | 'subio'
  | 'bajo'
  | 'sin-cambio'
  | 'nueva'
  | 'no-disponible'
  | 'sin-dato';

export interface FilaComparacionRuta {
  /** Clave estable de la fila (tramo o identidad de la opción). */
  clave: string;
  /** Opción de la cotización original; `null` si la versión es nueva. */
  original: SolicitudOpcion | null;
  /** Opción de la versión propuesta; `null` si ya no está disponible. */
  propuesta: SolicitudOpcion | null;
  /** `propuesta - original`; `null` cuando falta alguno de los dos precios. */
  diferencia: number | null;
  /** Variación porcentual; `null` cuando falta precio o el original es cero. */
  porcentaje: number | null;
  estado: EstadoComparacion;
}

const TEXTO_ESTADO: Record<EstadoComparacion, string> = {
  subio: 'Subió',
  bajo: 'Bajó',
  'sin-cambio': 'Sin cambio',
  nueva: 'Nueva',
  'no-disponible': 'Ya no disponible',
  'sin-dato': 'Sin dato',
};

const CLASE_ESTADO: Record<EstadoComparacion, string> = {
  subio: 'border-destructive/40 bg-destructive/10 text-destructive',
  bajo: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  'sin-cambio': 'border-border bg-muted/40 text-muted-foreground',
  nueva: 'border-primary/40 bg-primary/10 text-primary',
  'no-disponible': 'border-border bg-muted/40 text-muted-foreground',
  'sin-dato': 'border-border text-muted-foreground',
};

/**
 * La comparación es de la ruta que paga el viaje: si las opciones traen la
 * marca de elegida se comparan solo esas; si no (fixtures viejos o versiones
 * sin marcar) se comparan todas para no esconder información.
 */
export function opcionesParaComparar(opciones: SolicitudOpcion[]): SolicitudOpcion[] {
  return opciones.some((opcion) => opcion.fue_elegida)
    ? opciones.filter((opcion) => opcion.fue_elegida)
    : opciones;
}

function claveTramo(opcion: SolicitudOpcion): string | null {
  const tramo = opcion.datos?.tramo;
  return typeof tramo === 'number' && Number.isFinite(tramo) ? `tramo:${tramo}` : null;
}

/** Identidad de respaldo cuando la opción no dice a qué tramo pertenece. */
function claveIdentidad(opcion: SolicitudOpcion): string {
  return `opcion:${opcion.tipo}|${opcion.linea}|${opcion.url_compra ?? ''}`;
}

function diferenciaNumerica(original: number | null, propuesta: number | null): number | null {
  return original === null || propuesta === null ? null : propuesta - original;
}

function porcentajeDe(diferencia: number | null, original: number | null): number | null {
  if (diferencia === null || original === null || original === 0) return null;
  return (diferencia / original) * 100;
}

/**
 * Empareja la cotización original con la propuesta: primero por `datos.tramo`
 * y, cuando no hay tramo (o no coincide), por tipo/línea/url. Lo que sobra en
 * la propuesta es "Nueva"; lo que sobra en la original es "Ya no disponible".
 */
export function compararOpcionesRuta(
  originales: SolicitudOpcion[],
  propuestas: SolicitudOpcion[],
): FilaComparacionRuta[] {
  const candidatas = opcionesParaComparar(propuestas).map((opcion) => ({
    opcion,
    usado: false,
  }));
  const filas: FilaComparacionRuta[] = [];

  for (const original of opcionesParaComparar(originales)) {
    const tramoOriginal = claveTramo(original);
    let candidata =
      tramoOriginal === null
        ? undefined
        : // Dentro del tramo se prefiere el mismo tipo (vuelo con vuelo) para
          // no emparejar, por ejemplo, un hotel con un taxi.
          candidatas.find(
            (item) =>
              !item.usado &&
              claveTramo(item.opcion) === tramoOriginal &&
              item.opcion.tipo === original.tipo,
          ) ??
          candidatas.find(
            (item) => !item.usado && claveTramo(item.opcion) === tramoOriginal,
          );
    candidata ??= candidatas.find(
      (item) => !item.usado && claveIdentidad(item.opcion) === claveIdentidad(original),
    );
    if (candidata) candidata.usado = true;

    const propuesta = candidata?.opcion ?? null;
    const diferencia = diferenciaNumerica(original.precio, propuesta?.precio ?? null);
    const estado: EstadoComparacion =
      propuesta === null
        ? 'no-disponible'
        : original.precio === null || propuesta.precio === null
          ? 'sin-dato'
          : diferencia === 0
            ? 'sin-cambio'
            : (diferencia ?? 0) > 0
              ? 'subio'
              : 'bajo';

    filas.push({
      clave: tramoOriginal ?? claveIdentidad(original),
      original,
      propuesta,
      diferencia,
      porcentaje: porcentajeDe(diferencia, original.precio),
      estado,
    });
  }

  for (const { opcion, usado } of candidatas) {
    if (usado) continue;
    filas.push({
      clave: claveTramo(opcion) ?? claveIdentidad(opcion),
      original: null,
      propuesta: opcion,
      diferencia: null,
      porcentaje: null,
      estado: 'nueva',
    });
  }

  return filas;
}

/** Suma de las filas comparadas, o `null` si falta cualquier precio. */
function totalDeFilas(filas: FilaComparacionRuta[], lado: 'original' | 'propuesta'): number | null {
  const presentes = filas
    .map((fila) => fila[lado])
    .filter((opcion): opcion is SolicitudOpcion => opcion !== null);
  if (presentes.length === 0) return null;
  if (presentes.some((opcion) => opcion.precio === null)) return null;
  return presentes.reduce((suma, opcion) => suma + (opcion.precio ?? 0), 0);
}

function precioCelda(opcion: SolicitudOpcion | null): string {
  if (!opcion || opcion.precio === null) return 'Sin dato';
  return importeFormateado(opcion.precio, opcion.moneda);
}

function textoDiferencia(diferencia: number | null, porcentaje: number | null, moneda: string | null): string {
  if (diferencia === null) return 'Sin dato';
  const signo = diferencia > 0 ? '+' : diferencia < 0 ? '-' : '';
  const importe = `${signo}${importeFormateado(Math.abs(diferencia), moneda)}`;
  if (porcentaje === null) return importe;
  const signoPorcentaje = porcentaje > 0 ? '+' : porcentaje < 0 ? '-' : '';
  const variacion = `${signoPorcentaje}${Math.abs(porcentaje).toLocaleString('es-MX', {
    maximumFractionDigits: 1,
  })}%`;
  return `${importe} (${variacion})`;
}

function etiquetaDe(fila: FilaComparacionRuta): { titulo: string; detalle: string } {
  const base = fila.propuesta ?? fila.original;
  if (!base) return { titulo: 'Opción sin datos', detalle: '' };
  const tramo = base.datos?.tramo;
  const detalle = [
    typeof tramo === 'number' ? `Tramo ${tramo}` : null,
    base.tipo || null,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join(' · ');
  return { titulo: base.linea || 'Opción sin nombre', detalle };
}

/**
 * Comparador presentacional de la cotización original del viajero contra la
 * versión propuesta. No consulta servicios: recibe las dos listas y, si se
 * conocen, los totales. Todo lo que falta se muestra como "Sin dato".
 */
export function ComparadorRutas({
  opcionesOriginales,
  opcionesPropuestas,
  totalOriginal,
  totalPropuesto,
  moneda = null,
}: {
  opcionesOriginales: SolicitudOpcion[];
  opcionesPropuestas: SolicitudOpcion[];
  /** Total conocido de la cotización original; `null` = sin dato. */
  totalOriginal?: number | null;
  /** Total conocido de la versión propuesta; `null` = sin dato. */
  totalPropuesto?: number | null;
  /** Moneda de los totales; `null` usa MXN. */
  moneda?: string | null;
}) {
  const [boletoAbierto, setBoletoAbierto] = useState(false);
  const filas = useMemo(
    () => compararOpcionesRuta(opcionesOriginales, opcionesPropuestas),
    [opcionesOriginales, opcionesPropuestas],
  );
  const descartadas = useMemo(
    () => opcionesOriginales.filter((opcion) => !opcion.fue_elegida),
    [opcionesOriginales],
  );

  const totalOriginalCalculado = totalOriginal === undefined ? totalDeFilas(filas, 'original') : totalOriginal;
  const totalPropuestoCalculado = totalPropuesto === undefined ? totalDeFilas(filas, 'propuesta') : totalPropuesto;
  const diferenciaTotal = diferenciaNumerica(totalOriginalCalculado, totalPropuestoCalculado);
  const porcentajeTotal = porcentajeDe(diferenciaTotal, totalOriginalCalculado);

  return (
    <div
      data-testid="comparador-rutas"
      className="space-y-3 rounded-lg border bg-card p-3 text-sm shadow-[0_2px_10px_rgba(15,23,42,0.10)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Comparación de opciones</h3>
          <p className="text-xs text-muted-foreground">
            Cotización original del viajero contra la versión que se muestra.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={descartadas.length === 0}
          title={
            descartadas.length === 0
              ? 'El viajero no dejó opciones descartadas.'
              : `Ver las ${descartadas.length} opciones que no se eligieron`
          }
          onClick={() => setBoletoAbierto(true)}
        >
          <Ticket className="h-3.5 w-3.5" aria-hidden />
          Ver opciones descartadas del viajero
          {descartadas.length > 0 ? ` (${descartadas.length})` : ''}
        </Button>
      </div>

      {descartadas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          El viajero no dejó opciones descartadas: esta cotización no tiene alternativas sin elegir.
        </p>
      ) : null}

      {filas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay opciones que comparar entre la cotización original y la versión mostrada.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Concepto</th>
              <th className="pb-2 pr-3 text-right font-medium">Original</th>
              <th className="pb-2 pr-3 text-right font-medium">Propuesto</th>
              <th className="pb-2 pr-3 text-right font-medium">Diferencia</th>
              <th className="pb-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const { titulo, detalle } = etiquetaDe(fila);
              return (
                <tr key={fila.clave} className="border-t border-border/60 align-top">
                  <td className="py-1.5 pr-3">
                    <div>{titulo}</div>
                    {detalle ? <div className="text-xs text-muted-foreground">{detalle}</div> : null}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">
                    {fila.original ? precioCelda(fila.original) : '—'}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">
                    {fila.propuesta ? precioCelda(fila.propuesta) : '—'}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">
                    {fila.estado === 'nueva' || fila.estado === 'no-disponible'
                      ? 'Sin dato'
                      : textoDiferencia(fila.diferencia, fila.porcentaje, fila.propuesta?.moneda ?? null)}
                  </td>
                  <td className="py-1.5">
                    <Badge variant="outline" className={`font-normal ${CLASE_ESTADO[fila.estado]}`}>
                      {TEXTO_ESTADO[fila.estado]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td className="pt-2 text-xs font-medium">Total</td>
              <td data-testid="comparador-total-original" className="pt-2 pr-3 text-right font-medium tabular-nums">
                {totalOriginalCalculado === null
                  ? 'Sin dato'
                  : importeFormateado(totalOriginalCalculado, moneda)}
              </td>
              <td data-testid="comparador-total-propuesto" className="pt-2 pr-3 text-right font-medium tabular-nums">
                {totalPropuestoCalculado === null
                  ? 'Sin dato'
                  : importeFormateado(totalPropuestoCalculado, moneda)}
              </td>
              <td data-testid="comparador-total-diferencia" className="pt-2 pr-3 text-right font-medium tabular-nums">
                {textoDiferencia(diferenciaTotal, porcentajeTotal, moneda)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      <BoletoViajeDialog
        abierto={boletoAbierto}
        onOpenChange={setBoletoAbierto}
        titulo="Opciones descartadas del viajero"
        descripcion="Alternativas que el viajero cotizó pero no eligió. La captura abre la imagen completa en otra pestaña."
        opciones={descartadas}
      />
    </div>
  );
}

export default ComparadorRutas;
