import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CostosRutaOferta, CostosRutaTerminal } from '../types/costosRuta.types';
import { horaAmPm } from '../services/calculoViaje';
import { CeldaCaptura } from './celdasCotizacion';
import { LineaConCoordenadas } from './LineaConCoordenadas';
import { buscarCaptura } from '../services/capturas.api';

export interface TablaOpcionesProps {
  titulo: string;
  ofertas: CostosRutaOferta[];
  opcionElegidaId?: string | null;
  onElegir?: (oferta: CostosRutaOferta) => void;
  precioEnCursoId?: string | null;
  avisoPrecio?: Record<string, string>;
}

const SIN_URL =
  'Esta opción no trae URL de compra: el cálculo no la trajo y no hay un enlace real al que enviarte. Pide la cotización al proveedor o recalcula cuando exista la fuente.';

const BADGE_MODO: Record<string, { texto: string; clase: string }> = {
  bus: { texto: 'Bus', clase: 'border-sky-200 bg-sky-50 text-sky-700' },
  avion: { texto: 'Avión', clase: 'border-violet-200 bg-violet-50 text-violet-700' },
  taxi: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  uber: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
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

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function partirFechaHora(texto: string): { fecha: string; hora: string } | null {
  const partes = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})$/.exec(texto.trim());
  if (!partes) return null;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  if (!dia || mes < 1 || mes > 12) return null;
  return { fecha: `${dia} de ${MESES[mes - 1]}`, hora: partes[3] };
}

function FechaHoraBadges({ texto }: { texto: string }) {
  const partes = partirFechaHora(texto);
  if (!partes) return <>{texto}</>;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className="whitespace-nowrap border-slate-200 bg-slate-50 text-slate-700">
        {partes.fecha}
      </Badge>
      <Badge variant="outline" className="whitespace-nowrap border-slate-200 tabular-nums">
        {horaAmPm(partes.hora) ?? partes.hora}
      </Badge>
    </div>
  );
}

function minutosTexto(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return [horas > 0 ? `${horas} h` : '', resto > 0 ? `${resto} min` : '']
    .filter(Boolean)
    .join(' ');
}

function minutosDeDuracion(duracion: string): number | null {
  const partes = duracion.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (!partes) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

function duracionHm(minutos: number): string {
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}m`;
}

const AYUDA_TIEMPO_TOTAL =
  'Tiempo total = lo que dura el viaje + lo que hay que estar ahí antes (abordaje en la terminal o el aeropuerto) + el traslado en taxi a la terminal. En vuelos también cuenta bajar y recoger maletas.';

const AYUDA_SALE_ANTES =
  'Sale antes de tu hora de salida: para tomarlo tendrías que salir del origen antes de la hora que declaraste, contando el traslado y el tiempo de estar en la terminal. Si puedes salir más temprano, ajusta tu hora de salida en el origen.';

function desgloseTiempo(oferta: CostosRutaOferta): {
  total: number;
  viaje: number;
  antes: number;
  despues: number;
  taxi: number;
  conDesgloseTaxi: boolean;
  taxiOrigen: number | null;
  taxiDestino: number | null;
} | null {
  const puertaAPuerta = minutosDeDuracion(oferta.duracion)
    ?? (oferta.puertaAPuertaH != null ? Math.round(oferta.puertaAPuertaH * 60) : null);
  if (puertaAPuerta === null) return null;
  const antes = oferta.minutosAntes ?? 0;
  const despues = oferta.minutosDespues ?? 0;
  const taxi = oferta.minutosTaxi ?? 0;
  const viaje = Math.max(0, puertaAPuerta - antes - despues);
  const conDesgloseTaxi = oferta.minutosTaxiOrigen != null
    || oferta.minutosTaxiDestino != null
    || 'minutosTaxiOrigen' in oferta
    || 'minutosTaxiDestino' in oferta;
  return {
    total: viaje + antes + despues + taxi,
    viaje,
    antes,
    despues,
    taxi,
    conDesgloseTaxi,
    taxiOrigen: oferta.minutosTaxiOrigen ?? null,
    taxiDestino: oferta.minutosTaxiDestino ?? null,
  };
}

function TerminalLinea({ terminal }: { terminal?: CostosRutaTerminal | null }) {
  if (!terminal?.nombre) return null;
  const texto =
    terminal.latitud && terminal.longitud
      ? `${terminal.nombre} · ${terminal.latitud}, ${terminal.longitud}`
      : terminal.nombre;
  return (
    <div className="mt-1 max-w-[190px] text-xs text-muted-foreground" title={terminal.nombre}>
      <LineaConCoordenadas texto={texto} />
    </div>
  );
}

const capturasPorUrl = new Map<string, string>();

function esCapturable(url: string | undefined): boolean {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const prohibidos = ['booking.com', 'expedia.com'];
    return !prohibidos.some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
  } catch {
    return false;
  }
}

function etiquetaTipoPrecio(oferta: CostosRutaOferta): string {
  if (oferta.tipoPrecio === 'cotizado') return 'Cotizado';
  if (oferta.tipoPrecio === 'referencia_tabulador') return 'Referencia tabulador';
  return 'Estimado';
}

export function TablaOpciones({ titulo, ofertas, opcionElegidaId, onElegir, precioEnCursoId, avisoPrecio }: TablaOpcionesProps) {
  const capturas = Object.fromEntries(capturasPorUrl) as Record<string, string>;
  const [rebuscadas, setRebuscadas] = useState<Record<string, string>>({});
  const [rebuscando, setRebuscando] = useState<Record<string, boolean>>({});

  async function rebuscarDe(oferta: CostosRutaOferta) {
    const url = oferta.comprar?.url;
    if (!url) return;

    const contexto = [
      `Ruta: ${oferta.de} → ${oferta.a}`,
      oferta.comprar?.fecha ? `Fecha: ${oferta.comprar.fecha}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    setRebuscando((previo) => ({ ...previo, [oferta.id]: true }));
    try {
      const resultado = await buscarCaptura(url, contexto);
      if (!resultado.archivo) {
        throw new Error(resultado.error ?? 'El agente no devolvio ninguna captura.');
      }
      capturasPorUrl.set(url, resultado.archivo);
      oferta.rutaCaptura = resultado.archivo;
      setRebuscadas((previo) => ({ ...previo, [oferta.id]: resultado.archivo as string }));
      if (resultado.error) {
        toast.warning(resultado.error);
      } else {
        toast.success('Captura actualizada con la búsqueda real del viaje.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo volver a buscar la oferta en el sitio.',
      );
    } finally {
      setRebuscando((previo) => {
        const copia = { ...previo };
        delete copia[oferta.id];
        return copia;
      });
    }
  }

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
            <TableHead>Captura</TableHead>
            <TableHead>Comprar</TableHead>
            <TableHead className="text-right">Elegir</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ofertas.map((o) => {
            const elegida = opcionElegidaId === o.id;
            const etiqueta = `${o.linea} ${o.salidaTxt} → ${o.llegadaTxt}`;
            const urlCompra = o.comprar?.url;
            const rutaCaptura = rebuscadas[o.id] ?? capturas[urlCompra ?? ''] ?? o.capturas?.[0] ?? o.rutaCaptura;
            return (
              <TableRow key={o.id} data-state={elegida ? 'selected' : undefined}>
                <TableCell>
                  <div className="font-medium">{o.linea}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {o.badge && <Badge variant="outline">{o.badge}</Badge>}
                    {o.noTomable && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="inline-flex rounded-md">
                              <Badge variant="destructive">Sale antes</Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{AYUDA_SALE_ANTES}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {}
                    {o.llegaTarde && (
                      <Badge
                        variant="destructive"
                        title={o.minutosTarde > 0
                          ? `Llega ${minutosTexto(o.minutosTarde)} después de tu hora límite de llegada.`
                          : 'Llega después de tu hora límite de llegada.'}
                      >
                        Tarde
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell><BadgeModo modo={o.modo} /></TableCell>
                <TableCell>
                  <FechaHoraBadges texto={o.salidaTxt} />
                  <TerminalLinea terminal={o.terminalOrigen} />
                </TableCell>
                <TableCell>
                  <FechaHoraBadges texto={o.llegadaTxt} />
                  <TerminalLinea terminal={o.terminalDestino} />
                </TableCell>
                <TableCell>
                  {(() => {
                    const d = desgloseTiempo(o);
                    if (!d) {
                      return <Badge variant="outline" className="whitespace-nowrap tabular-nums">{o.duracion}</Badge>;
                    }
                    const filas: { etiqueta: string; valor: string }[] = [];
                    if (d.viaje > 0) filas.push({ etiqueta: 'Viaje', valor: minutosTexto(d.viaje) });
                    if (d.antes > 0) filas.push({ etiqueta: 'En terminal', valor: minutosTexto(d.antes) });
                    if (d.despues > 0) filas.push({ etiqueta: 'Maletas', valor: minutosTexto(d.despues) });
                    if (d.conDesgloseTaxi) {
                      const valorTaxi = (minutos: number | null) => {
                        if (minutos === null) return 'por confirmar';
                        return minutos > 0 ? minutosTexto(minutos) : 'sin traslado';
                      };
                      filas.push({ etiqueta: 'Taxi punto → terminal', valor: valorTaxi(d.taxiOrigen) });
                      filas.push({ etiqueta: 'Taxi terminal → punto', valor: valorTaxi(d.taxiDestino) });
                    } else if (d.taxi > 0) {
                      filas.push({ etiqueta: 'Taxi', valor: minutosTexto(d.taxi) });
                    }
                    return (
                      <>
                        <Badge variant="outline" className="whitespace-nowrap tabular-nums">{duracionHm(d.total)}</Badge>
                        <table className="mt-1 text-xs text-muted-foreground">
                          <tbody>
                            {filas.map((fila) => (
                              <tr key={fila.etiqueta}>
                                <td className="pr-2">{fila.etiqueta}</td>
                                <td className="whitespace-nowrap tabular-nums">{fila.valor}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="whitespace-nowrap tabular-nums">{o.precioTxt}</Badge>
                  {o.costoTaxi && o.costoTaxi > 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      + taxi punto ↔ terminal{' '}
                      {o.costoTaxi.toLocaleString('es-MX', {
                        style: 'currency',
                        currency: 'MXN',
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {etiquetaTipoPrecio(o)}
                    {o.proveedor ? ` · ${o.proveedor}` : ''}
                    {o.disponibilidad ? ` · ${o.disponibilidad}` : ''}
                  </div>
                  {precioEnCursoId === o.id ? (
                    <div
                      role="status"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Confirmando precio real…
                    </div>
                  ) : null}
                  {avisoPrecio?.[o.id] ? (
                    <div className="mt-1 max-w-[220px] text-xs text-amber-700">
                      {avisoPrecio[o.id]}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <CeldaCaptura
                    ruta={rutaCaptura}
                    etiqueta={etiqueta}
                    onRebuscar={esCapturable(urlCompra) ? () => rebuscarDe(o) : undefined}
                    rebuscando={Boolean(rebuscando[o.id])}
                    sinCapturaTexto={urlCompra && !esCapturable(urlCompra) ? 'Link no capturable' : undefined}
                  />
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
