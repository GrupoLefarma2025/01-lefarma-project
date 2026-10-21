import { useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  FileSignature,
  MapPin,
  Presentation,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { diaSemana, fechaCorta } from '../planificacion/rutasUtils';
import type {
  Asignacion,
  MatrizGeneralResumen,
  MisTalleresResponse,
  Taller,
} from '../../types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const hoyIso = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const sumarDias = (fecha: string, dias: number) => {
  const dia = new Date(`${fecha}T00:00:00`);
  dia.setDate(dia.getDate() + dias);
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
};

const COLOR_ESTADO: Record<string, string> = {
  Programado: 'bg-blue-500',
  EnCurso: 'bg-blue-600',
  Realizado: 'bg-emerald-600',
  Cancelado: 'bg-red-600',
};

export interface EnlaceRapido {
  title: string;
  path: string;
  icon: ElementType;
}

function DashboardCard({
  title,
  icon: Icon,
  link,
  children,
}: {
  title: string;
  icon: ElementType;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          {link && (
            <Link to={link.to} className="text-xs text-primary hover:underline">
              {link.label}
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-1">{children}</CardContent>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1 text-center">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function EstadoDot({ estado }: { estado: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${COLOR_ESTADO[estado] ?? 'bg-slate-400'}`} />
      {estado}
    </span>
  );
}

const TONOS_KPI = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
} as const;

export function KpiResumenCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  to,
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon: ElementType;
  tone: keyof typeof TONOS_KPI;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONOS_KPI[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{title}</span>
        <span className="block truncate text-xl font-semibold leading-tight tabular-nums">
          {value}
        </span>
        {subtitle && (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </span>
    </Link>
  );
}

const ESTADO_PILL: Record<string, string> = {
  Programado:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  EnCurso:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  Realizado:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  Cancelado:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant="outline" className={ESTADO_PILL[estado] ?? ''}>
      {estado}
    </Badge>
  );
}

const ESTADOS_TABLA = ['Programado', 'EnCurso', 'Realizado', 'Cancelado'];
const ETIQUETA_ESTADO: Record<string, string> = {
  Programado: 'Programados',
  EnCurso: 'En curso',
  Realizado: 'Realizados',
  Cancelado: 'Cancelados',
};

export function UltimosTalleresTable({
  talleres,
  mostrarEquipo,
  titulo,
  verTodosPath,
}: {
  talleres: Taller[];
  mostrarEquipo: boolean;
  titulo: string;
  verTodosPath: string;
}) {
  const [filtro, setFiltro] = useState<string>('Todos');
  const estadosPresentes = ESTADOS_TABLA.filter((estado) =>
    talleres.some((taller) => taller.estado === estado)
  );
  const ordenados = [...talleres].sort((a, b) =>
    `${b.fechaTaller ?? ''}${b.horaTaller ?? ''}`.localeCompare(
      `${a.fechaTaller ?? ''}${a.horaTaller ?? ''}`
    )
  );
  const filtrados = (filtro === 'Todos' ? ordenados : ordenados.filter((t) => t.estado === filtro))
    .slice(0, 8);
  const chips = ['Todos', ...estadosPresentes];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
          <Link to={verTodosPath} className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setFiltro(chip)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                filtro === chip
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {chip === 'Todos' ? 'Todos' : (ETIQUETA_ESTADO[chip] ?? chip)}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Hospital</th>
                <th className="px-2 py-2 font-medium">Fecha</th>
                {mostrarEquipo && <th className="px-2 py-2 font-medium">Equipo</th>}
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 text-right font-medium">Participantes</th>
                <th className="px-2 py-2 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={mostrarEquipo ? 6 : 5}
                    className="px-2 py-6 text-center text-xs text-muted-foreground"
                  >
                    Sin talleres en este estado.
                  </td>
                </tr>
              ) : (
                filtrados.map((taller) => (
                  <tr key={taller.idTaller} className="border-b last:border-0">
                    <td className="px-2 py-2">
                      <p className="font-medium">{taller.nombreHospital ?? '—'}</p>
                      {taller.region && (
                        <p className="text-xs text-muted-foreground">{taller.region}</p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {fmtFecha(taller.fechaTaller)}
                      {taller.horaTaller ? ` · ${taller.horaTaller.slice(0, 5)}` : ''}
                    </td>
                    {mostrarEquipo && (
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {[taller.nombreEjecutivo, taller.nombreEspecialista]
                          .filter(Boolean)
                          .join(' + ') || '—'}
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <EstadoBadge estado={taller.estado} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {taller.numeroParticipantes ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtMoneda(taller.costoTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function EquipoCard({ misTalleres }: { misTalleres: MisTalleresResponse }) {
  const talleres = misTalleres.talleres;
  const contar = (estado: string) => talleres.filter((t) => t.estado === estado).length;
  const total = talleres.length;
  const realizados = contar('Realizado');
  const avance = total > 0 ? Math.round((realizados / total) * 100) : 0;
  const proximos = [...talleres]
    .filter((t) => t.estado === 'Programado' || t.estado === 'EnCurso')
    .sort((a, b) =>
      `${a.fechaTaller ?? ''}${a.horaTaller ?? ''}`.localeCompare(
        `${b.fechaTaller ?? ''}${b.horaTaller ?? ''}`
      )
    )
    .slice(0, 3);

  return (
    <DashboardCard
      title="Panel de situación del equipo"
      icon={TrendingUp}
      link={{ to: '/educacion-medica/talleres/mis-talleres', label: 'Mis talleres' }}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {misTalleres.nombreEjecutivo ?? 'EV'} + {misTalleres.nombreEspecialista ?? 'EP'}
        </span>
        <span className="truncate">{misTalleres.nombreRegion ?? '—'}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        <Kpi label="Total" value={total} />
        <Kpi label="Programados" value={contar('Programado')} />
        <Kpi label="En curso" value={contar('EnCurso')} />
        <Kpi label="Realizados" value={realizados} />
        <Kpi label="Cancelados" value={contar('Cancelado')} />
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Avance</span>
          <span>
            {realizados}/{total} · {avance}%
          </span>
        </div>
        <Progress value={avance} />
      </div>
      {proximos.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {proximos.map((taller) => (
            <li key={taller.idTaller} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {fmtFecha(taller.fechaTaller)} · {taller.nombreHospital ?? '—'}
              </span>
              <EstadoDot estado={taller.estado} />
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

export function VisitasCard({ asignaciones }: { asignaciones: Asignacion[] }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const ordenadas = [...asignaciones].sort((a, b) => a.fechaVisita.localeCompare(b.fechaVisita));
  const proxima = ordenadas.find((a) => a.fechaVisita >= hoy) ?? ordenadas[0];

  return (
    <DashboardCard
      title="Mis visitas del mes"
      icon={MapPin}
      link={{ to: '/educacion-medica/calendario', label: 'Ver planeación' }}
    >
      <p className="text-2xl font-semibold tabular-nums">{asignaciones.length}</p>
      <p className="text-xs text-muted-foreground">visitas confirmadas</p>
      {proxima && (
        <div className="mt-3 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
          <p className="font-medium">{fmtFecha(proxima.fechaVisita)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {proxima.nombreHospital ?? '—'}
            {proxima.nombreRegion ? ` · ${proxima.nombreRegion}` : ''}
          </p>
        </div>
      )}
    </DashboardCard>
  );
}

export function ProximosDiasCard({
  visitas,
  talleres,
}: {
  visitas: Asignacion[];
  talleres: Taller[];
}) {
  const hoy = hoyIso();
  const limite = sumarDias(hoy, 6);

  const eventos = [
    ...visitas
      .filter((visita) => visita.fechaVisita >= hoy && visita.fechaVisita <= limite)
      .map((visita) => ({
        id: `visita-${visita.idRutaVisita}`,
        tipo: 'visita' as const,
        fecha: visita.fechaVisita,
        hora: visita.horaSalida ?? visita.horaLlegada ?? null,
        hospital: visita.nombreHospital ?? 'Hospital',
        region: visita.nombreRegion,
        extra: Boolean(visita.esExtraordinaria),
        estado: null as string | null,
      })),
    ...talleres
      .filter(
        (taller) =>
          taller.fechaTaller &&
          taller.fechaTaller.slice(0, 10) >= hoy &&
          taller.fechaTaller.slice(0, 10) <= limite
      )
      .map((taller) => ({
        id: `taller-${taller.idTaller}`,
        tipo: 'taller' as const,
        fecha: taller.fechaTaller!.slice(0, 10),
        hora: taller.horaTaller,
        hospital: taller.nombreHospital ?? 'Hospital',
        region: taller.region,
        extra: Boolean(taller.esExtraordinario),
        estado: taller.estado as string | null,
      })),
  ]
    .sort((a, b) =>
      `${a.fecha}${a.hora ?? '99:99'}`.localeCompare(`${b.fecha}${b.hora ?? '99:99'}`)
    )
    .slice(0, 6);

  if (eventos.length === 0) {
    return null;
  }

  const etiquetaDia = (fecha: string) => {
    if (fecha === hoy) return 'Hoy';
    if (fecha === sumarDias(hoy, 1)) return 'Mañana';
    return `${diaSemana(fecha)} ${fechaCorta(fecha)}`;
  };

  return (
    <DashboardCard
      title="Próximos 7 días"
      icon={CalendarDays}
      link={{ to: '/educacion-medica/calendario', label: 'Mi planeación' }}
    >
      <ul className="space-y-1.5">
        {eventos.map((evento) => (
          <li key={evento.id} className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                evento.tipo === 'visita'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {evento.tipo === 'visita' ? (
                <MapPin className="h-3 w-3" />
              ) : (
                <Presentation className="h-3 w-3" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{evento.hospital}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {etiquetaDia(evento.fecha)}
                {evento.hora ? ` · ${evento.hora.slice(0, 5)}` : ''}
                {evento.estado ? ` · ${evento.estado}` : ''}
                {evento.region ? ` · ${evento.region}` : ''}
              </p>
            </div>
            {evento.extra && (
              <Badge
                variant="outline"
                className="shrink-0 border-amber-300 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
              >
                Extra
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function MatrizCard({ matrices }: { matrices: MatrizGeneralResumen[] }) {
  return (
    <DashboardCard
      title="Matriz general del mes"
      icon={Presentation}
      link={{ to: '/educacion-medica/talleres', label: 'Abrir matriz' }}
    >
      <ul className="space-y-2">
        {matrices.map((matriz) => (
          <li key={matriz.idMatrizGeneral} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{matriz.gerencia ?? 'Gerencia'}</p>
              <p className="text-xs text-muted-foreground">
                {matriz.totalTalleres} taller(es) · {fmtMoneda(matriz.costoTotal)}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0"
              style={
                matriz.estadoColor
                  ? {
                      borderColor: matriz.estadoColor,
                      color: matriz.estadoColor,
                      backgroundColor: `${matriz.estadoColor}15`,
                    }
                  : undefined
              }
            >
              {matriz.estadoNombre ?? '—'}
            </Badge>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function SolicitudesCard({ solicitudes }: { solicitudes: Taller[] }) {
  return (
    <DashboardCard
      title="Solicitudes de cambio"
      icon={FileSignature}
      link={{ to: '/educacion-medica/talleres', label: 'Revisar' }}
    >
      <p className="text-2xl font-semibold tabular-nums">{solicitudes.length}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {solicitudes.slice(0, 3).map((taller) => (
          <li key={taller.idTaller} className="truncate">
            <span className="font-medium">{taller.nombreHospital ?? '—'}</span>
            <span className="text-muted-foreground">
              {' '}
              · {fmtFecha(taller.fechaTaller)}
              {taller.solicitudCambioPendiente?.nombreSolicitante
                ? ` · ${taller.solicitudCambioPendiente.nombreSolicitante}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function AccesosCard({ enlaces }: { enlaces: EnlaceRapido[] }) {
  return (
    <DashboardCard title="Accesos rápidos" icon={ClipboardList}>
      <div className="grid grid-cols-2 gap-2">
        {enlaces.map((enlace) => {
          const Icon = enlace.icon;
          return (
            <Link
              key={enlace.path}
              to={enlace.path}
              className="flex items-center gap-2 rounded-md border px-2 py-2 text-sm transition-colors hover:bg-muted/50"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{enlace.title}</span>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}
