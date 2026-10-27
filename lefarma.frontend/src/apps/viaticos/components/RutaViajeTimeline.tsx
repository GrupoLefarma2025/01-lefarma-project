import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { LineaConCoordenadas } from './LineaConCoordenadas';

export interface NodoRutaTimeline {
  id: string;
  titulo: string;
  detalles: ReactNode[];
  /** Etiquetas cortas del tramo (km, tiempo, horarios) que van bajo el título. */
  chips?: string[];
  testId?: string;
}

/**
 * El punto se llena desde abajo (como agua) cuando el líquido de la tubería
 * lo alcanza. La clase la pone el bucle de animación del componente.
 */
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

/**
 * Diagrama vertical de una ruta: una tubería que se llena de arriba a abajo y
 * un punto por parada que se rellena al ser alcanzado. Es el diseño de "Ruta
 * del viaje" del resumen y del resumen reconstruido antes de enviar.
 */
export function RutaViajeTimeline({ nodos }: { nodos: NodoRutaTimeline[] }) {
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
        .slice(0, nodos.length)
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
        // La tubería va del primer punto al último, no más abajo.
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

    // Sin layout real (jsdom) o sin ResizeObserver: se muestra lleno, sin animar.
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

    // El líquido tarda más mientras más puntos tenga la ruta.
    const duracion = Math.min(7000, Math.max(3200, nodos.length * 1000));
    const pausa = 900;
    const ciclo = duracion + pausa;
    const inicio = performance.now();
    let raf = 0;

    const paso = (tiempo: number) => {
      const transcurrido = (tiempo - inicio) % ciclo;
      const enPausa = transcurrido >= duracion;
      const avance = enPausa ? 1 : transcurrido / duracion;
      // Fundido suave al terminar y al reiniciar el ciclo.
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
  }, [nodos.length]);

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
        {nodos.map((nodo, i) => (
          <li key={nodo.id} className="relative pl-6">
            <span
              ref={(el) => { puntosRef.current[i] = el; }}
              aria-hidden
              className="absolute left-0 top-1 flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-background"
            >
              <span className="ruta-punto-relleno absolute inset-0 rounded-full bg-primary" />
            </span>
            <p className="font-medium">{nodo.titulo}</p>
            {nodo.chips && nodo.chips.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {nodo.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            {nodo.detalles.map((linea, idx) => (
              <p key={idx} data-testid={idx === 0 ? nodo.testId : undefined} className="text-xs text-muted-foreground">
                {typeof linea === 'string' ? <LineaConCoordenadas texto={linea} /> : linea}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </>
  );
}

export default RutaViajeTimeline;
