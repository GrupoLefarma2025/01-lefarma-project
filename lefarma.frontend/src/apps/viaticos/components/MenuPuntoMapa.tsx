import { useState } from 'react';
import { Popup, useMap, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';

export interface PosicionMenu {
  lat: number;
  lng: number;
}

/** Clic derecho sobre el mapa (el menú del navegador queda suprimido). */
export function ManejadorClickDerecho({ onMenu }: { onMenu: (lat: number, lng: number) => void }) {
  useMapEvents({
    contextmenu(event) {
      // Un clic nacido en el menú (o con su botón ya desmontado) no es del mapa.
      const objetivo = (event.originalEvent as { target?: Element | null } | undefined)?.target;
      if (objetivo && (!objetivo.isConnected || objetivo.closest?.('.leaflet-popup'))) return;
      onMenu(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Zoom mínimo al centrar desde el menú: suficiente para ver la calle. */
const ZOOM_MINIMO_CENTRAR = 15;

/**
 * Menú contextual del punto: se abre con clic derecho sobre el mapa (nunca
 * fuera de él). Cada acción hace solo lo suyo —centrar, poner el pin o
 * quitarlo—; abrir el menú no toca el pin.
 */
export function MenuContextualPunto({
  posicion,
  onCerrar,
  onPoner,
  onQuitar,
}: {
  posicion: PosicionMenu;
  onCerrar: () => void;
  onPoner?: (lat: number, lng: number) => void;
  onQuitar?: () => void;
}) {
  const map = useMap();
  const [copiado, setCopiado] = useState(false);
  const coords = `${posicion.lat.toFixed(5)}, ${posicion.lng.toFixed(5)}`;

  function centrar() {
    map.setView([posicion.lat, posicion.lng], Math.max(map.getZoom(), ZOOM_MINIMO_CENTRAR));
    onCerrar();
  }

  async function copiar() {
    try {
      await navigator.clipboard?.writeText(coords);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  function poner() {
    onPoner?.(posicion.lat, posicion.lng);
    onCerrar();
  }

  function quitar() {
    onQuitar?.();
    onCerrar();
  }

  return (
    <Popup position={[posicion.lat, posicion.lng]} eventHandlers={{ remove: onCerrar }}>
      <div className="flex w-44 flex-col gap-1">
        <p className="px-2 text-[11px] tabular-nums text-muted-foreground">{coords}</p>
        {onPoner ? (
          <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={poner}>
            Poner pin aquí
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={centrar}>
          Centrar aquí
        </Button>
        <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={() => void copiar()}>
          {copiado ? '¡Copiado!' : 'Copiar coordenadas'}
        </Button>
        {onQuitar ? (
          <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={quitar}>
            Quitar pin
          </Button>
        ) : null}
      </div>
    </Popup>
  );
}
