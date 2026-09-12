import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DragPayload } from '../rutasUtils';

export interface HospitalSinPlanificar {
  idSeleccionHospital: number;
  nombre: string;
  ubicacion: string | null;
  regionNombre: string | null;
  sinAsignacion: boolean;
}

interface SinPlanificarPanelProps {
  items: HospitalSinPlanificar[];
  errores: Record<number, string>;
  editable: boolean;
  dragActivo: DragPayload | null;
}

function ItemSinPlanificar({ item, editable }: { item: HospitalSinPlanificar; editable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `nuevo-${item.idSeleccionHospital}`,
    data: { tipo: 'nuevo', idSeleccionHospital: item.idSeleccionHospital, nombre: item.nombre },
    disabled: !editable,
  });

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
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.nombre}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[item.ubicacion, item.regionNombre].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      {item.sinAsignacion && (
        <span
          className="shrink-0 text-xs text-amber-600"
          title="Este hospital no tiene región o equipo asignado en la selección"
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

export function SinPlanificarPanel({ items, errores, editable, dragActivo }: SinPlanificarPanelProps) {
  const [abierto, setAbierto] = useState(true);
  const { isOver, setNodeRef } = useDroppable({ id: 'sin-planificar', disabled: !editable });

  if (items.length === 0 && !dragActivo) return null;

  const arrastrandoVisita = dragActivo?.tipo === 'visita';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border transition-all',
        isOver && editable && arrastrandoVisita
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'bg-muted/30'
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-sm"
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="flex items-center gap-1 font-medium">
          {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Sin planificar
        </span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </button>

      {abierto && (
        <div className="space-y-1 px-2 pb-2">
          {items.length === 0 && (
            <p className="px-1 py-1 text-xs text-muted-foreground">
              Suelta aquí una visita para devolverla a sin planificar.
            </p>
          )}
          {items.map((item) => (
            <div key={item.idSeleccionHospital} className="space-y-1">
              <ItemSinPlanificar item={item} editable={editable} />
              {errores[item.idSeleccionHospital] && (
                <p className="px-2 text-xs text-destructive">
                  ⚠ {errores[item.idSeleccionHospital]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
