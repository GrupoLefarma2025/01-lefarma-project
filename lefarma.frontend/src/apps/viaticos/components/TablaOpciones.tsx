import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
                <TableCell>{o.modo}</TableCell>
                <TableCell>{o.salidaTxt}</TableCell>
                <TableCell>{o.llegadaTxt}</TableCell>
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
