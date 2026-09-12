import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SeleccionMensual } from '@/apps/educacion-medica/types/educacionMedica.types';
import { formatearFecha, type EstadoVersion } from '../rutasUtils';

interface VersionOpcion {
  version: number;
  estado: EstadoVersion;
}

interface RutasHeaderProps {
  seleccion: SeleccionMensual | null;
  versiones: VersionOpcion[];
  version: number | null;
  estadoVersion: EstadoVersion | null;
  onVersionChange: (version: number) => void;
  onBack: () => void;
}

const BADGE_ESTADO: Record<EstadoVersion, { label: string; className: string }> = {
  Draft: { label: 'DRAFT', className: 'bg-amber-500/15 text-amber-700 border-amber-300' },
  Confirmada: { label: 'CONFIRMADA', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-300' },
  Cancelada: { label: 'CANCELADA', className: 'bg-red-500/10 text-red-700 border-red-300' },
  Archivada: { label: 'ARCHIVADA', className: 'bg-muted text-muted-foreground' },
};

export function RutasHeader({
  seleccion,
  versiones,
  version,
  estadoVersion,
  onVersionChange,
  onBack,
}: RutasHeaderProps) {
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Volver a Selección y reparto
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold leading-none">Planificación de rutas</h2>
            {estadoVersion && (
              <Badge variant="outline" className={BADGE_ESTADO[estadoVersion].className}>
                {BADGE_ESTADO[estadoVersion].label}
              </Badge>
            )}
          </div>
          {seleccion && (
            <p className="text-xs text-muted-foreground">
              {seleccion.tipoGerencia ? `${seleccion.tipoGerencia} · ` : ''}
              {seleccion.fechaInicioVigencia && seleccion.fechaFinVigencia
                ? `${formatearFecha(seleccion.fechaInicioVigencia)} – ${formatearFecha(seleccion.fechaFinVigencia)} · `
                : ''}
              Selección {seleccion.estado.toLowerCase()}
            </p>
          )}
        </div>

        {versiones.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Versión</span>
            <Select
              value={version !== null ? String(version) : undefined}
              onValueChange={(v) => onVersionChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[170px] text-sm">
                <SelectValue placeholder="Selecciona versión" />
              </SelectTrigger>
              <SelectContent>
                {versiones.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    V{v.version} · {v.estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
