import { Repeat, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { periodoTexto } from '../utils/incidencias';
import type { ReglasDescuentoResponse } from '@/types/solicitudPersonal.types';

interface ReglasDescuentoContenidoProps {
  reglas: ReglasDescuentoResponse | null;
  className?: string;
}

/**
 * Explicación de cómo se generan los descuentos por incidencias.
 * Presentacional: se usa inline (modal de detalle admin) y dentro de
 * ReglasDescuentoModal (páginas del empleado).
 */
export function ReglasDescuentoContenido({ reglas, className }: ReglasDescuentoContenidoProps) {
  const limite = reglas?.limiteDescuentosJustificadosMes ?? 2;

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-muted-foreground">
        Algunas incidencias de checado generan descuentos en nómina cuando se acumulan en el
        período. Los días justificados o en trámite no cuentan para esa acumulación.
      </p>

      {reglas && reglas.reglas.length > 0 ? (
        <ul className="space-y-2">
          {reglas.reglas.map((regla, index) => (
            <li
              key={index}
              className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <Repeat className="h-4 w-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{regla.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {regla.cantidadAcumulada > 1
                    ? `Cada ${regla.cantidadAcumulada} incidencias en ${periodoTexto(regla.periodo)} generan 1 descuento. El descuento se marca en la ${regla.cantidadAcumulada}.ª incidencia.`
                    : `Cada día con esta incidencia genera 1 descuento en ${periodoTexto(regla.periodo)}.`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          Por ahora no hay reglas de descuento configuradas.
        </p>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2.5 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Puedes justificar hasta <span className="font-semibold">{limite}</span>{' '}
          {limite === 1 ? 'descuento' : 'descuentos'} por mes.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Estados de una incidencia</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            Pendiente de justificar
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            En trámite (ya tiene solicitud)
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
            Justificada
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ReglasDescuentoContenido;
