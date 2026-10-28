/* eslint-disable react-refresh/only-export-components -- este archivo también
   expone helpers (`rutaApiCaptura`, `useCapturaAutenticada`) que comparten las
   tablas de cotización y el diálogo de boleto. */

import { useEffect, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Celdas compartidas por la tabla de transporte y la de hoteles. La regla de
// negocio vive aqui y en ningun otro lado: un estimado por formula NUNCA se
// presenta como cotizacion real ("Unknown prices remain unknown, not zero") y
// la `fuente` cruda que devuelve el backend nunca se oculta.

export function CeldaFuente({ fuente, estimado }: { fuente: string; estimado: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {estimado
        ? <Badge variant="secondary">Estimado</Badge>
        : <Badge variant="outline">Cotizado</Badge>}
      <span className="text-xs text-muted-foreground">{fuente}</span>
    </div>
  );
}

/**
 * Convierte una ruta persistida de captura (`/api/media/capturas-viaticos/x.png`,
 * `/media/capturas-viaticos/x.png` o `capturas-viaticos/x.png`) en la ruta del
 * endpoint autenticado `GET /api/viaticos/capturas/x.png`.
 *
 * Los PNG ya no se sirven por el estatico anonimo: el backend los expone SOLO
 * por ese endpoint `[Authorize]`. Devuelve `null` cuando la ruta no es una
 * captura del backend (URL externa, data:, blob:), porque esas no llevan token.
 */
export function rutaApiCaptura(ruta: string): string | null {
  const coincidencia = ruta.match(/(?:^|\/)capturas-viaticos\/([^/?#]+)$/);
  if (!coincidencia) return null;
  return `/viaticos/capturas/${encodeURIComponent(coincidencia[1])}`;
}

export interface EstadoCaptura {
  /** Object URL de la imagen, o la propia ruta si es externa; null mientras carga o si fallo. */
  url: string | null;
  error: string | null;
}

const MENSAJE_ERROR_CAPTURA = 'No se pudo cargar la captura.';

/**
 * Carga una captura con el token del cliente `API` y devuelve un object URL.
 * `<img src>` no puede mandar la cabecera Authorization, por eso se hace fetch
 * con `responseType: 'blob'`. El object URL se libera con
 * `URL.revokeObjectURL` al desmontar o al cambiar de captura: sin eso, una
 * tabla con muchas filas filtra memoria.
 */
export function useCapturaAutenticada(ruta: string | undefined): EstadoCaptura {
  const apiPath = ruta ? rutaApiCaptura(ruta) : null;
  // Se guarda con qué ruta se cargó cada resultado: así, al cambiar de captura,
  // la miniatura vieja no se queda pegada mientras llega la nueva.
  const [cargada, setCargada] = useState<{
    ruta: string;
    url: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!ruta || !apiPath) return;

    let cancelado = false;
    let objectUrl: string | null = null;
    API.get(apiPath, { responseType: 'blob' })
      .then((respuesta) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(respuesta.data as Blob);
        setCargada({ ruta, url: objectUrl, error: null });
      })
      .catch(() => {
        if (cancelado) return;
        setCargada({ ruta, url: null, error: MENSAJE_ERROR_CAPTURA });
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta, apiPath]);

  if (!ruta) return { url: null, error: null };
  if (!apiPath) return { url: ruta, error: null };
  if (cargada?.ruta !== ruta) return { url: null, error: null };
  return { url: cargada.url, error: cargada.error };
}

function ImagenCaptura({
  estado,
  alt,
  className,
}: {
  estado: EstadoCaptura;
  alt: string;
  className?: string;
}) {
  if (estado.error) {
    return (
      <span role="alert" className="text-xs text-destructive" title={estado.error}>
        {estado.error}
      </span>
    );
  }
  if (!estado.url) {
    return <span className="text-xs text-muted-foreground">Cargando captura…</span>;
  }
  return <img src={estado.url} alt={alt} loading="lazy" className={className} />;
}

/**
 * Miniatura suelta de una captura (sin ancla), usada por el importador, que
 * lista varias capturas por fila. Se apoya en `useCapturaAutenticada`.
 */
export function MiniaturaCaptura({
  ruta,
  alt,
  className,
}: {
  ruta: string;
  alt: string;
  className?: string;
}) {
  const estado = useCapturaAutenticada(ruta);
  return <ImagenCaptura estado={estado} alt={alt} className={className} />;
}

/**
 * Miniatura de la captura de pantalla. Sin `ruta` se muestra un placeholder
 * textual, nunca una <img> rota ni el PNG crudo del estatico. El ancla abre la
 * imagen completa en otra pestana porque la miniatura es demasiado pequena para
 * leer el precio.
 *
 * `onRebuscar` pide al agente volver a buscar la oferta (llenando el buscador
 * del sitio con la ruta y capturando los RESULTADOS, no la portada).
 */
export function CeldaCaptura({
  ruta,
  etiqueta,
  onRebuscar,
  rebuscando = false,
}: {
  ruta: string | undefined;
  etiqueta: string;
  onRebuscar?: () => void;
  rebuscando?: boolean;
}) {
  const estado = useCapturaAutenticada(ruta);
  const boton = onRebuscar ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rebuscando}
      onClick={onRebuscar}
      aria-label={`Volver a buscar la captura de ${etiqueta}`}
      title="Pide al agente buscar el viaje en el sitio y capturar la página de resultados"
    >
      {rebuscando ? 'Buscando…' : 'Volver a buscar'}
    </Button>
  ) : null;

  if (!ruta) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">Sin captura</span>
        {boton}
      </div>
    );
  }

  const alt = `Captura de pantalla de ${etiqueta}`;
  const claseMiniatura = 'h-12 w-20 rounded border object-cover';

  if (estado.error || !estado.url) {
    return (
      <div className="flex flex-col items-start gap-1">
        <ImagenCaptura estado={estado} alt={alt} className={claseMiniatura} />
        {boton}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <a href={estado.url} target="_blank" rel="noreferrer" title={`Ver captura completa · ${etiqueta}`}>
        <ImagenCaptura estado={estado} alt={alt} className={claseMiniatura} />
      </a>
      {boton}
    </div>
  );
}