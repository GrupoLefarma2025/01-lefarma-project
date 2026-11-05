import { CalendarRange } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Region, TipoGerencia } from '../../../types/educacionMedica.types';
import { AyudaContextual } from './AyudaContextual';

export interface EstadoFiltroOpcion {
  valor: string;
  etiqueta: string;
}

interface CalendarioFiltrosProps {
  todos: string;
  periodoLabel: string;
  idGerencias: string[];
  gerencias: TipoGerencia[];
  onGerenciasChange: (value: string[]) => void;
  idRegion: string;
  regiones: Region[];
  onRegionChange: (value: string) => void;
  estado: string;
  estados: EstadoFiltroOpcion[];
  onEstadoChange: (value: string) => void;
}

const selectClass = 'h-9 w-full rounded-lg border-slate-200 bg-card text-xs dark:border-slate-800';

export function CalendarioFiltros({
  todos,
  periodoLabel,
  idGerencias,
  gerencias,
  onGerenciasChange,
  idRegion,
  regiones,
  onRegionChange,
  estado,
  estados,
  onEstadoChange,
}: CalendarioFiltrosProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-orange-200/70 bg-orange-50/50 px-3 py-2 text-[11px] text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <CalendarRange className="h-3.5 w-3.5" />
          {periodoLabel}
        </span>
        <AyudaContextual titulo="Periodo">
          El calendario muestra el mes y la selección mensual activa. Cambia el mes desde la
          cabecera para consultar otra planeación.
        </AyudaContextual>
      </div>

      <section className="rounded-lg border-l-2 border-emerald-300 bg-emerald-50/30 p-3 dark:border-emerald-800 dark:bg-emerald-950/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
            Alcance
          </p>
          <AyudaContextual titulo="Alcance">
            Activa o desactiva las gerencias que quieres consultar. Si desactivas todas, el
            calendario se muestra vacío hasta reactivar alguna. La matriz se abre por gerencia
            desde su propio selector.
          </AyudaContextual>
        </div>
        <div className="space-y-2">
          <MultiSelect
            options={gerencias.map((gerencia) => ({
              value: String(gerencia.idTipoGerencia),
              label: gerencia.descripcion,
            }))}
            value={idGerencias}
            onChange={onGerenciasChange}
            placeholder="Todas las gerencias"
            searchPlaceholder="Buscar gerencia..."
            emptyText="Sin gerencias."
            className="text-xs"
          />

          <Select value={idRegion} onValueChange={onRegionChange}>
            <SelectTrigger className={selectClass} aria-label="Región">
              <SelectValue placeholder="Región" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={todos}>Todas las regiones</SelectItem>
              {regiones.map((region) => (
                <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                  {region.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-lg border-l-2 border-slate-300 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">
            Estado
          </p>
          <AyudaContextual titulo="Estado">
            Filtra visitas con taller programado, en curso, realizadas o canceladas. “Sin taller”
            muestra visitas pendientes de captura.
          </AyudaContextual>
        </div>
        <Select value={estado} onValueChange={onEstadoChange}>
          <SelectTrigger className={selectClass} aria-label="Estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={todos}>Todos los estados</SelectItem>
            {estados.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </div>
  );
}
