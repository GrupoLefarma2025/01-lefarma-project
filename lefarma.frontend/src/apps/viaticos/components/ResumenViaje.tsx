import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PuntoSeleccion } from '../types/costosRuta.types';
import type { ResumenDestino, ResumenViajeDatos } from '../services/resumenViaje';

interface NodoRuta {
  id: string;
  tipo: 'origen' | 'destino' | 'regreso';
  titulo: string;
  detalles: ReactNode[];
  testId?: string;
}

function etiquetaUbicacion(punto: PuntoSeleccion | null): string {
  if (!punto) return '—';
  const partes = [punto.municipio, punto.estado].filter(
    (valor): valor is string => typeof valor === 'string' && valor.trim() !== '',
  );
  return partes.length > 0 ? partes.join(', ') : punto.nombre;
}

const NOMBRES_GENERICOS = new Set(['punto seleccionado en mapa', 'punto seleccionado', 'punto']);

/** Solo estado/municipio del punto (sin el nombre genérico del mapa). */
function estadoMunicipio(punto: PuntoSeleccion | null): string {
  if (!punto) return '';
  return [punto.municipio, punto.estado]
    .filter((valor): valor is string => typeof valor === 'string' && valor.trim() !== '')
    .join(', ');
}

/** Estado/municipio; si no hay, el nombre del punto salvo los genéricos. */
function nombreOUbicacion(punto: PuntoSeleccion | null): string {
  const ubicacion = estadoMunicipio(punto);
  if (ubicacion) return ubicacion;
  const nombre = punto?.nombre.trim() ?? '';
  return nombre !== '' && !NOMBRES_GENERICOS.has(nombre.toLowerCase()) ? nombre : '';
}

function coordenadas(punto: PuntoSeleccion | null): string {
  if (!punto) return '';
  return `${punto.latitud.toFixed(5)}, ${punto.longitud.toFixed(5)}`;
}

/** Mapa de referencia de solo lectura: punto pequeño y vista amplia del estado. */
function MapaResumen({ punto }: { punto: PuntoSeleccion }) {
  return (
    <MapContainer
      center={[punto.latitud, punto.longitud]}
      zoom={7}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl={false}
      className="h-[340px] w-[520px] max-w-[85vw] cursor-default rounded-md"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[punto.latitud, punto.longitud]}
        radius={5}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#eb6c36', fillOpacity: 1 }}
      />
    </MapContainer>
  );
}

/** Ubicación con coordenadas clicables: abren el mapa de referencia. */
function DetalleUbicacion({
  punto,
  sufijo,
  usarNombre = false,
}: {
  punto: PuntoSeleccion | null;
  sufijo?: string;
  usarNombre?: boolean;
}) {
  const lugar = usarNombre ? nombreOUbicacion(punto) : estadoMunicipio(punto);
  const coords = coordenadas(punto);
  if (!punto || !coords) {
    return <>{[lugar, sufijo].filter(Boolean).join(' ') || '—'}</>;
  }
  return (
    <>
      {lugar ? `${lugar} · ` : ''}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground"
            aria-label={`Ver ${lugar || 'el punto'} en el mapa`}
          >
            {coords}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" collisionPadding={12} className="w-auto p-2">
          <MapaResumen punto={punto} />
          <p className="px-1 pt-1 text-[10px] text-muted-foreground">© OpenStreetMap contributors</p>
        </PopoverContent>
      </Popover>
      {sufijo ? ` ${sufijo}` : null}
    </>
  );
}

function etiquetaDestinoResumen(destino: ResumenDestino): string {
  const personalizada = destino.etiqueta?.trim();
  if (personalizada) return personalizada;
  return destino.punto ? etiquetaUbicacion(destino.punto) : 'Sin destino';
}

function construirNodos(datos: Pick<ResumenViajeDatos, 'origen' | 'destinos' | 'retorno'>): NodoRuta[] {
  return [
    {
      id: 'origen',
      tipo: 'origen',
      titulo: 'Origen',
      detalles: [<DetalleUbicacion key="origen" punto={datos.origen.punto} />],
    },
    ...datos.destinos.map((destino, i) => ({
      id: String(destino.id ?? `destino-${i}`),
      tipo: 'destino' as const,
      titulo: `${i + 1}. ${etiquetaDestinoResumen(destino)}`,
      detalles: [
        `Llegada: ${destino.debeEstarFecha || '—'} ${destino.debeEstarHora || ''} · Salida: ${destino.saleFecha || '—'} ${destino.saleHora || ''}`,
        ...(destino.punto
          ? [<DetalleUbicacion key={`destino-${i}-mapa`} punto={destino.punto} />]
          : []),
      ],
    })),
    {
      id: 'regreso',
      tipo: 'regreso',
      titulo: 'Regreso',
      detalles: [
        datos.retorno.destino === 'origen'
          ? <DetalleUbicacion key="regreso" punto={datos.origen.punto} sufijo="(origen)" />
          : <DetalleUbicacion key="regreso" punto={datos.retorno.punto} usarNombre />,
      ],
      testId: 'resumen-regreso',
    },
  ];
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
 * Resumen del viaje: tarjetas de motivo/transporte/origen y diagrama de ruta
 * (origen → destinos → regreso). La línea se llena como una tubería y cada
 * punto se llena al ser alcanzado.
 */
export function ResumenViaje({ motivo, modoTransporte, compartido, acompanantes, origen, destinos, retorno, rango }: ResumenViajeDatos) {
  const nodos = construirNodos({ origen, destinos, retorno });

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
    <div className="space-y-4 text-sm select-none">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-3 shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
          <dt className="text-xs text-muted-foreground">Motivo</dt>
          <dd className="font-medium">{motivo || '—'}</dd>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
          <dt className="text-xs text-muted-foreground">Transporte</dt>
          <dd className="font-medium">{modoTransporte === 'propio' ? 'Carro propio' : 'Solicitud de transporte'}</dd>
          {compartido || acompanantes.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Compartido{acompanantes.length > 0 ? ` con ${acompanantes.join(', ')}` : ''}
            </p>
          ) : null}
        </div>
      </dl>

      <div data-testid="diagrama-ruta" className="rounded-lg border bg-card p-4 shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
        <style>{ANIMACION_RUTA_CSS}</style>
        <h3 className="mb-3 font-semibold">Ruta del viaje</h3>
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
              {nodo.detalles.map((linea, idx) => (
                <p key={idx} data-testid={idx === 0 ? nodo.testId : undefined} className="text-xs text-muted-foreground">{linea}</p>
              ))}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-muted-foreground">Fechas del viaje: {rango.inicio ?? '—'} al {rango.fin ?? '—'}.</p>
    </div>
  );
}
