import { BadgeCheck, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resumenCostosRuta } from '../../services/calculoViaje';
import type { PropuestaVersion, ResumenCostosRuta } from '../../types/solicitud.types';

const CONCEPTOS: Array<{ clave: keyof Omit<ResumenCostosRuta, 'total'>; etiqueta: string }> = [
  { clave: 'autobus', etiqueta: 'Autobús' },
  { clave: 'avion', etiqueta: 'Avión' },
  { clave: 'gasolina', etiqueta: 'Gasolina' },
  { clave: 'casetas', etiqueta: 'Casetas' },
  { clave: 'hospedaje', etiqueta: 'Hospedaje' },
  { clave: 'comida', etiqueta: 'Comida' },
  { clave: 'taxi', etiqueta: 'Taxis y traslados' },
];

const GRUPOS: Record<string, string> = {
  autobus: 'Transporte',
  vuelo: 'Transporte',
  auto: 'Transporte',
  renta: 'Transporte',
  hotel: 'Hospedaje',
  comida: 'Alimentos',
  taxi: 'Traslados',
};

function moneda(valor: number): string {
  return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export interface ConfirmarAutorizacionDialogProps {
  abierto: boolean;
  folio: string;
  version: PropuestaVersion | null;
  procesando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export function ConfirmarAutorizacionDialog({
  abierto,
  folio,
  version,
  procesando,
  onCancelar,
  onConfirmar,
}: ConfirmarAutorizacionDialogProps) {
  const resumen = version
    ? version.resumen
      ?? resumenCostosRuta(
        version.calculo,
        version.opciones,
        version.calculo.modo_transporte,
        null,
      )
    : null;
  const total = resumen?.total
    ?? (resumen
      ? CONCEPTOS.reduce((suma, concepto) => suma + (resumen[concepto.clave] ?? 0), 0)
      : null);
  const elegidas = version?.opciones.filter((opcion) => opcion.fue_elegida) ?? [];
  const sinImporte = resumen
    ? CONCEPTOS.filter((concepto) => resumen[concepto.clave] === null).map((concepto) => concepto.etiqueta)
    : [];

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) onCancelar();
      }}
    >
      <DialogContent data-testid="confirmar-autorizacion" className="w-[92vw] max-w-2xl">
        <DialogHeader>
          <DialogTitle>¿Autorizar la solicitud {folio}?</DialogTitle>
          <DialogDescription>
            Revisa que cada concepto coincida con el viaje. Al autorizar, la solicitud pasa al
            concentrado con esta ruta y estos costos; desde aquí ya no se puede cambiar.
          </DialogDescription>
        </DialogHeader>

        {version === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            La solicitud todavía no tiene una ruta calculada que autorizar.
          </p>
        ) : (
          <div className="space-y-4">
            <section className="space-y-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4" aria-hidden />
                Desglose de los viáticos
              </h3>
              <table className="w-full text-sm">
                <caption className="sr-only">Costos de la propuesta que se va a autorizar</caption>
                <tbody>
                  {CONCEPTOS.map((concepto) => {
                    const importe = resumen?.[concepto.clave] ?? null;
                    return (
                      <tr key={concepto.clave} className="border-b border-border/60 last:border-b-0">
                        <th scope="row" className="py-1.5 text-left font-normal text-muted-foreground">
                          {concepto.etiqueta}
                        </th>
                        <td className="py-1.5 text-right tabular-nums">
                          {importe === null ? '—' : moneda(importe)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <th scope="row" className="pt-2 text-left text-base">
                      Total
                    </th>
                    <td className="pt-2 text-right text-base font-semibold tabular-nums">
                      {total === null ? 'Sin total' : moneda(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {sinImporte.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin importe capturado: {sinImporte.join(', ')}.
                </p>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                {elegidas.length === 1
                  ? '1 concepto elegido'
                  : `${elegidas.length} conceptos elegidos`}
              </h3>
              {elegidas.length === 0 ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  Esta propuesta no tiene conceptos elegidos: el concentrado quedaría sin importes.
                  Revisa la ruta o edita los costos antes de autorizar.
                </p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {elegidas.map((opcion, indice) => (
                    <li
                      key={`${opcion.linea}-${indice}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {GRUPOS[opcion.tipo] ?? opcion.tipo}
                        </span>
                        <span className="block truncate text-sm">{opcion.linea}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                        {opcion.precio === null ? 'Por cotizar' : moneda(opcion.precio)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={version === null || procesando}
            onClick={onConfirmar}
          >
            <BadgeCheck className="h-4 w-4" aria-hidden />
            Autorizar y enviar al concentrado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
