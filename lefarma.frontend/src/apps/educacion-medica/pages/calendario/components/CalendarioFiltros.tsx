import { CalendarRange } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  EjecutivoRegion,
  EspecialistaPersona,
  Region,
  TipoGerencia,
} from '../../../types/educacionMedica.types';
import { AyudaContextual } from './AyudaContextual';

export interface EstadoFiltroOpcion {
  valor: string;
  etiqueta: string;
}

interface CalendarioFiltrosProps {
  todos: string;
  mostrarResponsables?: boolean;
  periodoLabel: string;
  idGerencia: string;
  gerencias: TipoGerencia[];
  onGerenciaChange: (value: string) => void;
  idRegion: string;
  regiones: Region[];
  onRegionChange: (value: string) => void;
  idEjecutivo: string;
  ejecutivos: EjecutivoRegion[];
  onEjecutivoChange: (value: string) => void;
  idEspecialista: string;
  especialistas: EspecialistaPersona[];
  onEspecialistaChange: (value: string) => void;
  estado: string;
  estados: EstadoFiltroOpcion[];
  onEstadoChange: (value: string) => void;
}

const selectClass = 'h-9 w-full rounded-lg border-slate-200 bg-card text-xs dark:border-slate-800';

export function CalendarioFiltros({
  todos,
  mostrarResponsables = true,
  periodoLabel,
  idGerencia,
  gerencias,
  onGerenciaChange,
  idRegion,
  regiones,
  onRegionChange,
  idEjecutivo,
  ejecutivos,
  onEjecutivoChange,
  idEspecialista,
  especialistas,
  onEspecialistaChange,
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
            Gerencia y región acotan el universo de hospitales. La región se filtra según la
            gerencia seleccionada.
          </AyudaContextual>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={idGerencia} onValueChange={onGerenciaChange}>
            <SelectTrigger className={selectClass} aria-label="Gerencia">
              <SelectValue placeholder="Gerencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={todos}>Todas las gerencias</SelectItem>
              {gerencias.map((gerencia) => (
                <SelectItem key={gerencia.idTipoGerencia} value={String(gerencia.idTipoGerencia)}>
                  {gerencia.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

      {!mostrarResponsables && (
        <section className="rounded-lg border-l-2 border-sky-300 bg-sky-50/40 p-3 dark:border-sky-800 dark:bg-sky-950/10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-700 dark:text-sky-300">
            Mis visitas
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-sky-700 dark:text-sky-300">
            Solo se muestran las visitas en las que eres ejecutivo o especialista.
          </p>
        </section>
      )}

      {mostrarResponsables && (
        <section className="rounded-lg border-l-2 border-violet-300 bg-violet-50/30 p-3 dark:border-violet-800 dark:bg-violet-950/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-700 dark:text-violet-300">
              Responsables
            </p>
            <AyudaContextual titulo="Responsables">
              El ejecutivo es el dueño comercial del hospital; el especialista es quien viaja e
              imparte el taller. Puedes filtrar por cualquiera de los dos.
            </AyudaContextual>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={idEjecutivo} onValueChange={onEjecutivoChange}>
              <SelectTrigger className={selectClass} aria-label="Ejecutivo">
                <SelectValue placeholder="Ejecutivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={todos}>Todos los ejecutivos</SelectItem>
                {ejecutivos.map((ejecutivo) => (
                  <SelectItem key={ejecutivo.idUsuario} value={String(ejecutivo.idUsuario)}>
                    {ejecutivo.nombreUsuario}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idEspecialista} onValueChange={onEspecialistaChange}>
              <SelectTrigger className={selectClass} aria-label="Especialista">
                <SelectValue placeholder="Especialista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={todos}>Todos los especialistas</SelectItem>
                {especialistas.map((especialista) => (
                  <SelectItem key={especialista.idUsuario} value={String(especialista.idUsuario)}>
                    {especialista.nombreUsuario}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

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
