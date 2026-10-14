import { useDraggable } from '@dnd-kit/core';
import { Clock, GripVertical, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';

interface VisitaRutaItemProps {
  visita: RutaVisita;
  ubicacion: string | null;
  editable: boolean;
  /** Modo ajuste post-cierre (ADR-00010): drag y acciones con motivo. */
  modoAjuste?: boolean;
  onRetornar: (visita: RutaVisita) => void;
  onEditarHoras?: (visita: RutaVisita) => void;
}

export function VisitaRutaItem({
  visita,
  ubicacion,
  editable,
  modoAjuste,
  onRetornar,
  onEditarHoras,
}: VisitaRutaItemProps) {
  // dnd-kit (pointer events): funciona igual con mouse y tactil; evita la clase
  // completa de bugs del drag nativo (tooltips del SO, seleccion de texto, etc.).
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `visita-${visita.idRutaVisita}`,
    data: { tipo: 'visita', visita },
    disabled: !editable,
  });

  const tooltipText = ubicacion
    ? `${visita.nombreHospital ?? 'Hospital'} — ${ubicacion}`
    : (visita.nombreHospital ?? 'Hospital');

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex select-none items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm',
        editable && 'cursor-grab touch-none hover:shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      {editable && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {visita.orden}
      </span>
      <div className="min-w-0 flex-1">
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate font-medium">
                {visita.nombreHospital ??
                  `Hospital ${visita.idHospital ?? visita.idSeleccionHospital}`}
                {visita.esExtraordinaria && (
                  <Badge
                    variant="outline"
                    className="ml-2 border-amber-300 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  >
                    Extraordinaria
                  </Badge>
                )}
                {visita.esForanea && (
                  <Badge variant="outline" className="ml-2 text-[10px] font-medium">
                    Foráneo
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {ubicacion && <p className="truncate text-xs text-muted-foreground">{ubicacion}</p>}
        {(visita.horaSalida || visita.horaLlegada) && (
          <p className="text-[11px] text-muted-foreground">
            {visita.horaSalida ? `Sale ${visita.horaSalida.slice(0, 5)}` : ''}
            {visita.horaSalida && visita.horaLlegada ? ' · ' : ''}
            {visita.horaLlegada ? `Llega ${visita.horaLlegada.slice(0, 5)}` : ''}
          </p>
        )}
      </div>
      {(editable || modoAjuste) && onEditarHoras && (
        <button
          type="button"
          className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="Editar horas de la visita"
          aria-label="Editar horas de la visita"
          onClick={() => onEditarHoras(visita)}
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      )}
      {editable && (
        <button
          type="button"
          className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title={
            modoAjuste
              ? 'Quitar visita (ajuste post-cierre con motivo)'
              : 'Mover a Sin planificar (el hospital sigue en la selección)'
          }
          aria-label="Quitar visita y devolver el hospital a Sin planificar"
          onClick={() => onRetornar(visita)}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
