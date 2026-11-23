/* eslint-disable react-refresh/only-export-components -- este archivo también
   expone helpers (`rutaApiCaptura`, `useCapturaAutenticada`) que comparten las
   tablas de cotización y el diálogo de boleto. */

import { useEffect, useRef, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileViewer } from '@/components/archivos/FileViewer';

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

export function rutaApiCaptura(ruta: string): string | null {
  const coincidencia = ruta.match(/(?:^|\/)capturas-viaticos\/([^/?#]+)$/);
  if (!coincidencia) return null;
  return `/viaticos/capturas/${encodeURIComponent(coincidencia[1])}`;
}

export interface EstadoCaptura {
  url: string | null;
  error: string | null;
}

const MENSAJE_ERROR_CAPTURA = 'No se pudo cargar la captura.';

export function useCapturaAutenticada(ruta: string | undefined, revision = 0): EstadoCaptura {
  const apiPath = ruta ? rutaApiCaptura(ruta) : null;
  const apiUrl = apiPath
    ? (revision > 0 ? `${apiPath}?v=${revision}` : apiPath)
    : null;
  const [cargada, setCargada] = useState<{
    ruta: string;
    revision: number;
    url: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!ruta || !apiUrl) return;

    let cancelado = false;
    let objectUrl: string | null = null;
    API.get(apiUrl, { responseType: 'blob' })
      .then((respuesta) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(respuesta.data as Blob);
        setCargada({ ruta, revision, url: objectUrl, error: null });
      })
      .catch(() => {
        if (cancelado) return;
        setCargada({ ruta, revision, url: null, error: MENSAJE_ERROR_CAPTURA });
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta, apiUrl, revision]);

  if (!ruta) return { url: null, error: null };
  if (!apiPath) return { url: ruta, error: null };
  if (cargada?.ruta !== ruta || cargada.revision !== revision) return { url: null, error: null };
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

export function CeldaCaptura({
  ruta,
  etiqueta,
  onRebuscar,
  rebuscando = false,
  onSubirCaptura,
  subiendo = false,
  revision = 0,
  sinCapturaTexto = 'Sin captura',
}: {
  ruta: string | undefined;
  etiqueta: string;
  onRebuscar?: () => void;
  rebuscando?: boolean;
  onSubirCaptura?: (archivo: File) => void | Promise<void>;
  subiendo?: boolean;
  revision?: number;
  sinCapturaTexto?: string;
}) {
  const estado = useCapturaAutenticada(ruta, revision);
  const [verCaptura, setVerCaptura] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nombreArchivo = (ruta?.split('/').pop() ?? `captura-${etiqueta}.png`).split('?')[0];

  const botonRebuscar = onRebuscar ? (
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

  const botonSubir = onSubirCaptura ? (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,.png"
        className="hidden"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          evento.target.value = '';
          if (archivo) void onSubirCaptura(archivo);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
        aria-label={`Subir captura de ${etiqueta}`}
        title="Sube un PNG tomado manualmente (máx. 8 MB)"
      >
        {subiendo ? 'Subiendo…' : 'Subir captura'}
      </Button>
    </>
  ) : null;

  const acciones = botonRebuscar || botonSubir ? (
    <div className="flex flex-wrap items-start gap-1">
      {botonRebuscar}
      {botonSubir}
    </div>
  ) : null;

  if (!ruta) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">{sinCapturaTexto}</span>
        {acciones}
      </div>
    );
  }

  const alt = `Captura de pantalla de ${etiqueta}`;
  const claseMiniatura = 'h-12 w-20 rounded border bg-slate-50 object-contain';

  if (estado.error || !estado.url) {
    return (
      <div className="flex flex-col items-start gap-1">
        <ImagenCaptura estado={estado} alt={alt} className={claseMiniatura} />
        {acciones}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setVerCaptura(true)}
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver captura completa de ${etiqueta}`}
        title={`Ver captura completa · ${etiqueta}`}
      >
        <ImagenCaptura estado={estado} alt={alt} className={claseMiniatura} />
      </button>
      {acciones}
      <FileViewer
        open={verCaptura}
        onClose={() => setVerCaptura(false)}
        src={estado.url}
        nombre={nombreArchivo}
        titulo={`Captura · ${etiqueta}`}
        descargar
      />
    </div>
  );
}