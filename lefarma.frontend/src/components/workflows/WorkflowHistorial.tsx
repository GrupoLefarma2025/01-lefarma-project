import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Ban, CheckCircle2, CircleDot, Send, Undo2 } from 'lucide-react';

/** Forma mínima del historial (bitácora) que devuelve el motor de workflow. */
export interface HistorialWorkflowItemMin {
  idEvento: number;
  nombrePaso?: string | null;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  fechaEvento: string;
}

const formatearFechaHora = (fecha: string): string => {
  try {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fecha;
  }
};

function iconoDeAccion(codigo?: string | null) {
  switch (codigo) {
    case 'APROBAR':
    case 'AUTORIZAR':
    case 'CERRAR':
      return { Icono: CheckCircle2, clase: 'text-emerald-600' };
    case 'DEVOLVER':
    case 'RECHAZAR':
      return { Icono: Undo2, clase: 'text-amber-600' };
    case 'CANCELAR':
      return { Icono: Ban, clase: 'text-red-600' };
    case 'ENVIAR':
      return { Icono: Send, clase: 'text-blue-600' };
    default:
      return { Icono: CircleDot, clase: 'text-muted-foreground' };
  }
}

interface WorkflowHistorialProps {
  items: HistorialWorkflowItemMin[];
  vacioTexto?: string;
  className?: string;
}

/** Historial (bitácora) del workflow: quién, cuándo, qué paso y comentario. */
export function WorkflowHistorial({
  items,
  vacioTexto = 'Sin movimientos registrados.',
  className,
}: WorkflowHistorialProps) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{vacioTexto}</p>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const { Icono, clase } = iconoDeAccion(item.nombreAccion);
        return (
          <div key={item.idEvento} className="flex gap-3">
            <Icono className={cn('mt-0.5 h-4 w-4 shrink-0', clase)} />
            <div className="min-w-0 flex-1 border-b border-border/60 pb-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {item.nombrePaso ?? 'Paso del flujo'}
                </p>
                {item.nombreAccion && (
                  <Badge variant="outline" className="text-[10px]">
                    {item.nombreAccion}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.nombreUsuario ?? `Usuario #${item.idUsuario}`} ·{' '}
                {formatearFechaHora(item.fechaEvento)}
              </p>
              {item.comentario && (
                <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                  {item.comentario}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
