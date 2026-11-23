import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LineaConCoordenadas } from './LineaConCoordenadas';

export interface NodoRutaTimeline {
  id: string;
  titulo: string;
  detalles: ReactNode[];
  chips?: string[];
  costo?: number | null;
  urlCompra?: string | null;
  fase?: 'ida' | 'regreso';
  testId?: string;
}

const formatoMxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function urlCompraVisible(url: string | null | undefined): string | null {
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null;
}

const ANIMACION_RUTA_CSS = `
.ruta-punto-relleno {
  clip-path: inset(100% 0 0 0 round 9999px);
  transition: clip-path 280ms ease-out;
}
.ruta-punto-lleno .ruta-punto-relleno {
  clip-path: inset(0 0 0 0 round 9999px);
}
@media (prefers-reduced-motion: reduce) {
  .ruta-punto-relleno { transition: none; }
}
`;

function esParadaClave(nodo: NodoRutaTimeline): boolean {
  const titulo = nodo.titulo.trim();
  return /^\d+\./.test(titulo)
    || /^origen$/i.test(titulo)
    || /^regreso$/i.test(titulo)
    || /^hotel\b/i.test(titulo);
}

export function RutaViajeTimeline({
  nodos,
  mostrarFase = true,
  compacto = false,
}: {
  nodos: NodoRutaTimeline[];
  mostrarFase?: boolean;
  compacto?: boolean;
}) {
  const visibles = compacto
    ? nodos.filter(esParadaClave)
    : nodos;
  const nodosTimeline = visibles.length > 0 ? visibles : nodos;
  const intermedias = compacto && visibles.length > 0
    ? nodos.filter((nodo) => !esParadaClave(nodo))
    : [];
  const listaRef = useRef<HTMLOListElement | null>(null);
  const guiaRef = useRef<HTMLSpanElement | null>(null);
  const rellenoRef = useRef<HTMLSpanElement | null>(null);
  const puntaRef = useRef<HTMLSpanElement | null>(null);
  const puntosRef = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    const lista = listaRef.current;
    const guia = guiaRef.current;
    if (!lista || !guia) return;

    let alto = 0;
    let centros: number[] = [];

    const medir = () => {
      const listaRect = lista.getBoundingClientRect();
      const puntos = puntosRef.current
        .slice(0, nodosTimeline.length)
        .filter((punto): punto is HTMLSpanElement => punto !== null);
      if (puntos.length < 2) return;
      const absolutos = puntos.map((punto) => {
        const rect = punto.getBoundingClientRect();
        return rect.top + rect.height / 2 - listaRect.top;
      });
      const primero = absolutos[0];
      const ultimo = absolutos[absolutos.length - 1];
      alto = Math.max(0, ultimo - primero);
      centros = absolutos.map((centro) => centro - primero);
      if (alto > 0) {
        guia.style.top = `${primero}px`;
        guia.style.height = `${alto}px`;
      }
    };

    medir();

    const llenarTodo = () => {
      if (rellenoRef.current) rellenoRef.current.style.height = '100%';
      if (puntaRef.current) puntaRef.current.style.top = '100%';
      puntosRef.current.forEach((punto) => punto?.classList.add('ruta-punto-lleno'));
    };

    if (typeof ResizeObserver === 'undefined' || alto <= 0) {
      llenarTodo();
      return;
    }

    const observador = new ResizeObserver(medir);
    observador.observe(lista);

    const reducirMovimiento = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducirMovimiento) {
      llenarTodo();
      return () => observador.disconnect();
    }

    const duracion = Math.min(7000, Math.max(3200, nodosTimeline.length * 1000));
    const pausa = 900;
    const ciclo = duracion + pausa;
    const inicio = performance.now();
    let raf = 0;

    const paso = (tiempo: number) => {
      const transcurrido = (tiempo - inicio) % ciclo;
      const enPausa = transcurrido >= duracion;
      const avance = enPausa ? 1 : transcurrido / duracion;
      const opacidad = enPausa
        ? Math.min(1, (ciclo - transcurrido) / 220)
        : Math.min(1, transcurrido / 180);

      if (rellenoRef.current) {
        rellenoRef.current.style.height = `${avance * 100}%`;
        rellenoRef.current.style.opacity = `${opacidad}`;
      }
      if (puntaRef.current) {
        puntaRef.current.style.top = `${avance * 100}%`;
        puntaRef.current.style.opacity = `${opacidad}`;
      }
      const recorrido = avance * alto;
      puntosRef.current.forEach((punto, i) => {
        if (!punto) return;
        punto.classList.toggle('ruta-punto-lleno', recorrido >= (centros[i] ?? Number.POSITIVE_INFINITY));
      });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(raf);
      observador.disconnect();
    };
  }, [nodosTimeline.length]);

  return (
    <>
      <style>{ANIMACION_RUTA_CSS}</style>
      <ol ref={listaRef} className="relative space-y-4">
        <span
          ref={guiaRef}
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-[7px] top-2 w-px rounded-full bg-border"
        >
          <span ref={rellenoRef} className="absolute inset-x-0 top-0 h-0 rounded-full bg-primary" />
          <span
            ref={puntaRef}
            className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ boxShadow: '0 0 8px var(--primary)' }}
          />
        </span>
        {nodosTimeline.map((nodo, i) => {
          const urlCompra = urlCompraVisible(nodo.urlCompra);
          const esRegreso = nodo.fase === 'regreso';
          const inicioFase = mostrarFase
            && Boolean(nodo.fase)
            && nodo.fase !== nodosTimeline[i - 1]?.fase;
          return (
            <li key={nodo.id} className="relative pl-6">
              <span
                ref={(el) => { puntosRef.current[i] = el; }}
                aria-hidden
                className={cn(
                  'absolute left-0 top-1 flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-full border-2 bg-background',
                  esRegreso ? 'border-sky-500' : 'border-primary',
                )}
              >
                <span
                  className={cn(
                    'ruta-punto-relleno absolute inset-0 rounded-full',
                    esRegreso ? 'bg-sky-500' : 'bg-primary',
                  )}
                />
              </span>
              <p className="flex flex-wrap items-baseline gap-x-1.5 font-medium">
                {inicioFase ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      esRegreso ? 'bg-sky-50 text-sky-700' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {esRegreso ? 'Regreso' : 'Ida'}
                  </span>
                ) : null}
                <span>{nodo.titulo}</span>
              </p>
              {nodo.chips && nodo.chips.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {nodo.chips.join(' · ')}
                </p>
              ) : null}
              {nodo.detalles.map((linea, idx) => (
                <p key={idx} data-testid={idx === 0 ? nodo.testId : undefined} className="text-xs text-muted-foreground">
                  {typeof linea === 'string' ? <LineaConCoordenadas texto={linea} /> : linea}
                </p>
              ))}
              {typeof nodo.costo === 'number' && Number.isFinite(nodo.costo) ? (
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatoMxn.format(nodo.costo)}</p>
              ) : null}
              {urlCompra ? (
                <a
                  href={urlCompra}
                  target="_blank"
                  rel="noreferrer"
                  title={`Ir a compra: ${nodo.titulo}`}
                  className="mt-1 inline-flex text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Ir a compra
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
      {compacto && intermedias.length > 0 ? (
        <details className="mt-3 rounded-lg border border-slate-200/80 bg-muted/20 p-2 text-xs">
          <summary className="cursor-pointer select-none font-medium text-muted-foreground">
            Ver {intermedias.length} parada{intermedias.length === 1 ? '' : 's'} de traslado
          </summary>
          <ul className="mt-2 space-y-2">
            {intermedias.map((nodo) => (
              <li key={nodo.id} className="space-y-0.5 border-l border-border pl-2">
                <p className="font-medium">{nodo.titulo}</p>
                {nodo.chips && nodo.chips.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">{nodo.chips.join(' · ')}</p>
                ) : null}
                {nodo.detalles.map((linea, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {typeof linea === 'string' ? <LineaConCoordenadas texto={linea} /> : linea}
                  </p>
                ))}
                {typeof nodo.costo === 'number' && Number.isFinite(nodo.costo) ? (
                  <p className="text-sm font-semibold tabular-nums">{formatoMxn.format(nodo.costo)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

export default RutaViajeTimeline;
