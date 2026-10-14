import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PuntoSeleccion } from '../types/costosRuta.types';
import { PuntoMapaPicker } from './PuntoMapaPicker';

export interface SelectorRutaModalProps {
  /** Secuencia confirmada por el padre; el modal trabaja sobre una copia. */
  puntos: PuntoSeleccion[];
  /** Recibe la secuencia completa al confirmar. */
  onChange: (puntos: PuntoSeleccion[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback opcional adicional al confirmar. */
  onConfirm?: (puntos: PuntoSeleccion[]) => void;
  disabled?: boolean;
}

const CENTRO_MEXICO: [number, number] = [23.6345, -102.5528];
const ZOOM_MEXICO = 6;
const ZOOM_SECUENCIA = 12;

/** Marcador numerado: azul, distingue el orden del punto naranja del picker. */
function iconoSecuencia(numero: number) {
  return L.divIcon({
    className: 'custom-map-marker-secuencia',
    html: `<div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#1d4ed8] text-[11px] font-bold leading-none text-white shadow-md">${numero}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function centroDe(puntos: PuntoSeleccion[]): [number, number] {
  if (puntos.length === 0) return CENTRO_MEXICO;
  const suma = puntos.reduce((acc, p) => [acc[0] + p.latitud, acc[1] + p.longitud], [0, 0]);
  return [suma[0] / puntos.length, suma[1] / puntos.length];
}

/** Recentra el mapa cada vez que cambia la secuencia de puntos. */
function ControladorSecuencia({ puntos }: { puntos: PuntoSeleccion[] }) {
  const map = useMap();
  const centro = useMemo(() => centroDe(puntos), [puntos]);
  useEffect(() => {
    if (puntos.length === 0) return;
    map.setView(centro, ZOOM_SECUENCIA);
    // `map` se recrea en cada render del mock; la identidad de los puntos manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro, puntos]);
  return null;
}

/** Un clic en el mapa agrega el siguiente punto, no reemplaza el anterior. */
function ManejadorClic({ onPunto }: { onPunto: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPunto(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function ListaPuntos({
  puntos,
  disabled,
  editando,
  nombreEdicion,
  onNombreEdicion,
  onEditar,
  onGuardarNombre,
  onSubir,
  onBajar,
  onEliminar,
}: {
  puntos: PuntoSeleccion[];
  disabled?: boolean;
  editando: number | null;
  nombreEdicion: string;
  onNombreEdicion: (nombre: string) => void;
  onEditar: (indice: number) => void;
  onGuardarNombre: (indice: number, nombre: string) => void;
  onSubir: (indice: number) => void;
  onBajar: (indice: number) => void;
  onEliminar: (indice: number) => void;
}) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  /** Flechas arriba/abajo mueven el foco entre puntos sin cambiar el orden. */
  const onTeclaLista = useCallback(
    (evento: React.KeyboardEvent<HTMLLIElement>, indice: number) => {
      if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
      evento.preventDefault();
      const destino = evento.key === 'ArrowDown' ? indice + 1 : indice - 1;
      refs.current[destino]?.focus();
    },
    [],
  );

  if (puntos.length === 0) {
    return (
      <p data-testid="lista-vacia" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Todavía no hay puntos en la ruta. Haz clic en el mapa o elige un lugar con cualquiera de los dos
        buscadores.
      </p>
    );
  }

  return (
    <ol data-testid="lista-puntos" className="flex flex-col gap-2" aria-label="Puntos de la ruta en orden">
      {puntos.map((punto, indice) => (
        <li
          key={`${punto.latitud}-${punto.longitud}-${indice}`}
          ref={(el) => { refs.current[indice] = el; }}
          tabIndex={0}
          data-testid={`punto-${indice}`}
          onKeyDown={(evento) => onTeclaLista(evento, indice)}
          className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-[11px] font-bold text-white">
            {indice + 1}
          </span>
          {editando === indice ? (
            <>
              <Input
                autoFocus
                aria-label={`Nombre del punto ${indice + 1}`}
                value={nombreEdicion}
                disabled={disabled}
                className="h-8 flex-1"
                onChange={(evento) => onNombreEdicion(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') onGuardarNombre(indice, nombreEdicion);
                  if (evento.key === 'Escape') onGuardarNombre(indice, punto.nombre);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Cancelar edición del punto ${indice + 1}`}
                onClick={() => onGuardarNombre(indice, punto.nombre)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label={`Guardar punto ${indice + 1}`}
                onClick={() => onGuardarNombre(indice, nombreEdicion)}
              >
                Guardar
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate">{punto.nombre}</span>
              <span className="text-xs text-muted-foreground">
                {punto.latitud.toFixed(4)}, {punto.longitud.toFixed(4)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Subir punto ${indice + 1}`}
                disabled={disabled || indice === 0}
                onClick={() => onSubir(indice)}
              >
                Subir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Bajar punto ${indice + 1}`}
                disabled={disabled || indice === puntos.length - 1}
                onClick={() => onBajar(indice)}
              >
                Bajar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Editar punto ${indice + 1}`}
                disabled={disabled}
                onClick={() => onEditar(indice)}
              >
                Editar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Eliminar punto ${indice + 1}`}
                disabled={disabled}
                onClick={() => onEliminar(indice)}
              >
                Eliminar
              </Button>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

export function SelectorRutaModal({
  puntos,
  onChange,
  open,
  onOpenChange,
  onConfirm,
  disabled,
}: SelectorRutaModalProps) {
  const [borrador, setBorrador] = useState<PuntoSeleccion[]>(puntos);
  const [pendiente, setPendiente] = useState<PuntoSeleccion | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');

  // El padre manda la lista confirmada; el borrador sólo se resincroniza al abrir.
  const puntosRef = useRef(puntos);
  useEffect(() => {
    puntosRef.current = puntos;
  }, [puntos]);
  useEffect(() => {
    if (!open) return;
    setBorrador(puntosRef.current);
    setPendiente(null);
    setEditando(null);
    setNombreEdicion('');
  }, [open]);

  const mover = useCallback((indice: number, delta: number) => {
    setBorrador((actual) => {
      const destino = indice + delta;
      if (destino < 0 || destino >= actual.length) return actual;
      const siguiente = [...actual];
      [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
      return siguiente;
    });
    setEditando(null);
  }, []);

  const eliminar = useCallback((indice: number) => {
    setBorrador((actual) => actual.filter((_, i) => i !== indice));
    setEditando(null);
  }, []);

  const guardarNombre = useCallback((indice: number, nombre: string) => {
    setBorrador((actual) =>
      actual.map((punto, i) => (i === indice ? { ...punto, nombre: nombre.trim() || punto.nombre } : punto)),
    );
    setEditando(null);
    setNombreEdicion('');
  }, []);

  /** El clic inserta siempre al final: la secuencia previa se conserva. */
  const agregar = useCallback((punto: PuntoSeleccion) => {
    setBorrador((actual) => [...actual, punto]);
    setPendiente(null);
    setEditando(null);
  }, []);

  const agregarClic = useCallback(
    (lat: number, lng: number) => {
      const punto: PuntoSeleccion = {
        nombre: `Punto ${borrador.length + 1}`,
        latitud: lat,
        longitud: lng,
      };
      setPendiente(punto);
      agregar(punto);
    },
    [agregar, borrador.length],
  );

  const posiciones = useMemo(
    () => borrador.map((punto) => [punto.latitud, punto.longitud] as [number, number]),
    [borrador],
  );
  const iconos = useMemo(() => borrador.map((_, i) => iconoSecuencia(i + 1)), [borrador]);
  const centroInicial = useMemo(() => centroDe(borrador), [borrador]);

  const confirmar = useCallback(() => {
    onChange(borrador);
    onConfirm?.(borrador);
    onOpenChange(false);
  }, [borrador, onChange, onConfirm, onOpenChange]);

  const picker = (titulo: string, descripcion: string) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="text-xs text-muted-foreground">{descripcion}</p>
      <PuntoMapaPicker value={pendiente} onChange={setPendiente} disabled={disabled} />
    </div>
  );

  return (
    <Modal
      id="modal-selector-ruta"
      open={open}
      setOpen={onOpenChange}
      title="Ordenar ruta"
      subtitle="Define los puntos y su secuencia"
      size="wide"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={disabled}>
            Confirmar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Ruta en el mapa</h3>
          <div className="w-full overflow-hidden rounded-md border">
            <MapContainer
              center={centroInicial}
              zoom={borrador.length > 0 ? ZOOM_SECUENCIA : ZOOM_MEXICO}
              scrollWheelZoom
              className="h-72 w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={posiciones} pathOptions={{ color: '#1d4ed8', weight: 4 }} />
              {borrador.map((punto, indice) => (
                <Marker key={`${punto.latitud}-${punto.longitud}-${indice}`} position={posiciones[indice]} icon={iconos[indice]}>
                  <Popup>
                    {indice + 1}. {punto.nombre}
                  </Popup>
                </Marker>
              ))}
              <ControladorSecuencia puntos={borrador} />
              <ManejadorClic onPunto={agregarClic} />
            </MapContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            Haz clic en el mapa para agregar el siguiente punto ({borrador.length} en la ruta).
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Secuencia ({borrador.length})</h3>
          <ListaPuntos
            puntos={borrador}
            disabled={disabled}
            editando={editando}
            nombreEdicion={nombreEdicion}
            onNombreEdicion={setNombreEdicion}
            onEditar={(indice) => {
              setNombreEdicion(indice >= 0 && borrador[indice] ? borrador[indice].nombre : '');
              setEditando(indice >= 0 ? indice : null);
            }}
            onGuardarNombre={guardarNombre}
            onSubir={(indice) => mover(indice, -1)}
            onBajar={(indice) => mover(indice, 1)}
            onEliminar={eliminar}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              aria-label="Agregar a la ruta"
              disabled={disabled || !pendiente}
              onClick={() => pendiente && agregar(pendiente)}
            >
              Agregar a la ruta
            </Button>
          </div>
        </section>

        <Tabs defaultValue="global" className="flex flex-col">
          <TabsList>
            <TabsTrigger value="global">Buscador global</TabsTrigger>
            <TabsTrigger value="cascada">Por estado y municipio</TabsTrigger>
          </TabsList>
          <TabsContent value="global">
            {picker('Buscador global', 'Escribe la dirección completa y el país, sin cascada obligatoria.')}
          </TabsContent>
          <TabsContent value="cascada">
            {picker('Por estado y municipio', 'Elige estado, municipio y calle; es opcional, no es un paso previo.')}
          </TabsContent>
        </Tabs>
      </div>
    </Modal>
  );
}
