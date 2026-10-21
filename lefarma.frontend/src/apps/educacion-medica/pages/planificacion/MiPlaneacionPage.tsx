import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Hospital,
  MapPin,
  Plane,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { educacionMedicaApi } from '../../services/educacionMedica.api';
import { CotizarRutaModal } from './components/CotizarRutaModal';
import { diaSemana, fechaCorta, rangoSemanal, semanaIso } from './rutasUtils';
import type { Asignacion, MisTalleresResponse, Taller } from '../../types/educacionMedica.types';

const dosDigitos = (n: number) => String(n).padStart(2, '0');

const fechaIso = (fecha: Date) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;

const hoyIso = () => fechaIso(new Date());

const parseFecha = (fecha: string) => new Date(`${fecha}T00:00:00`);

const lunesDe = (fecha: string) => {
  const dia = parseFecha(fecha);
  const desplazamiento = (dia.getDay() + 6) % 7;
  dia.setDate(dia.getDate() - desplazamiento);
  return fechaIso(dia);
};

const sumarDias = (fecha: string, dias: number) => {
  const dia = parseFecha(fecha);
  dia.setDate(dia.getDate() + dias);
  return fechaIso(dia);
};

const diasDeSemana = (lunes: string) =>
  Array.from({ length: 5 }, (_, indice) => sumarDias(lunes, indice));

const mesDe = (fecha: string) => fecha.slice(0, 7);

const DIAS_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const fechaLarga = (fecha: string) => {
  const dia = parseFecha(fecha);
  return `${DIAS_LARGOS[dia.getDay()]}, ${dia.getDate()} de ${MESES_LARGOS[dia.getMonth()]}`;
};

const FONDOS_GRUPO = [
  'bg-slate-50/80 dark:bg-slate-900/30',
  'bg-background',
  'bg-blue-50/40 dark:bg-blue-950/15',
];

const fmtHora = (hora?: string | null) => (hora ? hora.slice(0, 5) : null);

const horasVisita = (visita: Asignacion) => {
  const salida = fmtHora(visita.horaSalida);
  const llegada = fmtHora(visita.horaLlegada);
  if (salida && llegada) return `${salida}–${llegada}`;
  return salida ?? llegada ?? 'Sin hora';
};

const ESTADO_TALLER: Record<string, { punto: string; texto: string }> = {
  Programado: { punto: 'bg-blue-500', texto: 'text-blue-600 dark:text-blue-300' },
  EnCurso: { punto: 'bg-blue-600', texto: 'text-blue-700 dark:text-blue-200' },
  Realizado: { punto: 'bg-emerald-600', texto: 'text-emerald-700 dark:text-emerald-300' },
  Cancelado: { punto: 'bg-red-600', texto: 'text-red-700 dark:text-red-300' },
};

interface RutaAgrupada {
  idRuta: number;
  nombre: string;
  visitas: Asignacion[];
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function VisitaItem({ visita }: { visita: Asignacion }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 truncate text-xs font-medium leading-tight">
          {visita.nombreHospital ?? 'Hospital'}
        </p>
        {visita.esExtraordinaria && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-300 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
          >
            Extra
          </Badge>
        )}
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {horasVisita(visita)}
      </p>
      {visita.nombreRegion && (
        <p className="truncate text-[11px] text-muted-foreground">{visita.nombreRegion}</p>
      )}
    </div>
  );
}

function TallerItem({ taller, enlace }: { taller: Taller; enlace: boolean }) {
  const estado = ESTADO_TALLER[taller.estado] ?? {
    punto: 'bg-slate-400',
    texto: 'text-muted-foreground',
  };
  const clases =
    'block rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/20';
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 truncate text-xs font-medium leading-tight">
          {taller.nombreHospital ?? 'Hospital'}
        </p>
        {taller.esExtraordinario && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-300 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
          >
            Extra
          </Badge>
        )}
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {fmtHora(taller.horaTaller) ?? 'Sin hora'}
        <span className={`ml-1 inline-flex items-center gap-1 ${estado.texto}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${estado.punto}`} />
          {taller.estado}
        </span>
      </p>
    </>
  );

  return enlace ? (
    <Link
      to="/educacion-medica/talleres/mis-talleres"
      className={`${clases} transition-colors hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40`}
      title="Ver en Mis talleres"
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

function DiaPlaneacion({
  fecha,
  visitas,
  talleres,
  esHoy,
  mostrarVisitas,
  mostrarTalleres,
  enlaceTalleres,
}: {
  fecha: string;
  visitas: Asignacion[];
  talleres: Taller[];
  esHoy: boolean;
  mostrarVisitas: boolean;
  mostrarTalleres: boolean;
  enlaceTalleres: boolean;
}) {
  const total =
    (mostrarVisitas ? visitas.length : 0) + (mostrarTalleres ? talleres.length : 0);

  return (
    <Card className={esHoy ? 'border-primary' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">
            {diaSemana(fecha)}{' '}
            <span className="font-normal normal-case text-muted-foreground">
              {fechaCorta(fecha)}
            </span>
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {total} {total === 1 ? 'evento' : 'eventos'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {total === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Día libre</p>
        ) : (
          <>
            {mostrarVisitas &&
              visitas.map((visita) => (
                <VisitaItem key={visita.idRutaVisita} visita={visita} />
              ))}
            {mostrarTalleres &&
              talleres.map((taller) => (
                <TallerItem key={taller.idTaller} taller={taller} enlace={enlaceTalleres} />
              ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mi planeación (ADR-00013): vista semanal personal y vista por rutas.
 * Solo lectura; el handoff a viáticos se hará por ruta completa (todos sus destinos).
 */
export default function MiPlaneacionPage() {
  usePageTitle('Mi planeación', 'Educación Médica');

  const puedeCapturar = usePermission({
    require: 'educacion_medica.talleres.puede_capturar',
  });
  const puedeVerTalleres = usePermission({
    require: 'educacion_medica.talleres.puede_ver',
  });

  const [vista, setVista] = useState<'semana' | 'rutas'>('semana');
  const [semana, setSemana] = useState(() => lunesDe(hoyIso()));
  const [visitas, setVisitas] = useState<Asignacion[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [equipo, setEquipo] = useState<MisTalleresResponse | null>(null);
  const [cargandoVisitas, setCargandoVisitas] = useState(true);
  const [cargandoTalleres, setCargandoTalleres] = useState(true);
  const [filtro, setFiltro] = useState<'Todo' | 'Visitas' | 'Talleres'>('Todo');
  const [refreshKey, setRefreshKey] = useState(0);
  const [rutaSeleccionadaId, setRutaSeleccionadaId] = useState<number | null>(null);
  const [rutaCotizar, setRutaCotizar] = useState<RutaAgrupada | null>(null);

  const dias = useMemo(() => diasDeSemana(semana), [semana]);
  const hoy = hoyIso();
  const loading = cargandoVisitas || cargandoTalleres;

  // Asignaciones completas: alimentan tanto la semana como la vista por rutas.
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setCargandoVisitas(true);
      const nuevas = puedeCapturar
        ? await educacionMedicaApi.rutas
            .asignaciones()
            .then((r) => (r.data.success ? (r.data.data ?? []) : []))
            .catch(() => [] as Asignacion[])
        : [];

      if (cancelado) return;
      setVisitas(nuevas);
      setCargandoVisitas(false);
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [puedeCapturar, refreshKey]);

  // Talleres de la semana (mes del lunes y mes del viernes, por si cruza).
  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setCargandoTalleres(true);
      const desde = semana;
      const hasta = sumarDias(semana, 4);
      const fechasSemana = diasDeSemana(semana);

      const respuestas = puedeVerTalleres
        ? await Promise.all(
            [...new Set([mesDe(desde), mesDe(hasta)])].map((mes) =>
              educacionMedicaApi.talleres
                .misTalleres(mes)
                .then((r) => (r.data.success ? (r.data.data ?? null) : null))
                .catch(() => null)
            )
          )
        : [];

      if (cancelado) return;

      const primero =
        respuestas.find((respuesta): respuesta is MisTalleresResponse => respuesta !== null) ??
        null;
      const talleresSemana = [
        ...new Map(
          respuestas
            .flatMap((respuesta) => respuesta?.talleres ?? [])
            .filter((taller) => taller.fechaTaller && fechasSemana.includes(taller.fechaTaller.slice(0, 10)))
            .map((taller) => [taller.idTaller, taller] as const)
        ).values(),
      ];

      setEquipo(primero);
      setTalleres(talleresSemana);
      setCargandoTalleres(false);
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [semana, puedeVerTalleres, refreshKey]);

  const visitasSemana = useMemo(() => {
    const hasta = sumarDias(semana, 4);
    return visitas.filter((visita) => visita.fechaVisita >= semana && visita.fechaVisita <= hasta);
  }, [visitas, semana]);

  const rutas = useMemo<RutaAgrupada[]>(() => {
    const porRuta = new Map<number, RutaAgrupada>();
    for (const visita of visitas) {
      const actual = porRuta.get(visita.idRuta) ?? {
        idRuta: visita.idRuta,
        nombre: visita.nombreRuta ?? `Ruta ${visita.idRuta}`,
        visitas: [],
      };
      actual.visitas.push(visita);
      porRuta.set(visita.idRuta, actual);
    }

    return [...porRuta.values()]
      .map((ruta) => ({
        ...ruta,
        visitas: [...ruta.visitas].sort(
          (a, b) => a.fechaVisita.localeCompare(b.fechaVisita) || a.orden - b.orden
        ),
      }))
      .sort((a, b) =>
        (a.visitas[0]?.fechaVisita ?? '').localeCompare(b.visitas[0]?.fechaVisita ?? '')
      );
  }, [visitas]);

  const rutaSeleccionada =
    rutas.find((ruta) => ruta.idRuta === rutaSeleccionadaId) ?? rutas[0] ?? null;

  const diasRuta = rutaSeleccionada
    ? new Set(rutaSeleccionada.visitas.map((visita) => visita.fechaVisita)).size
    : 0;

  const gruposRuta = useMemo(() => {
    if (!rutaSeleccionada) return [];
    const mapa = new Map<string, Asignacion[]>();
    for (const visita of rutaSeleccionada.visitas) {
      const lista = mapa.get(visita.fechaVisita) ?? [];
      lista.push(visita);
      mapa.set(visita.fechaVisita, lista);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, visitas]) => ({
        fecha,
        visitas: [...visitas].sort((a, b) => a.orden - b.orden),
      }));
  }, [rutaSeleccionada]);

  const equipoTexto =
    equipo?.nombreEjecutivo || equipo?.nombreEspecialista
      ? `${equipo.nombreEjecutivo ?? 'EV'} + ${equipo.nombreEspecialista ?? 'EP'}`
      : null;
  const mostrarVisitas = filtro !== 'Talleres';
  const mostrarTalleres = filtro !== 'Visitas';
  const sinDatosSemana = !loading && visitasSemana.length === 0 && talleres.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi planeación</h1>
          <p className="text-sm text-muted-foreground">
            {equipoTexto ? `${equipoTexto} · ` : ''}
            {equipo?.nombreRegion ? `${equipo.nombreRegion} · ` : ''}
            {vista === 'semana'
              ? `Semana ${semanaIso(semana)} · ${rangoSemanal(dias)}`
              : `${rutas.length} ruta(s) confirmada(s) · ${visitas.length} destinos`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setVista('semana')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                vista === 'semana'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setVista('rutas')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                vista === 'rutas'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rutas ({rutas.length})
            </button>
          </div>

          {vista === 'semana' && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setSemana((actual) => sumarDias(actual, -7))}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setSemana(lunesDe(hoy))}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setSemana((actual) => sumarDias(actual, 7))}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => setRefreshKey((clave) => clave + 1)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {vista === 'semana' ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['Todo', 'Visitas', 'Talleres'] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setFiltro(opcion)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  filtro === opcion
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opcion}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, indice) => (
                <Skeleton key={indice} className="h-48 w-full" />
              ))}
            </div>
          ) : sinDatosSemana ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No tienes visitas ni talleres en esta semana.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {dias.map((fecha) => (
                <DiaPlaneacion
                  key={fecha}
                  fecha={fecha}
                  esHoy={fecha === hoy}
                  visitas={visitasSemana.filter((visita) => visita.fechaVisita === fecha)}
                  talleres={talleres.filter(
                    (taller) => taller.fechaTaller?.slice(0, 10) === fecha
                  )}
                  mostrarVisitas={mostrarVisitas}
                  mostrarTalleres={mostrarTalleres}
                  enlaceTalleres={puedeCapturar}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : rutas.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No tienes rutas confirmadas por ahora.
            </p>
          ) : (
            rutaSeleccionada && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      {rutas.length > 1 ? (
                        <Select
                          value={String(rutaSeleccionada.idRuta)}
                          onValueChange={(valor) => setRutaSeleccionadaId(Number(valor))}
                        >
                          <SelectTrigger className="h-9 w-full sm:w-[360px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rutas.map((ruta) => (
                              <SelectItem key={ruta.idRuta} value={String(ruta.idRuta)}>
                                {ruta.nombre} · {ruta.visitas.length} destinos
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                          <Route className="h-4 w-4 text-muted-foreground" />
                          {rutaSeleccionada.nombre}
                        </CardTitle>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {equipoTexto && (
                          <Badge variant="outline" className="gap-1 bg-background/60 font-normal">
                            <Users className="h-3 w-3" />
                            {equipoTexto}
                          </Badge>
                        )}
                        {equipo?.nombreRegion && (
                          <Badge variant="outline" className="gap-1 bg-background/60 font-normal">
                            <MapPin className="h-3 w-3" />
                            {equipo.nombreRegion}
                          </Badge>
                        )}
                        <Badge variant="outline" className="gap-1 bg-background/60 font-normal">
                          <Route className="h-3 w-3" />
                          {rutas.length} ruta{rutas.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setRutaCotizar(rutaSeleccionada)}>
                      <Plane className="mr-1.5 h-4 w-4" />
                      Cotizar viáticos
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="Destinos" value={rutaSeleccionada.visitas.length} />
                    <Metric label="Días" value={diasRuta} />
                    <Metric
                      label="Rango"
                      value={rangoSemanal(
                        rutaSeleccionada.visitas.map((visita) => visita.fechaVisita)
                      )}
                    />
                    <Metric
                      label="Cotización"
                      value={
                        <Badge variant="outline" className="bg-muted/50 font-normal">
                          Por cotizar
                        </Badge>
                      }
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-0">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Región</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gruposRuta.map((grupo, indice) => {
                          const esHoy = grupo.fecha === hoy;
                          const esManana = grupo.fecha === sumarDias(hoy, 1);
                          const fondo = esHoy
                            ? 'bg-primary/5'
                            : FONDOS_GRUPO[indice % FONDOS_GRUPO.length];
                          return (
                            <Fragment key={grupo.fecha}>
                              <TableRow className={`border-b-0 ${fondo}`}>
                                <TableCell colSpan={5} className="px-3 pb-1 pt-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="bg-background/70">
                                      {diaSemana(grupo.fecha)}
                                    </Badge>
                                    <span className="text-sm font-semibold">
                                      {fechaLarga(grupo.fecha)}
                                    </span>
                                    {esHoy && (
                                      <Badge className="bg-primary text-primary-foreground">
                                        Hoy
                                      </Badge>
                                    )}
                                    {esManana && (
                                      <Badge
                                        variant="outline"
                                        className="border-primary/40 text-primary"
                                      >
                                        Mañana
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {grupo.visitas.length} visita
                                      {grupo.visitas.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {grupo.visitas.map((visita) => (
                                <TableRow
                                  key={visita.idRutaVisita}
                                  className={`border-b-0 ${fondo} transition-colors hover:bg-indigo-50/60 dark:hover:bg-indigo-950/25`}
                                >
                                  <TableCell className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                                    {visita.orden}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    <span className="flex items-center gap-1.5 text-sm font-medium">
                                      <Hospital className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      {visita.nombreHospital ?? 'Hospital'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {visita.nombreRegion ? (
                                      <Badge variant="outline" className="bg-muted/40 font-normal">
                                        {visita.nombreRegion}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {visita.horaSalida || visita.horaLlegada ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {horasVisita(visita)}
                                      </span>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="bg-muted/40 font-normal text-muted-foreground"
                                      >
                                        Sin hora
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {visita.esExtraordinaria ? (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-300 bg-amber-50/60 font-normal text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                                      >
                                        Extraordinaria
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="bg-muted/40 font-normal text-muted-foreground"
                                      >
                                        Normal
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </>
      )}

      {rutaCotizar && (
        <CotizarRutaModal
          key={rutaCotizar.idRuta}
          ruta={rutaCotizar}
          onClose={() => setRutaCotizar(null)}
        />
      )}
    </div>
  );
}
