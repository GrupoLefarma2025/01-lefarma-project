import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip as MapTooltip } from 'react-leaflet';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export type TipoPuntoRuta = 'origen' | 'punto' | 'hotel' | 'regreso';

export interface PuntoRutaResumen {
  lat: number;
  lng: number;
  nombre: string;
  tipo: TipoPuntoRuta;
  detalle?: string;
}

const COLOR_POR_TIPO: Record<TipoPuntoRuta, string> = {
  origen: '#1d3a8d',
  punto: '#eb6c36',
  hotel: '#0f766e',
  regreso: '#6b7280',
};

const ETIQUETA_TIPO: Record<TipoPuntoRuta, string> = {
  origen: 'Origen',
  punto: 'Punto',
  hotel: 'Hotel',
  regreso: 'Regreso',
};

interface ResumenRutaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puntos: PuntoRutaResumen[];
  /** Trazado de la carretera (pares [lat, lng]) para no dibujar líneas rectas. */
  linea: [number, number][];
  /** Texto del tramo reconstructido (origen → hotel → punto...). */
  tramosTexto: string[];
  onEnviar: () => void;
  enviando: boolean;
}

/**
 * Resumen reconstruido de la ruta: muestra en el mapa la ruta completa con
 * los puntos y hoteles reconsiderados (origen → hotel → punto → ... → regreso)
 * y permite enviar la solicitud al concentrado.
 */
export function ResumenRutaModal({
  open,
  onOpenChange,
  puntos,
  linea,
  tramosTexto,
  onEnviar,
  enviando,
}: ResumenRutaModalProps) {
  const trazo = linea.length > 1
    ? linea
    : puntos.map((p) => [p.lat, p.lng] as [number, number]);
  const centro = puntos.length > 0 ? [puntos[0].lat, puntos[0].lng] as [number, number] : [19.43, -99.13] as [number, number];
  const limites = trazo.length > 1
    ? ([[Math.min(...trazo.map((p) => p[0])), Math.min(...trazo.map((p) => p[1]))],
       [Math.max(...trazo.map((p) => p[0])), Math.max(...trazo.map((p) => p[1]))]] as [[number, number], [number, number]])
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumen reconstruido</DialogTitle>
          <DialogDescription>
            Ruta completa con los puntos y hoteles reconsiderados. Revísala antes de enviar a concentrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {puntos.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <MapContainer
                center={centro}
                bounds={limites}
                zoom={6}
                scrollWheelZoom={false}
                className="h-[380px] w-full"
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={trazo} pathOptions={{ color: '#eb6c36', weight: 4, opacity: 0.9 }} />
                {puntos.map((p, i) => (
                  <CircleMarker
                    key={`${p.lat}-${p.lng}-${i}`}
                    center={[p.lat, p.lng]}
                    radius={6}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: COLOR_POR_TIPO[p.tipo], fillOpacity: 1 }}
                  >
                    <MapTooltip permanent direction="top">
                      {i + 1}. {p.nombre}
                    </MapTooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay puntos para trazar.</p>
          )}

          <ul className="space-y-1 text-sm">
            {tramosTexto.map((linea, i) => (
              <li key={`${linea}-${i}`} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <span>{linea}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            {puntos.map((p, i) => (
              <Badge key={`${p.nombre}-${i}`} variant="outline" className="gap-1 font-normal">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_POR_TIPO[p.tipo] }} />
                {ETIQUETA_TIPO[p.tipo]}: {p.nombre}
              </Badge>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="button" onClick={onEnviar} disabled={enviando} className="gap-1.5">
            <Send className="h-4 w-4" aria-hidden />
            {enviando ? 'Enviando…' : 'Enviar a concentrado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
