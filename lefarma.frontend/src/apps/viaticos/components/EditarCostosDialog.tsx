import { useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resumenCostosRuta } from '../services/calculoViaje';
import { textoTotalElegidas, totalDeOpcionesElegidas } from '../pages/aprobaciones/DetalleSolicitudModal';
import type {
  CalculoViaje,
  DatosOpcion,
  OpcionCotizacion,
  PropuestaRuta,
  SolicitudOpcion,
} from '../types/solicitud.types';

/** Tipos de transporte que se pagan por tramo y alimentan el costo de la ruta. */
const TRANSPORTE_PRINCIPAL = ['autobus', 'vuelo', 'auto', 'renta'];

/** Misma regla que el backend: un precio vacío solo se acepta si el costo es estimado. */
function fuenteEstimada(fuente: string | null | undefined): boolean {
  return (fuente ?? '').toLowerCase().includes('estimado');
}

function esEstimada(opcion: SolicitudOpcion): boolean {
  return opcion.precio === null || opcion.datos?.tipo_precio === 'estimado';
}

/** Texto del campo a número. `null` = vacío; `NaN` = inválido. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return null;
  const numero = Number(limpio.replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : Number.NaN;
}

function precioPrincipal(opciones: OpcionCotizacion[], numeroTramo: number): number | null {
  const opcion = opciones.find(
    (candidata) =>
      candidata.fue_elegida &&
      candidata.datos?.tramo === numeroTramo &&
      TRANSPORTE_PRINCIPAL.includes(candidata.tipo),
  );
  return opcion?.precio ?? null;
}

/**
 * Recalcula el costo de cada tramo y de cada parada del diagrama con los
 * precios capturados. El resto del cálculo (tiempos, km, casetas, hoteles) no
 * cambia: solo se editan importes.
 */
function recalcularCosto(calculo: CalculoViaje, opciones: OpcionCotizacion[]): CalculoViaje {
  const tramos = calculo.tramos.map((tramo, indice) => {
    const precio = precioPrincipal(opciones, indice);
    return precio === null ? tramo : { ...tramo, costo: precio, moneda: 'MXN' };
  });
  const ruta = calculo.ruta
    ? {
        ...calculo.ruta,
        nodos: calculo.ruta.nodos.map((nodo) => {
          const coincidencia = /^(\d+)\./.exec(nodo.titulo.trim());
          const precio = coincidencia ? precioPrincipal(opciones, Number(coincidencia[1]) - 1) : null;
          return precio === null ? nodo : { ...nodo, costo: precio };
        }),
      }
    : calculo.ruta;
  return { ...calculo, tramos, ruta };
}

function descripcionOpcion(opcion: SolicitudOpcion): string {
  const partes: string[] = [];
  if (opcion.datos?.tramo != null) partes.push(`Tramo ${opcion.datos.tramo + 1}`);
  if (opcion.tipo) partes.push(opcion.tipo);
  if (esEstimada(opcion)) partes.push('estimado');
  return partes.join(' · ');
}

export interface EditarCostosDialogProps {
  /** Cálculo que se está revisando (el guardado o la propuesta en curso). */
  calculo: CalculoViaje;
  /** Opciones de esa misma versión: elegidas y descartadas. */
  opciones: SolicitudOpcion[];
  onOpenChange: (abierto: boolean) => void;
  /** Devuelve la propuesta con los importes capturados, sin guardarla. */
  onGuardar: (propuesta: PropuestaRuta) => void;
}

/**
 * Edición de importes antes de autorizar. Se monta solo cuando está abierto,
 * así cada apertura parte de los precios vigentes. No escribe en el servidor:
 * entrega una propuesta que el revisor confirma al autorizar.
 */
export function EditarCostosDialog({
  calculo,
  opciones,
  onOpenChange,
  onGuardar,
}: EditarCostosDialogProps) {
  const [precios, setPrecios] = useState<Record<number, string>>(() => {
    const inicial: Record<number, string> = {};
    opciones.forEach((opcion, indice) => {
      if (!opcion.fue_elegida) return;
      inicial[indice] = opcion.precio === null ? '' : String(opcion.precio);
    });
    return inicial;
  });

  const elegidas = opciones.filter((opcion) => opcion.fue_elegida);

  const ajustadas = useMemo(
    () =>
      opciones.map((opcion, indice) => {
        if (!opcion.fue_elegida) return opcion;
        const numero = aNumero(precios[indice] ?? '');
        return { ...opcion, precio: numero === null || Number.isNaN(numero) ? opcion.precio : numero };
      }),
    [opciones, precios],
  );
  const total = totalDeOpcionesElegidas(ajustadas);

  const invalidas = opciones
    .map((opcion, indice) => ({ opcion, numero: aNumero(precios[indice] ?? '') }))
    .filter(({ opcion, numero }) => {
      if (!opcion.fue_elegida) return false;
      if (typeof numero === 'number' && Number.isNaN(numero)) return true;
      return numero === null && !fuenteEstimada(opcion.fuente);
    });

  const guardar = () => {
    const opcionesCotizacion: OpcionCotizacion[] = ajustadas.map((opcion) => ({
      tipo: opcion.tipo,
      linea: opcion.linea,
      precio: opcion.precio,
      moneda: opcion.moneda ?? 'MXN',
      url_compra: opcion.url_compra,
      fuente: opcion.fuente,
      fue_elegida: opcion.fue_elegida,
      ruta_captura: opcion.ruta_captura,
      capturas: opcion.ruta_captura ? [opcion.ruta_captura] : [],
      datos: (opcion.datos ?? null) as DatosOpcion | null,
    }));
    const calculoAjustado = recalcularCosto(calculo, opcionesCotizacion);
    onGuardar({
      calculo: calculoAjustado,
      opciones: opcionesCotizacion,
      resumen: resumenCostosRuta(calculoAjustado, opcionesCotizacion, calculoAjustado.modo_transporte),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="editar-costos"
        className="max-h-[90vh] w-[92vw] max-w-[640px] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" aria-hidden /> Editar costos de la ruta
          </DialogTitle>
          <DialogDescription>
            Ajusta el precio de cada concepto elegido. La ruta se autoriza con estos importes y nada
            se guarda hasta que autorices.
          </DialogDescription>
        </DialogHeader>

        {elegidas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            La solicitud no tiene conceptos elegidos: no hay precios que editar.
          </p>
        ) : (
          <ul className="space-y-2">
            {opciones.map((opcion, indice) => {
              if (!opcion.fue_elegida) return null;
              const numero = aNumero(precios[indice] ?? '');
              const invalida =
                Number.isNaN(numero) || (numero === null && !fuenteEstimada(opcion.fuente));
              return (
                <li
                  key={`${opcion.id_opcion}-${indice}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{opcion.linea}</p>
                    {descripcionOpcion(opcion) ? (
                      <p className="text-xs text-muted-foreground">{descripcionOpcion(opcion)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Label htmlFor={`costo-opcion-${indice}`} className="sr-only">
                      Precio de {opcion.linea}
                    </Label>
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      id={`costo-opcion-${indice}`}
                      data-testid={`costo-opcion-${indice}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      aria-invalid={invalida}
                      className="h-9 w-28 text-right tabular-nums"
                      value={precios[indice] ?? ''}
                      onChange={(evento) =>
                        setPrecios((previos) => ({ ...previos, [indice]: evento.target.value }))
                      }
                    />
                    <span className="text-xs text-muted-foreground">{opcion.moneda ?? 'MXN'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {invalidas.length > 0 ? (
          <p role="alert" className="text-sm text-destructive">
            Escribe un precio válido en {invalidas.length === 1 ? 'el concepto marcado' : 'los conceptos marcados'}, o
            deja el campo vacío solo cuando el costo sea estimado.
          </p>
        ) : null}

        <div className="flex items-baseline justify-between gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">Desglose</span>
          <span
            data-testid="total-editar-costos"
            className="text-2xl font-semibold tracking-tight tabular-nums"
          >
            {textoTotalElegidas(total)}
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={elegidas.length === 0 || invalidas.length > 0}
            onClick={guardar}
          >
            Usar estos costos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
