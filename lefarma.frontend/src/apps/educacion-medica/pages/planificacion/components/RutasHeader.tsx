import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EstadoVersion } from '../rutasUtils';

interface VersionOpcion {
  version: number;
  estado: EstadoVersion;
}

interface RutasHeaderProps {
  versiones: VersionOpcion[];
  version: number | null;
  onVersionChange: (version: number) => void;
  onBack: () => void;
}

/**
 * Navegación de la pantalla de Rutas: volver + selector de versión. El encabezado
 * del documento (paso, estado y Firmar/Historial) es el `DocumentoHeaderCard`
 * compartido, igual que en Selección Mensual y Matriz de talleres.
 */
export function RutasHeader({
  versiones,
  version,
  onVersionChange,
  onBack,
}: RutasHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Volver a Selección Mensual
      </Button>

      {versiones.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="selector-version-rutas"
            className="text-xs font-medium text-muted-foreground"
          >
            Versión
          </label>
          <Select
            value={version !== null ? String(version) : undefined}
            onValueChange={(v) => onVersionChange(Number(v))}
          >
            <SelectTrigger
              id="selector-version-rutas"
              className="h-8 w-[170px] text-sm"
              aria-label="Versión de rutas"
            >
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
  );
}
