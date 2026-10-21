import { ExternalLink, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CeldaCaptura } from './celdasCotizacion';
import { importeFormateado } from '../types/aprobaciones.types';
import type { SolicitudOpcion } from '../types/solicitud.types';

/** Tipo de opción como etiqueta legible; lo desconocido se muestra tal cual. */
const ETIQUETA_TIPO: Record<string, string> = {
  vuelo: 'Vuelo',
  autobus: 'Autobús',
  auto: 'Carro propio',
  renta: 'Renta de auto',
  taxi: 'Taxi',
  publico: 'Transporte público',
  hotel: 'Hospedaje',
};

function precio(opcion: SolicitudOpcion): string | null {
  if (opcion.precio === null || opcion.precio === undefined) return null;
  return importeFormateado(opcion.precio, opcion.moneda);
}

/** Una opción con su boleto: línea, precio, enlace de compra y captura. */
function FilaBoleto({ opcion }: { opcion: SolicitudOpcion }) {
  const captura = opcion.ruta_captura ?? undefined;
  const importe = precio(opcion);

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{opcion.linea}</span>
          <Badge variant="outline" className="font-normal">
            {ETIQUETA_TIPO[opcion.tipo] ?? opcion.tipo}
          </Badge>
          {opcion.fue_elegida ? <Badge className="font-normal">Elegida</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {importe ?? 'Sin precio registrado'}
          {opcion.fuente ? ` · ${opcion.fuente}` : ''}
        </p>
        {opcion.url_compra ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={opcion.url_compra} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Ver boleto
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Sin enlace de compra registrado.</p>
        )}
      </div>
      <CeldaCaptura ruta={captura} etiqueta={opcion.linea} />
    </li>
  );
}

/**
 * Boletos del viaje: la URL de compra y la captura de pantalla de las opciones
 * que se le pasen. Sirve para todas las elegidas (desde el encabezado) y para
 * una sola (desde el botón de cada renglón).
 */
export function BoletoViajeDialog({
  abierto,
  onOpenChange,
  titulo,
  descripcion,
  opciones,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  opciones: SolicitudOpcion[];
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[90vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descripcion ??
              'Enlace de compra y captura de pantalla. La captura abre la imagen completa en otra pestaña.'}
          </DialogDescription>
        </DialogHeader>

        {opciones.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Esta solicitud no tiene boletos ni capturas registrados: se envió sin pasar por los cálculos.
          </p>
        ) : (
          <ul className="space-y-2">
            {opciones.map((opcion) => (
              <FilaBoleto key={opcion.id_opcion} opcion={opcion} />
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón estándar para abrir los boletos del viaje. */
export function BotonVerBoleto({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Ticket className="h-4 w-4" aria-hidden />
      Ver boleto
    </Button>
  );
}

export default BoletoViajeDialog;
