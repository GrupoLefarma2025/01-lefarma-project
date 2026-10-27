import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip as MapTooltip } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  COLOR_POR_TIPO,
  ESTILO_SEGMENTO,
  type PuntoMapa,
  type SegmentoMapa,
} from './rutaMapa.types';

/**
 * Mapa de la ruta: SOLO LECTURA para editar (los puntos no se arrastran), pero
 * se puede mover y hacer zoom para revisarla.
 */
export function RutaMapa({
  puntos,
  segmentos,
  alto = 380,
}: {
  puntos: PuntoMapa[];
  segmentos: SegmentoMapa[];
  alto?: number;
}) {
  const trazo = segmentos.flatMap((s) => s.puntos);
  const centro = puntos.length > 0 ? [puntos[0].lat, puntos[0].lng] as [number, number] : [19.43, -99.13] as [number, number];
  const limites = trazo.length > 1
    ? ([[Math.min(...trazo.map((p) => p[0])), Math.min(...trazo.map((p) => p[1]))],
       [Math.max(...trazo.map((p) => p[0])), Math.max(...trazo.map((p) => p[1]))]] as [[number, number], [number, number]])
    : undefined;

  return (
    <div className="overflow-hidden rounded-lg border">
      <MapContainer
        center={centro}
        bounds={limites}
        zoom={6}
        scrollWheelZoom
        dragging
        doubleClickZoom
        touchZoom
        boxZoom
        keyboard
        style={{ height: alto }}
        className="w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {segmentos.map((segmento, i) => (
          segmento.puntos.length > 1 ? (
            <Polyline
              key={`seg-${segmento.tipo}-${i}`}
              positions={segmento.puntos}
              pathOptions={ESTILO_SEGMENTO[segmento.tipo]}
            />
          ) : null
        ))}
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
  );
}

/** Diálogo con el mapa de la ruta. */
export function RutaMapaDialog({
  abierto,
  onOpenChange,
  titulo,
  descripcion,
  puntos,
  segmentos,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  puntos: PuntoMapa[];
  segmentos: SegmentoMapa[];
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        <RutaMapa puntos={puntos} segmentos={segmentos} alto={460} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón estándar para abrir el mapa de una ruta. */
export function BotonVerMapa({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <MapPin className="h-4 w-4" aria-hidden />
      Ver mapa
    </Button>
  );
}

export default RutaMapa;
