import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';

/**
 * Mapa de referencia de solo lectura: el punto centrado y la vista amplia.
 * Se usa en los globos de coordenadas (detalle del viaje y diagrama de ruta).
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
      zoom={7}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl={false}
      style={{ height: alto, width: ancho }}
      className="max-w-[85vw] cursor-default rounded-md"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[lat, lng]}
        radius={5}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#eb6c36', fillOpacity: 1 }}
      />
    </MapContainer>
  );
}

export default MapaPuntoMini;
