import { useEffect, useState } from 'react';
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
import type { CostosRutaOferta, CostosRutaTerminal } from '../types/costosRuta.types';
import { horaAmPm } from '../services/calculoViaje';
import { CeldaCaptura } from './celdasCotizacion';
import { LineaConCoordenadas } from './LineaConCoordenadas';
import { capturarUrls } from '../services/capturas.api';

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

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "23/10 14:30" (formato del motor) -> fecha en letra y hora, por separado. */
function partirFechaHora(texto: string): { fecha: string; hora: string } | null {
  const partes = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})$/.exec(texto.trim());
  if (!partes) return null;
  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  if (!dia || mes < 1 || mes > 12) return null;
  return { fecha: `${dia} de ${MESES[mes - 1]}`, hora: partes[3] };
}

/**
 * Salida y llegada como dos badges: la fecha en letra ("23 de octubre") y la
 * hora en 12 h ("2:30 PM"), igual que el encabezado del tramo. Si el texto no
 * trae el formato esperado se pinta intacto: nunca se pierde la información.
 */
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

const AYUDA_SALE_ANTES =
  'Sale antes de tu hora de salida: para tomarlo tendrías que salir del origen antes de la hora que declaraste, contando el traslado y el tiempo de estar en la terminal. Si puedes salir más temprano, ajusta tu hora de salida en el origen.';

/**
 * Desglose del tiempo total de una oferta. `duracion` es puerta a puerta (ya
 * trae el abordaje), así que el viaje puro es la diferencia; el taxi a la
 * terminal lo estima el motor y se suma aparte.
 */
function desgloseTiempo(oferta: CostosRutaOferta): {
  total: number;
  viaje: number;
  antes: number;
  despues: number;
  taxi: number;
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
  // Dos taxis: punto → terminal y terminal → punto. Un cálculo viejo puede no
  // traer el desglose; en ese caso queda el total en una sola fila.
  const taxiOrigen = oferta.minutosTaxiOrigen ?? null;
  const taxiDestino = oferta.minutosTaxiDestino ?? null;
  return { total: viaje + antes + despues + taxi, viaje, antes, despues, taxi, taxiOrigen, taxiDestino };
}

/**
 * Terminal del extremo del viaje: la que informa el proveedor (ClickBus) o,
 * si no hay, la que estima el motor. Se muestra con sus coordenadas; sin
 * terminal no pinta nada, para no dejar lineas vacias en la tabla.
 */
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

/** Capturas ya tomadas en esta sesión del navegador, por URL. */
const capturasPorUrl = new Map<string, string>();
/** URLs con captura en curso, para no pedirla dos veces. */
const capturasEnCurso = new Set<string>();

/** Nombre estable y válido ([a-zA-Z0-9_-]) derivado de la URL. */
function nombreCaptura(url: string): string {
  let hash = 7;
  for (const c of url) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return `bus-${Math.abs(hash).toString(36)}`;
}

/**
 * Toma en segundo plano la captura de las mejores ofertas de autobús, sin
 * bloquear la tabla. Solo aplica a los enlaces de resultados de ClickBus: en
 * las demás fuentes la página no prueba el precio de esa opción.
 *
 * Devuelve url -> archivo y, cuando llega, la deja también en
 * `oferta.rutaCaptura` para que viaje en `solicitud_opciones` al enviar.
 */
function useCapturasAutomaticas(ofertas: CostosRutaOferta[]): Record<string, string> {
  const [rutas, setRutas] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls = [
      ...new Set(
        ofertas
          .filter((o) => o.modo === 'bus' && o.comprar?.url?.includes('/trips?departure_place='))
          .map((o) => o.comprar?.url as string),
      ),
    ].slice(0, 3);

    if (urls.length === 0) return;

    const desdeCache: Record<string, string> = {};
    for (const url of urls) {
      const ruta = capturasPorUrl.get(url);
      if (ruta) desdeCache[url] = ruta;
    }
    if (Object.keys(desdeCache).length > 0) setRutas((prev) => ({ ...prev, ...desdeCache }));

    const pendientes = urls.filter((u) => !capturasPorUrl.has(u) && !capturasEnCurso.has(u));
    if (pendientes.length === 0) return;

    let cancelado = false;
    for (const url of pendientes) capturasEnCurso.add(url);

    void (async () => {
      for (const url of pendientes) {
        try {
          const [resultado] = await capturarUrls([{ url, nombre: nombreCaptura(url) }]);
          if (resultado?.ok && resultado.archivo) {
            const archivo = resultado.archivo;
            capturasPorUrl.set(url, archivo);
            // El padre arma `solicitud_opciones` con estos mismos objetos: al
            // dejarlo en la oferta, la captura viaja al enviar.
            for (const oferta of ofertas) {
              if (oferta.comprar?.url === url) oferta.rutaCaptura = archivo;
            }
            if (!cancelado) setRutas((prev) => ({ ...prev, [url]: archivo }));
          }
        } catch {
          // Sin captura: la fila se queda en "Sin captura" y el flujo sigue.
        } finally {
          capturasEnCurso.delete(url);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ofertas]);

  return rutas;
}

export function TablaOpciones({ titulo, ofertas, opcionElegidaId, onElegir }: TablaOpcionesProps) {
  const capturas = useCapturasAutomaticas(ofertas);
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
                    {/* "Tarde" es solo llegar después del límite: salir antes no lo es. */}
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
                    const partes: { etiqueta: string; minutos: number }[] = [
                      { etiqueta: 'Viaje', minutos: d.viaje },
                      { etiqueta: 'En terminal', minutos: d.antes },
                      { etiqueta: 'Maletas', minutos: d.despues },
                    ];
                    if (d.taxiOrigen === null && d.taxiDestino === null) {
                      partes.push({ etiqueta: 'Taxi', minutos: d.taxi });
                    } else {
                      // Son dos taxis: el del punto a la terminal y el de la
                      // terminal al punto final.
                      partes.push({ etiqueta: 'Taxi punto → terminal', minutos: d.taxiOrigen ?? 0 });
                      partes.push({ etiqueta: 'Taxi terminal → punto', minutos: d.taxiDestino ?? 0 });
                    }
                    const visibles = partes.filter((parte) => parte.minutos > 0);
                    return (
                      <>
                        <Badge variant="outline" className="whitespace-nowrap tabular-nums">{duracionHm(d.total)}</Badge>
                        <table className="mt-1 text-xs text-muted-foreground">
                          <tbody>
                            {visibles.map((parte) => (
                              <tr key={parte.etiqueta}>
                                <td className="pr-2">{parte.etiqueta}</td>
                                <td className="whitespace-nowrap tabular-nums">{minutosTexto(parte.minutos)}</td>
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
                </TableCell>
                <TableCell>
                  <CeldaCaptura
                    ruta={capturas[o.comprar?.url ?? ''] ?? o.capturas?.[0] ?? o.rutaCaptura}
                    etiqueta={etiqueta}
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
