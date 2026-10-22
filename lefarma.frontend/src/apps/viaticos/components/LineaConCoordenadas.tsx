import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapaPuntoMini } from './MapaPuntoMini';

/** "19.39888, -99.15101" -> coordenadas; `null` si el texto no las trae. */
const PATRON = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/;

function extraerCoordenadas(texto: string): { lat: number; lng: number } | null {
  const coincidencia = PATRON.exec(texto);
  if (!coincidencia) return null;
  const lat = Number(coincidencia[1]);
  const lng = Number(coincidencia[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Cualquier línea con coordenadas las vuelve un botón que abre el mapa del
 * punto. Así el mismo texto que ya imprime el detalle sirve de enlace, sin
 * cambiar el formato de lo que se guarda.
 */
export function LineaConCoordenadas({ texto }: { texto: string }) {
  const coincidencia = PATRON.exec(texto);
  const coords = extraerCoordenadas(texto);
  if (!coincidencia || !coords) return <>{texto}</>;

  const previo = texto.slice(0, coincidencia.index);
  const resto = texto.slice(coincidencia.index + coincidencia[0].length);

  return (
    <>
      {previo}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground"
            aria-label={`Ver ${coords.lat}, ${coords.lng} en el mapa`}
          >
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" collisionPadding={12} className="w-auto p-2">
          <MapaPuntoMini lat={coords.lat} lng={coords.lng} />
          <p className="px-1 pt-1 text-[10px] text-muted-foreground">© OpenStreetMap contributors</p>
        </PopoverContent>
      </Popover>
      {resto}
    </>
  );
}

export default LineaConCoordenadas;
