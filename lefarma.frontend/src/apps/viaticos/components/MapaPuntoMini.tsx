import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';

/**
 * Zoom con Ctrl + rueda. Sin Ctrl el evento no se toca, así la rueda sigue
 * desplazando el diálogo y no se queda "atrapada" en el mapa; con Ctrl se
 * frena el zoom de la página y se acerca el mapa.
 */
function ZoomConCtrl() {
  const map = useMap();

  useEffect(() => {
    const contenedor = map.getContainer();
    const alGirar = (evento: WheelEvent) => {
      if (!evento.ctrlKey) return;
      evento.preventDefault();
      map.setZoom(map.getZoom() + (evento.deltaY < 0 ? 1 : -1), { animate: false });
    };
    contenedor.addEventListener('wheel', alGirar, { passive: false });
    return () => contenedor.removeEventListener('wheel', alGirar);
  }, [map]);

  return null;
}

/**
 * Mapa de referencia del punto: se puede arrastrar y acercar (Ctrl + rueda o
 * los botones +/−), pero no edita nada. Se usa en los globos de coordenadas
 * del detalle del viaje y del diagrama de ruta.
 */
export function MapaPuntoMini({
  lat,
  lng,
  alto = 340,
  ancho = 520,
}: {
  lat: number;
  lng: number;
  alto?: number;
  ancho?: number;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={12}
      dragging
      scrollWheelZoom={false}
      doubleClickZoom
      touchZoom
      boxZoom
      keyboard
      zoomControl
      attributionControl={false}
      style={{ height: alto, width: ancho }}
      className="max-w-[85vw] cursor-grab rounded-md"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomConCtrl />
      <CircleMarker
        center={[lat, lng]}
        radius={6}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#eb6c36', fillOpacity: 1 }}
      />
    </MapContainer>
  );
}

export default MapaPuntoMini;
