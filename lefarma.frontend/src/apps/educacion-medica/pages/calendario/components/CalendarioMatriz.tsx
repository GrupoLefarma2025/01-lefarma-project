import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Layers3,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/usePermission';
import type { CalendarioItem } from '../../../types/educacionMedica.types';
import {
  esFinDeSemana,
  fechaMedia,
  fmtHora,
  fmtMoneda,
  iniciales,
  tonoAvatar,
} from '../calendarioUtils';
import { EstadoActividadBadge, MarcasActividad } from './CalendarioEstado';

interface CalendarioMatrizProps {
  items: CalendarioItem[];
  seleccionadoId: number | null;
  onSelect: (item: CalendarioItem) => void;
}

interface GrupoEjecutivo {
  id: number | null;
  nombre: string;
  items: CalendarioItem[];
}

interface GrupoGerencia {
  nombre: string;
  items: CalendarioItem[];
  ejecutivos: GrupoEjecutivo[];
}

const sumar = (items: CalendarioItem[], selector: (item: CalendarioItem) => number | null) =>
  items.reduce((total, item) => total + (selector(item) ?? 0), 0);

const tieneCostos = (items: CalendarioItem[]) => items.some((item) => item.costo != null);

function Resumen({ items, compacto = false }: { items: CalendarioItem[]; compacto?: boolean }) {
  const costo = sumar(items, (item) => item.costo);
  return (
    <div
      className={[
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400',
        compacto ? '' : 'mt-1',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1">
        <Layers3 className="h-3 w-3" />
        {items.length} actividades
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3 w-3" />
        {sumar(items, (item) => item.participantes)} participantes
      </span>
      <span className="inline-flex items-center gap-1">
        <Wallet className="h-3 w-3" />
        {tieneCostos(items) ? fmtMoneda(costo) : 'Sin costos capturados'}
      </span>
    </div>
  );
}

export function CalendarioMatriz({ items, seleccionadoId, onSelect }: CalendarioMatrizProps) {
  const puedeVerMatriz = usePermission({
    require: 'educacion_medica.talleres.puede_ver',
  });

  const grupos = useMemo<GrupoGerencia[]>(() => {
    const porGerencia = new Map<string, CalendarioItem[]>();
    items.forEach((item) => {
      const gerencia = item.gerencia || 'Sin gerencia';
      const lista = porGerencia.get(gerencia) ?? [];
      lista.push(item);
      porGerencia.set(gerencia, lista);
    });

    return Array.from(porGerencia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nombre, actividades]) => {
        const porEjecutivo = new Map<string, GrupoEjecutivo>();
        actividades.forEach((item) => {
          const clave = item.idEjecutivo ? String(item.idEjecutivo) : 'sin-asignar';
          const grupo = porEjecutivo.get(clave) ?? {
            id: item.idEjecutivo,
            nombre: item.nombreEjecutivo ?? 'Sin ejecutivo asignado',
            items: [],
          };
          grupo.items.push(item);
          porEjecutivo.set(clave, grupo);
        });

        return {
          nombre,
          items: actividades,
          ejecutivos: Array.from(porEjecutivo.values()).sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
          ),
        };
      });
  }, [items]);

  const totalParticipantes = sumar(items, (item) => item.participantes);
  const totalCosto = sumar(items, (item) => item.costo);
  const hayCostos = tieneCostos(items);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            <Layers3 className="h-4 w-4 text-orange-500" />
            Matriz operativa del periodo
          </p>
          <Resumen items={items} compacto />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            Solo lectura
          </span>
          {puedeVerMatriz && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-slate-200 bg-card text-[10px]"
            >
              <Link to="/educacion-medica/talleres">
                Abrir matriz general
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-card px-3 py-2.5 dark:border-slate-800">
          <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Gerencias
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {grupos.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-card px-3 py-2.5 dark:border-slate-800">
          <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Participantes
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {totalParticipantes}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-card px-3 py-2.5 dark:border-slate-800">
          <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Costo capturado
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {hayCostos ? fmtMoneda(totalCosto) : '—'}
          </p>
        </div>
      </div>

      {grupos.map((grupo) => (
        <section
          key={grupo.nombre}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800"
        >
          <header className="flex flex-col gap-2 border-b border-slate-200/70 bg-gradient-to-r from-orange-50/50 via-white to-white px-4 py-3.5 dark:border-slate-800 dark:from-orange-950/20 dark:via-slate-950 dark:to-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                  {grupo.nombre}
                </p>
                <Resumen items={grupo.items} compacto />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>{grupo.ejecutivos.length} ejecutivos</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{grupo.items.length} actividades</span>
            </div>
          </header>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {grupo.ejecutivos.map((ejecutivo) => (
              <div key={ejecutivo.id ?? 'sin-asignar'}>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 px-4 py-2.5 dark:bg-slate-900/20">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold ${tonoAvatar(ejecutivo.nombre)}`}
                    >
                      {ejecutivo.id ? (
                        iniciales(ejecutivo.nombre)
                      ) : (
                        <UserRound className="h-3 w-3" />
                      )}
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {ejecutivo.nombre}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {ejecutivo.items.length} actividades ·{' '}
                        {tieneCostos(ejecutivo.items)
                          ? fmtMoneda(sumar(ejecutivo.items, (item) => item.costo))
                          : 'Sin costos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                      <Users className="h-3 w-3" />
                      {sumar(ejecutivo.items, (item) => item.participantes)}
                    </span>
                    <MarcasActividad
                      item={{
                        ...ejecutivo.items[0],
                        esExtraordinario: ejecutivo.items.some((item) => item.esExtraordinario),
                        bloqueado: ejecutivo.items.some((item) => item.bloqueado),
                        solicitudCambioPendiente: ejecutivo.items.some(
                          (item) => item.solicitudCambioPendiente
                        ),
                      }}
                      compacto
                    />
                  </div>
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[10px]">
                    <thead>
                      <tr className="bg-white/80 text-[8px] uppercase tracking-[0.08em] text-slate-400 dark:bg-slate-950/60">
                        <th className="px-4 py-2 text-left font-semibold">Hospital</th>
                        <th className="px-2 py-2 text-left font-semibold">Fecha</th>
                        <th className="px-2 py-2 text-left font-semibold">Producto</th>
                        <th className="px-2 py-2 text-right font-semibold">Cant.</th>
                        <th className="px-2 py-2 text-right font-semibold">Costo</th>
                        <th className="px-2 py-2 text-left font-semibold">Especialista</th>
                        <th className="px-2 py-2 text-left font-semibold">Estado</th>
                        <th className="px-2 py-2 text-left font-semibold">Marcas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ejecutivo.items.map((item) => {
                        const activo = item.idRutaVisita === seleccionadoId;
                        return (
                          <tr
                            key={item.idRutaVisita}
                            className={`cursor-pointer transition-colors ${
                              activo
                                ? 'bg-orange-50/70 dark:bg-orange-950/20'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                            }`}
                            onClick={() => onSelect(item)}
                          >
                            <td className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800/70">
                              <p className="font-semibold text-slate-700 dark:text-slate-200">
                                {item.hospital ?? 'Hospital'}
                              </p>
                              <p className="mt-0.5 text-[8px] text-slate-400">
                                {item.region ?? 'Sin región'}
                                {item.ciudadMunicipio ? ` · ${item.ciudadMunicipio}` : ''}
                              </p>
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 tabular-nums dark:border-slate-800/70">
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  esFinDeSemana(item.fecha) ? 'text-amber-500' : ''
                                }`}
                              >
                                <CalendarDays className="h-3 w-3 text-slate-300" />
                                {fechaMedia(item.fecha)} · {fmtHora(item.hora) ?? '—'}
                              </span>
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                              <span className="block max-w-[150px] truncate">
                                {item.producto ?? '—'}
                              </span>
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 text-right tabular-nums text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                              {item.cantidad ?? '—'}
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 text-right tabular-nums text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                              {fmtMoneda(item.costo)}
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 dark:border-slate-800/70">
                              {item.nombreEspecialista ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold ${tonoAvatar(item.nombreEspecialista)}`}
                                  >
                                    {iniciales(item.nombreEspecialista)}
                                  </span>
                                  <span className="max-w-[120px] truncate">
                                    {item.nombreEspecialista}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-300">Sin asignar</span>
                              )}
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 dark:border-slate-800/70">
                              <EstadoActividadBadge estado={item.estado} />
                            </td>
                            <td className="border-t border-slate-100 px-2 py-2.5 dark:border-slate-800/70">
                              <MarcasActividad item={item} compacto />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1.5 p-3 md:hidden">
                  {ejecutivo.items.map((item) => (
                    <button
                      key={item.idRutaVisita}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={[
                        'w-full rounded-xl border p-2.5 text-left',
                        item.idRutaVisita === seleccionadoId
                          ? 'border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/20'
                          : 'border-slate-200/80 bg-card dark:border-slate-800',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {item.hospital}
                        </p>
                        <EstadoActividadBadge estado={item.estado} />
                      </div>
                      <p className="mt-1 text-[9px] text-slate-400">
                        {fechaMedia(item.fecha)} · {fmtHora(item.hora) ?? '—'} ·{' '}
                        {item.producto ?? 'Sin producto'} · {item.cantidad ?? 0} pzas
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-slate-400">
                          {item.nombreEspecialista ?? 'Sin especialista'}
                        </span>
                        <span className="text-[10px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                          {fmtMoneda(item.costo)}
                        </span>
                      </div>
                      {(item.esExtraordinario ||
                        item.bloqueado ||
                        item.solicitudCambioPendiente) && (
                        <div className="mt-1.5">
                          <MarcasActividad item={item} compacto />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
