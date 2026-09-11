import { useDroppable } from '@dnd-kit/core';
import { CheckCircle2, MapIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';
import {
  CLASES_ESTADO_DIA,
  diaSemana,
  estadoDelDia,
  fechaCorta,
  formatearFecha,
  type DragPayload,
} from '../rutasUtils';
import { VisitaRutaItem } from './VisitaRutaItem';

interface DiaRutaProps {
  idRuta: number;
  fecha: string;
  visitas: RutaVisita[];
  maxVisitasDia: number;
  editable: boolean;
  dragActivo: DragPayload | null;
  ubicacionPorVisita: (visita: RutaVisita) => string | null;
  onRetornar: (visita: RutaVisita) => void;
  onVerMapa: (fecha: string, visitas: RutaVisita[]) => void;
}

export function DiaRuta({
  idRuta,
  fecha,
  visitas,
  maxVisitasDia,
  editable,
  dragActivo,
  ubicacionPorVisita,
  onRetornar,
  onVerMapa,
}: DiaRutaProps) {
  const estado = estadoDelDia(visitas.length, maxVisitasDia);
  // Tope duro (espejo del backend): un dia lleno no acepta altas ni movimientos
  // entrantes; solo reorden dentro del mismo dia.
  const aceptaDrop =
    dragActivo?.tipo === 'nuevo' ||
    (dragActivo?.tipo === 'visita' && dragActivo.visita.fechaVisita !== fecha);
  const dropBloqueado = editable && aceptaDrop && visitas.length >= maxVisitasDia;

  const { isOver, setNodeRef } = useDroppable({
    id: `dia-${idRuta}-${fecha}`,
    data: { fecha, idRuta },
    disabled: !editable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'select-none overflow-hidden rounded-lg border bg-card shadow-sm transition-all',
        isOver && editable
          ? dropBloqueado
            ? 'border-destructive ring-2 ring-destructive/30'
            : 'border-primary ring-2 ring-primary/30'
          : 'border-border'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 text-xs font-semibold',
          CLASES_ESTADO_DIA[estado]
        )}
      >
        <span className="uppercase tracking-wide">
          {diaSemana(fecha)} {formatearFecha(fecha)}
        </span>
        <div className="flex items-center gap-1.5">
          {estado === 'lleno' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {visitas.length}/{maxVisitasDia}
          {estado === 'lleno' && (
            <Badge variant="outline" className="border-emerald-300 bg-white/60 text-[9px] text-emerald-700">
              Lleno
            </Badge>
          )}
          {estado === 'incompleto' && (
            <Badge variant="outline" className="border-red-300 bg-white/60 text-[9px] text-red-700">
              Incompleto
            </Badge>
          )}
          {estado === 'excedido' && (
            <Badge variant="outline" className="border-red-400 bg-white/60 text-[9px] text-red-800">
              Excedido
            </Badge>
          )}
          {estado === 'vacio' && <span className="font-normal normal-case">Día libre</span>}
        </div>
      </div>

      <div className="p-2">
        {visitas.length === 0 ? (
          dragActivo && editable ? (
            <p className="rounded-md border border-dashed py-2 text-center text-xs text-muted-foreground">
              Arrastra una visita aquí
            </p>
          ) : (
            <p className="py-1 text-center text-xs text-muted-foreground/60">
              {editable ? 'Suelta una visita aquí para programarla' : 'Sin visitas'}
            </p>
          )
        ) : (
          <div className="space-y-1">
            {isOver && dropBloqueado && (
              <p className="rounded-md border border-dashed border-destructive/60 bg-destructive/5 py-0.5 text-center text-[11px] text-destructive">
                Día lleno ({visitas.length}/{maxVisitasDia})
              </p>
            )}
            {isOver && !dropBloqueado && (
              <p className="rounded-md border border-dashed border-primary/60 bg-primary/5 py-0.5 text-center text-[11px] text-primary">
                Suelta aquí para {dragActivo?.tipo === 'nuevo' ? 'agregar la visita' : 'mover la visita'}
              </p>
            )}
            {visitas.map((visita) => (
              <VisitaRutaItem
                key={visita.idRutaVisita}
                visita={visita}
                ubicacion={ubicacionPorVisita(visita)}
                editable={editable}
                onRetornar={onRetornar}
              />
            ))}
          </div>
        )}
        {visitas.length > 0 && (
          <div className="mt-1.5 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground"
              onClick={() => onVerMapa(fecha, visitas)}
              title={`Ver en mapa el recorrido del ${fechaCorta(fecha)}`}
            >
              <MapIcon className="mr-1 h-3.5 w-3.5" />
              Ver mapa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
