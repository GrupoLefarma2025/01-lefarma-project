import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CostosRutaOferta } from '../types/costosRuta.types';
import { CeldaCaptura, CeldaFuente } from './celdasCotizacion';

export interface TablaOpcionesProps {
  /** Etiqueta del tramo, para el encabezado de la tabla. */
  titulo: string;
  ofertas: CostosRutaOferta[];
  /** Clave de la fila elegida (id de la oferta); se resalta en la tabla. */
  opcionElegidaId?: string | null;
  onElegir?: (oferta: CostosRutaOferta) => void;
}

const SIN_URL =
  'Esta opción no trae URL de compra: el cálculo no la trajo y no hay un enlace real al que enviarte. Pide la cotización al proveedor o recalcula cuando exista la fuente.';

/** Modo de transporte como badge: bus, avión y taxi con color propio; el resto neutro. */
const BADGE_MODO: Record<string, { texto: string; clase: string }> = {
  bus: { texto: 'Bus', clase: 'border-sky-200 bg-sky-50 text-sky-700' },
  avion: { texto: 'Avión', clase: 'border-violet-200 bg-violet-50 text-violet-700' },
  taxi: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  uber: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  // Transporte urbano: metro, metrobús, tren ligero o camión. El sistema
  // concreto va en la línea ("Transporte público (Metro / Metrobús)"), no en
  // el modo. "metro" es la clave vieja y se pinta igual.
  publico: { texto: 'Público', clase: 'border-teal-200 bg-teal-50 text-teal-700' },
  metro: { texto: 'Público', clase: 'border-teal-200 bg-teal-50 text-teal-700' },
};

function BadgeModo({ modo }: { modo: string }) {
  const config = BADGE_MODO[modo.trim().toLowerCase()];
  if (!config) {
    return <Badge variant="outline">{modo}</Badge>;
  }
  return <Badge variant="outline" className={config.clase}>{config.texto}</Badge>;
}

/** Minutos como "2 h" / "30 min" / "2 h 30 min". */
function minutosTexto(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return [horas > 0 ? `${horas} h` : '', resto > 0 ? `${resto} min` : '']
    .filter(Boolean)
    .join(' ');
}

/** "10h 43m" (formato del motor) -> 643 minutos; `null` si no trae el formato. */
function minutosDeDuracion(duracion: string): number | null {
  const partes = duracion.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (!partes) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

/** Minutos como "10h 43m", el mismo formato que usa el motor. */
function duracionHm(minutos: number): string {
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
}

/**
 * Qué significa la columna. El usuario pidió que quede explícito que el total
 * no es solo el viaje: suma lo que hay que estar ahí antes y el taxi a la
 * terminal que estima el motor.
 */
const AYUDA_TIEMPO_TOTAL =
  'Tiempo total = lo que dura el viaje + lo que hay que estar ahí antes (abordaje en la terminal o el aeropuerto) + el traslado en taxi a la terminal. En vuelos también cuenta bajar y recoger maletas.';

/**
 * Desglose del tiempo total de una oferta. `duracion` es puerta a puerta (ya
 * trae el abordaje), así que el viaje puro es la diferencia; el taxi a la
 * terminal lo estima el motor y se suma aparte.
 */
function desgloseTiempo(oferta: CostosRutaOferta): { total: number; viaje: number; antes: number; despues: number; taxi: number } | null {
  const puertaAPuerta = minutosDeDuracion(oferta.duracion)
    ?? (oferta.puertaAPuertaH != null ? Math.round(oferta.puertaAPuertaH * 60) : null);
  if (puertaAPuerta === null) return null;
  const antes = oferta.minutosAntes ?? 0;
  const despues = oferta.minutosDespues ?? 0;
  const taxi = oferta.minutosTaxi ?? 0;
  const viaje = Math.max(0, puertaAPuerta - antes - despues);
  return { total: viaje + antes + despues + taxi, viaje, antes, despues, taxi };
}

export function TablaOpciones({ titulo, ofertas, opcionElegidaId, onElegir }: TablaOpcionesProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">{titulo}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transportista</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead>Llegada</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                Tiempo total
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Qué incluye el tiempo total"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{AYUDA_TIEMPO_TOTAL}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Captura</TableHead>
            <TableHead>Comprar</TableHead>
            <TableHead className="text-right">Elegir</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ofertas.map((o) => {
            const elegida = opcionElegidaId === o.id;
            const etiqueta = `${o.linea} ${o.salidaTxt} → ${o.llegadaTxt}`;
            return (
              <TableRow key={o.id} data-state={elegida ? 'selected' : undefined}>
                <TableCell>
                  <div className="font-medium">{o.linea}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {o.badge && <Badge variant="outline">{o.badge}</Badge>}
                    {o.noTomable && <Badge variant="destructive">No tomable</Badge>}
                    {!o.aTiempo && <Badge variant="destructive">Tarde</Badge>}
                  </div>
                </TableCell>
                <TableCell><BadgeModo modo={o.modo} /></TableCell>
                <TableCell>{o.salidaTxt}</TableCell>
                <TableCell>{o.llegadaTxt}</TableCell>
                <TableCell>
                  {(() => {
                    const d = desgloseTiempo(o);
                    if (!d) return <div>{o.duracion}</div>;
                    const partes = [
                      `${minutosTexto(d.viaje)} de viaje`,
                      d.antes > 0 ? `${minutosTexto(d.antes)} antes` : '',
                      d.despues > 0 ? `${minutosTexto(d.despues)} de maletas` : '',
                      d.taxi > 0 ? `${minutosTexto(d.taxi)} de taxi` : '',
                    ].filter(Boolean);
                    return (
                      <>
                        <div>{duracionHm(d.total)}</div>
                        <div className="text-xs text-muted-foreground">{partes.join(' + ')}</div>
                      </>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <div>{o.precioTxt}</div>
                  {o.porPersona === false && (
                    <div className="text-xs text-muted-foreground">precio del grupo</div>
                  )}
                </TableCell>
                <TableCell>
                  <CeldaFuente fuente={o.fuente} estimado={o.estimado} />
                </TableCell>
                <TableCell>
                  <CeldaCaptura ruta={o.capturas?.[0] ?? o.rutaCaptura} etiqueta={etiqueta} />
                </TableCell>
                <TableCell>
                  {o.comprar?.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={o.comprar.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${o.comprar.accion || 'Comprar'} ${etiqueta}`}
                      >
                        {o.comprar.accion || 'Comprar'} ↗
                      </a>
                    </Button>
                  ) : (
                    // Sin URL no hay enlace roto: botón deshabilitado con el motivo explained.
                    // El texto `sr-only` es el motivo para lector de pantalla: un <button disabled>
                    // no dispara hover, así que el tooltip por sí solo no es accesible.
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button variant="outline" size="sm" disabled>
                              {o.comprar?.accion || 'Comprar'} sin URL
                              <span className="sr-only">{SIN_URL}</span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{SIN_URL}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={elegida ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={elegida}
                    aria-label={`Elegir ${etiqueta}`}
                    disabled={!onElegir}
                    onClick={() => onElegir?.(o)}
                  >
                    {elegida ? 'Elegida' : 'Elegir'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
