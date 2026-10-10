import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature, History, Loader2 } from 'lucide-react';
import { etiquetaEstadoDominio } from './seleccionUtils';

interface DocumentoHeaderCardProps {
  /** Título del documento, p. ej. "Rutas v2" o "Selección Septiembre 2026". */
  titulo: string;
  /** Línea secundaria (gerencia, período, resumen...). */
  detalle?: ReactNode;
  /** Nombre del paso actual del workflow. */
  pasoNombre?: string | null;
  /** Estado del workflow (catálogo `config.workflow_estados`): nombre y color. */
  estadoNombre?: string | null;
  estadoColor?: string | null;
  /** Estado de dominio como respaldo si no hay nombre del catálogo. */
  estadoFallback?: string | null;
  /**
   * Muestra el botón "Firmar": solo en las vistas especializadas (Rutas y
   * Selección Mensual) y solo cuando el usuario tiene acciones disponibles.
   * Al pulsarlo se abre el modal de acciones (DocumentoFirmaModal).
   */
  showFirmar?: boolean;
  onFirmar?: () => void;
  firmando?: boolean;
  firmarDeshabilitado?: boolean;
  /** Muestra el botón "Historial" (bitácora del documento) junto a Firmar. */
  showHistorial?: boolean;
  onHistorial?: () => void;
  /** Clases de fondo del card (tinte suave por vista); default: bg-card. */
  fondoClase?: string;
}

/**
 * Encabezado de documento compartido por las vistas especializadas de Educación
 * Médica (mismo patrón que `SolicitudHeaderCard` de RH): título, paso actual,
 * estado con nombre y color del catálogo, y — cuándo aplica — el botón Firmar.
 */
export function DocumentoHeaderCard({
  titulo,
  detalle,
  pasoNombre,
  estadoNombre,
  estadoColor,
  estadoFallback,
  showFirmar = false,
  onFirmar,
  firmando = false,
  firmarDeshabilitado = false,
  showHistorial = false,
  onHistorial,
  fondoClase = 'bg-card',
}: DocumentoHeaderCardProps) {
  const color = estadoColor ?? '#94a3b8';
  const nombreEstado = estadoNombre ?? etiquetaEstadoDominio(estadoFallback) ?? '-';

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${fondoClase}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold">{titulo}</span>
            {pasoNombre && (
              <span className="text-xs text-muted-foreground">
                Paso actual: <span className="font-medium text-foreground">{pasoNombre}</span>
              </span>
            )}
          </div>
          {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className="inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{
              borderColor: color,
              color,
              backgroundColor: color + '15',
            }}
          >
            {nombreEstado}
          </span>
          {showHistorial && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onHistorial}>
              <History className="h-3.5 w-3.5" />
              Historial
            </Button>
          )}
          {showFirmar && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={onFirmar}
              disabled={firmando || firmarDeshabilitado}
            >
              {firmando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSignature className="h-3.5 w-3.5" />
              )}
              Firmar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
