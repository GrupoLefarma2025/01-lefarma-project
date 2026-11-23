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
import type { CostosRutaHotel } from '../types/costosRuta.types';
import { CeldaCaptura, CeldaFuente } from './celdasCotizacion';

export interface TablaHotelesProps {
  titulo?: string;
  hoteles: CostosRutaHotel[];
}

const SIN_LINK =
  'Este hotel no trae link de reservación: el cálculo no encontró una URL real. Busca el hotel por nombre para cotizar en el sitio oficial.';

export function TablaHoteles({ titulo = 'Hoteles propuestos', hoteles }: TablaHotelesProps) {
  return (
    <div className="space-y-2">
      <div className="font-medium">{titulo}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lugar</TableHead>
            <TableHead>Ciudad</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead className="text-right">Noches</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Fuente</TableHead>
            <TableHead>Captura</TableHead>
            <TableHead>Reservar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hoteles.map((h, ix) => {
            const etiqueta = `${h.lugar} en ${h.ciudad}`;
            return (
              <TableRow key={`${h.lugar}-${h.ciudad}-${ix}`}>
                <TableCell>
                  <div className="font-medium">{h.lugar}</div>
                  <div className="text-xs text-muted-foreground">{h.habitaciones} hab.</div>
                </TableCell>
                <TableCell>{h.ciudad}</TableCell>
                <TableCell>{h.checkIn}</TableCell>
                <TableCell>{h.checkOut}</TableCell>
                <TableCell className="text-right">{h.noches}</TableCell>
                <TableCell>
                  <div>{h.motivo}</div>
                </TableCell>
                <TableCell>
                  <CeldaFuente fuente={h.fuente} estimado={true} />
                </TableCell>
                <TableCell>
                  <CeldaCaptura ruta={h.capturas?.[0] ?? h.rutaCaptura} etiqueta={etiqueta} />
                </TableCell>
                <TableCell>
                  {h.link ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={h.link} target="_blank" rel="noreferrer" aria-label={`Reservar ${etiqueta}`}>
                        Reservar ↗
                      </a>
                    </Button>
                  ) : (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button variant="outline" size="sm" disabled>
                              Reservar sin link
                              <span className="sr-only">{SIN_LINK}</span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{SIN_LINK}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
