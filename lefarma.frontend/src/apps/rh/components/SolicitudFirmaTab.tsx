import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { AccionDisponibleResponse } from '@/types/solicitudPersonalWorkflow.types';

const actionStyles: Record<string, string> = {
  APROBAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  AUTORIZAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  RECHAZAR: 'bg-red-600 hover:bg-red-700 text-white',
  DEVOLVER: 'bg-amber-500 hover:bg-amber-600 text-white',
  CANCELAR: 'bg-red-600 hover:bg-red-700 text-white',
  CERRAR: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  ENVIAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  NOTIFICACION: 'bg-amber-500 hover:bg-amber-600 text-white',
};

interface SolicitudFirmaTabProps {
  acciones: AccionDisponibleResponse[];
  onAccionClick: (accion: AccionDisponibleResponse) => void;
  isSubmittingFirma?: boolean;
}

export function SolicitudFirmaTab({
  acciones,
  onAccionClick,
  isSubmittingFirma,
}: SolicitudFirmaTabProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 dark:border-blue-800 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Acciones disponibles
            </span>
            <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
              Paso actual
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {acciones.length === 0 ? (
              <span className="text-xs text-muted-foreground">No hay acciones disponibles para tu usuario en este paso</span>
            ) : (
              acciones.map((a) => (
                <Button
                  key={a.idAccion}
                  size="sm"
                  className={actionStyles[a.tipoAccionCodigo ?? ''] ?? 'bg-blue-600 hover:bg-blue-700 text-white'}
                  onClick={() => onAccionClick(a)}
                  disabled={isSubmittingFirma}
                >
                  {isSubmittingFirma ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  {a.tipoAccionNombre}
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}