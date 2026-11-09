import { useMemo, useState } from 'react';
import { Check, Search, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { estiloGerencia, iniciales, tonoAvatar, tonoGerencia } from '../calendarioUtils';

export type TipoResponsable = 'especialistas' | 'ejecutivos';

export interface ResponsableGrupoPersona {
  id: number;
  nombre: string;
  detalle: string;
  total: number;
}

export interface ResponsableGrupo {
  idTipoGerencia: number | null;
  nombreGerencia: string;
  personas: ResponsableGrupoPersona[];
}

interface ResponsableFiltroProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  tipo: TipoResponsable;
  onTipoChange: (tipo: TipoResponsable) => void;
  grupos: ResponsableGrupo[];
  idSeleccionado: number | null;
  onSeleccionar: (id: number | null, tipo: TipoResponsable) => void;
  ejecutivosCount: number;
  especialistasCount: number;
  activoNombre: string | null;
}

export function ResponsableFiltro({
  abierto,
  onAbiertoChange,
  tipo,
  onTipoChange,
  grupos,
  idSeleccionado,
  onSeleccionar,
  ejecutivosCount,
  especialistasCount,
  activoNombre,
}: ResponsableFiltroProps) {
  const [busqueda, setBusqueda] = useState('');

  const gruposFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return grupos
      .map((grupo) => ({
        ...grupo,
        personas: grupo.personas.filter(
          (persona) =>
            !texto ||
            persona.nombre.toLowerCase().includes(texto) ||
            persona.detalle.toLowerCase().includes(texto)
        ),
      }))
      .filter((grupo) => grupo.personas.length > 0);
  }, [busqueda, grupos]);

  const total = tipo === 'ejecutivos' ? ejecutivosCount : especialistasCount;

  return (
    <Popover open={abierto} onOpenChange={onAbiertoChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg border-slate-200 bg-card px-2.5 text-[11px]"
          aria-label="Filtrar por responsable"
        >
          <UsersRound className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{activoNombre ?? 'Responsable'}</span>
          {activoNombre && (
            <Badge className="h-4 min-w-4 rounded-full bg-orange-100 px-1 text-[9px] text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300">
              1
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(92vw,360px)] overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Responsable
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Filtra por especialista o ejecutivo, agrupado por gerencia.
          </p>

          <Tabs
            value={tipo}
            onValueChange={(value) => onTipoChange(value as TipoResponsable)}
            className="mt-2"
          >
            <TabsList className="grid h-8 w-full grid-cols-2 rounded-lg bg-slate-50 p-0.5 dark:bg-slate-900/60">
              <TabsTrigger value="especialistas" className="gap-1 rounded-md text-[10px]">
                Especialistas
                <span className="text-[9px] text-slate-400">{especialistasCount}</span>
              </TabsTrigger>
              <TabsTrigger value="ejecutivos" className="gap-1 rounded-md text-[10px]">
                Ejecutivos
                <span className="text-[9px] text-slate-400">{ejecutivosCount}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar responsable..."
              className="h-8 rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
            />
          </div>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => onSeleccionar(null, tipo)}
            className={[
              'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors',
              idSeleccionado == null
                ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
                : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
            ].join(' ')}
          >
            <span className="text-xs font-semibold">Todos</span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {total}
              </span>
              {idSeleccionado == null && <Check className="h-3.5 w-3.5" />}
            </span>
          </button>

          {gruposFiltrados.length === 0 ? (
            <p className="px-3 py-5 text-center text-[11px] text-slate-400">
              {busqueda.trim()
                ? 'Sin responsables que coincidan.'
                : 'Activa al menos una gerencia para ver responsables.'}
            </p>
          ) : (
            gruposFiltrados.map((grupo) => {
              const estilo =
                estiloGerencia[
                  tonoGerencia({
                    idTipoGerencia: grupo.idTipoGerencia,
                    gerencia: grupo.nombreGerencia,
                  })
                ];
              return (
                <section
                  key={`${grupo.idTipoGerencia ?? 'sin-gerencia'}-${grupo.nombreGerencia}`}
                  className="mt-2"
                >
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className={`h-2 w-2 rounded-full ${estilo.punto}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      {grupo.nombreGerencia}
                    </p>
                    <span className="text-[10px] text-slate-400">{grupo.personas.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {grupo.personas.map((persona) => {
                      const activo = idSeleccionado === persona.id;
                      return (
                        <button
                          key={`${grupo.nombreGerencia}-${persona.id}`}
                          type="button"
                          onClick={() => onSeleccionar(persona.id, tipo)}
                          className={[
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                            activo
                              ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
                          ].join(' ')}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${tonoAvatar(persona.nombre)}`}
                          >
                            {iniciales(persona.nombre)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {persona.nombre}
                            </span>
                            <span className="block truncate text-[9px] text-slate-400">
                              {persona.detalle}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {persona.total}
                            </span>
                            {activo && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-2 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[10px] text-slate-500"
            onClick={() => onSeleccionar(null, tipo)}
          >
            Quitar filtro
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-[10px]"
            onClick={() => onAbiertoChange(false)}
          >
            Cerrar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
