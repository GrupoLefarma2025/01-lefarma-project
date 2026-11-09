import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { waitForPrintImages } from '@/utils/waitForPrintImages';
import {
  ConcentradoViaticosPrint,
  type SolicitudConcentrado,
} from '../costos/ConcentradoViaticosPrint';
import {
  ConcentradoVuelosPrint,
  type SolicitudVuelo,
} from '../costos/ConcentradoVuelosPrint';
import type { GrupoConcentrado } from '../../constants/grupos';

/**
 * Vista previa imprimible del concentrado desde la pantalla de revisión.
 *
 * Dos formatos, el mismo patrón de impresión del repo (portal a
 * `document.body`, aislado con la clase del formato en `body` y el id del
 * portal):
 *
 * - `for-008`: concentrado de costos ASK-ADM-FOR-008 (`ConcentradoViaticosPrint`).
 * - `vuelos`: concentrado de vuelos «Solicitud de avión», el formato del Excel
 *   VUELOS EDUCACION MEDICA (`ConcentradoVuelosPrint`).
 *
 * Las filas NO se piden al servidor: llegan por props ya filtradas por la
 * persona. El documento es WYSIWYG: se imprime lo que está viendo.
 */

/** Mismos estados que imprime el documento oficial (ver ConcentradoViaticosPrint). */
const ESTADOS_AUTORIZADOS = ['autorizada', 'autorizada_con_ajustes'] as const;

/** Formatos imprimibles del concentrado. */
export type FormatoConcentrado = 'for-008' | 'vuelos';

/** Id del portal y clase de aislamiento en `body` de cada formato. */
const IMPRESION: Record<
  FormatoConcentrado,
  { id: string; claseCuerpo: string; etiqueta: string }
> = {
  'for-008': {
    id: 'concentrado-viaticos-print',
    claseCuerpo: 'concentrado-print-active',
    etiqueta: 'Concentrado de viáticos FOR-008',
  },
  vuelos: {
    id: 'concentrado-vuelos-print',
    claseCuerpo: 'concentrado-vuelos-print-active',
    etiqueta: 'Concentrado de vuelos',
  },
};

/** Reglas de pantalla del portal; dependen del id del formato activo. */
function cssPantalla(id: string): string {
  return `
#${id} { display: none; }
#${id}.concentrado-print-preview {
  display: block; position: fixed; inset: 0; z-index: 50;
  overflow: auto; background: #fff; padding: 72px 16px 48px;
}
.concentrado-toolbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 51;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #ddd;
}
.concentrado-toolbar-title { flex: 1; font-weight: 600; }
@media print {
  #${id}.concentrado-print-preview {
    position: static; padding: 0; overflow: visible;
  }
  .concentrado-toolbar { display: none !important; }
}`;
}

interface Props {
  abierto: boolean;
  /** Filas del FOR-008, ya filtradas en pantalla. */
  solicitudes: SolicitudConcentrado[];
  /** Filas del concentrado de vuelos («Solicitud de avión»). */
  vuelos: SolicitudVuelo[];
  /** Formato a previsualizar/imprimir. */
  formato?: FormatoConcentrado;
  /** Texto de la barra: periodo o filtro activo. */
  titulo: string;
  gerencia?: string;
  /** Criterio con el que se parten los bloques del FOR-008. */
  grupoPor?: GrupoConcentrado;
  /**
   * Imprimir solo las solicitudes autorizadas. Activo por defecto porque el
   * FOR-008 es el documento oficial; el concentrado de vuelos imprime la
   * selección tal cual (incluye enviadas: la solicitud a la agencia va antes
   * de la autorización).
   */
  soloAutorizadas?: boolean;
  onCerrar: () => void;
}

export function ConcentradoDocumentoPreview({
  abierto,
  solicitudes,
  vuelos,
  formato = 'for-008',
  titulo,
  gerencia,
  grupoPor = 'ninguna',
  soloAutorizadas = true,
  onCerrar,
}: Props) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const mounted = useRef(true);
  const filasFor008 = soloAutorizadas
    ? solicitudes.filter(s => (ESTADOS_AUTORIZADOS as readonly string[]).includes(s.estado))
    : solicitudes;
  // El documento de vuelos es de lo seleccionado; solo se salta si el
  // contenedor pidió explícitamente el filtro de autorizadas.
  const filasVuelos = vuelos;
  const hayFilas = formato === 'vuelos' ? filasVuelos.length > 0 : filasFor008.length > 0;

  const { id, claseCuerpo, etiqueta } = IMPRESION[formato];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      document.body.classList.remove('concentrado-print-active');
      document.body.classList.remove('concentrado-vuelos-print-active');
    };
  }, []);

  const quitarClase = useCallback(() => {
    document.body.classList.remove(claseCuerpo);
  }, [claseCuerpo]);

  const imprimir = useCallback(async () => {
    if (imprimiendo || !hayFilas) return;
    setImprimiendo(true);
    try {
      await waitForPrintImages(`#${id}`);
      if (!mounted.current) return;
      window.addEventListener('afterprint', quitarClase, { once: true });
      document.body.classList.add(claseCuerpo);
      window.print();
    } catch {
      toast.error('No se pudo preparar la impresión del concentrado. Intenta de nuevo.');
    } finally {
      quitarClase();
      window.removeEventListener('afterprint', quitarClase);
      if (mounted.current) setImprimiendo(false);
    }
  }, [imprimiendo, hayFilas, id, claseCuerpo, quitarClase]);

  if (!abierto) return null;

  return createPortal(
    <>
      <div className="concentrado-toolbar" data-testid="documento-toolbar">
        <span className="concentrado-toolbar-title">
          {etiqueta} · {titulo}
        </span>
        <Button
          size="sm"
          disabled={!hayFilas || imprimiendo}
          onClick={() => void imprimir()}
        >
          {imprimiendo ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-1.5 h-4 w-4" />
          )}
          Imprimir
        </Button>
        <Button size="sm" variant="ghost" onClick={onCerrar}>
          <X className="mr-1.5 h-4 w-4" />
          Cerrar
        </Button>
      </div>

      <div
        id={id}
        className="concentrado-print-preview"
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
      >
        <style>{cssPantalla(id)}</style>
        {!hayFilas ? (
          <p className="mx-auto max-w-lg rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay solicitudes con los filtros actuales. Elige otro periodo o definición de «activo»
            para generar el documento.
          </p>
        ) : formato === 'vuelos' ? (
          <ConcentradoVuelosPrint
            solicitudes={filasVuelos}
            gerencia={gerencia}
          />
        ) : (
          <ConcentradoViaticosPrint
            solicitudes={solicitudes}
            gerencia={gerencia}
            grupoPor={grupoPor}
            soloAutorizadas={soloAutorizadas}
          />
        )}
      </div>
    </>,
    document.body,
  );
}

export default ConcentradoDocumentoPreview;
