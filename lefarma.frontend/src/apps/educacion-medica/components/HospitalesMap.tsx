import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HospitalCercanoOtraSeleccion, HospitalUbicacion } from '../types/educacionMedica.types';

export interface RegionCentroide {
  idRegion: number;
  nombre: string;
  latitud: number;
  longitud: number;
  cantidadHospitales: number;
}

interface HospitalesMapProps {
  hospitales: HospitalUbicacion[];
  selectedCodigo?: number | null;
  /** Resalta el círculo del hospital SIN mover el mapa (p. ej. hover en una fila). */
  highlightCodigo?: number | null;
  /** Ajusta la vista solo a estos hospitales (p. ej. región expandida). Vacío o ausente = vista global. */
  focusCodigos?: number[];
  centroides?: RegionCentroide[];
  /** Colores por región (idRegion -> color CSS) para pintar los marcadores. */
  colorPorRegion?: Record<number, string>;
  /** Color para marcadores sin región (idRegion null); omitir usa el color oscuro por defecto. */
  colorSinRegion?: string;
  /** Hospitales de otras gerencias cercanos a la selección (anillo punteado); solo informativo. */
  hospitalesAjenos?: HospitalCercanoOtraSeleccion[];
}

const DEFAULT_CENTER: L.LatLngExpression = [23.6345, -102.5528];
const DEFAULT_ZOOM = 5;

function createMarkerIcon(selected: boolean, color?: string) {
  const fondo = selected ? '#eb6c36' : (color ?? '#2d3142');
  const ring = selected ? 'ring-2 ring-white' : '';
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div class="h-4 w-4 rounded-full ${ring} border border-white shadow-md" style="background-color: ${fondo}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function createCentroideIcon() {
  return L.divIcon({
    className: 'custom-map-centroide',
    html: `<div class="flex h-5 w-5 items-center justify-center rounded-sm bg-[#eb6c36] text-[10px] font-bold text-white border border-white shadow-md">Z</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function createAjenoIcon() {
  return L.divIcon({
    className: 'custom-map-marker-ajeno',
    html: '<div class="h-4 w-4 rounded-full border-2 border-dashed border-[#eb6c36] bg-white/80 shadow-md"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function MapController({
  hospitales,
  selectedCodigo,
  focusCodigos,
  centroides,
}: {
  hospitales: HospitalUbicacion[];
  selectedCodigo?: number | null;
  focusCodigos?: number[];
  centroides?: RegionCentroide[];
}) {
  const map = useMap();

  const conCoordenadas = useMemo(
    () =>
      hospitales.filter(
        (h): h is HospitalUbicacion & { latitud: number; longitud: number } =>
          typeof h.latitud === 'number' && typeof h.longitud === 'number'
      ),
    [hospitales]
  );

  useEffect(() => {
    const puntosFoco = focusCodigos?.length
      ? conCoordenadas.filter((h) => focusCodigos.includes(h.codigoContacto))
      : null;

    const puntos: L.LatLngExpression[] = puntosFoco
      ? puntosFoco.map((h) => [h.latitud, h.longitud] as L.LatLngExpression)
      : [
          ...conCoordenadas.map((h) => [h.latitud, h.longitud] as L.LatLngExpression),
          ...(centroides ?? []).map((c) => [c.latitud, c.longitud] as L.LatLngExpression),
        ];

    if (puntos.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const seleccionado = selectedCodigo
      ? conCoordenadas.find((h) => h.codigoContacto === selectedCodigo)
      : null;

    if (seleccionado) {
      map.flyTo([seleccionado.latitud, seleccionado.longitud], 15, {
        duration: 1,
      });
      return;
    }

    if (puntos.length === 1) {
      const [lat, lon] = puntos[0] as [number, number];
      map.setView([lat, lon], 11);
      return;
    }

    const bounds = L.latLngBounds(puntos);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, conCoordenadas, selectedCodigo, focusCodigos, centroides]);

  return null;
}

export function HospitalesMap({ hospitales, selectedCodigo, highlightCodigo, focusCodigos, centroides, colorPorRegion, colorSinRegion, hospitalesAjenos }: HospitalesMapProps) {
  const conCoordenadas = useMemo(
    () =>
      hospitales.filter(
        (h): h is HospitalUbicacion & { latitud: number; longitud: number } =>
          typeof h.latitud === 'number' && typeof h.longitud === 'number'
      ),
    [hospitales]
  );

  if (conCoordenadas.length === 0 && (!centroides || centroides.length === 0)) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
        No hay hospitales con coordenadas para mostrar en el mapa.
      </div>
    );
  }

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="isolate h-[60vh] w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController hospitales={hospitales} selectedCodigo={selectedCodigo} focusCodigos={focusCodigos} centroides={centroides} />
      {conCoordenadas.map((h) => {
        const isSelected = h.codigoContacto === selectedCodigo || h.codigoContacto === highlightCodigo;
        const color = h.idRegion != null ? colorPorRegion?.[h.idRegion] : colorSinRegion;
        return (
          <Marker
            key={h.codigoContacto}
            position={[h.latitud, h.longitud]}
            icon={createMarkerIcon(isSelected, color)}
          >
            <Popup>
              <div className="space-y-0.5">
                <p className="font-medium">{h.nombreContacto}</p>
                {h.nombreCorto && (
                  <p className="text-xs text-muted-foreground">{h.nombreCorto}</p>
                )}
                {h.clues && <p className="text-xs">CLUES: {h.clues}</p>}
                {h.ciudad && <p className="text-xs">{h.ciudad}</p>}
                {h.regionNombre && <p className="text-xs font-medium">Región: {h.regionNombre}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}
      {(centroides ?? []).map((c) => (
        <Marker
          key={`region-${c.idRegion}`}
          position={[c.latitud, c.longitud]}
          icon={createCentroideIcon()}
        >
          <Popup>
            <div className="space-y-0.5">
              <p className="font-medium">{c.nombre}</p>
              <p className="text-xs text-muted-foreground">
                Centroide · {c.cantidadHospitales} hospital(es)
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      {(hospitalesAjenos ?? [])
        .filter(
          (a): a is HospitalCercanoOtraSeleccion & { latitud: number; longitud: number } =>
            typeof a.latitud === 'number' && typeof a.longitud === 'number'
        )
        .map((a) => (
          <Marker
            key={`ajeno-${a.idSeleccionHospitalAjeno}`}
            position={[a.latitud, a.longitud]}
            icon={createAjenoIcon()}
          >
            <Popup>
              <div className="space-y-0.5">
                <p className="font-medium">{a.nombreHospital ?? `Hospital ${a.idHospital ?? ''}`}</p>
                {a.gerenciaOrigen && (
                  <p className="text-xs font-medium text-[#eb6c36]">{a.gerenciaOrigen}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {a.criterio === 'distancia'
                    ? `A ${a.distanciaKm} km de ${a.nombreHospitalCercano ?? 'la selección'}`
                    : a.criterio === 'mismoEstado'
                      ? `Mismo estado (${a.entidadFederativa ?? '—'})`
                      : `Misma ciudad (${a.ciudadMunicipio ?? '—'})`}
                  {a.criterio !== 'distancia' && a.distanciaKm != null
                    ? ` · ${a.distanciaKm} km de ${a.nombreHospitalCercano ?? 'la selección'}`
                    : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[a.ciudadMunicipio, a.entidadFederativa].filter(Boolean).join(', ')}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
