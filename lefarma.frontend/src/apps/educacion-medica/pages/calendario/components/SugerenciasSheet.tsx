import { useState } from 'react';
import { Check, Loader2, MapPin, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SugerenciaEspecialistaCalendario } from '../../../types/educacionMedica.types';
import {
  estiloGerencia,
  fechaMedia,
  iniciales,
  tonoAvatar,
  tonoGerencia,
} from '../calendarioUtils';

interface SugerenciasSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sugerencias: SugerenciaEspecialistaCalendario[];
  asignandoId: number | null;
  asignandoLote?: boolean;
  onAsignar: (sugerencia: SugerenciaEspecialistaCalendario) => void;
  onAsignarSeleccionadas: (sugerencias: SugerenciaEspecialistaCalendario[]) => void;
}

export function SugerenciasSheet({
  open,
  onOpenChange,
  sugerencias,
  asignandoId,
  asignandoLote = false,
  onAsignar,
  onAsignarSeleccionadas,
}: SugerenciasSheetProps) {
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(() => new Set());
  const seleccionables = sugerencias.filter((sugerencia) => sugerencia.idRutaVisita);
  const idsSeleccionados = seleccionables.filter((sugerencia) =>
    seleccionadas.has(sugerencia.idRutaVisita)
  );
  const todasSeleccionadas =
    seleccionables.length > 0 && idsSeleccionados.length === seleccionables.length;
  const algunasSeleccionadas = idsSeleccionados.length > 0 && !todasSeleccionadas;

  const alternarTodas = () => {
    setSeleccionadas(
      todasSeleccionadas
        ? new Set()
        : new Set(seleccionables.map((sugerencia) => sugerencia.idRutaVisita))
    );
  };

  const alternar = (id: number) => {
    setSeleccionadas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const grupos = [...sugerencias
    .reduce<Map<string, SugerenciaEspecialistaCalendario[]>>((mapa, sugerencia) => {
      const grupo = mapa.get(sugerencia.gerencia) ?? [];
      grupo.push(sugerencia);
      mapa.set(sugerencia.gerencia, grupo);
      return mapa;
    }, new Map())
    .entries()]
    .sort(([gerenciaA], [gerenciaB]) => gerenciaA.localeCompare(gerenciaB));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-orange-500" />
            Sugerencias de especialista
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            El sistema propone al especialista que ya estará cerca, que conoce la zona o que tiene
            menor carga. Tú decides si lo asignas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {sugerencias.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={
                    todasSeleccionadas ? true : algunasSeleccionadas ? 'indeterminate' : false
                  }
                  onCheckedChange={alternarTodas}
                  disabled={asignandoLote}
                />
                Seleccionar todas
              </label>
              <span className="text-[10px] text-slate-400">
                {idsSeleccionados.length}/{seleccionables.length} seleccionadas
              </span>
            </div>
          )}
          {sugerencias.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-800">
              <Sparkles className="mx-auto h-5 w-5 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                No hay sugerencias pendientes.
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Todas las visitas del periodo ya tienen especialista o no hay una coincidencia
                cercana.
              </p>
            </div>
          ) : (
            grupos.map(([gerencia, sugerenciasGrupo]) => {
              const estilo = estiloGerencia[
                tonoGerencia({
                  idTipoGerencia: sugerenciasGrupo[0]?.idTipoGerencia ?? null,
                  gerencia,
                })
              ];
              return (
                <section key={gerencia} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 pt-1">
                    <span className={`h-2 w-2 rounded-full ${estilo.punto}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      {gerencia}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {sugerenciasGrupo.length}
                    </span>
                  </div>
                  {sugerenciasGrupo.map((sugerencia) => {
                    const guardando = asignandoId === sugerencia.idRutaVisita;
                    return (
                <article
                  key={sugerencia.idRutaVisita}
                  className="rounded-xl border border-slate-200/80 bg-card p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <Checkbox
                        checked={seleccionadas.has(sugerencia.idRutaVisita)}
                        onCheckedChange={() => alternar(sugerencia.idRutaVisita)}
                        disabled={guardando || asignandoLote}
                        aria-label={`Seleccionar ${sugerencia.nombreHospital ?? 'sugerencia'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {sugerencia.nombreHospital ?? 'Hospital sin nombre'}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {sugerencia.ciudadMunicipio ?? 'Sin ciudad'}
                          </span>
                          <span>·</span>
                          <span>{fechaMedia(sugerencia.fechaVisita)}</span>
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full text-[9px]"
                      title="Carga actual del especialista ese día; el máximo es 3 visitas"
                    >
                      Carga: {sugerencia.cargaDia}/3 visitas
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50/60 px-2.5 py-2 dark:bg-orange-950/20">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${tonoAvatar(sugerencia.nombreEspecialista)}`}
                    >
                      {iniciales(sugerencia.nombreEspecialista)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {sugerencia.nombreEspecialista}
                      </p>
                      <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {sugerencia.motivo} · {sugerencia.cargaSemana}/8 visitas en la semana ·{' '}
                        {sugerencia.cargaMes} en el mes
                        {sugerencia.tieneDiaConsecutivo ? ' · día consecutivo' : ''}
                      </p>
                      {sugerencia.haVisitadoHospital && (
                        <p className="text-[10px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                          Ya visitó este hospital {sugerencia.visitasRealizadasHospital} vez(ces)
                          {sugerencia.ultimaVisitaHospital
                            ? ` · última ${fechaMedia(sugerencia.ultimaVisitaHospital)}`
                            : ''}
                        </p>
                      )}
                      {(sugerencia.haVisitadoCiudad ||
                        sugerencia.haVisitadoRegion ||
                        sugerencia.haVisitadoInstitucion) && (
                        <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {sugerencia.haVisitadoCiudad
                            ? `${sugerencia.visitasRealizadasCiudad} visita(s) en ${sugerencia.ciudadMunicipio}`
                            : ''}
                          {sugerencia.haVisitadoRegion
                            ? `${sugerencia.haVisitadoCiudad ? ' · ' : ''}${sugerencia.visitasRealizadasRegion} en la región ${sugerencia.region}`
                            : ''}
                          {sugerencia.haVisitadoInstitucion
                            ? `${sugerencia.haVisitadoCiudad || sugerencia.haVisitadoRegion ? ' · ' : ''}${sugerencia.visitasRealizadasInstitucion} en la institución`
                            : ''}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 gap-1 rounded-lg bg-[#eb6c36] px-2.5 text-[10px] text-white hover:bg-[#d95a2b]"
                      onClick={() => onAsignar(sugerencia)}
                      disabled={guardando || asignandoLote}
                    >
                      {guardando ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Asignar
                    </Button>
                  </div>
                </article>
              );
                  })}
                </section>
              );
            })
          )}
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">
              Cómo funciona:
            </strong>{' '}
            el sistema busca visitas sin especialista y propone a quien ya estará en la ciudad,
            comparte institución, tiene menor carga y evita días consecutivos. También considera
            cuántas veces ha visitado el hospital, la ciudad, la región o la institución. Revisa la
            fecha, la ciudad y la capacidad;
            selecciona una o varias y pulsa <strong>Asignar</strong>. La sugerencia desaparece y el
            calendario se actualiza. El sistema no asigna automáticamente.
          </p>
          <Button
            className="h-9 w-full rounded-lg bg-[#eb6c36] text-[11px] text-white hover:bg-[#d95a2b]"
            onClick={() => onAsignarSeleccionadas(idsSeleccionados)}
            disabled={idsSeleccionados.length === 0 || asignandoLote}
          >
            {asignandoLote ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Asignar seleccionadas ({idsSeleccionados.length})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
