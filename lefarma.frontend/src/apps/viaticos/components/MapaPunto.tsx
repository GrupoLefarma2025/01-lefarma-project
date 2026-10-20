import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PuntoSeleccion } from '../types/costosRuta.types';
import { dentroDeMexico } from '../services/ubicacionMexico';
import { toast } from 'sonner';
import { ManejadorClickDerecho, MenuContextualPunto, type PosicionMenu } from './MenuPuntoMapa';

export interface MapaPuntoProps {
  punto: PuntoSeleccion | null;
  /** Si es falso, el mapa solo muestra: sin clic ni arrastre. */
  interactivo?: boolean;
  /** Clic en el mapa (solo en modo interactivo). */
  onPunto?: (latitud: number, longitud: number) => void;
  /** Arrastre del marcador (solo en modo interactivo). */
  onMover?: (latitud: number, longitud: number) => void;
  /** Quitar el pin desde el menú contextual (solo en modo interactivo). */
  onQuitar?: () => void;
  /** Nota al pie del mapa (fondo amarillo). */
  pie?: ReactNode;
}

const CENTRO_MEXICO: [number, number] = [23.6345, -102.5528];
const ZOOM_MEXICO = 5;
const ZOOM_PUNTO = 15;

function iconoMarcador() {
  return L.divIcon({
    className: 'custom-map-marker-punto',
    html: '<div style="width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 1.5C7.9 1.5 4.5 4.9 4.5 9c0 5.4 7.5 13.5 7.5 13.5s7.5-8.1 7.5-13.5c0-4.1-3.4-7.5-7.5-7.5z" fill="#eb6c36" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 27],
    popupAnchor: [0, -27],
  });
}

/**
 * Recentra el mapa cuando cambia el punto. Si el mapa monta con un punto ya
 * elegido (p. ej. el regreso al origen), arranca enfocado en él; sin punto,
 * arranca en México.
 */
function ControladorMapa({ centro }: { centro: [number, number] | null }) {
  const map = useMap();
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      if (centro) map.setView(centro, ZOOM_PUNTO);
      return;
    }
    if (centro) map.setView(centro, ZOOM_PUNTO);
  }, [map, centro]);
  return null;
}

/** Convierte un clic en el mapa en coordenadas. */
function ManejadorClick({ onPunto }: { onPunto: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      // Los botones del menú no son clics del mapa: al pulsarlos, React ya
      // desmontó el menú y Leaflet recibe el clic con un botón desconectado
      // (o dentro del popup); ignorarlo evita re-fijar/mover el pin.
      const objetivo = (event.originalEvent as { target?: Element | null } | undefined)?.target;
      if (objetivo && (!objetivo.isConnected || objetivo.closest?.('.leaflet-popup'))) return;
      onPunto(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * El mapa arranca fijo para poder arrastrar el marcador sin moverlo por
 * accidente: solo con Ctrl presionado se habilitan arrastre y zoom con rueda.
 */
function ControlNavegacionCtrl() {
  const map = useMap();
  useEffect(() => {
    map.dragging?.disable();
    map.scrollWheelZoom?.disable();
    const activar = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        map.dragging?.enable();
        map.scrollWheelZoom?.enable();
      }
    };
    const desactivar = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        map.dragging?.disable();
        map.scrollWheelZoom?.disable();
      }
    };
    const focoPerdido = () => {
      map.dragging?.disable();
      map.scrollWheelZoom?.disable();
    };
    window.addEventListener('keydown', activar);
    window.addEventListener('keyup', desactivar);
    window.addEventListener('blur', focoPerdido);
    return () => {
      window.removeEventListener('keydown', activar);
      window.removeEventListener('keyup', desactivar);
      window.removeEventListener('blur', focoPerdido);
    };
  }, [map]);
  return null;
}

/**
 * Mapa con un solo punto: el padre decide qué se muestra (punto elegido,
 * sucursal, etc.) y si se puede interactuar. Sin punto arranca con México.
 */
export function MapaPunto({ punto, interactivo, onPunto, onMover, onQuitar, pie }: MapaPuntoProps) {
  const icono = useMemo(() => iconoMarcador(), []);
  const centro = punto ? ([punto.latitud, punto.longitud] as [number, number]) : null;
  const clic = interactivo ? onPunto : undefined;
  const arrastre = interactivo ? onMover : undefined;
  const [menu, setMenu] = useState<PosicionMenu | null>(null);

  /** Clic derecho: abre el menú contextual de esa posición (no mueve el pin). */
  function clicDerecho(lat: number, lng: number) {
    if (!interactivo) return;
    setMenu({ lat, lng });
  }

  /** Fija el pin solo si la posición cae dentro de México. */
  function fijarPunto(lat: number, lng: number) {
    if (!dentroDeMexico(lat, lng)) {
      toast.error('Solo puedes fijar puntos dentro de México.');
      return;
    }
    setMenu(null);
    onPunto?.(lat, lng);
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <MapContainer
        center={CENTRO_MEXICO}
        zoom={ZOOM_MEXICO}
        dragging={false}
        scrollWheelZoom={false}
        zoomControl={false}
        className={pie ? 'isolate h-[45rem] w-full rounded-t-md' : 'isolate h-[45rem] w-full rounded-md'}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomleft" />
        <ControladorMapa centro={centro} />
        <ControlNavegacionCtrl />
        {clic ? <ManejadorClick onPunto={fijarPunto} /> : null}
        {interactivo ? <ManejadorClickDerecho onMenu={clicDerecho} /> : null}
        {menu && interactivo ? (
          <MenuContextualPunto
            posicion={menu}
            onCerrar={() => setMenu(null)}
            onPoner={fijarPunto}
            onQuitar={punto ? onQuitar : undefined}
          />
        ) : null}
        {punto ? (
          <Marker
            position={[punto.latitud, punto.longitud]}
            draggable={interactivo === true}
            icon={icono}
            eventHandlers={
              arrastre
                ? {
                    dragend: (event) => {
                      const marcador = event.target as L.Marker;
                      const posicion = marcador.getLatLng();
                      if (!dentroDeMexico(posicion.lat, posicion.lng)) {
                        toast.error('Solo puedes fijar puntos dentro de México.');
                        marcador.setLatLng([punto.latitud, punto.longitud]);
                        return;
                      }
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
      {pie ? (
        <p className="rounded-b-md border border-t-0 border-yellow-300 bg-yellow-100 px-2 py-1.5 text-xs text-yellow-900">
          {pie}
        </p>
      ) : null}
    </div>
  );
}
