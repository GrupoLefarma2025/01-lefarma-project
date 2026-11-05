import {
  CalendarPlus,
  CheckCircle2,
  FileSignature,
  History,
  Plus,
  RefreshCw,
  Route,
  XCircle,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  ActividadVisita,
  ActividadVisitaEvento,
  ActividadVisitaTaller,
} from '../../../types/educacionMedica.types';
import { estadoEtiqueta, fechaMedia, fmtHora } from '../calendarioUtils';

interface ActividadVisitaTabProps {
  actividad: ActividadVisita | null;
  cargando: boolean;
  puedeResolverSolicitud: boolean;
  puedeSolicitarAsistida?: boolean;
  onSolicitarCambio: (idTaller: number) => void;
  onResolverSolicitud: (idTaller: number) => void;
}

const CAMPOS_DIFF: Array<{ clave: string; etiqueta: string }> = [
  { clave: 'fechaVisita', etiqueta: 'Fecha de visita' },
  { clave: 'fechaTaller', etiqueta: 'Fecha del taller' },
  { clave: 'horaTaller', etiqueta: 'Hora' },
  { clave: 'lugar', etiqueta: 'Lugar' },
  { clave: 'numeroParticipantes', etiqueta: 'Participantes' },
  { clave: 'idEjecutivo', etiqueta: 'Ejecutivo' },
  { clave: 'idEspecialista', etiqueta: 'Especialista' },
];

const iconoEvento = (evento: ActividadVisitaEvento) => {
  switch (evento.tipo) {
    case 'VISITA_CREADA':
      return CalendarPlus;
    case 'TALLER_CREADO':
      return Plus;
    case 'TALLER_ESTADO':
      return RefreshCw;
    case 'TALLER_SOLICITUD':
      return FileSignature;
    case 'TALLER_SOLICITUD_RESUELTA':
      return evento.estadoNuevo === 'Rechazada' ? XCircle : CheckCircle2;
    case 'VISITA_AJUSTE':
      return Route;
    default:
      return Wrench;
  }
};

const colorEvento = (evento: ActividadVisitaEvento) => {
  if (evento.tipo === 'TALLER_SOLICITUD_RESUELTA' && evento.estadoNuevo === 'Rechazada') {
    return 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300';
  }
  if (evento.tipo === 'TALLER_SOLICITUD' || evento.tipo === 'TALLER_SOLICITUD_RESUELTA') {
    return 'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300';
  }
  if (evento.tipo === 'TALLER_ESTADO') {
    return 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300';
  }
  return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400';
};

const parseDiff = (valor: string | null) => {
  if (!valor) return null;
  try {
    return JSON.parse(valor) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const formatearDiff = (evento: ActividadVisitaEvento) => {
  const antes = parseDiff(evento.antes);
  const despues = parseDiff(evento.despues);
  if (!antes && !despues) return [];

  return CAMPOS_DIFF.flatMap(({ clave, etiqueta }) => {
    const anterior = antes?.[clave];
    const siguiente = despues?.[clave];
    if (siguiente == null || JSON.stringify(anterior ?? null) === JSON.stringify(siguiente)) {
      return [];
    }

    return [
      {
        etiqueta,
        antes: anterior == null || anterior === '' ? '—' : String(anterior),
        despues: String(siguiente),
      },
    ];
  });
};

const fechaEvento = (fecha: string) =>
  new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const puedeSolicitar = (
  taller: ActividadVisitaTaller,
  puedeSolicitarAsistida = false
) =>
  (taller.esIntegranteEquipo || puedeSolicitarAsistida) &&
  taller.candadoPuesto &&
  !taller.idSolicitudPendiente &&
  taller.estado !== 'Realizado' &&
  taller.estado !== 'Cancelado';

function ResumenTaller({
  taller,
  puedeResolverSolicitud,
  puedeSolicitarAsistida = false,
  onSolicitarCambio,
  onResolverSolicitud,
}: {
  taller: ActividadVisitaTaller;
  puedeResolverSolicitud: boolean;
  puedeSolicitarAsistida?: boolean;
  onSolicitarCambio: (idTaller: number) => void;
  onResolverSolicitud: (idTaller: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            {taller.tema ?? taller.producto ?? 'Taller sin tema'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {taller.fechaTaller ? fechaMedia(taller.fechaTaller) : 'Sin fecha'}
            {taller.horaTaller ? ` · ${fmtHora(taller.horaTaller)}` : ''}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {estadoEtiqueta[taller.estado] ?? taller.estado}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {taller.candadoPuesto && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            Captura bloqueada
          </Badge>
        )}
        {taller.idSolicitudPendiente && (
          <Badge
            variant="outline"
            className="rounded-full border-violet-200 text-[10px] text-violet-700 dark:border-violet-900 dark:text-violet-300"
          >
            Solicitud pendiente
          </Badge>
        )}
        {puedeSolicitar(taller, puedeSolicitarAsistida) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg px-2 text-[10px]"
            onClick={() => onSolicitarCambio(taller.idTaller)}
          >
            Solicitar cambio
          </Button>
        )}
        {taller.idSolicitudPendiente && puedeResolverSolicitud && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg px-2 text-[10px]"
            onClick={() => onResolverSolicitud(taller.idTaller)}
          >
            Resolver solicitud
          </Button>
        )}
      </div>
    </div>
  );
}

export function ActividadVisitaTab({
  actividad,
  cargando,
  puedeResolverSolicitud,
  puedeSolicitarAsistida = false,
  onSolicitarCambio,
  onResolverSolicitud,
}: ActividadVisitaTabProps) {
  if (cargando) {
    return (
      <div className="space-y-2 p-5">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (!actividad) {
    return (
      <p className="p-5 text-center text-xs text-slate-400">
        No se pudo cargar la actividad de la visita.
      </p>
    );
  }

  const ultimoTaller = actividad.talleres[0] ?? null;

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full text-[10px]">
          {actividad.candadoPuesto ? 'Captura bloqueada' : 'Captura abierta'}
        </Badge>
        <span className="text-[11px] text-slate-400">
          {fechaMedia(actividad.fechaVisita)} · {actividad.hospital ?? 'Hospital'}
        </span>
      </div>

      {ultimoTaller && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Último taller
            </p>
            <span className="text-[10px] text-slate-400">
              {actividad.talleres.length} taller{actividad.talleres.length === 1 ? '' : 'es'}
            </span>
          </div>
          <ResumenTaller
            taller={ultimoTaller}
            puedeResolverSolicitud={puedeResolverSolicitud}
            puedeSolicitarAsistida={puedeSolicitarAsistida}
            onSolicitarCambio={onSolicitarCambio}
            onResolverSolicitud={onResolverSolicitud}
          />
        </section>
      )}

      {actividad.talleres.length > 1 && (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Otros talleres
          </p>
          {actividad.talleres.slice(1).map((taller) => (
            <ResumenTaller
              key={taller.idTaller}
              taller={taller}
              puedeResolverSolicitud={puedeResolverSolicitud}
              puedeSolicitarAsistida={puedeSolicitarAsistida}
              onSolicitarCambio={onSolicitarCambio}
              onResolverSolicitud={onResolverSolicitud}
            />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Historial de cambios
          </p>
        </div>

        {actividad.eventos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-[11px] text-slate-400 dark:border-slate-800">
            Sin actividad registrada.
          </p>
        ) : (
          <ol className="space-y-2">
            {actividad.eventos.map((evento, indice) => {
              const Icono = iconoEvento(evento);
              const cambios = formatearDiff(evento);
              return (
                <li
                  key={`${evento.tipo}-${evento.fecha}-${evento.idTaller ?? 'visita'}-${indice}`}
                  className="relative flex gap-2.5 rounded-xl border border-slate-200/70 bg-card px-3 py-2.5 dark:border-slate-800"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${colorEvento(evento)}`}
                  >
                    <Icono className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {evento.titulo}
                      </p>
                      <span className="text-[9px] tabular-nums text-slate-400">
                        {fechaEvento(evento.fecha)}
                      </span>
                    </div>
                    {evento.detalle && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {evento.detalle}
                      </p>
                    )}
                    {evento.motivo && (
                      <p className="mt-0.5 text-[11px] italic text-slate-400">“{evento.motivo}”</p>
                    )}
                    {cambios.length > 0 && (
                      <div className="mt-1.5 space-y-1 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/50">
                        {cambios.map((cambio) => (
                          <p
                            key={`${evento.tipo}-${evento.fecha}-${cambio.etiqueta}`}
                            className="text-[10px] text-slate-500 dark:text-slate-400"
                          >
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                              {cambio.etiqueta}:
                            </span>{' '}
                            {cambio.antes} → {cambio.despues}
                          </p>
                        ))}
                      </div>
                    )}
                    {evento.actor && (
                      <p className="mt-1 text-[10px] text-slate-400">{evento.actor}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
