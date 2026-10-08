import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { EstadoCatalogo } from '@/apps/educacion-medica/types/educacionMedica.types';
import { municipiosApi } from '../services/municipios.api';
import {
  urlGeocodificarCascada,
  urlGeocodificarGlobal,
  type RespuestaGeocodificar,
} from '../services/geocodificar.api';
import type { Municipio } from '../types/municipios.types';
import type { PuntoSeleccion } from '../types/costosRuta.types';

export interface PuntoMapaPickerProps {
  value: PuntoSeleccion | null;
  onChange: (punto: PuntoSeleccion | null) => void;
  /** Confirma el punto (el padre decide qué hacer). */
  onAgregar?: () => void;
  disabled?: boolean;
}

const CENTRO_MEXICO: [number, number] = [23.6345, -102.5528];
const ZOOM_MEXICO = 5;
const ZOOM_PUNTO = 15;
const DEBOUNCE_MS = 400;
const THROTTLE_MS = 1000;
const MIN_TEXTO = 3;

function iconoMarcador() {
  return L.divIcon({
    className: 'custom-map-marker-punto',
    html: '<div class="h-4 w-4 rounded-full border-2 border-white bg-[#eb6c36] shadow-md"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

/** Recentra el mapa cuando cambia el punto o el municipio elegido. */
function ControladorMapa({ centro }: { centro: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (centro) map.setView(centro, ZOOM_PUNTO);
  }, [map, centro]);
  return null;
}

/** Convierte un clic en el mapa en la posición del marcador. */
function ManejadorClick({ onPunto }: { onPunto: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPunto(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function PuntoMapaPicker({ value, onChange, onAgregar, disabled }: PuntoMapaPickerProps) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<PuntoSeleccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [estados, setEstados] = useState<EstadoCatalogo[]>([]);
  const [estadoCodigo, setEstadoCodigo] = useState<number | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [municipioSel, setMunicipioSel] = useState<Municipio | null>(null);
  const [direccion, setDireccion] = useState('');
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [errorCatalogos, setErrorCatalogos] = useState('');

  const mapRef = useRef<L.Map | null>(null);
  const cacheRef = useRef(new Map<string, PuntoSeleccion[]>());
  const ultimaPeticionRef = useRef(0);
  const seqRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const icono = useMemo(() => iconoMarcador(), []);

  useEffect(
    () => () => {
      timersRef.current.forEach(id => window.clearTimeout(id));
      timersRef.current = [];
      // Invalida respuestas en vuelo para no actualizar estado tras desmontar.
      seqRef.current += 1;
    },
    []
  );

  function programar(callback: () => void, ms: number) {
    const id = window.setTimeout(callback, ms);
    timersRef.current.push(id);
    return id;
  }

  const ejecutarBusqueda = useCallback(async (url: string, clave: string) => {
    const enCache = cacheRef.current.get(clave);
    if (enCache) {
      setResultados(enCache);
      setErrorBusqueda(enCache.length ? '' : 'Sin resultados. Coloca el marcador en el mapa.');
      return;
    }
    // Throttle: como máximo una petición por segundo, sin descartar la última.
    const restante = Math.max(0, THROTTLE_MS - (Date.now() - ultimaPeticionRef.current));
    if (restante > 0) await new Promise<void>(resolve => { programar(resolve, restante); });
    const seq = (seqRef.current += 1);
    ultimaPeticionRef.current = Date.now();
    setBuscando(true);
    setErrorBusqueda('');
    try {
      const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const cuerpo = (await respuesta.json()) as RespuestaGeocodificar;
      if (seq !== seqRef.current) return;
      const limpios = (cuerpo.data ?? [])
        .map(item => ({
          nombre: item.nombre.trim() || 'Punto sin nombre',
          latitud: item.latitud,
          longitud: item.longitud,
        }))
        .filter(punto => Number.isFinite(punto.latitud) && Number.isFinite(punto.longitud));
      cacheRef.current.set(clave, limpios);
      setResultados(limpios);
      if (limpios.length === 0) setErrorBusqueda('Sin resultados. Coloca el marcador en el mapa.');
    } catch {
      if (seq !== seqRef.current) return;
      setResultados([]);
      setErrorBusqueda('No se pudo buscar la dirección. Coloca el marcador manualmente.');
    } finally {
      if (seq === seqRef.current) setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < MIN_TEXTO) {
      setResultados([]);
      setErrorBusqueda('');
      return;
    }
    const id = window.setTimeout(() => {
      void ejecutarBusqueda(urlGeocodificarGlobal(limpio), `global:${limpio.toLocaleLowerCase()}`);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [texto, ejecutarBusqueda]);

  useEffect(() => {
    let cancelado = false;
    setCargandoCatalogos(true);
    void (async () => {
      try {
        const respuesta = await educacionMedicaApi.regiones.getEstadosCatalogo();
        if (cancelado) return;
        if (!respuesta.data.success) {
          setErrorCatalogos(respuesta.data.message || 'No se pudieron cargar los estados.');
          return;
        }
        setEstados(respuesta.data.data || []);
      } catch (error) {
        if (!cancelado) setErrorCatalogos(toApiError(error).message || 'No se pudieron cargar los estados.');
      } finally {
        if (!cancelado) setCargandoCatalogos(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (estadoCodigo === null) {
      setMunicipios([]);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const respuesta = await municipiosApi.getMunicipios(estadoCodigo);
        if (cancelado) return;
        if (!respuesta.data.success) {
          setErrorCatalogos(respuesta.data.message || 'No se pudieron cargar los municipios.');
          setMunicipios([]);
          return;
        }
        setMunicipios(respuesta.data.data || []);
      } catch (error) {
        if (!cancelado) {
          setErrorCatalogos(toApiError(error).message || 'No se pudieron cargar los municipios.');
          setMunicipios([]);
        }
      }
    })();
    return () => { cancelado = true; };
  }, [estadoCodigo]);

  const centro = useMemo<[number, number] | null>(() => {
    if (value) return [value.latitud, value.longitud];
    if (municipioSel?.latitud != null && municipioSel?.longitud != null) {
      return [municipioSel.latitud, municipioSel.longitud];
    }
    return null;
  }, [value, municipioSel]);

  function fijarDesdeMapa(lat: number, lng: number) {
    if (disabled) return;
    onChange({ nombre: value?.nombre.trim() || 'Punto seleccionado en mapa', latitud: lat, longitud: lng });
  }

  function moverMarcador(lat: number, lng: number) {
    if (!value) return;
    onChange({ ...value, latitud: lat, longitud: lng });
  }

  function elegirResultado(punto: PuntoSeleccion) {
    onChange(punto);
    setResultados([]);
    setErrorBusqueda('');
    setTexto('');
    setDireccion('');
  }

  function seleccionarMunicipio(idMunicipio: number) {
    setMunicipioSel(municipios.find(item => item.idMunicipio === idMunicipio) ?? null);
  }

  function buscarGuiada() {
    const estado = estados.find(item => item.codigoEstado === estadoCodigo);
    if (!estado || !municipioSel || direccion.trim().length < MIN_TEXTO) return;
    void ejecutarBusqueda(
      urlGeocodificarCascada(estado.nombreEstado, municipioSel.nombre, direccion.trim()),
      `guiada:${estado.codigoEstado}:${municipioSel.idMunicipio}:${direccion.trim().toLocaleLowerCase()}`
    );
  }

  function recentrar() {
    const destino = value ? [value.latitud, value.longitud] as [number, number] : centro;
    if (destino) mapRef.current?.setView(destino, ZOOM_PUNTO);
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="space-y-1">
        <Label htmlFor="punto-busqueda-global">Buscar dirección (OpenStreetMap)</Label>
        <Input
          id="punto-busqueda-global"
          value={texto}
          disabled={disabled}
          placeholder="Escribe una dirección y espera los resultados"
          onChange={event => setTexto(event.target.value)}
        />
        {buscando ? <p role="status" className="text-xs">Buscando…</p> : null}
        {errorBusqueda ? <p role="alert" className="text-xs text-destructive">{errorBusqueda}</p> : null}
        {resultados.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-auto text-xs" aria-label="Resultados de direcciones">
            {resultados.map((resultado, index) => (
              <li key={`${resultado.latitud}-${resultado.longitud}-${index}`}>
                <button type="button" className="w-full text-left underline" disabled={disabled}
                  onClick={() => elegirResultado(resultado)}>
                  {resultado.nombre}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <details>
        <summary className="cursor-pointer text-sm">Dirección guiada (estado, municipio y calle)</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className="space-y-1 text-xs">Estado
            <select aria-label="Estado" className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={estadoCodigo ?? ''} disabled={disabled || cargandoCatalogos}
              onChange={event => {
                setEstadoCodigo(event.target.value ? Number(event.target.value) : null);
                setMunicipioSel(null);
              }}>
              <option value="">Selecciona un estado</option>
              {estados.map(estado => <option key={estado.codigoEstado} value={estado.codigoEstado}>{estado.nombreEstado}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs">Municipio
            <select aria-label="Municipio" className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={municipioSel?.idMunicipio ?? ''} disabled={disabled || estadoCodigo === null}
              onChange={event => seleccionarMunicipio(Number(event.target.value))}>
              <option value="">Selecciona un municipio</option>
              {municipios.map(municipio => <option key={municipio.idMunicipio} value={municipio.idMunicipio}>{municipio.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs">Calle y número
            <Input value={direccion} disabled={disabled || !municipioSel}
              placeholder="Ej. Av. Reforma 123" onChange={event => setDireccion(event.target.value)} />
          </label>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2"
          disabled={disabled || !municipioSel || direccion.trim().length < MIN_TEXTO}
          onClick={buscarGuiada}>
          Buscar en el mapa
        </Button>
        {errorCatalogos ? <p role="alert" className="mt-2 text-xs text-destructive">{errorCatalogos}</p> : null}
      </details>

      <MapContainer ref={mapRef} center={centro ?? CENTRO_MEXICO} zoom={centro ? ZOOM_PUNTO : ZOOM_MEXICO}
        scrollWheelZoom className="isolate h-64 w-full rounded-md">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ControladorMapa centro={centro} />
        <ManejadorClick onPunto={fijarDesdeMapa} />
        {value ? (
          <Marker position={[value.latitud, value.longitud]} draggable icon={icono}
            eventHandlers={{
              dragend: event => {
                const posicion = (event.target as L.Marker).getLatLng();
                moverMarcador(posicion.lat, posicion.lng);
              },
            }}>
            <Popup>{value.nombre}</Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {value
            ? <>Punto: <strong>{value.nombre}</strong> · Lat {value.latitud.toFixed(5)}, Lng {value.longitud.toFixed(5)}</>
            : 'Haz clic en el mapa o busca una dirección para fijar el punto.'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || (!value && !centro)} onClick={recentrar}>
            Centrar
          </Button>
          <Button type="button" size="sm" disabled={disabled || !value} onClick={() => onAgregar?.()}>
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}