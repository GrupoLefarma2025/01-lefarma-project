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
import type { GrupoConcentrado } from '../../constants/grupos';

/**
 * Vista previa imprimible del concentrado FOR-008 desde el concentrado de
 * revisión.
 *
 * A diferencia de `ConcentradoViaticosView` (pantalla de aprobaciones), aquí las
 * filas NO se piden al servidor: llegan por props, ya filtradas por la persona.
 * El documento es WYSIWYG: se imprime lo que está viendo. Sigue el patrón de
 * impresión del repo (portal a `document.body` con id
 * `concentrado-viaticos-print`, aislado con `body.concentrado-print-active`).
 */

/** Mismos estados que imprime el documento oficial (ver ConcentradoViaticosPrint). */
const ESTADOS_AUTORIZADOS = ['autorizada', 'autorizada_con_ajustes'] as const;

const SCREEN_CSS = `
#concentrado-viaticos-print { display: none; }
#concentrado-viaticos-print.concentrado-print-preview {
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
  #concentrado-viaticos-print.concentrado-print-preview {
    position: static; padding: 0; overflow: visible;
  }
  .concentrado-toolbar { display: none !important; }
}`;

interface Props {
  abierto: boolean;
  /** Filas a imprimir, ya filtradas en pantalla. */
  solicitudes: SolicitudConcentrado[];
  /** Texto de la barra: periodo o filtro activo. */
  titulo: string;
  gerencia?: string;
  /** Criterio con el que se parten los bloques del FOR-008. */
  grupoPor?: GrupoConcentrado;
  /**
   * Imprimir solo las solicitudes autorizadas. Activo por defecto porque el
   * FOR-008 es el documento oficial; se apaga para previsualizar tal cual una
   * selección explícita del usuario.
   */
  soloAutorizadas?: boolean;
  onCerrar: () => void;
}

export function ConcentradoDocumentoPreview({
  abierto,
  solicitudes,
  titulo,
  gerencia,
  grupoPor = 'ninguna',
  soloAutorizadas = true,
  onCerrar,
}: Props) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const mounted = useRef(true);
  const filasImprimibles = soloAutorizadas
    ? solicitudes.filter(s => (ESTADOS_AUTORIZADOS as readonly string[]).includes(s.estado))
    : solicitudes;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      document.body.classList.remove('concentrado-print-active');
    };
  }, []);

  const imprimir = useCallback(async () => {
    if (imprimiendo || filasImprimibles.length === 0) return;
    setImprimiendo(true);
    const quitar = () => document.body.classList.remove('concentrado-print-active');
    try {
      await waitForPrintImages('#concentrado-viaticos-print');
      if (!mounted.current) return;
      window.addEventListener('afterprint', quitar, { once: true });
      document.body.classList.add('concentrado-print-active');
      window.print();
    } catch {
      toast.error('No se pudo preparar la impresión del concentrado. Intenta de nuevo.');
    } finally {
      quitar();
      window.removeEventListener('afterprint', quitar);
      if (mounted.current) setImprimiendo(false);
    }
  }, [imprimiendo, filasImprimibles.length]);

  if (!abierto) return null;

  return createPortal(
    <>
      <div className="concentrado-toolbar" data-testid="documento-toolbar">
        <span className="concentrado-toolbar-title">Concentrado de viáticos FOR-008 · {titulo}</span>
        <Button
          size="sm"
          disabled={filasImprimibles.length === 0 || imprimiendo}
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
        id="concentrado-viaticos-print"
        className="concentrado-print-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Concentrado de viáticos"
      >
        <style>{SCREEN_CSS}</style>
        {filasImprimibles.length === 0 ? (
          <p className="mx-auto max-w-lg rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay solicitudes con los filtros actuales. Elige otro periodo o definición de «activo»
            para generar el documento.
          </p>
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
