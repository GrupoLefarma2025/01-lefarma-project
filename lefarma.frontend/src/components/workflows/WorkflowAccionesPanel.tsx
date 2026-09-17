import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { SignatureAlert } from '@/components/common/SignatureAlert';
import { accionBotonClase, type AccionWorkflow } from './workflowAccion';

interface WorkflowAccionesPanelProps {
  acciones: AccionWorkflow[];
  onAccionClick: (accion: AccionWorkflow) => void;
  isSubmitting?: boolean;
  hasFirma?: boolean;
  vacioTexto?: string;
}

/** Panel de acciones disponibles del paso actual (mismo patrón que solicitudes de personal). */
export function WorkflowAccionesPanel({
  acciones,
  onAccionClick,
  isSubmitting,
  hasFirma = true,
  vacioTexto = 'No hay acciones disponibles para tu usuario en este paso',
}: WorkflowAccionesPanelProps) {
  return (
    <div className="space-y-3">
      {hasFirma === false && <SignatureAlert />}
      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 dark:border-blue-800 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Acciones disponibles
            </span>
            <Badge
              variant="outline"
              className="border-blue-200 text-[10px] text-blue-700 dark:border-blue-800 dark:text-blue-300"
            >
              Paso actual
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {acciones.length === 0 ? (
              <span className="text-xs text-muted-foreground">{vacioTexto}</span>
            ) : (
              acciones.map((accion) => (
                <Button
                  key={accion.idAccion}
                  size="sm"
                  className={accionBotonClase(accion)}
                  onClick={() => onAccionClick(accion)}
                  disabled={isSubmitting || hasFirma === false}
                >
                  {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  {accion.tipoAccionNombre ?? 'Ejecutar'}
                </Button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
