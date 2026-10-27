import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  FilterX,
  Grid2X2,
  Layers3,
  LayoutList,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '../../services/educacionMedica.api';
import type {
  CalendarioItem,
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  Region,
  SeleccionDetalle,
  TipoGerencia,
} from '../../types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import {
  DIAS_SEMANA_LARGOS,
  MESES,
  etiquetaPeriodo,
  fechaCorta,
  fechaInicialCalendario,
  fechaLarga,
  fechaMedia,
  fmtHora,
  hoyIso,
  iniciales,
  rangoVista,
  sumarDias,
  sumarMeses,
  tonoAvatar,
  type VistaCalendario,
} from './calendarioUtils';
import { CalendarioGrid } from './components/CalendarioGrid';
import { CalendarioMatriz } from './components/CalendarioMatriz';
import { CalendarioTabla } from './components/CalendarioTabla';
import { CalendarioInspector } from './components/CalendarioInspector';
import { CrearTallerVisitaModal } from './components/CrearTallerVisitaModal';
import { GenerarRutasModal } from './components/GenerarRutasModal';

const TODOS = 'all';

const VISTAS: Array<{
  valor: VistaCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'dia', etiqueta: 'Día', icono: LayoutList },
  { valor: 'semana', etiqueta: 'Semana', icono: Columns3 },
  { valor: 'mes', etiqueta: 'Mes', icono: Grid2X2 },
  { valor: 'especialista', etiqueta: 'Especialista', icono: UserRound },
  { valor: 'ejecutivo', etiqueta: 'Ejecutivo', icono: UsersRound },
];

const ESTADOS = [
  { valor: 'SinTaller', etiqueta: 'Sin taller' },
  { valor: 'Programado', etiqueta: 'Programado' },
  { valor: 'EnCurso', etiqueta: 'En curso' },
  { valor: 'Realizado', etiqueta: 'Realizado' },
  { valor: 'Cancelado', etiqueta: 'Cancelado' },
];

type ModoCalendario = 'calendario' | 'tabla' | 'matriz';

const MODOS: Array<{
  valor: ModoCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
  { valor: 'tabla', etiqueta: 'Tabla', icono: Table2 },
  { valor: 'matriz', etiqueta: 'Matriz', icono: Layers3 },
];

type FiltroRapido = 'todos' | 'hoy' | 'mis' | 'solicitudes' | 'conflictos' | 'sin-taller';

const FILTROS_RAPIDOS: FiltroRapido[] = [
  'todos',
  'hoy',
  'mis',
  'solicitudes',
  'conflictos',
  'sin-taller',
];

function esVistaValida(valor: string | null): valor is VistaCalendario {
  return VISTAS.some((vista) => vista.valor === valor);
}

function esFiltroRapidoValido(valor: string | null): valor is FiltroRapido {
  return FILTROS_RAPIDOS.includes(valor as FiltroRapido);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detalle,
  tono,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  detalle: string;
  tono: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-none tracking-[-0.04em] text-slate-900 dark:text-slate-100">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-400">{detalle}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tono}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function RailPersona({
  nombre,
  detalle,
  total,
  activo,
  onClick,
}: {
  nombre: string;
  detalle: string;
  total: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
        activo
          ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
      ].join(' ')}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tonoAvatar(nombre)}`}
      >
        {iniciales(nombre)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
          {nombre}
        </span>
        <span className="block truncate text-[9px] text-slate-400">{detalle}</span>
      </span>
      <span
        className={[
          'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums',
          activo
            ? 'bg-orange-200/70 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        ].join(' ')}
      >
        {total}
      </span>
    </button>
  );
}

export default function CalendarioPage() {
  usePageTitle('Calendario');
  const [searchParams, setSearchParams] = useSearchParams();
  const idSeleccionParam = Number(searchParams.get('idSeleccion')) || null;
  const vistaParam = searchParams.get('vista');

  const [fecha, setFecha] = useState(fechaInicialCalendario);
  const [vista, setVista] = useState<VistaCalendario>(() =>
    esVistaValida(vistaParam) ? vistaParam : 'semana'
  );
  const [modo, setModo] = useState<ModoCalendario>(() =>
    vistaParam === 'tabla' || vistaParam === 'matriz' ? vistaParam : 'calendario'
  );
  const usuarioActual = useAuthStore((state) => state.user);
  const puedeGestionarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_gestionar',
  });
  const puedeVerRutas = usePermission({
    require: 'educacion_medica.rutas.puede_ver',
  });
  const [busqueda, setBusqueda] = useState('');
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>(() => {
    const filtro = searchParams.get('filtro');
    return esFiltroRapidoValido(filtro) ? filtro : 'todos';
  });
  const [idGerencia, setIdGerencia] = useState(TODOS);
  const [idRegion, setIdRegion] = useState(TODOS);
  const [idEspecialista, setIdEspecialista] = useState(TODOS);
  const [idEjecutivo, setIdEjecutivo] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);

  const [items, setItems] = useState<CalendarioItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [crearTallerItem, setCrearTallerItem] = useState<CalendarioItem | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [seleccionContexto, setSeleccionContexto] = useState<SeleccionDetalle | null>(null);
  const [hayRutas, setHayRutas] = useState<boolean | null>(null);
  const [modalGenerar, setModalGenerar] = useState(false);

  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoRegion[]>([]);
  const [suplentes, setSuplentes] = useState<EjecutivoSuplente[]>([]);
  const [especialistas, setEspecialistas] = useState<EspecialistaPersona[]>([]);

  useEffect(() => {
    void educacionMedicaApi.tipoGerencia
      .getAll()
      .then((response) => setGerencias(response.data.data ?? []))
      .catch(() => setGerencias([]));
    void educacionMedicaApi.regiones
      .getAll()
      .then((response) => setRegiones(response.data.data ?? []))
      .catch(() => setRegiones([]));
    void educacionMedicaApi.personas.ejecutivos
      .getAll({ soloActivos: true })
      .then((response) => setEjecutivos(response.data.data ?? []))
      .catch(() => setEjecutivos([]));
    void educacionMedicaApi.personas.suplentes
      .getAll({ soloActivos: true })
      .then((response) => setSuplentes(response.data.data ?? []))
      .catch(() => setSuplentes([]));
    void educacionMedicaApi.personas.especialistas
      .getAll(undefined, true)
      .then((response) => setEspecialistas(response.data.data ?? []))
      .catch(() => setEspecialistas([]));
  }, []);

  useEffect(() => {
    if (!idSeleccionParam) return;
    let cancelado = false;

    void educacionMedicaApi.seleccionesMensuales
      .getById(idSeleccionParam)
      .then((response) => {
        if (cancelado || !response.data.success) return;
        const detalle = response.data.data ?? null;
        setSeleccionContexto(detalle);
        const inicio = detalle?.fechaInicioVigencia?.slice(0, 10);
        if (inicio) setFecha(inicio);
      })
      .catch(() => undefined);

    if (puedeVerRutas) {
      void educacionMedicaApi.rutas
        .getBySeleccion(idSeleccionParam)
        .then((response) => {
          if (cancelado || !response.data.success) return;
          setHayRutas((response.data.data ?? []).length > 0);
        })
        .catch(() => {
          if (!cancelado) setHayRutas(null);
        });
    }

    return () => {
      cancelado = true;
    };
  }, [idSeleccionParam, puedeVerRutas]);

  const rango = useMemo(() => rangoVista(fecha, vista), [fecha, vista]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await educacionMedicaApi.calendario.getAll({
        idSeleccion: idSeleccionParam,
        desde: rango.desde,
        hasta: rango.hasta,
        idGerencia: idGerencia === TODOS ? null : Number(idGerencia),
        idRegion: idRegion === TODOS ? null : Number(idRegion),
        idEspecialista: idEspecialista === TODOS ? null : Number(idEspecialista),
        idEjecutivo: idEjecutivo === TODOS ? null : Number(idEjecutivo),
        estado: estado === TODOS ? null : estado,
      });
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo cargar el calendario.');
      }
      setItems(response.data.data ?? []);
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo cargar el calendario.');
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, [
    rango.desde,
    rango.hasta,
    idGerencia,
    idRegion,
    idEspecialista,
    idEjecutivo,
    estado,
    idSeleccionParam,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar periodo o filtros; los setState ocurren tras el await
    void cargar();
  }, [cargar]);

  const regionesDisponibles = useMemo(
    () =>
      idGerencia === TODOS
        ? regiones
        : regiones.filter((region) => region.idTipoGerencia === Number(idGerencia)),
    [regiones, idGerencia]
  );

  const itemsFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      if (filtroRapido === 'hoy' && item.fecha !== hoyIso()) return false;
      if (filtroRapido === 'conflictos' && item.conflictos.length === 0) return false;
      if (filtroRapido === 'solicitudes' && !item.solicitudCambioPendiente) return false;
      if (filtroRapido === 'sin-taller' && item.idTaller) return false;
      if (
        filtroRapido === 'mis' &&
        item.idEjecutivo !== usuarioActual?.id &&
        item.idEspecialista !== usuarioActual?.id
      ) {
        return false;
      }
      if (!texto) return true;
      return [
        item.hospital,
        item.region,
        item.gerencia,
        item.nombreEjecutivo,
        item.nombreEspecialista,
        item.tema,
        item.producto,
        item.institucion,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto));
    });
  }, [items, busqueda, filtroRapido, usuarioActual?.id]);

  const seleccionado = useMemo(
    () => items.find((item) => item.idRutaVisita === seleccionadoId) ?? null,
    [items, seleccionadoId]
  );

  const metricas = useMemo(() => {
    const total = itemsFiltrados.length;
    const talleres = itemsFiltrados.filter((item) => item.idTaller).length;
    const conflictos = itemsFiltrados.filter((item) => item.conflictos.length > 0).length;
    const sinResponsable = itemsFiltrados.filter((item) => !item.idEjecutivo).length;
    const solicitudes = itemsFiltrados.filter((item) => item.solicitudCambioPendiente).length;
    return { total, talleres, conflictos, sinResponsable, solicitudes };
  }, [itemsFiltrados]);

  const conteoEspecialistas = useMemo(() => {
    const mapa = new Map<number, number>();
    items.forEach((item) => {
      if (!item.idEspecialista) return;
      mapa.set(item.idEspecialista, (mapa.get(item.idEspecialista) ?? 0) + 1);
    });
    return mapa;
  }, [items]);

  const conteoEjecutivos = useMemo(() => {
    const mapa = new Map<number, number>();
    items.forEach((item) => {
      if (!item.idEjecutivo) return;
      mapa.set(item.idEjecutivo, (mapa.get(item.idEjecutivo) ?? 0) + 1);
    });
    return mapa;
  }, [items]);

  const proximo = useMemo(() => {
    const hoy = hoyIso();
    return [...itemsFiltrados]
      .filter((item) => item.fecha >= hoy)
      .sort((a, b) =>
        `${a.fecha}${a.hora ?? '23:59'}`.localeCompare(`${b.fecha}${b.hora ?? '23:59'}`)
      )[0];
  }, [itemsFiltrados]);

  const agendaHoy = useMemo(
    () =>
      itemsFiltrados
        .filter((item) => item.fecha === hoyIso())
        .sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99')),
    [itemsFiltrados]
  );

  const moverPeriodo = (direccion: -1 | 1) => {
    if (vista === 'mes') {
      setFecha((actual) => sumarMeses(actual, direccion));
      return;
    }
    const dias = vista === 'dia' ? direccion : direccion * 7;
    setFecha((actual) => sumarDias(actual, dias));
  };

  const cambiarFiltroEspecialista = (id: number) => {
    setIdEspecialista((actual) => (actual === String(id) ? TODOS : String(id)));
  };

  const cambiarFiltroEjecutivo = (id: number) => {
    setIdEjecutivo((actual) => (actual === String(id) ? TODOS : String(id)));
  };

  const cambiarFiltroRapido = (valor: FiltroRapido) => {
    setFiltroRapido(valor);
    const params = new URLSearchParams(searchParams);
    if (valor === 'todos') {
      params.delete('filtro');
    } else {
      params.set('filtro', valor);
    }
    setSearchParams(params, { replace: true });
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroRapido('todos');
    setIdGerencia(TODOS);
    setIdRegion(TODOS);
    setIdEspecialista(TODOS);
    setIdEjecutivo(TODOS);
    setEstado(TODOS);
    const params = new URLSearchParams(searchParams);
    params.delete('filtro');
    setSearchParams(params, { replace: true });
  };

  const moverItem = async (item: CalendarioItem, nuevaFecha: string) => {
    if (item.fecha === nuevaFecha || moviendo) return;
    setMoviendo(true);
    try {
      const response = await educacionMedicaApi.rutas.moverVisita(item.idRuta, item.idRutaVisita, {
        fechaVisita: nuevaFecha,
        orden: item.orden,
      });
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo mover la actividad.');
      }
      toast.success(`Actividad movida al ${fechaCorta(nuevaFecha)}.`);
      await cargar();
    } catch (err: unknown) {
      toast.error(toApiError(err).message ?? 'No se pudo mover la actividad.');
    } finally {
      setMoviendo(false);
    }
  };

  const personasRail =
    vista === 'ejecutivo'
      ? [...ejecutivos]
          .sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario))
          .slice(0, 7)
          .map((ejecutivo) => ({
            id: ejecutivo.idUsuario,
            nombre: ejecutivo.nombreUsuario,
            detalle: ejecutivo.nombreRegion,
            total: conteoEjecutivos.get(ejecutivo.idUsuario) ?? 0,
            activo: idEjecutivo === String(ejecutivo.idUsuario),
            onClick: () => cambiarFiltroEjecutivo(ejecutivo.idUsuario),
          }))
      : [...especialistas]
          .sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario))
          .slice(0, 7)
          .map((especialista) => ({
            id: especialista.idUsuario,
            nombre: especialista.nombreUsuario,
            detalle:
              especialista.gerencias
                .map((gerencia) => gerencia.nombreGerencia)
                .filter(Boolean)
                .join(' · ') || 'Sin gerencia',
            total: conteoEspecialistas.get(especialista.idUsuario) ?? 0,
            activo: idEspecialista === String(especialista.idUsuario),
            onClick: () => cambiarFiltroEspecialista(especialista.idUsuario),
          }));

  const filtrosActivos = [idGerencia, idRegion, idEjecutivo, idEspecialista, estado].filter(
    (valor) => valor !== TODOS
  ).length;

  const actualizarVistaQuery = (nuevoModo: ModoCalendario, nuevaVista: VistaCalendario) => {
    const params = new URLSearchParams(searchParams);
    params.set('vista', nuevoModo === 'calendario' ? nuevaVista : nuevoModo);
    setSearchParams(params, { replace: true });
  };

  const cambiarModo = (nuevo: ModoCalendario) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    actualizarVistaQuery(nuevo, vista);
  };

  const cambiarVista = (nueva: VistaCalendario) => {
    setVista(nueva);
    setModo('calendario');
    actualizarVistaQuery('calendario', nueva);
  };

  const hayFiltros =
    busqueda.trim() !== '' ||
    filtroRapido !== 'todos' ||
    idGerencia !== TODOS ||
    idRegion !== TODOS ||
    idEspecialista !== TODOS ||
    idEjecutivo !== TODOS ||
    estado !== TODOS;

  return (
    <div className="space-y-5 pb-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-500">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            Educación Médica
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-[30px] font-semibold leading-none tracking-[-0.045em] text-slate-900 dark:text-slate-100">
              Calendario
            </h1>
            {idSeleccionParam && (
              <Badge
                variant="secondary"
                className="rounded-full border-orange-200 bg-orange-50 text-[9px] text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
              >
                Selección #{idSeleccionParam}
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Planeación de visitas y talleres por ejecutivo y especialista. Arrastra una actividad
            para reprogramarla.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl bg-card"
            onClick={() => setFecha(hoyIso())}
          >
            Hoy
          </Button>
          <div className="hidden h-9 items-center rounded-xl border border-slate-200 bg-card p-0.5 dark:border-slate-800 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => moverPeriodo(-1)}
              aria-label="Periodo anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[172px] px-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
              {etiquetaPeriodo(fecha, vista)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => moverPeriodo(1)}
              aria-label="Periodo siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl bg-card"
            onClick={() => void cargar()}
            disabled={cargando}
            aria-label="Actualizar calendario"
          >
            {cargando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-card p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            {MODOS.map((opcion) => {
              const Icono = opcion.icono;
              const activo = modo === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => cambiarModo(opcion.valor)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                    activo
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                  ].join(' ')}
                >
                  <Icono className="h-3.5 w-3.5" />
                  {opcion.etiqueta}
                </button>
              );
            })}
          </div>

          {modo === 'calendario' && (
            <div className="hidden flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1 dark:bg-slate-900/60 xl:flex">
              {VISTAS.map((opcion) => {
                const Icono = opcion.icono;
                const activo = vista === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    onClick={() => cambiarVista(opcion.valor)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                      activo
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icono className="h-3.5 w-3.5" />
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-8 w-[200px] rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
              placeholder="Buscar hospital, región…"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg border-slate-200 bg-card px-2.5 text-[11px] md:hidden"
            onClick={() => setFiltrosAbiertos(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {filtrosActivos > 0 && (
              <Badge className="h-4 min-w-4 rounded-full bg-orange-100 px-1 text-[9px] text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300">
                {filtrosActivos}
              </Badge>
            )}
          </Button>
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-[11px] text-slate-500"
              onClick={limpiarFiltros}
            >
              <FilterX className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </section>

      <section className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-6">
        <Select
          value={idGerencia}
          onValueChange={(value) => {
            setIdGerencia(value);
            setIdRegion(TODOS);
          }}
        >
          <SelectTrigger className="h-9 w-[170px] shrink-0 rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800 md:w-full">
            <SelectValue placeholder="Gerencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las gerencias</SelectItem>
            {gerencias.map((gerencia) => (
              <SelectItem key={gerencia.idTipoGerencia} value={String(gerencia.idTipoGerencia)}>
                {gerencia.descripcion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={idRegion} onValueChange={setIdRegion}>
          <SelectTrigger className="h-9 w-[170px] shrink-0 rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800 md:w-full">
            <SelectValue placeholder="Región" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las regiones</SelectItem>
            {regionesDisponibles.map((region) => (
              <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                {region.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={idEjecutivo} onValueChange={setIdEjecutivo}>
          <SelectTrigger className="h-9 w-[170px] shrink-0 rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800 md:w-full">
            <SelectValue placeholder="Ejecutivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los ejecutivos</SelectItem>
            {ejecutivos.map((ejecutivo) => (
              <SelectItem key={ejecutivo.idUsuario} value={String(ejecutivo.idUsuario)}>
                {ejecutivo.nombreUsuario}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={idEspecialista} onValueChange={setIdEspecialista}>
          <SelectTrigger className="h-9 w-[170px] shrink-0 rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800 md:w-full">
            <SelectValue placeholder="Especialista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los especialistas</SelectItem>
            {especialistas.map((especialista) => (
              <SelectItem key={especialista.idUsuario} value={String(especialista.idUsuario)}>
                {especialista.nombreUsuario}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="h-9 w-[170px] shrink-0 rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800 md:w-full">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            {ESTADOS.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex h-9 w-[170px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-2 text-[10px] font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 md:w-full">
          <CalendarRange className="h-3.5 w-3.5" />
          {idSeleccionParam ? `Selección #${idSeleccionParam}` : etiquetaPeriodo(fecha, vista)}
        </div>
      </section>

      <section className="hidden gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarCheck2}
          label="Actividades"
          value={metricas.total}
          detalle="en el periodo visible"
          tono="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Talleres"
          value={metricas.talleres}
          detalle={`${metricas.total - metricas.talleres} visitas por programar`}
          tono="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Conflictos"
          value={metricas.conflictos}
          detalle="requieren revisión"
          tono="bg-rose-50 text-rose-500 dark:bg-rose-950 dark:text-rose-300"
        />
        <MetricCard
          icon={UserRound}
          label="Sin responsable"
          value={metricas.sinResponsable}
          detalle="sin ejecutivo asignado"
          tono="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
        />
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            onClick={() => void cargar()}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div
        className={[
          'grid gap-5',
          modo === 'calendario'
            ? 'xl:grid-cols-[228px_minmax(0,1fr)_324px]'
            : 'xl:grid-cols-[minmax(0,1fr)_324px]',
        ].join(' ')}
      >
        {modo === 'calendario' && (
          <aside className="hidden space-y-4 xl:block">
            <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Resumen
                </p>
                <Badge variant="secondary" className="rounded-full text-[9px]">
                  {metricas.total}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#f97316 ${
                      metricas.total ? (metricas.talleres / metricas.total) * 100 : 0
                    }%, #f1f5f9 0)`,
                  }}
                >
                  <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-card dark:bg-slate-950">
                    <span className="text-lg font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">
                      {metricas.total ? Math.round((metricas.talleres / metricas.total) * 100) : 0}%
                    </span>
                    <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      talleres
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                    {metricas.talleres} programados
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    {metricas.total - metricas.talleres} por programar
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {metricas.conflictos} con conflicto
                  </p>
                  {metricas.solicitudes > 0 && (
                    <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {metricas.solicitudes} solicitudes
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                Filtros rápidos
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(
                  [
                    ['todos', 'Todo'],
                    ['hoy', 'Hoy'],
                    ['mis', 'Mis talleres'],
                    ['solicitudes', 'Solicitudes'],
                    ['conflictos', 'Conflictos'],
                    ['sin-taller', 'Sin taller'],
                  ] as Array<[FiltroRapido, string]>
                ).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => cambiarFiltroRapido(valor)}
                    className={[
                      'rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors',
                      filtroRapido === valor
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {vista === 'ejecutivo' ? 'Ejecutivos' : 'Especialistas'}
                </p>
                <Sparkles className="h-3 w-3 text-orange-400" />
              </div>
              <div className="mt-2 space-y-0.5">
                {personasRail.length === 0 ? (
                  <p className="px-2 py-3 text-[10px] text-slate-400">Sin colaboradores activos.</p>
                ) : (
                  personasRail.map((persona) => (
                    <RailPersona
                      key={persona.id}
                      nombre={persona.nombre}
                      detalle={persona.detalle}
                      total={persona.total}
                      activo={persona.activo}
                      onClick={persona.onClick}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-900/5 bg-slate-900 p-4 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
              <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/50 dark:text-slate-500">
                <Clock3 className="h-3 w-3" />
                Próxima actividad
              </p>
              {proximo ? (
                <>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                    {proximo.hospital ?? 'Hospital'}
                  </p>
                  <p className="mt-1 text-[10px] text-white/60 dark:text-slate-500">
                    {fechaLarga(proximo.fecha)}
                    {proximo.hora ? ` · ${fmtHora(proximo.hora)}` : ''}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 h-7 rounded-lg bg-white/15 px-2.5 text-[10px] text-white hover:bg-white/25 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                    onClick={() => setSeleccionadoId(proximo.idRutaVisita)}
                  >
                    Ver detalle
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-white/60 dark:text-slate-500">
                  No hay actividades próximas en este periodo.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Hoy
                </p>
                <Badge variant="secondary" className="rounded-full text-[9px]">
                  {agendaHoy.length}
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                {agendaHoy.slice(0, 3).map((item) => (
                  <button
                    key={item.idRutaVisita}
                    type="button"
                    onClick={() => setSeleccionadoId(item.idRutaVisita)}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <span className="w-8 shrink-0 text-[9px] font-semibold tabular-nums text-slate-400">
                      {fmtHora(item.hora) ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      {item.hospital}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.idTaller ? 'bg-orange-400' : 'bg-sky-400'
                      }`}
                    />
                  </button>
                ))}
                {agendaHoy.length === 0 && (
                  <p className="px-1.5 py-2 text-[10px] text-slate-400">
                    Sin actividades para hoy.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                <span className="xl:hidden">
                  {modo === 'tabla'
                    ? 'Tabla de actividades'
                    : modo === 'matriz'
                      ? 'Matriz operativa'
                      : 'Agenda diaria'}
                </span>
                <span className="hidden xl:inline">
                  {modo === 'tabla'
                    ? 'Tabla de actividades'
                    : modo === 'matriz'
                      ? 'Matriz operativa'
                      : vista === 'dia'
                        ? DIAS_SEMANA_LARGOS[(new Date(`${fecha}T00:00:00`).getDay() + 6) % 7]
                        : vista === 'mes'
                          ? MESES[Number(fecha.slice(5, 7)) - 1]
                          : vista === 'especialista'
                            ? 'Carga por especialista'
                            : vista === 'ejecutivo'
                              ? 'Carga por ejecutivo'
                              : 'Semana de trabajo'}
                </span>
              </h2>
              <Badge
                variant="secondary"
                className="rounded-full bg-slate-100 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                <span className="xl:hidden">
                  {modo === 'calendario'
                    ? `${itemsFiltrados.filter((item) => item.fecha === fecha).length} del día`
                    : `${itemsFiltrados.length} actividades`}
                </span>
                <span className="hidden xl:inline">{itemsFiltrados.length} actividades</span>
              </Badge>
              {moviendo && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Moviendo…
                </span>
              )}
            </div>
            <p className="hidden text-[10px] text-slate-400 sm:block">
              {modo === 'tabla'
                ? 'Vista tipo Excel del periodo · clic en una fila para abrir el detalle'
                : modo === 'matriz'
                  ? 'Agrupado por gerencia y ejecutivo · solo lectura operativa'
                  : vista === 'semana' || vista === 'mes'
                    ? 'Arrastra una tarjeta para cambiar de fecha'
                    : vista === 'dia'
                      ? 'Agenda del día'
                      : 'Distribución semanal por responsable'}
            </p>
          </div>

          {cargando ? (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, indice) => (
                  <Skeleton key={indice} className="h-16 rounded-xl" />
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, indice) => (
                <Skeleton key={indice} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : itemsFiltrados.length === 0 ? (
            idSeleccionParam && seleccionContexto?.estado === 'Cerrada' && hayRutas === false ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
                <div className="flex flex-col items-center bg-gradient-to-br from-slate-50 via-white to-orange-50/50 px-6 py-9 text-center dark:from-slate-950 dark:via-slate-950 dark:to-orange-950/20">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100 dark:bg-slate-900 dark:ring-orange-900/60">
                    <Route className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                    La selección está autorizada, pero aún no tiene rutas
                  </p>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    El calendario muestra visitas planificadas. Genera la propuesta para
                    calendarizar los hospitales autorizados y comenzar a asignar especialistas.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {seleccionContexto.hospitales.length} hospitales
                    </span>
                    <span>{seleccionContexto.regiones.length} regiones</span>
                    {seleccionContexto.fechaInicioVigencia && (
                      <span>
                        {fechaMedia(seleccionContexto.fechaInicioVigencia.slice(0, 10))}
                        {seleccionContexto.fechaFinVigencia
                          ? ` – ${fechaMedia(seleccionContexto.fechaFinVigencia.slice(0, 10))}`
                          : ''}
                      </span>
                    )}
                  </div>

                  {puedeGestionarRutas ? (
                    <Button
                      className="mt-5 rounded-xl bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
                      onClick={() => setModalGenerar(true)}
                      disabled={seleccionContexto.hospitales.length === 0}
                    >
                      <Route className="mr-2 h-4 w-4" />
                      Generar propuesta de rutas
                    </Button>
                  ) : (
                    <p className="mt-5 max-w-sm rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                      La selección aún no tiene rutas. Solicita a un planificador con permiso de
                      gestión de rutas que genere la propuesta.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 text-center dark:border-slate-800 dark:bg-slate-950/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Sin actividades en este periodo
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                  Cambia de semana o limpia los filtros para ver la planeación completa.
                </p>
                {hayFiltros && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )
          ) : modo === 'tabla' ? (
            <CalendarioTabla
              items={itemsFiltrados}
              seleccionadoId={seleccionadoId}
              onSelect={(item) => setSeleccionadoId(item.idRutaVisita)}
            />
          ) : modo === 'matriz' ? (
            <CalendarioMatriz
              items={itemsFiltrados}
              seleccionadoId={seleccionadoId}
              onSelect={(item) => setSeleccionadoId(item.idRutaVisita)}
            />
          ) : (
            <>
              <div className="space-y-3 xl:hidden">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-card px-2 py-1.5 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setFecha((actual) => sumarDias(actual, -1))}
                    aria-label="Día anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {fechaLarga(fecha)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setFecha((actual) => sumarDias(actual, 1))}
                    aria-label="Día siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <CalendarioGrid
                  vista="dia"
                  fecha={fecha}
                  items={itemsFiltrados}
                  seleccionadoId={seleccionadoId}
                  especialistas={especialistas}
                  ejecutivos={ejecutivos}
                  suplentes={suplentes}
                  onSelect={(item) => setSeleccionadoId(item.idRutaVisita)}
                  onMover={(item, nuevaFecha) => void moverItem(item, nuevaFecha)}
                />
              </div>

              <div className="hidden xl:block">
                <CalendarioGrid
                  vista={vista}
                  fecha={fecha}
                  items={itemsFiltrados}
                  seleccionadoId={seleccionadoId}
                  especialistas={especialistas}
                  ejecutivos={ejecutivos}
                  suplentes={suplentes}
                  onSelect={(item) => setSeleccionadoId(item.idRutaVisita)}
                  onMover={(item, nuevaFecha) => void moverItem(item, nuevaFecha)}
                />
              </div>
            </>
          )}

          {vista === 'semana' && itemsFiltrados.length > 0 && (
            <div className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[9px] text-slate-400 xl:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Taller
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Visita
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Conflicto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Bloqueado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Extraordinario
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-slate-300">
                <MapPin className="h-2.5 w-2.5" />
                Arrastra para reprogramar
              </span>
            </div>
          )}
        </section>

        <div
          className={[
            'min-w-0 xl:sticky xl:top-4 xl:self-start',
            seleccionado ? '' : 'hidden xl:block',
          ].join(' ')}
        >
          <CalendarioInspector
            item={seleccionado}
            ejecutivos={ejecutivos}
            suplentes={suplentes}
            especialistas={especialistas}
            pendientes={itemsFiltrados.filter((item) => item.solicitudCambioPendiente)}
            onSelectItem={(item) => setSeleccionadoId(item.idRutaVisita)}
            onClose={() => setSeleccionadoId(null)}
            onRefresh={cargar}
            onCrearTaller={setCrearTallerItem}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/50 px-4 py-2.5 text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/20">
        <span className="inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3 w-3" />
          <ArrowRight className="h-3 w-3" />
          Navega con las flechas del periodo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Planificación sincronizada
        </span>
      </div>

      <Sheet open={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
        <SheetContent
          side="bottom"
          className="max-h-[86vh] overflow-y-auto rounded-t-3xl border-slate-200 bg-[#f7f7f4] p-5 dark:border-slate-800 dark:bg-slate-950"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-base tracking-tight">Filtros del calendario</SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Acota la agenda por gerencia, región, responsable o estado.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-3 py-4">
            <Select
              value={idGerencia}
              onValueChange={(value) => {
                setIdGerencia(value);
                setIdRegion(TODOS);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800">
                <SelectValue placeholder="Gerencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las gerencias</SelectItem>
                {gerencias.map((gerencia) => (
                  <SelectItem key={gerencia.idTipoGerencia} value={String(gerencia.idTipoGerencia)}>
                    {gerencia.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idRegion} onValueChange={setIdRegion}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800">
                <SelectValue placeholder="Región" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las regiones</SelectItem>
                {regionesDisponibles.map((region) => (
                  <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                    {region.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idEjecutivo} onValueChange={setIdEjecutivo}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800">
                <SelectValue placeholder="Ejecutivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los ejecutivos</SelectItem>
                {ejecutivos.map((ejecutivo) => (
                  <SelectItem key={ejecutivo.idUsuario} value={String(ejecutivo.idUsuario)}>
                    {ejecutivo.nombreUsuario}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={idEspecialista} onValueChange={setIdEspecialista}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800">
                <SelectValue placeholder="Especialista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los especialistas</SelectItem>
                {especialistas.map((especialista) => (
                  <SelectItem key={especialista.idUsuario} value={String(especialista.idUsuario)}>
                    {especialista.nombreUsuario}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-card text-xs dark:border-slate-800">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los estados</SelectItem>
                {ESTADOS.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/60 px-2 text-[10px] font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
              <CalendarRange className="h-3.5 w-3.5" />
              {idSeleccionParam ? `Selección #${idSeleccionParam}` : etiquetaPeriodo(fecha, vista)}
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                limpiarFiltros();
                setFiltrosAbiertos(false);
              }}
            >
              Limpiar filtros
            </Button>
            <Button
              className="rounded-xl bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
              onClick={() => setFiltrosAbiertos(false)}
            >
              Ver resultados
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <GenerarRutasModal
        open={modalGenerar}
        onOpenChange={setModalGenerar}
        seleccion={seleccionContexto}
        onGenerated={() => {
          setHayRutas(true);
          void cargar();
        }}
      />

      <CrearTallerVisitaModal
        open={Boolean(crearTallerItem)}
        onOpenChange={(abierto) => {
          if (!abierto) setCrearTallerItem(null);
        }}
        item={crearTallerItem}
        onSaved={(taller) => {
          setCrearTallerItem(null);
          const fechaTaller = taller.fechaTaller?.slice(0, 10);
          if (fechaTaller) setFecha(fechaTaller);
          setSeleccionadoId(taller.idRutaVisita);
          void cargar();
        }}
      />
    </div>
  );
}
