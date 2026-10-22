import { Fragment, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hospital,
  MapPin,
  Plane,
  Presentation,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { solicitudesApi } from '@/apps/viaticos/services/solicitudes.api';
import type { SolicitudOrigenEmResumen } from '@/apps/viaticos/types/solicitud.types';
import { useAuthStore } from '@/shared/auth/authStore';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '../../services/educacionMedica.api';
import { CotizarRutaModal } from './components/CotizarRutaModal';
import { crearBorradorDesdeRuta } from './viaticosHandoff';
import { fechaLarga, rangoSemanal, semanaIso } from './rutasUtils';
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

const FONDOS_GRUPO = [
  'bg-slate-50 dark:bg-slate-900',
  'bg-card',
  'bg-blue-50 dark:bg-blue-950',
];

const CLASE_EXTRA =
  'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';

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

const ESTADOS_COTIZACION_ACTIVA = new Set([
  'borrador',
  'enviada',
  'autorizada',
  'autorizada_con_ajustes',
]);

const ESTADO_COTIZACION: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  autorizada: 'Autorizada',
  autorizada_con_ajustes: 'Con ajustes',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

const CLASE_ESTADO_COTIZACION: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  enviada: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  autorizada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  autorizada_con_ajustes:
    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  rechazada: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelada: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const estadoCotizacion = (estado: string) => ESTADO_COTIZACION[estado] ?? estado;

const formatearTotal = (total: number | null) =>
  total == null
    ? 'Sin cotización'
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total);

const rutaCotizacion = (idSolicitud: number, estado: string) =>
  estado === 'borrador' ? `/viaticos/solicitud/${idSolicitud}` : '/viaticos/mis-viajes';

interface RutaAgrupada {
  idRuta: number;
  nombre: string;
  visitas: Asignacion[];
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ElementType;
}) {
  return (
    <div className="rounded-md border bg-muted px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function VisitaItem({ visita }: { visita: Asignacion }) {
  const sinHora = !visita.horaSalida && !visita.horaLlegada;

  return (
    <div className="rounded-md border bg-slate-50 px-2 py-1.5 transition-colors hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950">
      <div className="flex items-start justify-between gap-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-tight">
          <Hospital className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{visita.nombreHospital ?? 'Hospital'}</span>
        </p>
        {visita.esExtraordinaria && (
          <Badge variant="secondary" className={`shrink-0 text-[9px] ${CLASE_EXTRA}`}>
            Extra
          </Badge>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {sinHora ? 'Sin hora' : horasVisita(visita)}
        </span>
        {visita.nombreRegion && (
          <Badge
            variant="secondary"
            className="bg-sky-50 text-[9px] text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          >
            {visita.nombreRegion}
          </Badge>
        )}
      </div>
    </div>
  );
}

function TallerItem({ taller, enlace }: { taller: Taller; enlace: boolean }) {
  const estado = ESTADO_TALLER[taller.estado] ?? {
    punto: 'bg-slate-400',
    texto: 'text-muted-foreground',
  };
  const clases =
    'block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:hover:bg-emerald-900';
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-tight">
          <Presentation className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span className="truncate">{taller.nombreHospital ?? 'Hospital'}</span>
        </p>
        {taller.esExtraordinario && (
          <Badge variant="secondary" className={`shrink-0 text-[9px] ${CLASE_EXTRA}`}>
            Extra
          </Badge>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
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
  esManana,
  mostrarVisitas,
  mostrarTalleres,
  enlaceTalleres,
}: {
  fecha: string;
  visitas: Asignacion[];
  talleres: Taller[];
  esHoy: boolean;
  esManana: boolean;
  mostrarVisitas: boolean;
  mostrarTalleres: boolean;
  enlaceTalleres: boolean;
}) {
  const total =
    (mostrarVisitas ? visitas.length : 0) + (mostrarTalleres ? talleres.length : 0);

  return (
    <Card className={esHoy ? 'border-primary' : undefined}>
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold">{fechaLarga(fecha)}</span>
          {esHoy && <Badge className="bg-primary text-primary-foreground">Hoy</Badge>}
          {esManana && (
            <Badge
              variant="secondary"
              className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              Mañana
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {total} {total === 1 ? 'evento' : 'eventos'}
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {total === 0 ? (
          <p className="rounded-md border border-dashed bg-muted py-2 text-center text-xs text-muted-foreground">
            Día libre
          </p>
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

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const puedeCapturar = usePermission({
    require: 'educacion_medica.talleres.puede_capturar',
  });
  const puedeVerTalleres = usePermission({
    require: 'educacion_medica.talleres.puede_ver',
  });
  const puedeCotizar = usePermission({ require: 'viaticos.solicitar' });

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
  const [cotizaciones, setCotizaciones] = useState<SolicitudOrigenEmResumen[]>([]);
  const [cotizacionesRutaId, setCotizacionesRutaId] = useState<number | null>(null);
  const [cargandoCotizaciones, setCargandoCotizaciones] = useState(false);

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

  const resumenSemana = useMemo(() => {
    const diasActividad = new Set<string>();
    for (const visita of visitasSemana) {
      diasActividad.add(visita.fechaVisita);
    }
    for (const taller of talleres) {
      const fecha = taller.fechaTaller?.slice(0, 10);
      if (fecha) diasActividad.add(fecha);
    }
    return {
      visitas: visitasSemana.length,
      talleres: talleres.length,
      dias: diasActividad.size,
    };
  }, [visitasSemana, talleres]);

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
  const idRutaSeleccionada = rutaSeleccionada?.idRuta ?? null;

  // Cotizaciones de la ruta seleccionada (ADR-00014). Se recargan al cambiar de
  // ruta o al usar "Actualizar"; el backend decide qué visitas siguen activas.
  useEffect(() => {
    if (!puedeCotizar || idRutaSeleccionada == null) {
      return;
    }

    let cancelado = false;
    const cargar = async () => {
      setCargandoCotizaciones(true);
      const respuesta = await solicitudesApi
        .porRuta(idRutaSeleccionada)
        .then((r) => (r.data.success ? (r.data.data ?? []) : []))
        .catch(() => [] as SolicitudOrigenEmResumen[]);

      if (cancelado) return;
      setCotizaciones(respuesta);
      setCotizacionesRutaId(idRutaSeleccionada);
      setCargandoCotizaciones(false);
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [idRutaSeleccionada, puedeCotizar, refreshKey]);

  const cotizacionesVisibles = useMemo(
    () =>
      puedeCotizar &&
      idRutaSeleccionada != null &&
      cotizacionesRutaId === idRutaSeleccionada
        ? cotizaciones
        : [],
    [puedeCotizar, idRutaSeleccionada, cotizacionesRutaId, cotizaciones]
  );
  const cargandoCotizacionesVisibles =
    puedeCotizar && idRutaSeleccionada != null && cargandoCotizaciones;

  const cotizacionesPorVisita = useMemo(() => {
    const mapa = new Map<number, SolicitudOrigenEmResumen[]>();
    for (const cotizacion of cotizacionesVisibles) {
      for (const idVisita of cotizacion.id_ruta_visitas) {
        const lista = mapa.get(idVisita) ?? [];
        lista.push(cotizacion);
        mapa.set(idVisita, lista);
      }
    }
    return mapa;
  }, [cotizacionesVisibles]);

  const visitasBloqueadas = useMemo(() => {
    const mapa = new Map<
      number,
      { idSolicitud: number; folio: string | null; estado: string }
    >();
    for (const cotizacion of cotizacionesVisibles) {
      if (!ESTADOS_COTIZACION_ACTIVA.has(cotizacion.estado)) continue;
      for (const idVisita of cotizacion.id_ruta_visitas) {
        if (!mapa.has(idVisita)) {
          mapa.set(idVisita, {
            idSolicitud: cotizacion.id_solicitud,
            folio: cotizacion.folio,
            estado: cotizacion.estado,
          });
        }
      }
    }
    return mapa;
  }, [cotizacionesVisibles]);

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

  const confirmarCotizacion = async (visitasSeleccionadas: Asignacion[]) => {
    if (!rutaCotizar) return;

    try {
      const resultado = await crearBorradorDesdeRuta(
        rutaCotizar,
        visitasSeleccionadas,
        user?.nombre ?? ''
      );
      setRutaCotizar(null);
      if (resultado.reutilizado) {
        toast.info(
          `Se abrió la cotización ${resultado.folio ?? ''} existente para esta ruta.`.trim()
        );
      } else {
        toast.success(
          `Cotización creada${resultado.folio ? `: ${resultado.folio}` : ''}.`
        );
      }
      navigate(`/viaticos/solicitud/${resultado.idSolicitud}`);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo crear el borrador de viáticos.');
    }
  };

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
                className="border-0 bg-muted text-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700"
                onClick={() => setSemana((actual) => sumarDias(actual, -7))}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-0 bg-primary text-primary-foreground hover:brightness-95 hover:text-primary-foreground"
                onClick={() => setSemana(lunesDe(hoy))}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-0 bg-muted text-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700"
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
            className="border-0 bg-muted text-foreground hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700"
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
                    : 'bg-muted text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opcion}
              </button>
            ))}
          </div>

          {!loading && !sinDatosSemana && (
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Visitas" value={resumenSemana.visitas} icon={Hospital} />
              <Metric label="Talleres" value={resumenSemana.talleres} icon={Presentation} />
              <Metric
                label="Días con actividad"
                value={resumenSemana.dias}
                icon={CalendarDays}
              />
            </div>
          )}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, indice) => (
                <Skeleton key={indice} className="h-48 w-full" />
              ))}
            </div>
          ) : sinDatosSemana ? (
            <p className="rounded-md border border-dashed bg-muted p-6 text-center text-sm text-muted-foreground">
              No tienes visitas ni talleres en esta semana.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {dias.map((fecha) => (
                <DiaPlaneacion
                  key={fecha}
                  fecha={fecha}
                  esHoy={fecha === hoy}
                  esManana={fecha === sumarDias(hoy, 1)}
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
            <p className="rounded-md border border-dashed bg-muted p-6 text-center text-sm text-muted-foreground">
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
                          <SelectTrigger className="h-9 w-full bg-card sm:w-[360px]">
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {equipoTexto && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {equipoTexto}
                          </span>
                        )}
                        {equipo?.nombreRegion && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {equipo.nombreRegion}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Route className="h-3 w-3" />
                          {rutas.length} ruta{rutas.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    {puedeCotizar && (
                      <Button
                        size="sm"
                        onClick={() => setRutaCotizar(rutaSeleccionada)}
                        disabled={cargandoCotizacionesVisibles}
                      >
                        <Plane className="mr-1.5 h-4 w-4" />
                        Cotizar viáticos
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric
                      label="Destinos"
                      value={rutaSeleccionada.visitas.length}
                      icon={MapPin}
                    />
                    <Metric label="Días" value={diasRuta} icon={CalendarDays} />
                    <Metric
                      label="Rango"
                      value={rangoSemanal(
                        rutaSeleccionada.visitas.map((visita) => visita.fechaVisita)
                      )}
                      icon={CalendarRange}
                    />
                    <Metric
                      label="Cotizaciones"
                      icon={Plane}
                      value={
                        cargandoCotizacionesVisibles ? (
                          'Cargando…'
                        ) : cotizacionesVisibles.length === 0 ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          >
                            Por cotizar
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            {cotizacionesVisibles.length}{' '}
                            {cotizacionesVisibles.length === 1 ? 'cotización' : 'cotizaciones'}
                          </Badge>
                        )
                      }
                    />
                  </div>

                  {cotizacionesVisibles.length > 0 && (
                    <div className="rounded-md border bg-card p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                        <p className="text-sm font-medium">Cotizaciones de la ruta</p>
                        <span className="text-xs text-muted-foreground">
                          {cotizacionesVisibles.length} en total
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {cotizacionesVisibles.map((cotizacion) => (
                          <li
                            key={cotizacion.id_solicitud}
                            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted px-2.5 py-2 text-xs"
                          >
                            <span className="font-mono font-semibold">
                              {cotizacion.folio ?? `Solicitud #${cotizacion.id_solicitud}`}
                            </span>
                            <Badge
                              variant="secondary"
                              className={
                                CLASE_ESTADO_COTIZACION[cotizacion.estado] ??
                                'bg-muted text-muted-foreground'
                              }
                            >
                              {estadoCotizacion(cotizacion.estado)}
                            </Badge>
                            <span className="text-muted-foreground">
                              {cotizacion.id_ruta_visitas.length} destino
                              {cotizacion.id_ruta_visitas.length === 1 ? '' : 's'}
                            </span>
                            <span className="ml-auto font-medium">
                              {formatearTotal(cotizacion.total)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                navigate(
                                  rutaCotizacion(
                                    cotizacion.id_solicitud,
                                    cotizacion.estado
                                  )
                                )
                              }
                            >
                              Abrir
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-0">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Región</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cotización</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gruposRuta.map((grupo, indice) => {
                          const esHoy = grupo.fecha === hoy;
                          const esManana = grupo.fecha === sumarDias(hoy, 1);
                          const fondo = esHoy
                            ? 'bg-blue-50 dark:bg-blue-950'
                            : FONDOS_GRUPO[indice % FONDOS_GRUPO.length];
                          return (
                            <Fragment key={grupo.fecha}>
                              <TableRow className={`border-b-0 ${fondo}`}>
                                <TableCell colSpan={6} className="px-3 pb-1 pt-4">
                                  <div className="flex flex-wrap items-center gap-2">
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
                                        variant="secondary"
                                        className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
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
                                  className={`border-b-0 ${fondo} transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950`}
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
                                      <Badge
                                        variant="secondary"
                                        className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                                      >
                                        {visita.nombreRegion}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {visita.horaSalida || visita.horaLlegada
                                        ? horasVisita(visita)
                                        : 'Sin hora'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {visita.esExtraordinaria ? (
                                      <Badge
                                        variant="secondary"
                                        className={`font-normal ${CLASE_EXTRA}`}
                                      >
                                        Extraordinaria
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Normal</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {(() => {
                                      const lista =
                                        cotizacionesPorVisita.get(visita.idRutaVisita) ?? [];
                                      const ultima = lista[0];
                                      if (!ultima) {
                                        return (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        );
                                      }
                                      return (
                                        <span className="inline-flex flex-wrap items-center gap-1">
                                          <button
                                            type="button"
                                            className="font-mono text-[11px] text-primary hover:underline"
                                            onClick={() =>
                                              navigate(
                                                rutaCotizacion(
                                                  ultima.id_solicitud,
                                                  ultima.estado
                                                )
                                              )
                                            }
                                          >
                                            {ultima.folio ?? `#${ultima.id_solicitud}`}
                                          </button>
                                          <Badge
                                            variant="secondary"
                                            className={
                                              CLASE_ESTADO_COTIZACION[ultima.estado] ??
                                              'bg-muted text-muted-foreground'
                                            }
                                          >
                                            {estadoCotizacion(ultima.estado)}
                                          </Badge>
                                          {lista.length > 1 && (
                                            <Badge
                                              variant="secondary"
                                              title={lista
                                                .map(
                                                  (cotizacion) =>
                                                    `${cotizacion.folio ?? `#${cotizacion.id_solicitud}`} · ${estadoCotizacion(cotizacion.estado)}`
                                                )
                                                .join('\n')}
                                            >
                                              +{lista.length - 1}
                                            </Badge>
                                          )}
                                        </span>
                                      );
                                    })()}
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
          visitasCotizadas={visitasBloqueadas}
          onAbrirCotizacion={(idSolicitud, estado) =>
            navigate(rutaCotizacion(idSolicitud, estado))
          }
          onConfirm={confirmarCotizacion}
          onClose={() => setRutaCotizar(null)}
        />
      )}
    </div>
  );
}
