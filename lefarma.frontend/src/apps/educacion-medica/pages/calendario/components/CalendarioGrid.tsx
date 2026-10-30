import type { DragEvent, ReactNode } from 'react';
import { CalendarX2, Clock3, Plus, UserRound } from 'lucide-react';
import type {
  CalendarioItem,
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
} from '../../../types/educacionMedica.types';
import {
  DIAS_SEMANA,
  HORAS,
  claveEvento,
  cuadriculaMes,
  diasLaboralesDe,
  esFinDeSemana,
  fechaIso,
  iniciales,
  tonoAvatar,
} from '../calendarioUtils';
import { CalendarioEvento } from './CalendarioEvento';
import { TextoExpandible } from './TextoExpandible';

interface CalendarioGridProps {
  vista: 'dia' | 'semana' | 'mes' | 'especialista' | 'ejecutivo';
  fecha: string;
  items: CalendarioItem[];
  seleccionadoId: number | null;
  especialistas: EspecialistaPersona[];
  ejecutivos: EjecutivoRegion[];
  suplentes: EjecutivoSuplente[];
  onSelect: (item: CalendarioItem) => void;
  onMover: (item: CalendarioItem, fecha: string) => void;
  onDiaDobleClick?: (fecha: string) => void;
}

function CabeceraDia({ fecha, compacta = false }: { fecha: string; compacta?: boolean }) {
  const dia = new Date(`${fecha}T00:00:00`);
  const hoy = fecha === fechaIso(new Date());
  return (
    <div
      className={['flex items-center justify-between gap-1 px-2', compacta ? 'py-2' : 'py-3'].join(
        ' '
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {DIAS_SEMANA[(dia.getDay() + 6) % 7]}
      </span>
      <span
        className={[
          'flex items-center justify-center rounded-full text-xs font-semibold tabular-nums',
          compacta ? 'h-6 w-6' : 'h-7 w-7',
          hoy
            ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
            : 'text-slate-600 dark:text-slate-300',
        ].join(' ')}
      >
        {dia.getDate()}
      </span>
    </div>
  );
}

function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 text-center dark:border-slate-800 dark:bg-slate-950/30">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
        <CalendarX2 className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{mensaje}</p>
      <p className="mt-1 text-xs text-slate-400">Ajusta los filtros o cambia de periodo.</p>
    </div>
  );
}

function DragCell({
  fecha,
  children,
  className = '',
  onMover,
  onDoubleClick,
}: {
  fecha: string;
  children: ReactNode;
  className?: string;
  onMover: (fecha: string, idRutaVisita: number) => void;
  onDoubleClick?: () => void;
}) {
  const aceptar = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  return (
    <div
      className={`group/cell relative min-w-0 border-b border-l border-slate-200/70 transition-colors dark:border-slate-800 ${className}`}
      onDragOver={aceptar}
      onDrop={(event) => {
        event.preventDefault();
        const id = Number(event.dataTransfer.getData('calendario-item'));
        if (id) onMover(fecha, id);
      }}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

function SemanaView({
  fecha,
  items,
  seleccionadoId,
  onSelect,
  onMover,
}: Omit<CalendarioGridProps, 'vista' | 'especialistas' | 'ejecutivos' | 'suplentes'>) {
  const dias = diasLaboralesDe(fecha);
  const sinHora = items.filter((item) => !item.hora);
  const porDiaHora = (dia: string, hora: number | null) =>
    items.filter((item) => {
      if (item.fecha !== dia) return false;
      if (hora === null) return !item.hora;
      return item.hora && Number(item.hora.slice(0, 2)) === hora;
    });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className="grid border-b border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30"
            style={{ gridTemplateColumns: '4.25rem repeat(5, minmax(9rem, 1fr))' }}
          >
            <div className="flex items-end justify-end px-2 pb-2 pt-3 text-[9px] font-medium uppercase tracking-[0.1em] text-slate-400">
              Hora
            </div>
            {dias.map((dia) => (
              <div
                key={dia}
                className={esFinDeSemana(dia) ? 'bg-slate-100/50 dark:bg-slate-900/40' : ''}
              >
                <CabeceraDia fecha={dia} />
              </div>
            ))}
          </div>

          {sinHora.length > 0 && (
            <div
              className="grid border-b border-slate-200/70 dark:border-slate-800"
              style={{ gridTemplateColumns: '4.25rem repeat(5, minmax(9rem, 1fr))' }}
            >
              <div className="flex items-start justify-end px-2 pt-2 text-[9px] font-medium text-slate-400">
                Sin hora
              </div>
              {dias.map((dia) => (
                <DragCell
                  key={dia}
                  fecha={dia}
                  className="min-h-[58px] bg-slate-50/50 p-1 dark:bg-slate-900/20"
                  onMover={(nuevaFecha, id) => {
                    const item = items.find((evento) => evento.idRutaVisita === id);
                    if (item) onMover(item, nuevaFecha);
                  }}
                >
                  <div className="space-y-1">
                    {porDiaHora(dia, null).map((item) => (
                      <CalendarioEvento
                        key={claveEvento(item)}
                        item={item}
                        activo={item.idRutaVisita === seleccionadoId}
                        onClick={onSelect}
                        onDragStart={(event, evento) => {
                          event.dataTransfer.setData(
                            'calendario-item',
                            String(evento.idRutaVisita)
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                      />
                    ))}
                  </div>
                </DragCell>
              ))}
            </div>
          )}

          {HORAS.map((hora) => (
            <div
              key={hora}
              className="grid"
              style={{ gridTemplateColumns: '4.25rem repeat(5, minmax(9rem, 1fr))' }}
            >
              <div className="flex items-start justify-end border-b border-slate-100 px-2 pt-2 text-[9px] font-medium tabular-nums text-slate-400 dark:border-slate-800/70">
                {String(hora).padStart(2, '0')}:00
              </div>
              {dias.map((dia) => {
                const eventos = porDiaHora(dia, hora);
                return (
                  <DragCell
                    key={dia}
                    fecha={dia}
                    className={[
                      'min-h-[64px] p-1',
                      esFinDeSemana(dia) ? 'bg-slate-50/50 dark:bg-slate-900/20' : '',
                    ].join(' ')}
                    onMover={(nuevaFecha, id) => {
                      const item = items.find((evento) => evento.idRutaVisita === id);
                      if (item) onMover(item, nuevaFecha);
                    }}
                  >
                    <div className="space-y-1">
                      {eventos.map((item) => (
                        <CalendarioEvento
                          key={claveEvento(item)}
                          item={item}
                          activo={item.idRutaVisita === seleccionadoId}
                          onClick={onSelect}
                          onDragStart={(event, evento) => {
                            event.dataTransfer.setData(
                              'calendario-item',
                              String(evento.idRutaVisita)
                            );
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                        />
                      ))}
                    </div>
                    {eventos.length === 0 && (
                      <span className="pointer-events-none flex h-full items-center justify-center text-slate-200 opacity-0 transition-opacity group-hover/cell:opacity-100 dark:text-slate-700">
                        <Plus className="h-3 w-3" />
                      </span>
                    )}
                  </DragCell>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MesView({
  fecha,
  items,
  seleccionadoId,
  onSelect,
  onMover,
  onDiaDobleClick,
}: Omit<CalendarioGridProps, 'vista' | 'especialistas' | 'ejecutivos' | 'suplentes'>) {
  const dias = cuadriculaMes(fecha);
  const mes = Number(fecha.slice(5, 7));
  const porDia = (dia: string) => items.filter((item) => item.fecha === dia);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-7 border-b border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
              >
                {dia}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((dia) => {
              const eventos = porDia(dia);
              const delMes = Number(dia.slice(5, 7)) === mes;
              const hoy = dia === fechaIso(new Date());
              return (
                <DragCell
                  key={dia}
                  fecha={dia}
                  className={[
                    'min-h-[118px] p-1.5',
                    !delMes ? 'bg-slate-50/70 dark:bg-slate-900/40' : '',
                    esFinDeSemana(dia) && delMes ? 'bg-slate-50/40 dark:bg-slate-900/20' : '',
                  ].join(' ')}
                  onMover={(nuevaFecha, id) => {
                    const item = items.find((evento) => evento.idRutaVisita === id);
                    if (item) onMover(item, nuevaFecha);
                  }}
                  onDoubleClick={() => onDiaDobleClick?.(dia)}
                >
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                        hoy
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : delMes
                            ? 'text-slate-700 dark:text-slate-200'
                            : 'text-slate-300 dark:text-slate-600',
                      ].join(' ')}
                    >
                      {Number(dia.slice(8, 10))}
                    </span>
                    {eventos.length > 3 && (
                      <span className="text-[9px] font-medium text-slate-400">
                        {eventos.length} act.
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {eventos.slice(0, 3).map((item) => (
                      <CalendarioEvento
                        key={claveEvento(item)}
                        item={item}
                        variante="mes"
                        activo={item.idRutaVisita === seleccionadoId}
                        onClick={onSelect}
                        onDragStart={(event, evento) => {
                          event.dataTransfer.setData(
                            'calendario-item',
                            String(evento.idRutaVisita)
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                      />
                    ))}
                    {eventos.length > 3 && (
                      <p className="pl-1 text-[9px] font-medium text-slate-400">
                        +{eventos.length - 3} más
                      </p>
                    )}
                  </div>
                </DragCell>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiaView({
  fecha,
  items,
  seleccionadoId,
  onSelect,
}: Omit<CalendarioGridProps, 'vista' | 'especialistas' | 'ejecutivos' | 'suplentes' | 'onMover'>) {
  const delDia = items
    .filter((item) => item.fecha === fecha)
    .sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'));

  if (delDia.length === 0) return <EmptyState mensaje="Sin actividades este día" />;

  return (
    <div className="space-y-1.5">
      {delDia.map((item) => (
        <div key={claveEvento(item)} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
          <div className="pt-3 text-right">
            <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {item.hora?.slice(0, 5) ?? '—'}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-slate-400">
              <Clock3 className="h-2.5 w-2.5" />
              {item.idTaller ? 'Taller' : 'Visita'}
            </p>
          </div>
          <div className="relative border-l border-slate-200 pl-3 dark:border-slate-800">
            <span className="absolute -left-1 top-4 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white dark:bg-slate-600 dark:ring-slate-950" />
            <CalendarioEvento
              item={item}
              variante="dia"
              activo={item.idRutaVisita === seleccionadoId}
              onClick={onSelect}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FilaMatriz {
  key: string;
  id: number | null;
  nombre: string;
  detalle: string;
}

function MatrizView({
  vista,
  fecha,
  items,
  seleccionadoId,
  especialistas,
  ejecutivos,
  suplentes,
  onSelect,
}: CalendarioGridProps) {
  const dias = diasLaboralesDe(fecha);
  const filas = new Map<string, FilaMatriz>();

  if (vista === 'especialista') {
    especialistas
      .filter((especialista) => especialista.activo)
      .forEach((especialista) => {
        filas.set(`e-${especialista.idUsuario}`, {
          key: `e-${especialista.idUsuario}`,
          id: especialista.idUsuario,
          nombre: especialista.nombreUsuario,
          detalle: especialista.gerencias.map((gerencia) => gerencia.nombreGerencia).join(' · '),
        });
      });
    items.forEach((item) => {
      if (!item.idEspecialista || filas.has(`e-${item.idEspecialista}`)) return;
      filas.set(`e-${item.idEspecialista}`, {
        key: `e-${item.idEspecialista}`,
        id: item.idEspecialista,
        nombre: item.nombreEspecialista ?? 'Especialista',
        detalle: item.gerencia,
      });
    });
  } else {
    const agregar = (id: number, nombre: string, detalle: string) => {
      if (filas.has(`j-${id}`)) return;
      filas.set(`j-${id}`, { key: `j-${id}`, id, nombre, detalle });
    };
    ejecutivos.forEach((ejecutivo) =>
      agregar(ejecutivo.idUsuario, ejecutivo.nombreUsuario, ejecutivo.nombreRegion)
    );
    suplentes.forEach((suplente) =>
      agregar(suplente.idUsuario, suplente.nombreUsuario, suplente.nombreRegion ?? 'Suplente')
    );
    items.forEach((item) => {
      if (!item.idEjecutivo) return;
      agregar(item.idEjecutivo, item.nombreEjecutivo ?? 'Ejecutivo', item.region ?? item.gerencia);
    });
  }

  const ordenadas = Array.from(filas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const sinAsignar = items.filter((item) =>
    vista === 'especialista' ? !item.idEspecialista : !item.idEjecutivo
  );
  if (sinAsignar.length > 0) {
    ordenadas.push({
      key: 'sin-asignar',
      id: null,
      nombre: 'Sin asignar',
      detalle: 'Pendientes de responsable',
    });
  }

  const eventosFila = (fila: FilaMatriz, dia: string) =>
    items.filter((item) => {
      if (item.fecha !== dia) return false;
      if (fila.id === null) {
        return vista === 'especialista' ? !item.idEspecialista : !item.idEjecutivo;
      }
      return vista === 'especialista'
        ? item.idEspecialista === fila.id
        : item.idEjecutivo === fila.id;
    });

  if (ordenadas.length === 0) {
    return <EmptyState mensaje="Sin colaboradores para mostrar" />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div
            className="grid border-b border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30"
            style={{ gridTemplateColumns: '13rem repeat(5, minmax(9rem, 1fr))' }}
          >
            <div className="px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {vista === 'especialista' ? 'Especialista' : 'Ejecutivo'}
            </div>
            {dias.map((dia) => (
              <div key={dia}>
                <CabeceraDia fecha={dia} compacta />
              </div>
            ))}
          </div>

          {ordenadas.map((fila) => {
            const total = items.filter((item) =>
              fila.id === null
                ? vista === 'especialista'
                  ? !item.idEspecialista
                  : !item.idEjecutivo
                : vista === 'especialista'
                  ? item.idEspecialista === fila.id
                  : item.idEjecutivo === fila.id
            ).length;
            return (
              <div
                key={fila.key}
                className="grid border-b border-slate-100 last:border-b-0 dark:border-slate-800/70"
                style={{ gridTemplateColumns: '13rem repeat(5, minmax(9rem, 1fr))' }}
              >
                <div className="flex items-center gap-2.5 border-r border-slate-200/70 px-3 py-3 dark:border-slate-800">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tonoAvatar(fila.nombre)}`}
                  >
                    {fila.id === null ? (
                      <UserRound className="h-3.5 w-3.5" />
                    ) : (
                      iniciales(fila.nombre)
                    )}
                  </span>
                  <div className="min-w-0">
                    <TextoExpandible
                      text={fila.nombre}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                      triggerClassName="w-full"
                    />
                    <p className="truncate text-[9px] text-slate-400">
                      {fila.detalle || 'Sin detalle'} · {total}
                    </p>
                  </div>
                </div>
                {dias.map((dia) => {
                  const eventos = eventosFila(fila, dia);
                  return (
                    <div
                      key={dia}
                      className={[
                        'min-h-[76px] border-l border-slate-100 p-1 dark:border-slate-800/70',
                        esFinDeSemana(dia) ? 'bg-slate-50/40 dark:bg-slate-900/20' : '',
                      ].join(' ')}
                    >
                      <div className="space-y-1">
                        {eventos.map((item) => (
                          <CalendarioEvento
                            key={claveEvento(item)}
                            item={item}
                            variante="matriz"
                            activo={item.idRutaVisita === seleccionadoId}
                            onClick={onSelect}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarioGrid(props: CalendarioGridProps) {
  if (props.vista === 'mes') return <MesView {...props} />;
  if (props.vista === 'dia') return <DiaView {...props} />;
  if (props.vista === 'especialista' || props.vista === 'ejecutivo') {
    return <MatrizView {...props} />;
  }
  return <SemanaView {...props} />;
}
