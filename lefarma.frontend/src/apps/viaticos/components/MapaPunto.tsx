import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PuntoSeleccion } from '../types/costosRuta.types';

export interface MapaPuntoProps {
  punto: PuntoSeleccion | null;
  /** Si es falso, el mapa solo muestra: sin clic ni arrastre. */
  interactivo?: boolean;
  /** Clic en el mapa (solo en modo interactivo). */
  onPunto?: (latitud: number, longitud: number) => void;
  /** Arrastre del marcador (solo en modo interactivo). */
  onMover?: (latitud: number, longitud: number) => void;
}

const CENTRO_MEXICO: [number, number] = [23.6345, -102.5528];
const ZOOM_MEXICO = 5;
const ZOOM_PUNTO = 15;

function iconoMarcador() {
  return L.divIcon({
    className: 'custom-map-marker-punto',
    html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-primary shadow-md"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

/** Recentra el mapa cuando cambia el punto. */
function ControladorMapa({ centro }: { centro: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (centro) map.setView(centro, ZOOM_PUNTO);
  }, [map, centro]);
  return null;
}

/** Convierte un clic en el mapa en coordenadas. */
function ManejadorClick({ onPunto }: { onPunto: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPunto(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Mapa con un solo punto: el padre decide qué se muestra (punto elegido,
 * sucursal, etc.) y si se puede interactuar. Sin punto arranca con México.
 */
export function MapaPunto({ punto, interactivo, onPunto, onMover }: MapaPuntoProps) {
  const icono = useMemo(() => iconoMarcador(), []);
  const centro = punto ? ([punto.latitud, punto.longitud] as [number, number]) : null;
  const clic = interactivo ? onPunto : undefined;
  const arrastre = interactivo ? onMover : undefined;

  return (
    <MapContainer
      center={centro ?? CENTRO_MEXICO}
      zoom={centro ? ZOOM_PUNTO : ZOOM_MEXICO}
      scrollWheelZoom
      className="isolate h-64 w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ControladorMapa centro={centro} />
      {clic ? <ManejadorClick onPunto={clic} /> : null}
      {punto ? (
        <Marker
          position={[punto.latitud, punto.longitud]}
          draggable={interactivo === true}
          icon={icono}
          eventHandlers={
            arrastre
              ? {
                  dragend: (event) => {
                    const posicion = (event.target as L.Marker).getLatLng();
                    arrastre(posicion.lat, posicion.lng);
                  },
                }
              : undefined
          }
        >
          <Popup>{punto.nombre}</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
