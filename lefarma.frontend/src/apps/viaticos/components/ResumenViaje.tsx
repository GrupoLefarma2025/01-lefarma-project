import type { ReactNode } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PuntoSeleccion } from '../types/costosRuta.types';
import type { ResumenDestino, ResumenViajeDatos } from '../services/resumenViaje';
import { RutaViajeTimeline } from './RutaViajeTimeline';

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
 * Resumen del viaje: tarjetas de motivo/transporte/origen y diagrama de ruta
 * (origen → destinos → regreso). La línea se llena como una tubería y cada
 * punto se llena al ser alcanzado.
 */
export function ResumenViaje({ motivo, modoTransporte, compartido, acompanantes, origen, destinos, retorno, rango }: ResumenViajeDatos) {
  const nodos = construirNodos({ origen, destinos, retorno });

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
        <h3 className="mb-3 font-semibold">Ruta del viaje</h3>
        <RutaViajeTimeline nodos={nodos} />
      </div>

      <p className="text-xs text-muted-foreground">Fechas del viaje: {rango.inicio ?? '—'} al {rango.fin ?? '—'}.</p>
    </div>
  );
}
