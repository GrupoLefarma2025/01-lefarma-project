import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';

interface VisitaRutaItemProps {
  visita: RutaVisita;
  ubicacion: string | null;
  editable: boolean;
  onRetornar: (visita: RutaVisita) => void;
}

export function VisitaRutaItem({ visita, ubicacion, editable, onRetornar }: VisitaRutaItemProps) {
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
      {editable && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
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
                {visita.esForanea && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
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
      </div>
      {editable && (
        <button
          type="button"
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
          title="Mover a Sin planificar (el hospital sigue en la selección)"
          onClick={() => onRetornar(visita)}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
