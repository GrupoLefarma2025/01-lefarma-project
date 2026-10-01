import { useEffect, useState } from 'react';
import { fetchFirmaObjectUrl } from '@/services/firmas.service';

interface FirmaImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Endpoint autenticado de la firma (p.ej. firmasEndpoints.firmaEvento(id)). */
  endpoint?: string | null;
}

/**
 * Imagen de firma servida por endpoint autenticado: descarga el blob con el
 * token de la sesión y lo pinta como object URL. Mientras carga deja un
 * marcador [data-firma-loading] para que la impresión pueda esperarla
 * (waitForPrintImages).
 */
export function FirmaImg({ endpoint, alt = 'Firma', style, ...imgProps }: FirmaImgProps) {
  const [loaded, setLoaded] = useState<{ endpoint: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (endpoint) {
      fetchFirmaObjectUrl(endpoint).then((u) => {
        if (cancelled) {
          if (u) URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setLoaded({ endpoint, url: u });
      });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint]);

  if (!endpoint) return null;
  if (!loaded || loaded.endpoint !== endpoint) {
    return (
      <span
        data-firma-loading=""
        style={{ display: 'inline-block', width: 80, height: 28 }}
      />
    );
  }
  if (!loaded.url) return null;
  return <img src={loaded.url} alt={alt} style={style} {...imgProps} />;
}
