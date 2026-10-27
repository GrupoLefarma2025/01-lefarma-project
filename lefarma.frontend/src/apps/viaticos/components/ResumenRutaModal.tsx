import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RutaViajeTimeline, type NodoRutaTimeline } from './RutaViajeTimeline';
import {
  ETIQUETA_SEGMENTO,
  ETIQUETA_TIPO,
  ESTILO_SEGMENTO,
  COLOR_POR_TIPO,
  type PuntoMapa,
  type SegmentoMapa,
  type TipoPuntoMapa,
} from './rutaMapa.types';
import { RutaMapa } from './RutaMapa';

export type TipoPuntoRuta = TipoPuntoMapa;

export interface PuntoRutaResumen extends PuntoMapa {
  detalle?: string;
}

export type SegmentoRuta = SegmentoMapa;

interface ResumenRutaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  puntos: PuntoRutaResumen[];
  /** Trazado completo de la ruta, tramo por tramo (taxi / vuelo / carretera). */
  segmentos: SegmentoRuta[];
  /** Paradas de la ruta en orden, con su detalle (llegada, transporte, hora). */
  nodos: NodoRutaTimeline[];
  onEnviar: () => void;
  enviando: boolean;
  /** Etiqueta del botón de confirmación (enviar o autorizar). */
  textoAccion?: string;
  textoEnviando?: string;
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
  nodos,
  onEnviar,
  enviando,
  textoAccion = 'Enviar a concentrado',
  textoEnviando = 'Enviando…',
}: ResumenRutaModalProps) {
  const tiposSegmento = Array.from(new Set(segmentos.map((s) => s.tipo)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[90vw] max-w-[90vw] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumen reconstruido</DialogTitle>
          <DialogDescription>
            Ruta completa: origen, terminal, vuelo o autobús, hotel y regreso, ya recalculada.
            Puedes mover el mapa y hacer zoom; es de solo lectura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {puntos.length > 0 ? (
              <RutaMapa puntos={puntos} segmentos={segmentos} alto={420} />
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay puntos para trazar.</p>
            )}

            <div data-testid="resumen-ruta-diagrama" className="max-h-[420px] overflow-y-auto rounded-lg border bg-card p-4">
              <h3 className="mb-3 font-semibold">Ruta del viaje</h3>
              <RutaViajeTimeline nodos={nodos} />
            </div>
          </div>

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
            {enviando ? textoEnviando : textoAccion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResumenRutaModal;
