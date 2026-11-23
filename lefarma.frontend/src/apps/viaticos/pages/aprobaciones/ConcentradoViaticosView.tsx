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

export const ESTADOS_CONCENTRADO = ['autorizada', 'autorizada_con_ajustes'] as const;

export function esEstadoConcentrado(estado: string): boolean {
  return (ESTADOS_CONCENTRADO as readonly string[]).includes(estado);
}

export function filaConcentrado(solicitud: SolicitudBandeja): SolicitudConcentrado {
  return {
    id_solicitud: solicitud.id_solicitud,
    nombre_solicitante: solicitud.nombre_solicitante,
    gerencia: solicitud.gerencia,
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

export function filasConcentrado(solicitudes: SolicitudBandeja[]): SolicitudConcentrado[] {
  return solicitudes.filter((solicitud) => esEstadoConcentrado(solicitud.estado)).map(filaConcentrado);
}

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

function periodoMesActual(): string {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}`;
}

interface Props {
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