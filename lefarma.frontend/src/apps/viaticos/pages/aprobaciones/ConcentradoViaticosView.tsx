import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toApiError } from '@/utils/errors';
import { waitForPrintImages } from '@/utils/waitForPrintImages';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';
import {
  ConcentradoViaticosPrint,
  type SolicitudConcentrado,
} from '../costos/ConcentradoViaticosPrint';

/**
 * Host del concentrado FOR-008 dentro de la pantalla de aprobaciones.
 *
 * El concentrado consulta su PROPIA bandeja (`aprobacionesApi.bandeja`) en vez
 * de reutilizar las filas de `BandejaAprobacionesPage`. No es duplicar el
 * listado: la pregunta es distinta. La lista muestra lo que el admin tenga
 * filtrado en ese momento; el concentrado es un documento contable y necesita
 * TODAS las solicitudes autorizadas del periodo, sin importar los filtros de la
 * lista. Ademas, al abrirlo lee datos frescos del servidor.
 *
 * La impresion sigue el patron del repo (ver `ViaticosPage`): un portal propio a
 * `document.body` con id `concentrado-viaticos-print`, aislado con
 * `body.concentrado-print-active`. `ConcentradoViaticosPrint` recibe las filas
 * por props y no hace fetch: es presentacional puro y asi se queda.
 */

/** Estados que el concentrado imprime: el FOR-008 es de lo autorizado. */
export const ESTADOS_CONCENTRADO = ['autorizada', 'autorizada_con_ajustes'] as const;

export function esEstadoConcentrado(estado: string): boolean {
  return (ESTADOS_CONCENTRADO as readonly string[]).includes(estado);
}

/**
 * MAPEO UNICO bandeja -> fila del concentrado.
 *
 * El backend ya proyecta en `SolicitudBandeja` el encabezado del FOR-008
 * (`origen` y el rango `fecha`) y el desglose por concepto (autobus, avion,
 * gasolina, casetas, vehiculo_propio, hospedaje, comida, taxi). Aqui se copian
 * TAL CUAL: los importes salen del servidor y nadie los inventa. Un campo
 * `null` o ausente (`undefined`) llega al concentrado como `null`, que el
 * componente imprime como "—". NUNCA 0: en un documento de dinero un "$0.00"
 * donde no hay dato es un error, no un vacio.
 *
 * `vehiculo_propio` no se mapea porque el formato no tiene una columna propia
 * para el: la cotizacion del automovil propio se desglosa en Gasolina y
 * Casetas, bajo el encabezado de grupo "Automóvil propio".
 *
 * `fecha` es el rango ya compuesto por el backend ("05/10/2026 AL 09/10/2026"),
 * no el `periodo` (que es el mes de la solicitud). Si viene ausente se deja
 * vacio y el concentrado lo imprime como "—".
 */
export function filaConcentrado(solicitud: SolicitudBandeja): SolicitudConcentrado {
  return {
    id_solicitud: solicitud.id_solicitud,
    nombre_solicitante: solicitud.nombre_solicitante,
    estado: solicitud.estado,
    fecha: solicitud.fecha ?? '',
    origen: solicitud.origen ?? null,
    destino: solicitud.destino,
    autobus: solicitud.autobus ?? null,
    avion: solicitud.avion ?? null,
    gasolina: solicitud.gasolina ?? null,
    casetas: solicitud.casetas ?? null,
    hospedaje: solicitud.hospedaje ?? null,
    comida: solicitud.comida ?? null,
    taxi: solicitud.taxi ?? null,
    total: solicitud.total,
  };
}

/** Filas imprimibles: solo autorizadas, ya mapeadas al formato del concentrado. */
export function filasConcentrado(solicitudes: SolicitudBandeja[]): SolicitudConcentrado[] {
  return solicitudes.filter((solicitud) => esEstadoConcentrado(solicitud.estado)).map(filaConcentrado);
}

/**
 * Reglas de pantalla del portal. Las de impresion (A4 landscape, ocultar el
 * resto del body) viven en `ConcentradoViaticosPrint`; aqui solo se define como
 * se ve la vista previa y se revierte el `position: fixed` al imprimir.
 */
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

/** Periodo (yyyy-MM) del mes en curso, que `aprobacionesApi.bandeja` espera. */
function periodoMesActual(): string {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}`;
}

interface Props {
  /** Periodo (yyyy-MM) del concentrado; por defecto, el mes en curso. */
  periodo?: string;
}

export function ConcentradoViaticosView({ periodo }: Props = {}) {
  const periodoActivo = periodo ?? periodoMesActual();

  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<SolicitudConcentrado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      document.body.classList.remove('concentrado-print-active');
    };
  }, []);

  const cargar = useCallback(async (periodoPedido: string) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await aprobacionesApi.bandeja({ periodo: periodoPedido });
      if (!mounted.current) return;
      if (respuesta.data.success) {
        setFilas(filasConcentrado(respuesta.data.data ?? []));
        setCargadoPara(periodoPedido);
      } else {
        setFilas([]);
        setError(respuesta.data.message ?? 'No se pudo cargar el concentrado.');
      }
    } catch (falla: unknown) {
      if (!mounted.current) return;
      setFilas([]);
      setError(toApiError(falla).message || 'No se pudo cargar el concentrado.');
    } finally {
      if (mounted.current) setCargando(false);
    }
  }, []);

  // Un solo fetch por periodo: abrir y cerrar reutiliza lo cargado; solo se
  // vuelve a consultar cuando cambia el periodo (o tras un error, para poder
  // reintentar con el boton).
  useEffect(() => {
    if (!abierto || cargadoPara === periodoActivo) return;
    void cargar(periodoActivo);
  }, [abierto, periodoActivo, cargadoPara, cargar]);

  const imprimir = useCallback(async () => {
    if (imprimiendo || filas.length === 0) return;
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
  }, [filas.length, imprimiendo]);

  // Antes del primer render abierto aun no hay `cargadoPara`: se muestra la
  // carga, no el mensaje de "sin autorizadas", para no parpadear un vacio falso.
  const mostrando = cargando || (!error && cargadoPara !== periodoActivo);
  const vacio = !mostrando && !error && filas.length === 0;

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Printer className="mr-1.5 h-4 w-4" />
        Imprimir concentrado
      </Button>

      {abierto &&
        createPortal(
          <>
            <div className="concentrado-toolbar" data-testid="concentrado-toolbar">
              <span className="concentrado-toolbar-title">
                Concentrado de viáticos FOR-008 · {periodoActivo}
              </span>
              <Button
                size="sm"
                disabled={mostrando || error !== null || filas.length === 0 || imprimiendo}
                onClick={() => void imprimir()}
              >
                {imprimiendo ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-1.5 h-4 w-4" />
                )}
                Imprimir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>
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
              {mostrando ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cargando concentrado...
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="mx-auto flex max-w-lg items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium text-destructive">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void cargar(periodoActivo)}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : vacio ? (
                <p
                  data-testid="concentrado-vacio"
                  className="mx-auto max-w-lg rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
                >
                  No hay solicitudes autorizadas en el periodo {periodoActivo}. Autoriza una
                  solicitud y vuelve a abrir el concentrado.
                </p>
              ) : (
                <ConcentradoViaticosPrint solicitudes={filas} />
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export default ConcentradoViaticosView;