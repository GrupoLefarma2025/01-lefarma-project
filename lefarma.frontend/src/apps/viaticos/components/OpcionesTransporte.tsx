import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bus,
  CarFront,
  Check,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Plane,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { horaAmPm } from '../services/calculoViaje';
import type { CostosRutaOferta } from '../types/costosRuta.types';
import { MiniaturaCaptura } from './celdasCotizacion';

export type TipoTransporte = 'avion' | 'bus' | 'renta' | 'otros';
export type CriterioOrdenOfertas = 'cerca' | 'barato' | 'hora';

const CRITERIOS: Array<{ valor: CriterioOrdenOfertas; etiqueta: string; ayuda: string }> = [
  {
    valor: 'cerca',
    etiqueta: 'Cerca de mi hora',
    ayuda: 'Primero las salidas cercanas a tu hora; luego las más baratas.',
  },
  {
    valor: 'barato',
    etiqueta: 'Más baratas',
    ayuda: 'Ordenadas de menor a mayor precio.',
  },
  {
    valor: 'hora',
    etiqueta: 'Por hora',
    ayuda: 'Ordenadas por hora de salida.',
  },
];

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const GRUPOS: Array<{
  tipo: TipoTransporte;
  etiqueta: string;
  Icono: LucideIcon;
  activo: string;
}> = [
  { tipo: 'avion', etiqueta: 'Avión', Icono: Plane, activo: 'border-violet-200 bg-violet-50 text-violet-800' },
  { tipo: 'bus', etiqueta: 'Autobús', Icono: Bus, activo: 'border-sky-200 bg-sky-50 text-sky-800' },
  { tipo: 'renta', etiqueta: 'Renta', Icono: CarFront, activo: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { tipo: 'otros', etiqueta: 'Otros', Icono: MoreHorizontal, activo: 'border-amber-200 bg-amber-50 text-amber-800' },
];

const MODO = {
  avion: { texto: 'Avión', clase: 'border-violet-200 bg-violet-50 text-violet-700' },
  bus: { texto: 'Autobús', clase: 'border-sky-200 bg-sky-50 text-sky-700' },
  renta: { texto: 'Renta', clase: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  taxi: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  uber: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  publico: { texto: 'Público', clase: 'border-teal-200 bg-teal-50 text-teal-700' },
  metro: { texto: 'Público', clase: 'border-teal-200 bg-teal-50 text-teal-700' },
} as const;

function grupoDe(oferta: CostosRutaOferta): TipoTransporte {
  const modo = (oferta.modo ?? '').trim().toLowerCase();
  if (modo === 'avion') return 'avion';
  if (modo === 'bus') return 'bus';
  if (modo === 'renta') return 'renta';
  return 'otros';
}

function modoDe(oferta: CostosRutaOferta) {
  const modo = (oferta.modo ?? '').trim().toLowerCase() as keyof typeof MODO;
  return MODO[modo] ?? { texto: 'Otros', clase: 'border-slate-200 bg-slate-50 text-slate-600' };
}

function horario(texto: string): string {
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (!partes) return texto;
  const mes = MESES_CORTOS[Number(partes[2]) - 1] ?? '';
  return `${Number(partes[1])} ${mes} · ${horaAmPm(partes[3]) ?? partes[3]}`;
}

function minutosTexto(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return [horas > 0 ? `${horas} h` : '', resto > 0 ? `${resto} min` : '']
    .filter(Boolean)
    .join(' ');
}

function mxn(valor: number): string {
  return valor.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });
}

function etiquetaPrecio(oferta: CostosRutaOferta) {
  if (oferta.tipoPrecio === 'cotizado') {
    return { texto: 'Real', clase: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (oferta.tipoPrecio === 'referencia_tabulador') {
    return { texto: 'Referencia', clase: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  return { texto: 'Estimado', clase: 'border-amber-200 bg-amber-50 text-amber-700' };
}

function minutosIso(valor?: string | null): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor ?? '');
  if (!partes) return null;
  const [, anio, mes, dia, hora, minuto] = partes;
  return Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto)) / 60000;
}

function ordenarPorPrecio(a: CostosRutaOferta, b: CostosRutaOferta): number {
  return a.costoGrupo - b.costoGrupo
    || a.salidaTxt.localeCompare(b.salidaTxt)
    || a.id.localeCompare(b.id);
}

function ordenarPorHora(a: CostosRutaOferta, b: CostosRutaOferta): number {
  const aMin = minutosIso(a.salida);
  const bMin = minutosIso(b.salida);
  if (aMin !== null && bMin !== null && aMin !== bMin) return aMin - bMin;
  if (aMin !== null && bMin === null) return -1;
  if (aMin === null && bMin !== null) return 1;
  return ordenarPorPrecio(a, b);
}

function ordenarResto(a: CostosRutaOferta, b: CostosRutaOferta): number {
  if (a.noTomable !== b.noTomable) return a.noTomable ? 1 : -1;
  if (a.noTomable) return ordenarPorPrecio(a, b);
  return (a.minutosTarde || 0) - (b.minutosTarde || 0) || ordenarPorPrecio(a, b);
}

function ordenarOfertasPorCriterio(
  ofertas: CostosRutaOferta[],
  criterio: CriterioOrdenOfertas,
  salidaReferencia?: string | null,
): CostosRutaOferta[] {
  const viables = ofertas.filter((oferta) => oferta.aTiempo && !oferta.noTomable);
  const resto = ofertas.filter((oferta) => !oferta.aTiempo || oferta.noTomable);

  if (criterio === 'barato') {
    return [...viables.sort(ordenarPorPrecio), ...resto.sort(ordenarResto)];
  }
  if (criterio === 'hora') {
    return [...viables.sort(ordenarPorHora), ...resto.sort(ordenarPorHora)];
  }

  const referencia = minutosIso(salidaReferencia);
  if (referencia === null) {
    return [...viables.sort(ordenarPorPrecio), ...resto.sort(ordenarResto)];
  }

  const cercanas = viables
    .map((oferta) => ({ oferta, minuto: minutosIso(oferta.salida) }))
    .filter((item) => item.minuto !== null)
    .sort((a, b) =>
      Math.abs(a.minuto! - referencia) - Math.abs(b.minuto! - referencia)
      || ordenarPorPrecio(a.oferta, b.oferta))
    .slice(0, 2)
    .map((item) => item.oferta);

  const anteriores = resto
    .filter((oferta) => oferta.noTomable && !oferta.llegaTarde)
    .map((oferta) => ({ oferta, minuto: minutosIso(oferta.salida) }))
    .filter((item) => item.minuto !== null)
    .sort((a, b) =>
      Math.abs(a.minuto! - referencia) - Math.abs(b.minuto! - referencia));
  const anterior = anteriores[0]?.oferta ?? null;

  const elegidas = new Set(
    [...cercanas, ...(anterior ? [anterior] : [])].map((oferta) => oferta.id),
  );
  const baratas = viables.filter((oferta) => !elegidas.has(oferta.id)).sort(ordenarPorPrecio);
  const restantes = resto.filter((oferta) => !elegidas.has(oferta.id)).sort(ordenarResto);

  return [...cercanas, ...(anterior ? [anterior] : []), ...baratas, ...restantes];
}

function CapturaOferta({ ruta, alt }: { ruta: string; alt: string }) {
  return (
    <MiniaturaCaptura
      ruta={ruta}
      alt={alt}
      className="h-14 w-24 rounded-lg border border-slate-200 bg-slate-50 object-contain"
    />
  );
}

export interface OpcionesTransporteProps {
  ofertas: CostosRutaOferta[];
  opcionElegidaId?: string | null;
  onElegir: (oferta: CostosRutaOferta) => void;
  modoInicial?: TipoTransporte;
  salidaReferencia?: string | null;
  limite?: number;
  cargando?: boolean;
  aviso?: string | null;
  precioEnCursoId?: string | null;
  avisoPrecio?: Record<string, string>;
  onSolicitarReales?: (tipo: TipoTransporte) => void;
  onReintentar?: () => void;
}

export function OpcionesTransporte({
  ofertas,
  opcionElegidaId,
  onElegir,
  modoInicial = 'avion',
  salidaReferencia,
  limite = 6,
  cargando = false,
  aviso,
  precioEnCursoId,
  avisoPrecio,
  onSolicitarReales,
  onReintentar,
}: OpcionesTransporteProps) {
  const [activo, setActivo] = useState<TipoTransporte>(modoInicial);
  const [criterio, setCriterio] = useState<CriterioOrdenOfertas>('cerca');
  const [verTodos, setVerTodos] = useState<{
    activo: TipoTransporte;
    criterio: CriterioOrdenOfertas;
  } | null>(null);
  const solicitadosRef = useRef<Set<TipoTransporte>>(new Set());

  const conteos = useMemo(() => {
    const inicial: Record<TipoTransporte, number> = { avion: 0, bus: 0, renta: 0, otros: 0 };
    for (const oferta of ofertas) inicial[grupoDe(oferta)] += 1;
    return inicial;
  }, [ofertas]);

  const primerGrupoConOpciones = GRUPOS.find((grupo) => conteos[grupo.tipo] > 0)?.tipo;
  const activoEfectivo = conteos[activo] > 0 ? activo : (primerGrupoConOpciones ?? activo);

  useEffect(() => {
    if (conteos[activoEfectivo] === 0) return;
    if (solicitadosRef.current.has(activoEfectivo)) return;
    solicitadosRef.current.add(activoEfectivo);
    onSolicitarReales?.(activoEfectivo);
  }, [activoEfectivo, conteos, onSolicitarReales]);

  const delTab = useMemo(
    () => ordenarOfertasPorCriterio(
      ofertas.filter((oferta) => grupoDe(oferta) === activoEfectivo),
      criterio,
      salidaReferencia,
    ),
    [ofertas, activoEfectivo, criterio, salidaReferencia],
  );
  const verTodosActivo = verTodos?.activo === activoEfectivo && verTodos.criterio === criterio;
  const visibles = verTodosActivo ? delTab : delTab.slice(0, limite);
  const etiquetaGrupo = GRUPOS.find((grupo) => grupo.tipo === activoEfectivo)?.etiqueta ?? 'transporte';
  const criterioActivo = CRITERIOS.find((item) => item.valor === criterio) ?? CRITERIOS[0];
  const referenciaMin = minutosIso(salidaReferencia);
  const ayudaCriterio = criterio === 'cerca' && referenciaMin === null
    ? 'Sin hora de referencia: ordenadas por precio.'
    : criterioActivo.ayuda;
  const mostrandoCarga = cargando && activoEfectivo === 'avion';

  const idBarata = useMemo(() => {
    const viables = delTab.filter((oferta) => oferta.aTiempo && !oferta.noTomable);
    const pool = viables.length > 0 ? viables : delTab;
    return [...pool].sort(ordenarPorPrecio)[0]?.id ?? null;
  }, [delTab]);

  const idCercana = useMemo(() => {
    if (referenciaMin === null) return null;
    const viables = delTab.filter((oferta) => oferta.aTiempo && !oferta.noTomable);
    const pool = viables.length > 0 ? viables : delTab;
    const ordenadas = [...pool]
      .map((oferta) => ({ oferta, minuto: minutosIso(oferta.salida) }))
      .filter((item) => item.minuto !== null)
      .sort((a, b) => Math.abs(a.minuto! - referenciaMin) - Math.abs(b.minuto! - referenciaMin));
    return ordenadas[0]?.oferta.id ?? null;
  }, [delTab, referenciaMin]);

  return (
    <div className="space-y-3" data-testid="opciones-transporte">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Tipo de transporte"
          className="flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1"
        >
          {GRUPOS.map(({ tipo, etiqueta, Icono, activo: claseActivo }) => {
            const seleccionado = activoEfectivo === tipo;
            const vacio = conteos[tipo] === 0;
            return (
              <button
                key={tipo}
                type="button"
                role="tab"
                aria-selected={seleccionado}
                disabled={vacio}
                onClick={() => setActivo(tipo)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  seleccionado
                    ? cn('border shadow-sm', claseActivo)
                    : 'border border-transparent text-slate-600 hover:bg-white/70',
                  vacio && 'cursor-not-allowed opacity-40',
                )}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden />
                {etiqueta}
                <span className="rounded-full bg-white/70 px-1.5 text-[10px] tabular-nums">
                  {conteos[tipo]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Ordenar</span>
            <select
              aria-label="Criterio de orden"
              value={criterio}
              onChange={(event) => setCriterio(event.target.value as CriterioOrdenOfertas)}
              className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {CRITERIOS.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </label>
          {onReintentar && activoEfectivo === 'avion' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-xs"
              onClick={onReintentar}
              disabled={cargando}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', cargando && 'animate-spin')} aria-hidden />
              Actualizar
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{ayudaCriterio}</p>

      {aviso && !mostrandoCarga && activoEfectivo === 'avion' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span>{aviso}</span>
          {onReintentar ? (
            <button type="button" className="font-medium underline" onClick={onReintentar}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {mostrandoCarga ? (
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Confirmando precio real…
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {Array.from({ length: 3 }).map((_, indice) => (
              <Skeleton key={indice} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No hay opciones de {etiquetaGrupo.toLowerCase()} para este tramo.
        </div>
      ) : (
        <>
          <ul className="grid gap-2 lg:grid-cols-2">
            {visibles.map((oferta) => {
              const elegida = opcionElegidaId === oferta.id;
              const esCercana = oferta.id === idCercana;
              const esBarata = oferta.id === idBarata;
              const modo = modoDe(oferta);
              const precio = etiquetaPrecio(oferta);
              const captura = oferta.capturas?.[0] ?? oferta.rutaCaptura ?? null;
              return (
                <li key={oferta.id}>
                  <article
                    className={cn(
                      'flex h-full flex-col gap-3 rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors',
                      elegida
                        ? 'border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20'
                        : 'border-slate-200/80 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={modo.clase}>{modo.texto}</Badge>
                          <span className="truncate text-sm font-semibold">{oferta.linea}</span>
                          {esCercana ? (
                            <Badge
                              variant="outline"
                              className="border-sky-200 bg-sky-50 text-sky-700"
                              title="Salida cercana a tu hora de referencia"
                            >
                              Cerca
                            </Badge>
                          ) : null}
                          {esBarata ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                              title="Menor costo total del tramo (boleto + taxi)"
                            >
                              Más barata
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{horario(oferta.salidaTxt)}</span>
                          <span aria-hidden>→</span>
                          <span>{horario(oferta.llegadaTxt)}</span>
                          <span aria-hidden>·</span>
                          <span>{oferta.duracion}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {oferta.noTomable ? (
                          <Badge variant="destructive">Sale antes</Badge>
                        ) : oferta.llegaTarde ? (
                          <Badge
                            variant="destructive"
                            title={oferta.minutosTarde > 0
                              ? `Llega ${minutosTexto(oferta.minutosTarde)} después de tu hora límite.`
                              : 'Llega después de tu hora límite.'}
                          >
                            Tarde
                          </Badge>
                        ) : oferta.aTiempo ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            A tiempo
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className={precio.clase}>{precio.texto}</Badge>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold tracking-tight tabular-nums">{oferta.precioTxt}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {oferta.proveedor || oferta.fuente}
                          {oferta.costoTaxi && oferta.costoTaxi > 0
                            ? ` · + taxi ${mxn(oferta.costoTaxi)}`
                            : ''}
                        </p>
                      </div>
                      {captura ? (
                        <CapturaOferta ruta={captura} alt={`Captura de ${oferta.linea}`} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Se captura al terminar</span>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      {oferta.comprar?.url ? (
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1 rounded-lg text-xs">
                          <a href={oferta.comprar.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {oferta.comprar.accion || 'Comprar'}
                          </a>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sin enlace de compra</span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={elegida ? 'default' : 'outline'}
                        className="h-8 gap-1 rounded-lg text-xs"
                        aria-pressed={elegida}
                        aria-label={`Elegir ${oferta.linea} ${oferta.salidaTxt} → ${oferta.llegadaTxt}`}
                        onClick={() => onElegir(oferta)}
                      >
                        {elegida ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                        {elegida ? 'Elegida' : 'Elegir'}
                      </Button>
                    </div>

                    {precioEnCursoId === oferta.id ? (
                      <p role="status" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Confirmando precio real…
                      </p>
                    ) : null}
                    {avisoPrecio?.[oferta.id] ? (
                      <p className="text-[11px] text-amber-700">{avisoPrecio[oferta.id]}</p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
          {delTab.length > limite ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs text-muted-foreground"
                onClick={() => setVerTodos(
                  verTodosActivo ? null : { activo: activoEfectivo, criterio },
                )}
              >
                {verTodosActivo ? 'Ver menos' : `Ver todos (${delTab.length})`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
