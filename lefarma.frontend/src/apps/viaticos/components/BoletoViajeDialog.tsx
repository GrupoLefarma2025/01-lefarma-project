import { ExternalLink, ImageOff, Ticket } from 'lucide-react';
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
import { useCapturaAutenticada } from './celdasCotizacion';
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

/** Captura de la opción: miniatura que abre la imagen completa, o su ausencia. */
function CapturaBoleto({ ruta, etiqueta }: { ruta?: string; etiqueta: string }) {
  const estado = useCapturaAutenticada(ruta);

  if (!ruta) {
    return (
      <div className="flex h-24 w-full items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground sm:w-40">
        <ImageOff className="h-4 w-4" aria-hidden />
        Sin captura
      </div>
    );
  }
  if (estado.error) {
    return (
      <p role="alert" className="flex h-24 w-full items-center justify-center rounded-md border text-xs text-destructive sm:w-40">
        {estado.error}
      </p>
    );
  }
  if (!estado.url) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-md border text-xs text-muted-foreground sm:w-40">
        Cargando captura…
      </div>
    );
  }
  return (
    <a
      href={estado.url}
      target="_blank"
      rel="noreferrer"
      title={`Ver captura completa · ${etiqueta}`}
      className="block"
    >
      <img
        src={estado.url}
        alt={`Captura de pantalla de ${etiqueta}`}
        className="h-24 w-full rounded-md border object-cover sm:w-40"
      />
    </a>
  );
}

/** Una opción con su boleto: línea, precio, fuente, enlace de compra y captura. */
function FilaBoleto({ opcion }: { opcion: SolicitudOpcion }) {
  const captura = opcion.ruta_captura ?? undefined;
  const importe = precio(opcion);

  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{opcion.linea}</span>
          <Badge variant="outline" className="font-normal">
            {ETIQUETA_TIPO[opcion.tipo] ?? opcion.tipo}
          </Badge>
          {opcion.fue_elegida ? <Badge className="font-normal">Elegida</Badge> : null}
        </div>
        <p className="text-lg font-semibold tabular-nums">{importe ?? 'Sin precio registrado'}</p>
        {opcion.fuente ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">Fuente:</span> {opcion.fuente}
          </p>
        ) : null}
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
      <CapturaBoleto ruta={captura} etiqueta={opcion.linea} />
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
