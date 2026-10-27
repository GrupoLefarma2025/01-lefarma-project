import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MapPin, SearchX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CalendarioItem } from '../../../types/educacionMedica.types';
import { fechaMedia, fmtHora, fmtMoneda, iniciales, tonoAvatar } from '../calendarioUtils';
import { EstadoActividadBadge, MarcasActividad } from './CalendarioEstado';

type ColumnaOrden = 'fecha' | 'hospital' | 'region' | 'ejecutivo' | 'especialista' | 'estado';

interface CalendarioTablaProps {
  items: CalendarioItem[];
  seleccionadoId: number | null;
  onSelect: (item: CalendarioItem) => void;
}

const COMPARADORES: Record<ColumnaOrden, (a: CalendarioItem, b: CalendarioItem) => number> = {
  fecha: (a, b) => `${a.fecha}${a.hora ?? '23:59'}`.localeCompare(`${b.fecha}${b.hora ?? '23:59'}`),
  hospital: (a, b) => (a.hospital ?? '').localeCompare(b.hospital ?? ''),
  region: (a, b) => (a.region ?? '').localeCompare(b.region ?? ''),
  ejecutivo: (a, b) => (a.nombreEjecutivo ?? '').localeCompare(b.nombreEjecutivo ?? ''),
  especialista: (a, b) => (a.nombreEspecialista ?? '').localeCompare(b.nombreEspecialista ?? ''),
  estado: (a, b) => a.estado.localeCompare(b.estado),
};

function EncabezadoOrdenable({
  columna,
  actual,
  direccion,
  onOrdenar,
  children,
  className = '',
}: {
  columna: ColumnaOrden;
  actual: ColumnaOrden;
  direccion: 1 | -1;
  onOrdenar: (columna: ColumnaOrden) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const activa = actual === columna;
  return (
    <th className={`px-3 py-2.5 text-left font-semibold ${className}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        onClick={() => onOrdenar(columna)}
      >
        {children}
        {activa ? (
          direccion === 1 ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function Persona({ nombre }: { nombre: string | null }) {
  if (!nombre) return <span className="text-slate-300 dark:text-slate-600">Sin asignar</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${tonoAvatar(nombre)}`}
      >
        {iniciales(nombre)}
      </span>
      <span className="truncate">{nombre}</span>
    </span>
  );
}

export function CalendarioTabla({ items, seleccionadoId, onSelect }: CalendarioTablaProps) {
  const [orden, setOrden] = useState<{ columna: ColumnaOrden; direccion: 1 | -1 }>({
    columna: 'fecha',
    direccion: 1,
  });

  const ordenados = useMemo(() => {
    const comparador = COMPARADORES[orden.columna];
    return [...items].sort((a, b) => {
      const base = comparador(a, b);
      if (base !== 0) return base * orden.direccion;
      return `${a.fecha}${a.hora ?? ''}`.localeCompare(`${b.fecha}${b.hora ?? ''}`);
    });
  }, [items, orden]);

  const cambiarOrden = (columna: ColumnaOrden) => {
    setOrden((actual) =>
      actual.columna === columna
        ? { columna, direccion: actual.direccion === 1 ? -1 : 1 }
        : { columna, direccion: 1 }
    );
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 text-center dark:border-slate-800 dark:bg-slate-950/30">
        <SearchX className="h-6 w-6 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Sin filas para mostrar
        </p>
        <p className="mt-1 text-xs text-slate-400">Ajusta los filtros del periodo.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 xl:block">
        <div className="max-h-[calc(100vh-250px)] overflow-auto">
          <table className="w-full min-w-[1480px] border-separate border-spacing-0 text-[11px]">
            <thead>
              <tr className="bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                <th className="sticky left-0 top-0 z-30 w-12 border-b border-slate-200/80 bg-slate-50/95 px-3 py-2.5 text-left font-semibold dark:border-slate-800 dark:bg-slate-900/95">
                  <span className="text-[9px] uppercase tracking-[0.08em] text-slate-400">No.</span>
                </th>
                <EncabezadoOrdenable
                  columna="hospital"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="sticky left-12 top-0 z-30 w-[230px] border-b border-r border-slate-200/80 bg-slate-50/95 dark:border-slate-800 dark:bg-slate-900/95"
                >
                  Hospital
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  columna="region"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="w-[130px] border-b border-slate-200/80 dark:border-slate-800"
                >
                  Región
                </EncabezadoOrdenable>
                <th className="w-[150px] border-b border-slate-200/80 px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Institución
                </th>
                <EncabezadoOrdenable
                  columna="estado"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="w-[105px] border-b border-slate-200/80 dark:border-slate-800"
                >
                  Estado
                </EncabezadoOrdenable>
                <th className="w-[120px] border-b border-slate-200/80 px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Ciudad
                </th>
                <th className="w-[80px] border-b border-slate-200/80 px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Participantes
                </th>
                <EncabezadoOrdenable
                  columna="ejecutivo"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="w-[160px] border-b border-slate-200/80 dark:border-slate-800"
                >
                  Ejecutivo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  columna="especialista"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="w-[160px] border-b border-slate-200/80 dark:border-slate-800"
                >
                  Especialista
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  columna="fecha"
                  actual={orden.columna}
                  direccion={orden.direccion}
                  onOrdenar={cambiarOrden}
                  className="w-[100px] border-b border-slate-200/80 dark:border-slate-800"
                >
                  Fecha / hora
                </EncabezadoOrdenable>
                <th className="w-[150px] border-b border-slate-200/80 px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Producto
                </th>
                <th className="w-[70px] border-b border-slate-200/80 px-3 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Cant.
                </th>
                <th className="w-[105px] border-b border-slate-200/80 px-3 py-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Costo
                </th>
                <th className="w-[150px] border-b border-slate-200/80 px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:border-slate-800">
                  Candado
                </th>
                <th className="sticky right-0 top-0 z-30 w-12 border-b border-l border-slate-200/80 bg-slate-50/95 px-2 py-2.5 dark:border-slate-800 dark:bg-slate-900/95" />
              </tr>
            </thead>
            <tbody>
              {ordenados.map((item, indice) => {
                const activo = item.idRutaVisita === seleccionadoId;
                const fondo = activo
                  ? 'bg-orange-50/80 dark:bg-orange-950/20'
                  : 'bg-card hover:bg-slate-50/80 dark:hover:bg-slate-900/50';
                return (
                  <tr
                    key={item.idRutaVisita}
                    className={`cursor-pointer transition-colors ${fondo}`}
                    onClick={() => onSelect(item)}
                  >
                    <td
                      className={`sticky left-0 z-10 border-b border-slate-100 px-3 py-2.5 text-[10px] tabular-nums text-slate-400 dark:border-slate-800/70 ${fondo}`}
                    >
                      {indice + 1}
                    </td>
                    <td
                      className={`sticky left-12 z-10 border-b border-r border-slate-100 px-3 py-2.5 dark:border-slate-800/70 ${fondo}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-6 w-0.5 shrink-0 rounded-full ${
                            item.conflictos.length > 0
                              ? 'bg-rose-400'
                              : item.esExtraordinario
                                ? 'bg-violet-400'
                                : item.idTaller
                                  ? 'bg-orange-400'
                                  : 'bg-sky-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
                            {item.hospital ?? 'Hospital sin nombre'}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-slate-400">
                            <MapPin className="h-2.5 w-2.5" />
                            {item.region ?? 'Sin región'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      <span className="block truncate">{item.region ?? '—'}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-slate-400">
                        {item.gerencia}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      <span className="block truncate">{item.institucion ?? '—'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                      <EstadoActividadBadge estado={item.estado} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      <span className="block truncate">{item.ciudadMunicipio ?? '—'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      {item.participantes ?? '—'}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                      <Persona nombre={item.nombreEjecutivo} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                      <Persona nombre={item.nombreEspecialista} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 tabular-nums dark:border-slate-800/70">
                      <span className="block font-medium text-slate-600 dark:text-slate-300">
                        {fechaMedia(item.fecha)}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-slate-400">
                        {fmtHora(item.hora) ?? 'Sin hora'}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      <span className="block truncate">{item.producto ?? '—'}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                      {item.cantidad ?? '—'}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                      {fmtMoneda(item.costo)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800/70">
                      <MarcasActividad item={item} compacto />
                    </td>
                    <td
                      className={`sticky right-0 z-10 border-b border-l border-slate-100 px-2 py-2.5 text-center dark:border-slate-800/70 ${fondo}`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(item);
                        }}
                        aria-label="Abrir detalle"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[9px] text-slate-400 dark:border-slate-800">
          <span>{ordenados.length} actividades</span>
          <span>Ordenado por {orden.columna} · clic en encabezados para cambiar</span>
        </div>
      </div>

      <div className="space-y-2 xl:hidden">
        {ordenados.map((item) => {
          const activo = item.idRutaVisita === seleccionadoId;
          return (
            <button
              key={item.idRutaVisita}
              type="button"
              onClick={() => onSelect(item)}
              className={[
                'w-full rounded-2xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors',
                activo
                  ? 'border-orange-300 ring-1 ring-orange-200 dark:border-orange-800 dark:ring-orange-950'
                  : 'border-slate-200/80 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-900/50',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {item.hospital ?? 'Hospital sin nombre'}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <MapPin className="h-3 w-3" />
                    {item.region ?? 'Sin región'} · {item.gerencia}
                  </p>
                </div>
                <EstadoActividadBadge estado={item.estado} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {fechaMedia(item.fecha)} · {fmtHora(item.hora) ?? 'Sin hora'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {item.participantes ?? 0}
                </span>
                {item.producto && <span>{item.producto}</span>}
                {item.cantidad != null && <span>{item.cantidad} pzas</span>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400">
                <span>Ejecutivo: {item.nombreEjecutivo ?? 'Sin asignar'}</span>
                <span>Especialista: {item.nombreEspecialista ?? 'Sin asignar'}</span>
              </div>

              {(item.esExtraordinario || item.bloqueado || item.solicitudCambioPendiente) && (
                <div className="mt-2">
                  <MarcasActividad item={item} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
