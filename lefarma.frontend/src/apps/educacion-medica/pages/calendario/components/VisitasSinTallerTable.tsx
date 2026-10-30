import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ExternalLink, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VisitaSinTaller } from '../../../types/educacionMedica.types';
import { fechaMedia } from '../calendarioUtils';

interface VisitasSinTallerTableProps {
  visitas: VisitaSinTaller[];
  loading?: boolean;
  puedeCrear: boolean;
  onCrearTaller: (visita: VisitaSinTaller) => void;
  onVerVisita: (visita: VisitaSinTaller) => void;
}

export function VisitasSinTallerTable({
  visitas,
  loading,
  puedeCrear,
  onCrearTaller,
  onVerVisita,
}: VisitasSinTallerTableProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return visitas;
    return visitas.filter((visita) =>
      [
        visita.hospital,
        visita.region,
        visita.nombreEjecutivo,
        visita.nombreEspecialista,
        visita.estadoRuta,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto))
    );
  }, [visitas, busqueda]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Visitas sin taller
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {visitas.length} visita(s) tipo taller sin taller capturado. No todas son un error.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar hospital, región…"
            className="h-8 w-[220px] rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center dark:border-slate-800 dark:bg-slate-900/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-500 shadow-sm dark:bg-slate-900">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {visitas.length === 0 ? 'Cobertura completa' : 'Sin resultados'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {visitas.length === 0
              ? 'Todas las visitas tipo taller tienen al menos un taller capturado.'
              : 'Ajusta la búsqueda para encontrar la visita.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[11px]">
            <thead>
              <tr className="bg-slate-50/80 text-[9px] uppercase tracking-[0.08em] text-slate-400 dark:bg-slate-900/60">
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Hospital</th>
                <th className="px-3 py-2 text-left font-semibold">Región</th>
                <th className="px-3 py-2 text-left font-semibold">Equipo</th>
                <th className="px-3 py-2 text-left font-semibold">Ruta</th>
                <th className="px-3 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((visita) => (
                <tr
                  key={visita.idRutaVisita}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                >
                  <td className="border-t border-slate-100 px-3 py-2.5 tabular-nums dark:border-slate-800/70">
                    <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <CalendarDays className="h-3 w-3 text-slate-300" />
                      {fechaMedia(visita.fechaVisita)}
                    </span>
                  </td>
                  <td className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {visita.hospital ?? 'Hospital sin nombre'}
                    </p>
                  </td>
                  <td className="border-t border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                    {visita.region ?? '—'}
                  </td>
                  <td className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                    <p className="text-slate-600 dark:text-slate-300">
                      EV: {visita.nombreEjecutivo ?? 'Sin asignar'}
                    </p>
                    <p className="text-slate-400">
                      EP: {visita.nombreEspecialista ?? 'Sin asignar'}
                    </p>
                  </td>
                  <td className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {visita.estadoRuta ?? '—'}
                    </Badge>
                  </td>
                  <td className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 rounded-lg px-2 text-[10px]"
                        onClick={() => onVerVisita(visita)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver
                      </Button>
                      {puedeCrear ? (
                        <Button
                          size="sm"
                          className="h-7 gap-1 rounded-lg bg-[#eb6c36] px-2 text-[10px] text-white hover:bg-[#d95a2b]"
                          onClick={() => onCrearTaller(visita)}
                        >
                          <Plus className="h-3 w-3" />
                          Crear taller
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Solo lectura</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
