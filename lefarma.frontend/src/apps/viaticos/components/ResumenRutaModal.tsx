import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip as MapTooltip } from 'react-leaflet';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export type TipoPuntoRuta = 'origen' | 'punto' | 'hotel' | 'regreso' | 'terminal';

export interface PuntoRutaResumen {
  lat: number;
  lng: number;
  nombre: string;
  tipo: TipoPuntoRuta;
  detalle?: string;
}

/** Tramo del mapa: el taxi a la terminal, el vuelo/bus o la carretera. */
export type TipoSegmentoRuta = 'taxi' | 'transporte' | 'carretera';

export interface SegmentoRuta {
  tipo: TipoSegmentoRuta;
  /** Pares [lat, lng] en orden de recorrido. */
  puntos: [number, number][];
  /** Texto corto para la leyenda ("Taxi al aeropuerto"). */
  etiqueta?: string;
}

const COLOR_POR_TIPO: Record<TipoPuntoRuta, string> = {
  origen: '#1d3a8d',
  punto: '#eb6c36',
  hotel: '#0f766e',
  regreso: '#6b7280',
  terminal: '#7c3aed',
};

const ETIQUETA_TIPO: Record<TipoPuntoRuta, string> = {
  origen: 'Origen',
  punto: 'Punto',
  hotel: 'Hotel',
  regreso: 'Regreso',
  terminal: 'Terminal',
};

/** Estilo de cada tipo de tramo: el taxi punteado, el viaje largo sólido. */
const ESTILO_SEGMENTO: Record<TipoSegmentoRuta, { color: string; weight: number; dashArray?: string; opacity: number }> = {
  taxi: { color: '#6b7280', weight: 3, dashArray: '6 6', opacity: 0.9 },
  transporte: { color: '#eb6c36', weight: 4, opacity: 0.95 },
  carretera: { color: '#eb6c36', weight: 4, opacity: 0.95 },
};

const ETIQUETA_SEGMENTO: Record<TipoSegmentoRuta, string> = {
  taxi: 'Taxi',
  transporte: 'Vuelo o autobús',
  carretera: 'Carretera',
};

interface ResumenRutaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puntos: PuntoRutaResumen[];
  /** Trazado completo de la ruta, tramo por tramo (taxi / vuelo / carretera). */
  segmentos: SegmentoRuta[];
  /** Texto del tramo reconstructido (origen → terminal → vuelo → hotel...). */
  tramosTexto: string[];
  onEnviar: () => void;
  enviando: boolean;
}

/**
 * Resumen reconstruido de la ruta: muestra en el mapa la cadena completa
 * (origen → terminal → vuelo o autobús → terminal → hotel o punto → regreso)
 * y permite enviar la solicitud al concentrado.
 *
 * El mapa es de SOLO LECTURA: se puede mover y hacer zoom para revisar el
 * trayecto, pero los puntos no se arrastran ni se editan.
 */
export function ResumenRutaModal({
  open,
  onOpenChange,
  puntos,
  segmentos,
  tramosTexto,
  onEnviar,
  enviando,
}: ResumenRutaModalProps) {
  const trazo = segmentos.flatMap((s) => s.puntos);
  const centro = puntos.length > 0 ? [puntos[0].lat, puntos[0].lng] as [number, number] : [19.43, -99.13] as [number, number];
  const limites = trazo.length > 1
    ? ([[Math.min(...trazo.map((p) => p[0])), Math.min(...trazo.map((p) => p[1]))],
       [Math.max(...trazo.map((p) => p[0])), Math.max(...trazo.map((p) => p[1]))]] as [[number, number], [number, number]])
    : undefined;
  const tiposSegmento = Array.from(new Set(segmentos.map((s) => s.tipo)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumen reconstruido</DialogTitle>
          <DialogDescription>
            Ruta completa: origen, terminal, vuelo o autobús, hotel y regreso, ya recalculada.
            Puedes mover el mapa y hacer zoom; es de solo lectura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {puntos.length > 0 ? (
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
                className="h-[380px] w-full"
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

          {tiposSegmento.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tiposSegmento.map((tipo) => (
                <Badge key={`seg-leyenda-${tipo}`} variant="outline" className="gap-1 font-normal">
                  <span
                    className="inline-block h-0.5 w-4"
                    style={{
                      backgroundColor: ESTILO_SEGMENTO[tipo].color,
                      borderTop: ESTILO_SEGMENTO[tipo].dashArray ? `2px dashed ${ESTILO_SEGMENTO[tipo].color}` : undefined,
                    }}
                  />
                  {ETIQUETA_SEGMENTO[tipo]}
                </Badge>
              ))}
            </div>
          ) : null}

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

export default ResumenRutaModal;
