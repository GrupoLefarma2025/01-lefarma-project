import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ManejadorClickDerecho, MenuContextualPunto, type PosicionMenu } from './MenuPuntoMapa';
import { geocodificarReversa, urlGeocodificarGlobal, urlResolverLiga, type RespuestaGeocodificar, type RespuestaResolverLiga } from '../services/geocodificar.api';
import { formatearCoordenadas, interpretarEntradaPegada } from '../services/ubicacionPegada';
import { dentroDeMexico } from '../services/ubicacionMexico';
import { toast } from 'sonner';
import type { PuntoSeleccion } from '../types/costosRuta.types';

export interface PuntoMapaPickerProps {
  value: PuntoSeleccion | null;
  onChange: (punto: PuntoSeleccion | null) => void;
  /** Acción del botón Agregar sobre el mapa (el padre decide qué hacer). */
  onAgregar?: () => void;
  /** Deshabilita el botón Agregar del mapa (p. ej. si al destino le falta algo). */
  agregarDeshabilitado?: boolean;
  disabled?: boolean;
  /** Oculta el mapa y su pie (el padre muestra su propio mapa compartido). */
  ocultarMapa?: boolean;
  /** Alto (px) al que se pega la barra de búsqueda al scrollear (p. ej. bajo la barra de pasos). */
  stickyTop?: number;
  /** Superpone la búsqueda flotando sobre el mapa del padre (estilo Google Maps). */
  flotante?: boolean;
}

const CENTRO_MEXICO: [number, number] = [23.6345, -102.5528];
const ZOOM_MEXICO = 5;
const ZOOM_PUNTO = 15;
const DEBOUNCE_MS = 400;
const THROTTLE_MS = 1000;
const MIN_TEXTO = 3;
/** Radio del sesgo "Cerca de mí": ~50 km, como el acotado de Google Maps. */
const RADIO_SESGO_GRADOS = 0.45;

const ERROR_SIN_RESULTADOS = 'Sin resultados. Coloca el marcador en el mapa.';
const ERROR_RED = 'No se pudo buscar la dirección. Coloca el marcador manualmente.';
const ERROR_LIGA = 'No pudimos leer esa liga de mapas. Pega las coordenadas (lat, lng) o escribe la dirección.';

/** Nombre de respaldo de un punto fijado por coordenadas cuando no hubo dirección. */
function nombreDeCoordenadas(latitud: number, longitud: number): string {
  return `Lat ${latitud.toFixed(5)}, Lng ${longitud.toFixed(5)}`;
}

/** Caja (minLon,minLat,maxLon,maxLat) alrededor de la ubicación, que Nominatim acepta como sesgo. */
function cajaCercaDeMi(latitud: number, longitud: number): string {
  const minLon = (longitud - RADIO_SESGO_GRADOS).toFixed(4);
  const minLat = (latitud - RADIO_SESGO_GRADOS).toFixed(4);
  const maxLon = (longitud + RADIO_SESGO_GRADOS).toFixed(4);
  const maxLat = (latitud + RADIO_SESGO_GRADOS).toFixed(4);
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

/** Parte la etiqueta en título y detalle con la primera coma (estilo Google Maps). */
function partirEtiqueta(nombre: string): [string, string] {
  const corte = nombre.indexOf(',');
  if (corte === -1) return [nombre, ''];
  return [nombre.slice(0, corte).trim(), nombre.slice(corte + 1).trim()];
}

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
 * Recentra el mapa cuando cambia el punto elegido. Si monta con un punto ya
 * elegido (p. ej. al volver a un destino), arranca enfocado en él; sin punto,
 * arranca en México y solo se mueve por acción de la persona usuaria.
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

/** Convierte un clic en el mapa en la posición del marcador. */
function ManejadorClick({ onPunto }: { onPunto: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      // Un clic nacido en el menú (popup) o con su botón ya desmontado no es
      // un clic del mapa: ignorarlo para no re-fijar/mover el pin.
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

export function PuntoMapaPicker({ value, onChange, onAgregar, agregarDeshabilitado, disabled, ocultarMapa, stickyTop = 0, flotante = false }: PuntoMapaPickerProps) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<PuntoSeleccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [ubicacion, setUbicacion] = useState<{ latitud: number; longitud: number } | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const [menu, setMenu] = useState<PosicionMenu | null>(null);
  /** Resultado resaltado con el teclado dentro del panel de resultados. */
  const [activo, setActivo] = useState(-1);
  /** El panel se cerró con Esc o clic fuera; se reabre al reenfocar o teclear. */
  const [panelCerrado, setPanelCerrado] = useState(false);
  const idLista = useId();
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  // Sin geolocalización disponible (p. ej. HTTP sin HTTPS) el botón no se muestra.
  const geolocalizacionDisponible = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const viewbox = useMemo(
    () => (ubicacion ? cajaCercaDeMi(ubicacion.latitud, ubicacion.longitud) : undefined),
    [ubicacion]
  );

  const mapRef = useRef<L.Map | null>(null);
  const cacheRef = useRef(new Map<string, PuntoSeleccion[]>());
  const ultimaPeticionRef = useRef(0);
  const seqRef = useRef(0);
  /** Invalida geocodificaciones inversas de clics viejos en el mapa. */
  const seqPuntoRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  /** Fila de coordenadas/liga pegada en pantalla: al elegirla el recuadro se normaliza. */
  const filaCoordenadasRef = useRef<PuntoSeleccion | null>(null);
  const icono = useMemo(() => iconoMarcador(), []);

  useEffect(
    () => () => {
      timersRef.current.forEach(id => window.clearTimeout(id));
      timersRef.current = [];
      // Invalida respuestas en vuelo para no actualizar estado tras desmontar.
      seqRef.current += 1;
      seqPuntoRef.current += 1;
    },
    []
  );

  function programar(callback: () => void, ms: number) {
    const id = window.setTimeout(callback, ms);
    timersRef.current.push(id);
    return id;
  }

  const claveBusqueda = useCallback(
    (limpio: string) => `global:${limpio.toLocaleLowerCase()}:${viewbox ?? ''}`,
    [viewbox]
  );

  const ejecutarBusqueda = useCallback(async (url: string, clave: string) => {
    filaCoordenadasRef.current = null;
    const enCache = cacheRef.current.get(clave);
    if (enCache) {
      setResultados(enCache);
      setErrorBusqueda(enCache.length ? '' : ERROR_SIN_RESULTADOS);
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
          // Estado y municipio solo cuando el backend los conoce (dirección).
          ...(item.estado ? { estado: item.estado } : {}),
          ...(item.municipio ? { municipio: item.municipio } : {}),
        }))
        .filter(punto => Number.isFinite(punto.latitud) && Number.isFinite(punto.longitud));
      cacheRef.current.set(clave, limpios);
      setResultados(limpios);
      if (limpios.length === 0) setErrorBusqueda(ERROR_SIN_RESULTADOS);
    } catch {
      if (seq !== seqRef.current) return;
      setResultados([]);
      setErrorBusqueda(ERROR_RED);
    } finally {
      if (seq === seqRef.current) setBuscando(false);
    }
  }, []);

  /**
   * Fila de coordenadas pegadas (o de una liga ya resuelta): se nombra con la
   * geocodificación inversa —"Calle Núm, Colonia, Ciudad"— y si esa llamada
   * falla se usa "Lat …, Lng …". Las coordenadas que mandó el usuario son las
   * que se conservan (más fieles que el punto del geocodificador).
   */
  const fijarCoordenadas = useCallback(
    async (limpio: string, latitud: number, longitud: number) => {
      if (!dentroDeMexico(latitud, longitud)) {
        filaCoordenadasRef.current = null;
        setBuscando(false);
        setResultados([]);
        setPanelCerrado(false);
        setErrorBusqueda('Solo puedes usar coordenadas dentro de México.');
        return;
      }
      const clave = claveBusqueda(limpio);
      const enCache = cacheRef.current.get(clave);
      if (enCache) {
        filaCoordenadasRef.current = enCache[0] ?? null;
        setResultados(enCache);
        setErrorBusqueda('');
        return;
      }
      const seq = (seqRef.current += 1);
      setBuscando(true);
      setErrorBusqueda('');
      setResultados([]);
      try {
        const fila = (await geocodificarReversa(latitud, longitud)) ?? {
          nombre: nombreDeCoordenadas(latitud, longitud),
          latitud,
          longitud,
        };
        if (seq !== seqRef.current) return;
        filaCoordenadasRef.current = fila;
        cacheRef.current.set(clave, [fila]);
        setResultados([fila]);
      } catch {
        if (seq !== seqRef.current) return;
        // Sin geocodificación inversa la fila sigue siendo utilizable.
        const fila: PuntoSeleccion = { nombre: nombreDeCoordenadas(latitud, longitud), latitud, longitud };
        filaCoordenadasRef.current = fila;
        setResultados([fila]);
      } finally {
        if (seq === seqRef.current) setBuscando(false);
      }
    },
    [claveBusqueda]
  );

  /** Interpreta lo escrito: coordenadas/liga pegada o búsqueda normal. */
  const ejecutarTexto = useCallback(
    async (limpio: string) => {
      const entrada = interpretarEntradaPegada(limpio);
      if (!entrada) {
        void ejecutarBusqueda(urlGeocodificarGlobal(limpio, viewbox), claveBusqueda(limpio));
        return;
      }
      if (entrada.tipo === 'coordenadas') {
        await fijarCoordenadas(limpio, entrada.latitud, entrada.longitud);
        return;
      }
      if (entrada.tipo === 'busqueda') {
        // Liga cuyo parámetro q/query trae el nombre del lugar.
        void ejecutarBusqueda(urlGeocodificarGlobal(entrada.texto, viewbox), claveBusqueda(entrada.texto));
        return;
      }
      // Liga corta: la resuelve el backend (el navegador no puede por CORS).
      const seq = (seqRef.current += 1);
      setBuscando(true);
      setErrorBusqueda('');
      setResultados([]);
      filaCoordenadasRef.current = null;
      try {
        const respuesta = await fetch(urlResolverLiga(limpio), { headers: { Accept: 'application/json' } });
        const cuerpo = respuesta.ok ? ((await respuesta.json()) as RespuestaResolverLiga) : null;
        if (seq !== seqRef.current) return;
        const final = cuerpo?.data ?? '';
        const interno = final ? interpretarEntradaPegada(final) : null;
        if (interno?.tipo === 'coordenadas') {
          await fijarCoordenadas(limpio, interno.latitud, interno.longitud);
        } else if (interno?.tipo === 'busqueda') {
          void ejecutarBusqueda(urlGeocodificarGlobal(interno.texto, viewbox), claveBusqueda(interno.texto));
        } else {
          setErrorBusqueda(ERROR_LIGA);
        }
      } catch {
        if (seq !== seqRef.current) return;
        setErrorBusqueda(ERROR_LIGA);
      } finally {
        if (seq === seqRef.current) setBuscando(false);
      }
    },
    [claveBusqueda, ejecutarBusqueda, fijarCoordenadas, viewbox]
  );

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < MIN_TEXTO) {
      filaCoordenadasRef.current = null;
      setResultados([]);
      setErrorBusqueda('');
      return;
    }
    const id = window.setTimeout(() => {
      void ejecutarTexto(limpio);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [texto, ejecutarTexto]);

  // Nuevos resultados: el resaltado del teclado vuelve al inicio.
  useEffect(() => {
    setActivo(-1);
  }, [resultados]);

  const centro = useMemo<[number, number] | null>(
    () => (value ? [value.latitud, value.longitud] : null),
    [value]
  );

  /**
   * Fija el pin al instante y luego completa nombre/estado/municipio con
   * geocodificación inversa. Si upstream falla, el punto se queda con el
   * nombre de respaldo y las coordenadas exactas del clic.
   */
  function fijarPuntoConDireccion(nombre: string, lat: number, lng: number) {
    onChange({ nombre, latitud: lat, longitud: lng });
    const seq = (seqPuntoRef.current += 1);
    void (async () => {
      const resuelto = await geocodificarReversa(lat, lng);
      if (seq !== seqPuntoRef.current || !resuelto) return;
      onChange(resuelto);
    })();
  }

  function fijarDesdeMapa(lat: number, lng: number) {
    if (disabled) return;
    if (!dentroDeMexico(lat, lng)) {
      toast.error('Solo puedes fijar puntos dentro de México.');
      return;
    }
    fijarPuntoConDireccion(value?.nombre.trim() || 'Punto seleccionado en mapa', lat, lng);
  }

  /** Clic derecho: abre el menú contextual sin mover el pin (cada opción hace lo suyo). */
  function clicDerechoMapa(lat: number, lng: number) {
    if (disabled) return;
    setMenu({ lat, lng });
  }

  function quitarPin() {
    if (disabled) return;
    seqPuntoRef.current += 1;
    onChange(null);
  }

  function moverMarcador(lat: number, lng: number) {
    if (disabled || !value || !dentroDeMexico(lat, lng)) return;
    fijarPuntoConDireccion(value.nombre, lat, lng);
  }

  /**
   * Al elegir un resultado el recuadro queda con el nombre del lugar elegido
   * (como en Google Maps); si la fila venía de coordenadas o de una liga
   * pegada, queda con las coordenadas ya normalizadas ("19.43950, -99.13320").
   */
  function elegirResultado(punto: PuntoSeleccion) {
    if (!dentroDeMexico(punto.latitud, punto.longitud)) {
      toast.error('Solo puedes elegir puntos dentro de México.');
      return;
    }
    if (filaCoordenadasRef.current === punto) {
      const textoCoordenadas = formatearCoordenadas(punto.latitud, punto.longitud);
      // Precarga el cache con la clave del texto normalizado para que el
      // recuadro no vuelva a pedir la geocodificación inversa al reejecutarse.
      cacheRef.current.set(claveBusqueda(textoCoordenadas), [punto]);
      setTexto(textoCoordenadas);
      filaCoordenadasRef.current = null;
    } else {
      // El recuadro se llena con lo que decía la fila elegida; se cachea para
      // que el debounce no dispare otra búsqueda sobre el mismo nombre.
      setTexto(punto.nombre);
      cacheRef.current.set(claveBusqueda(punto.nombre), [punto]);
    }
    // Elegir un resultado pisa cualquier geocodificación inversa en vuelo.
    seqPuntoRef.current += 1;
    onChange(punto);
    setResultados([]);
    setErrorBusqueda('');
    setPanelCerrado(true);
    setActivo(-1);
  }

  function limpiarTexto() {
    setTexto('');
    setResultados([]);
    setErrorBusqueda('');
    setPanelCerrado(false);
    setActivo(-1);
    filaCoordenadasRef.current = null;
  }

  /** Al reenfocar: reabre el panel y repone resultados de cache (sin red). */
  function alEnfocar() {
    const limpio = texto.trim();
    if (limpio.length < MIN_TEXTO || disabled) return;
    setPanelCerrado(false);
    const enCache = cacheRef.current.get(claveBusqueda(limpio));
    if (enCache) {
      setResultados(enCache);
      setErrorBusqueda(enCache.length ? '' : ERROR_SIN_RESULTADOS);
    }
  }

  function alPerderFoco(event: React.FocusEvent<HTMLInputElement>) {
    const siguiente = event.relatedTarget as Node | null;
    if (siguiente && contenedorRef.current?.contains(siguiente)) return;
    setPanelCerrado(true);
    setActivo(-1);
  }

  const consultaActiva = texto.trim().length >= MIN_TEXTO;
  const panelVisible = consultaActiva && !panelCerrado && !disabled;
  const sinResultados = errorBusqueda === ERROR_SIN_RESULTADOS;

  function alTeclear(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && resultados.length > 0) {
      event.preventDefault();
      setPanelCerrado(false);
      setActivo(actual => (actual + 1) % resultados.length);
    } else if (event.key === 'ArrowUp' && resultados.length > 0) {
      event.preventDefault();
      setPanelCerrado(false);
      setActivo(actual => (actual <= 0 ? resultados.length - 1 : actual - 1));
    } else if (event.key === 'Enter') {
      const resaltado = activo >= 0 && activo < resultados.length ? resultados[activo] : null;
      // Con un solo resultado (p. ej. coordenadas pegadas) Enter lo usa directo.
      const objetivo = resaltado ?? (resultados.length === 1 ? resultados[0] : null);
      if (panelVisible && objetivo) {
        event.preventDefault();
        elegirResultado(objetivo);
      }
    } else if (event.key === 'Escape' && panelVisible) {
      event.preventDefault();
      setPanelCerrado(true);
      setActivo(-1);
    }
  }

  /** Enciende/apaga el sesgo de resultados hacia la ubicación actual. */
  function alternarCercaDeMi() {
    setErrorUbicacion('');
    if (ubicacion) {
      setUbicacion(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      posicion => setUbicacion({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }),
      () => setErrorUbicacion('No pudimos obtener tu ubicación. Revisa los permisos del navegador.'),
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  function recentrar() {
    const destino = value ? [value.latitud, value.longitud] as [number, number] : centro;
    if (destino) mapRef.current?.setView(destino, ZOOM_PUNTO);
  }

  return (
    <div
      className={
        flotante
          ? ocultarMapa
            ? 'absolute left-2 top-2 z-[5] w-1/2'
            : 'relative'
          : 'rounded-md border'
      }
    >
      <div
        ref={contenedorRef}
        className={cn(
          'z-30 bg-card px-2',
          flotante ? 'rounded-2xl border py-1.5 shadow-lg' : 'sticky rounded-t-md border-b py-2',
          flotante && !ocultarMapa && 'absolute left-2 top-2 z-[5] w-1/2'
        )}
        style={flotante ? undefined : { top: stickyTop }}
      >
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="punto-busqueda-global"
              role="combobox"
              aria-label="Buscar dirección (OpenStreetMap)"
              aria-expanded={panelVisible}
              aria-controls={idLista}
              aria-autocomplete="list"
              aria-activedescendant={panelVisible && activo >= 0 && activo < resultados.length ? `${idLista}-opcion-${activo}` : undefined}
              autoComplete="off"
              value={texto}
              disabled={disabled}
              placeholder="Ej. 20 de Noviembre 13, Centro, CDMX"
              className={cn('rounded-md pl-9 pr-9', flotante ? 'h-9' : 'h-10')}
              onChange={event => {
                setTexto(event.target.value);
                setPanelCerrado(false);
              }}
              onKeyDown={alTeclear}
              onFocus={alEnfocar}
              onBlur={alPerderFoco}
            />
            {buscando ? (
              <Loader2 aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : texto ? (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                disabled={disabled}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                onMouseDown={event => event.preventDefault()}
                onClick={limpiarTexto}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {geolocalizacionDisponible ? (
          <div className={cn('flex flex-wrap items-center gap-2', flotante ? 'mt-1' : 'mt-1.5')}>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={disabled}
              aria-pressed={ubicacion !== null} onClick={alternarCercaDeMi}>
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" /> Cerca de mí
            </Button>
            {ubicacion ? <span className="text-xs text-muted-foreground">Resultados priorizados cerca de tu ubicación.</span> : null}
          </div>
        ) : null}
        {errorUbicacion ? <p role="alert" className="mt-1 text-xs text-destructive">{errorUbicacion}</p> : null}

        {/* Panel flotante de resultados, anclado bajo la barra (estilo Google Maps). */}
        {panelVisible ? (
          <div className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
            {resultados.length > 0 ? (
              <ul id={idLista} role="listbox" aria-label="Resultados de direcciones" className="max-h-64 overflow-auto overscroll-contain">
                {resultados.map((resultado, index) => {
                  const [titulo, detalle] = partirEtiqueta(resultado.nombre);
                  return (
                    <li
                      key={`${resultado.latitud}-${resultado.longitud}-${index}`}
                      id={`${idLista}-opcion-${index}`}
                      role="option"
                      aria-selected={index === activo}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0',
                        index === activo ? 'bg-accent' : 'hover:bg-accent/60'
                      )}
                      onMouseDown={event => event.preventDefault()}
                      onMouseEnter={() => setActivo(index)}
                      onClick={() => elegirResultado(resultado)}
                    >
                      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{titulo}</span>
                        {detalle ? <span className="block truncate text-xs text-muted-foreground">{detalle}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : buscando || !errorBusqueda ? (
              <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Buscando direcciones…</p>
            ) : (
              <p role={sinResultados ? 'status' : 'alert'}
                className={cn('px-3 py-2 text-sm', sinResultados ? 'text-muted-foreground' : 'text-destructive')}>
                {errorBusqueda}
              </p>
            )}
            {resultados.length > 0 ? (
              <p className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>Datos © OpenStreetMap</span>
                <span aria-hidden="true">↓↑ para moverte · Enter para elegir</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {flotante && !ocultarMapa && onAgregar ? (
        <Button
          type="button"
          size="sm"
          className="absolute right-2 top-2 z-[5]"
          disabled={disabled || agregarDeshabilitado || !value}
          onClick={() => onAgregar()}
        >
          Agregar
        </Button>
      ) : null}

      {ocultarMapa ? null : (
      <div className="space-y-2 p-2">
      <div onContextMenu={(e) => e.preventDefault()}>
      <MapContainer ref={mapRef} center={CENTRO_MEXICO} zoom={ZOOM_MEXICO}
        dragging={false} scrollWheelZoom={false} zoomControl={!flotante} className="isolate h-[36rem] w-full rounded-t-md">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {flotante ? <ZoomControl position="bottomleft" /> : null}
        <ControladorMapa centro={centro} />
        <ControlNavegacionCtrl />
        <ManejadorClick
          onPunto={(lat, lng) => {
            setMenu(null);
            fijarDesdeMapa(lat, lng);
          }}
        />
        <ManejadorClickDerecho onMenu={clicDerechoMapa} />
        {menu ? (
          <MenuContextualPunto
            posicion={menu}
            onCerrar={() => setMenu(null)}
            onPoner={(lat, lng) => fijarDesdeMapa(lat, lng)}
            onQuitar={value ? quitarPin : undefined}
          />
        ) : null}
        {value ? (
          <Marker position={[value.latitud, value.longitud]} draggable={!disabled} icon={icono}
            eventHandlers={{
              dragend: event => {
                const marcador = event.target as L.Marker;
                const posicion = marcador.getLatLng();
                if (!dentroDeMexico(posicion.lat, posicion.lng)) {
                  toast.error('Solo puedes fijar puntos dentro de México.');
                  marcador.setLatLng([value.latitud, value.longitud]);
                  return;
                }
                moverMarcador(posicion.lat, posicion.lng);
              },
            }}>
            <Popup>{value.nombre}</Popup>
          </Marker>
        ) : null}
      </MapContainer>
      </div>
      <p className="rounded-b-md border border-t-0 border-yellow-300 bg-yellow-100 px-2 py-1.5 text-xs text-yellow-900">
        {disabled
          ? 'Mapa de referencia: no se puede modificar.'
          : 'Clic para fijar el pin o arrástralo para ajustar · Ctrl para mover el mapa · Clic derecho abre el menú.'}
      </p>

      {!flotante ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {value
            ? <>Punto: <strong>{value.nombre}</strong> · Lat {value.latitud.toFixed(5)}, Lng {value.longitud.toFixed(5)}</>
            : 'Sin punto todavía: busca una dirección arriba o haz clic en el mapa.'}
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
      ) : null}
      </div>
      )}
    </div>
  );
}
