import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  FilterX,
  Grid2X2,
  LayoutList,
  Loader2,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Presentation,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { DocumentoHeaderCard } from '../../components/DocumentoHeaderCard';
import { DocumentoFirmaModal } from '../../components/DocumentoFirmaModal';
import { DocumentoHistorialModal } from '../../components/DocumentoHistorialModal';
import { CalendarioFiltros } from './components/CalendarioFiltros';
import { ResumenCalendario } from './components/ResumenCalendario';
import { AyudaContextual } from './components/AyudaContextual';
import { SugerenciasSheet } from './components/SugerenciasSheet';
import { CotizarRutaModal } from '../planificacion/components/CotizarRutaModal';
import {
  crearBorradorDesdeRuta,
  esEstadoRutaCotizable,
  type RutaParaCotizar,
} from '../planificacion/viaticosHandoff';

import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '../../services/educacionMedica.api';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import type {
  CalendarioItem,
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  Region,
  Ruta,
  RutaVersionDto,
  SeleccionDetalle,
  SugerenciaEspecialista,
  TipoGerencia,
  VisitaSinTaller,
} from '../../types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import {
  DIAS_SEMANA_LARGOS,
  MESES,
  etiquetaPeriodo,
  claveEvento,
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
import { MatrizPanel } from './components/MatrizPanel';
import { useMatrizPeriodo } from './hooks/useMatrizPeriodo';

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

type ModoCalendario = 'calendario' | 'tabla' | 'resumen' | 'matriz';

const AYUDA_VISTA: Record<VistaCalendario, string> = {
  dia: 'Agenda del día; arrastra un taller para reprogramarlo.',
  semana: 'Semana laboral con horarios, capacidad y visitas.',
  mes: 'Vista mensual; doble clic en un día para abrir su agenda.',
  especialista: 'Carga y visitas agrupadas por especialista.',
  ejecutivo: 'Carga y visitas agrupadas por ejecutivo.',
};

const MODOS: Array<{
  valor: ModoCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
  { valor: 'tabla', etiqueta: 'Tabla', icono: Table2 },
  { valor: 'resumen', etiqueta: 'Resumen', icono: BarChart3 },
  { valor: 'matriz', etiqueta: 'Matriz', icono: Presentation },
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

const ETIQUETAS_FILTRO_RAPIDO: Record<FiltroRapido, string> = {
  todos: 'Todo',
  hoy: 'Hoy',
  mis: 'Mis talleres',
  solicitudes: 'Solicitudes',
  conflictos: 'Conflictos',
  'sin-taller': 'Sin taller',
};

function esVistaValida(valor: string | null): valor is VistaCalendario {
  return VISTAS.some((vista) => vista.valor === valor);
}

function esFiltroRapidoValido(valor: string | null): valor is FiltroRapido {
  return FILTROS_RAPIDOS.includes(valor as FiltroRapido);
}

function esFechaValida(valor: string | null): valor is string {
  return Boolean(valor && /^\d{4}-\d{2}-\d{2}$/.test(valor));
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
  usePageTitle('Panel de rutas', 'Rutas, visitas y talleres');
  const [searchParams, setSearchParams] = useSearchParams();
  const idSeleccionParam = Number(searchParams.get('idSeleccion')) || null;
  const vistaParam = searchParams.get('vista');
  const fechaParam = searchParams.get('fecha');
  const visitaParam = Number(searchParams.get('visita')) || null;
  const nuevoParam = searchParams.get('nuevo') === '1';
  const fechaDeepLinkInicial = esFechaValida(fechaParam) ? fechaParam : null;
  const fechaDeepLink = useRef(fechaDeepLinkInicial);
  const deepLinkAplicado = useRef(false);
  const [idSeleccionActiva, setIdSeleccionActiva] = useState<number | null>(idSeleccionParam);

  const [fecha, setFecha] = useState(() => fechaDeepLinkInicial ?? fechaInicialCalendario());
  const [periodoMes, setPeriodoMes] = useState(() =>
    (fechaDeepLinkInicial ?? fechaInicialCalendario()).slice(0, 7)
  );
  const [vista, setVista] = useState<VistaCalendario>(() =>
    esVistaValida(vistaParam) ? vistaParam : 'semana'
  );
  const [modo, setModo] = useState<ModoCalendario>(() =>
    vistaParam === 'tabla' || vistaParam === 'resumen' || vistaParam === 'matriz'
      ? vistaParam
      : 'calendario'
  );
  const navigate = useNavigate();
  const usuarioActual = useAuthStore((state) => state.user);
  const hasFirma = useAuthStore((state) => state.hasFirma);
  const puedeGestionarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_gestionar',
  });
  const puedeVerRutas = usePermission({
    require: 'educacion_medica.rutas.puede_ver',
  });
  const puedeVerTodas = usePermission({
    requireAny: ['educacion_medica.calendario.puede_ver_todos', 'educacion_medica.rutas.puede_ver'],
  });
  const puedeCotizar = usePermission({ require: 'viaticos.solicitar' });
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
  const [seleccionadoTallerId, setSeleccionadoTallerId] = useState<number | null>(null);
  const [crearTallerItem, setCrearTallerItem] = useState<CalendarioItem | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtrosDesktopAbiertos, setFiltrosDesktopAbiertos] = useState(false);
  const [panelLateralAbierto, setPanelLateralAbierto] = useState(true);
  const [tabPersonas, setTabPersonas] = useState<'ejecutivos' | 'especialistas'>('especialistas');
  const [moviendo, setMoviendo] = useState(false);
  const [seleccionContexto, setSeleccionContexto] = useState<SeleccionDetalle | null>(null);
  const idMatrizParam = Number(searchParams.get('idMatriz')) || null;
  const gerenciaMatrizId =
    idGerencia !== TODOS ? Number(idGerencia) : (seleccionContexto?.idTipoGerencia ?? null);
  const {
    matriz: matrizPeriodo,
    concentracion: matrizConcentracion,
    revision: matrizRevision,
    loading: matrizLoading,
    error: matrizError,
    reload: recargarMatriz,
  } = useMatrizPeriodo(gerenciaMatrizId, periodoMes, idMatrizParam);
  const capturaBloqueada = matrizPeriodo ? !matrizPeriodo.esEditable : false;
  const [hayRutas, setHayRutas] = useState<boolean | null>(null);
  const [rutasVersion, setRutasVersion] = useState<Ruta[]>([]);
  const [versionRuta, setVersionRuta] = useState<number | null>(null);
  const [versionInfo, setVersionInfo] = useState<RutaVersionDto | null>(null);
  const [refrescoRutas, setRefrescoRutas] = useState(0);
  const [modalGenerar, setModalGenerar] = useState(false);
  const [modalFirma, setModalFirma] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaEspecialista[]>([]);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [rutaCotizarAbierta, setRutaCotizarAbierta] = useState(false);
  const [asignandoSugerencia, setAsignandoSugerencia] = useState<number | null>(null);
  const [asignandoSugerencias, setAsignandoSugerencias] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [guardandoWorkflow, setGuardandoWorkflow] = useState(false);

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
    if (idSeleccionActiva) return;
    let cancelado = false;

    void educacionMedicaApi.seleccionesMensuales
      .getAll()
      .then((response) => {
        if (cancelado || !response.data.success) return;
        const lista = (response.data.data ?? []).filter(
          (seleccion) =>
            (seleccion.fechaInicioVigencia?.slice(0, 7) ??
              seleccion.fechaSeleccion?.slice(0, 7)) === periodoMes
        );
        const candidata =
          idGerencia === TODOS
            ? lista.length === 1
              ? lista[0]
              : null
            : lista.find((seleccion) => String(seleccion.idTipoGerencia) === idGerencia);
        if (candidata) setIdSeleccionActiva(candidata.idSeleccionMensual);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, [periodoMes, idGerencia, idSeleccionActiva]);

  useEffect(() => {
    if (!idSeleccionActiva) return;
    let cancelado = false;

    void educacionMedicaApi.seleccionesMensuales
      .getById(idSeleccionActiva)
      .then((response) => {
        if (cancelado || !response.data.success) return;
        const detalle = response.data.data ?? null;
        setSeleccionContexto(detalle);
        const mesSeleccion =
          detalle?.fechaInicioVigencia?.slice(0, 7) ?? detalle?.fechaSeleccion?.slice(0, 7);
        if (mesSeleccion) {
          setPeriodoMes(mesSeleccion);
          const inicio = detalle?.fechaInicioVigencia?.slice(0, 10);
          const fechaSeleccion =
            inicio && inicio.slice(0, 7) === mesSeleccion ? inicio : `${mesSeleccion}-01`;
          setFecha(fechaDeepLink.current ?? fechaSeleccion);
        }
        if (idGerencia === TODOS && detalle?.idTipoGerencia) {
          setIdGerencia(String(detalle.idTipoGerencia));
        }
      })
      .catch(() => undefined);

    if (puedeVerRutas) {
      void educacionMedicaApi.rutas
        .getBySeleccion(idSeleccionActiva)
        .then((response) => {
          if (cancelado || !response.data.success) return;
          const lista = response.data.data ?? [];
          setRutasVersion(lista);
          setHayRutas(lista.length > 0);
          const versiones = [...new Set(lista.map((ruta) => ruta.version))].sort((a, b) => b - a);
          setVersionRuta((actual) =>
            actual != null && versiones.includes(actual) ? actual : (versiones[0] ?? null)
          );
        })
        .catch(() => {
          if (cancelado) return;
          setHayRutas(null);
          setRutasVersion([]);
          setVersionRuta(null);
        });
    }

    return () => {
      cancelado = true;
    };
  }, [idSeleccionActiva, idGerencia, puedeVerRutas, refrescoRutas]);

  useEffect(() => {
    if (!idSeleccionActiva || versionRuta == null || !puedeVerRutas) {
      return;
    }
    let cancelado = false;
    void educacionMedicaApi.rutas
      .version(idSeleccionActiva, versionRuta)
      .then((response) => {
        if (cancelado || !response.data.success) return;
        setVersionInfo(response.data.data ?? null);
      })
      .catch(() => {
        if (!cancelado) setVersionInfo(null);
      });
    return () => {
      cancelado = true;
    };
  }, [idSeleccionActiva, versionRuta, puedeVerRutas, refrescoRutas]);

  const versionesDisponibles = useMemo(() => {
    const mapa = new Map<number, Ruta['estado']>();
    rutasVersion.forEach((ruta) => {
      if (!mapa.has(ruta.version)) mapa.set(ruta.version, ruta.estado);
    });
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [rutasVersion]);

  const rutasVersionActual = useMemo(
    () => rutasVersion.filter((ruta) => ruta.version === versionRuta && ruta.visitas.length > 0),
    [rutasVersion, versionRuta]
  );

  const rutasParaCotizar = useMemo(
    () =>
      rutasVersionActual
        .filter((ruta) => esEstadoRutaCotizable(ruta.estado))
        .map((ruta) => ({
          idRuta: ruta.idRuta,
          nombre: ruta.nombre ?? `Ruta ${ruta.idRuta}`,
          idSeleccionMensual: ruta.idSeleccionMensual,
          viajero: ruta.idEspecialista
            ? {
                idUsuario: ruta.idEspecialista,
                nombre: ruta.nombreEspecialista ?? `Especialista ${ruta.idEspecialista}`,
                rol: `especialista` as const,
              }
            : undefined,
          visitas: ruta.visitas.map((visita) => ({
            idRutaVisita: visita.idRutaVisita,
            idRuta: visita.idRuta,
            idSeleccionMensual: ruta.idSeleccionMensual,
            fechaVisita: visita.fechaVisita,
            orden: visita.orden,
            nombreHospital: visita.nombreHospital,
            nombreRegion: visita.nombreRegion,
            entidadFederativa: visita.entidadFederativa ?? null,
            ciudadMunicipio: visita.ciudadMunicipio ?? null,
            latitud: visita.latitud ?? null,
            longitud: visita.longitud ?? null,
          })),
        })),
    [rutasVersionActual]
  );

  const versionInfoActual = versionInfo && versionInfo.version === versionRuta ? versionInfo : null;

  const estadoVersionSeleccionada =
    versionRuta == null
      ? null
      : ((versionInfo?.version === versionRuta ? versionInfo.estado : null) ??
        versionesDisponibles.find(([version]) => version === versionRuta)?.[1] ??
        null);

  const cotizacionBloqueada =
    estadoVersionSeleccionada != null && !esEstadoRutaCotizable(estadoVersionSeleccionada);

  const accionesWorkflowRutas =
    versionInfoActual?.acciones.filter((accion) => accion.tipoAccionCodigo !== 'CANCELAR') ?? [];
  const accionesFirmaRutas =
    versionInfoActual && !versionInfoActual.esEditable && !versionInfoActual.esFinal
      ? accionesWorkflowRutas
      : [];
  const accionEnviarRutas = accionesWorkflowRutas.find(
    (accion) => accion.tipoAccionCodigo === 'ENVIAR'
  );
  const accionesModalRutas =
    accionesFirmaRutas.length > 0
      ? accionesFirmaRutas
      : accionEnviarRutas
        ? [accionEnviarRutas]
        : [];

  const rango = useMemo(() => rangoVista(fecha, vista), [fecha, vista]);

  useEffect(() => {
    if (!idSeleccionActiva || !puedeVerRutas) return;
    let cancelado = false;

    void educacionMedicaApi.calendario
      .sugerencias(idSeleccionActiva, rango.desde, rango.hasta)
      .then((response) => {
        if (cancelado || !response.data.success) return;
        setSugerencias(response.data.data ?? []);
      })
      .catch(() => {
        if (!cancelado) setSugerencias([]);
      });

    return () => {
      cancelado = true;
    };
  }, [idSeleccionActiva, puedeVerRutas, rango.desde, rango.hasta, refrescoRutas]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await educacionMedicaApi.calendario.getAll({
        idSeleccion: idSeleccionActiva,
        version: versionRuta,
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
    idSeleccionActiva,
    versionRuta,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar periodo o filtros; los setState ocurren tras el await
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (deepLinkAplicado.current || !visitaParam || items.length === 0) return;
    const item = items.find((calendarioItem) => calendarioItem.idRutaVisita === visitaParam);
    if (!item) return;
    deepLinkAplicado.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- aplica el deep link de "Registrar taller" una sola vez
    setSeleccionadoId(item.idRutaVisita);
    setSeleccionadoTallerId(item.idTaller);
    if (nuevoParam) setCrearTallerItem(item);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('nuevo');
        params.delete('visita');
        params.delete('fecha');
        return params;
      },
      { replace: true }
    );
  }, [items, visitaParam, nuevoParam, setSearchParams]);

  const refrescarCalendario = useCallback(async () => {
    setRefrescoRutas((valor) => valor + 1);
    await cargar();
  }, [cargar]);

  const recargarMatrizYCalendario = useCallback(async () => {
    await Promise.all([recargarMatriz(), cargar()]);
  }, [recargarMatriz, cargar]);

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
    () =>
      items.find(
        (item) =>
          item.idRutaVisita === seleccionadoId &&
          (seleccionadoTallerId == null || item.idTaller === seleccionadoTallerId)
      ) ?? null,
    [items, seleccionadoId, seleccionadoTallerId]
  );

  const rutasGeneradas = hayRutas === true || seleccionContexto?.tieneRutas === true;

  const sugerenciaSeleccionada = useMemo(
    () => sugerencias.find((sugerencia) => sugerencia.idRutaVisita === seleccionadoId) ?? null,
    [sugerencias, seleccionadoId]
  );

  const seleccionarItem = (item: CalendarioItem) => {
    setSeleccionadoId(item.idRutaVisita);
    setSeleccionadoTallerId(item.idTaller);
  };

  const firmarVersionRutas = async (
    accion: AccionWorkflow,
    comentario?: string,
    datosAdicionales?: Record<string, unknown> | null
  ): Promise<boolean> => {
    if (!versionInfoActual) return false;
    setGuardandoWorkflow(true);
    try {
      const response = await educacionMedicaApi.rutas.firmarVersion(
        versionInfoActual.idRutaVersion,
        {
          idAccion: accion.idAccion,
          comentario: comentario ?? null,
          datosAdicionales: datosAdicionales ?? null,
        }
      );
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo avanzar el workflow.');
      }
      setRefrescoRutas((valor) => valor + 1);
      await cargar();
      return true;
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo avanzar el workflow.');
      return false;
    } finally {
      setGuardandoWorkflow(false);
    }
  };

  const asignarSugerencia = async (sugerencia: SugerenciaEspecialista) => {
    setAsignandoSugerencia(sugerencia.idRutaVisita);
    try {
      const response = await educacionMedicaApi.calendario.asignarEspecialista(
        sugerencia.idRutaVisita,
        sugerencia.idEspecialista
      );
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo aplicar la sugerencia.');
      }
      toast.success(
        `${sugerencia.nombreEspecialista} asignado a ${sugerencia.nombreHospital ?? 'la visita'}.`
      );
      setSugerencias((actuales) =>
        actuales.filter((item) => item.idRutaVisita !== sugerencia.idRutaVisita)
      );
      setRefrescoRutas((valor) => valor + 1);
      await cargar();
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo aplicar la sugerencia.');
    } finally {
      setAsignandoSugerencia(null);
    }
  };

  const asignarSugerenciasSeleccionadas = async (seleccionadas: SugerenciaEspecialista[]) => {
    if (seleccionadas.length === 0) return;
    setAsignandoSugerencias(true);
    const asignadas: number[] = [];
    let fallos = 0;

    for (const sugerencia of seleccionadas) {
      try {
        const response = await educacionMedicaApi.calendario.asignarEspecialista(
          sugerencia.idRutaVisita,
          sugerencia.idEspecialista
        );
        if (response.data.success) asignadas.push(sugerencia.idRutaVisita);
        else fallos += 1;
      } catch {
        fallos += 1;
      }
    }

    if (asignadas.length > 0) {
      setSugerencias((actuales) =>
        actuales.filter((sugerencia) => !asignadas.includes(sugerencia.idRutaVisita))
      );
      setRefrescoRutas((valor) => valor + 1);
      await cargar();
    }

    if (fallos === 0) {
      toast.success(`${asignadas.length} sugerencia(s) asignada(s).`);
    } else if (asignadas.length === 0) {
      toast.error('No se pudo asignar ninguna sugerencia.');
    } else {
      toast.warning(`${asignadas.length} asignada(s); ${fallos} no se pudieron asignar.`);
    }
    setAsignandoSugerencias(false);
  };

  const confirmarCotizacionRuta = async (
    ruta: RutaParaCotizar,
    visitas: Parameters<typeof crearBorradorDesdeRuta>[1]
  ) => {
    if (!ruta.viajero) {
      toast.error('La ruta no tiene especialista asignado.');
      return;
    }
    try {
      const resultado = await crearBorradorDesdeRuta(ruta, visitas, usuarioActual?.nombre ?? '');
      toast.success(
        resultado.reutilizado
          ? `Se abrió la cotización ${resultado.folio ?? ''} existente.`.trim()
          : `Cotización creada${resultado.folio ? `: ${resultado.folio}` : ''}.`
      );
      setRutaCotizarAbierta(false);
      setRefrescoRutas((valor) => valor + 1);
      await cargar();
      navigate(`/viaticos/solicitud/${resultado.idSolicitud}`);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo crear el borrador de viáticos.');
    }
  };

  const abrirCotizacion = (idSolicitud: number, estado: string) => {
    navigate(estado === 'borrador' ? `/viaticos/solicitud/${idSolicitud}` : '/viaticos/mis-viajes');
  };

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

  const cambiarMes = (nuevoMes: string) => {
    if (!nuevoMes) return;
    setPeriodoMes(nuevoMes);
    setFecha(`${nuevoMes}-01`);
    setVista('mes');
    setModo('calendario');
    setIdSeleccionActiva(null);
    setSeleccionContexto(null);
    setHayRutas(null);
    const params = new URLSearchParams(searchParams);
    params.set('vista', 'mes');
    params.delete('idSeleccion');
    params.delete('idMatriz');
    setSearchParams(params, { replace: true });
  };

  const cambiarGerencia = (value: string) => {
    setIdGerencia(value);
    setIdRegion(TODOS);
    setIdSeleccionActiva(null);
    setSeleccionContexto(null);
    setHayRutas(null);
    const params = new URLSearchParams(searchParams);
    params.delete('idSeleccion');
    params.delete('idMatriz');
    setSearchParams(params, { replace: true });
  };

  const irHoy = () => {
    const hoy = hoyIso();
    setFecha(hoy);
    setPeriodoMes(hoy.slice(0, 7));
    setIdSeleccionActiva(null);
    setSeleccionContexto(null);
    setHayRutas(null);
    const params = new URLSearchParams(searchParams);
    params.delete('idSeleccion');
    params.delete('idMatriz');
    setSearchParams(params, { replace: true });
  };

  const moverPeriodo = (direccion: -1 | 1) => {
    const nuevaFecha =
      vista === 'mes'
        ? sumarMeses(fecha, direccion)
        : sumarDias(fecha, vista === 'dia' ? direccion : direccion * 7);
    setFecha(nuevaFecha);
    const nuevoMes = nuevaFecha.slice(0, 7);
    if (nuevoMes !== periodoMes) {
      setPeriodoMes(nuevoMes);
      setIdSeleccionActiva(null);
      setSeleccionContexto(null);
      setHayRutas(null);
      const params = new URLSearchParams(searchParams);
      params.delete('idSeleccion');
      params.delete('idMatriz');
      setSearchParams(params, { replace: true });
    }
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

  const crearTallerDesdeVisitaSinTaller = (visita: VisitaSinTaller) => {
    const existente = items.find((item) => item.idRutaVisita === visita.idRutaVisita);
    if (existente) {
      setCrearTallerItem(existente);
      return;
    }

    setCrearTallerItem({
      idRutaVisita: visita.idRutaVisita,
      idRuta: visita.idRuta,
      idSeleccionMensual: seleccionContexto?.idSeleccionMensual ?? 0,
      idTaller: null,
      idSeleccionHospital: null,
      idHospital: visita.idHospital,
      hospital: visita.hospital,
      region: visita.region,
      gerencia: matrizPeriodo?.gerencia ?? '',
      estadoRuta: visita.estadoRuta ?? '',
      institucion: null,
      ciudadMunicipio: null,
      entidadFederativa: null,
      fecha: visita.fechaVisita,
      orden: 0,
      hora: null,
      idEjecutivo: visita.idEjecutivo,
      nombreEjecutivo: visita.nombreEjecutivo,
      idEspecialista: visita.idEspecialista,
      nombreEspecialista: visita.nombreEspecialista,
      idTipoVisita: null,
      tipoVisita: 'Taller',
      tema: null,
      producto: null,
      cantidad: null,
      costo: null,
      participantes: null,
      estado: 'SinTaller',
      esExtraordinario: false,
      bloqueado: false,
      solicitudCambioPendiente: false,
      conflictos: [],
    });
  };

  const verVisitaSinTaller = (visita: VisitaSinTaller) => {
    setFecha(visita.fechaVisita);
    setPeriodoMes(visita.fechaVisita.slice(0, 7));
    setVista('dia');
    setModo('calendario');
    setSeleccionadoId(visita.idRutaVisita);
    setSeleccionadoTallerId(null);
    const params = new URLSearchParams(searchParams);
    params.set('vista', 'dia');
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
    tabPersonas === 'ejecutivos'
      ? [...ejecutivos]
          .sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario))
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

  const totalPersonasRail = personasRail.reduce((total, persona) => total + persona.total, 0);

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

  const abrirDia = (dia: string) => {
    setFecha(dia);
    setVista('dia');
    setModo('calendario');
    actualizarVistaQuery('calendario', 'dia');
  };

  const cambiarVista = (nueva: VistaCalendario) => {
    setVista(nueva);
    setModo('calendario');
    actualizarVistaQuery('calendario', nueva);
  };

  const ayudaVista =
    modo === 'tabla'
      ? 'Tabla operativa del periodo · ordena y abre cualquier fila para revisar el detalle.'
      : modo === 'resumen'
        ? 'Resumen operativo por gerencia y ejecutivo · solo lectura para comparar la carga.'
        : modo === 'matriz'
          ? 'Matriz general del periodo · documento de autorización, costos y cobertura de talleres.'
          : vista === 'dia'
          ? 'Agenda diaria · arrastra un taller para reprogramarlo.'
          : vista === 'semana'
            ? 'Semana de trabajo · arrastra un taller para moverlo de día.'
            : vista === 'mes'
              ? 'Vista mensual · doble clic en un día para abrir su agenda.'
              : vista === 'especialista'
                ? 'Carga por especialista · selecciona una persona para filtrar la agenda.'
                : 'Carga por ejecutivo · selecciona una persona para filtrar la agenda.';

  const hayFiltros =
    busqueda.trim() !== '' ||
    filtroRapido !== 'todos' ||
    idGerencia !== TODOS ||
    idRegion !== TODOS ||
    idEspecialista !== TODOS ||
    idEjecutivo !== TODOS ||
    estado !== TODOS;

  const chipsFiltros = [
    ...(filtroRapido !== 'todos'
      ? [
          {
            key: 'rapido',
            label: ETIQUETAS_FILTRO_RAPIDO[filtroRapido],
            clear: () => cambiarFiltroRapido('todos'),
          },
        ]
      : []),
    ...(idGerencia !== TODOS
      ? [
          {
            key: 'gerencia',
            label:
              gerencias.find((gerencia) => String(gerencia.idTipoGerencia) === idGerencia)
                ?.descripcion ?? 'Gerencia',
            clear: () => setIdGerencia(TODOS),
          },
        ]
      : []),
    ...(idRegion !== TODOS
      ? [
          {
            key: 'region',
            label:
              regionesDisponibles.find((region) => String(region.idRegion) === idRegion)?.nombre ??
              'Región',
            clear: () => setIdRegion(TODOS),
          },
        ]
      : []),
    ...(idEjecutivo !== TODOS
      ? [
          {
            key: 'ejecutivo',
            label:
              ejecutivos.find((ejecutivo) => String(ejecutivo.idUsuario) === idEjecutivo)
                ?.nombreUsuario ?? 'Ejecutivo',
            clear: () => setIdEjecutivo(TODOS),
          },
        ]
      : []),
    ...(idEspecialista !== TODOS
      ? [
          {
            key: 'especialista',
            label:
              especialistas.find(
                (especialista) => String(especialista.idUsuario) === idEspecialista
              )?.nombreUsuario ?? 'Especialista',
            clear: () => setIdEspecialista(TODOS),
          },
        ]
      : []),
    ...(estado !== TODOS
      ? [
          {
            key: 'estado',
            label: ESTADOS.find((opcion) => opcion.valor === estado)?.etiqueta ?? 'Estado',
            clear: () => setEstado(TODOS),
          },
        ]
      : []),
    ...(busqueda.trim()
      ? [{ key: 'busqueda', label: `Buscar: ${busqueda.trim()}`, clear: () => setBusqueda('') }]
      : []),
  ];

  const contenidoFiltros = (
    <CalendarioFiltros
      todos={TODOS}
      mostrarResponsables={puedeVerTodas}
      periodoLabel={
        idSeleccionParam ? `Selección #${idSeleccionParam}` : etiquetaPeriodo(fecha, vista)
      }
      idGerencia={idGerencia}
      gerencias={gerencias}
      onGerenciaChange={cambiarGerencia}
      idRegion={idRegion}
      regiones={regionesDisponibles}
      onRegionChange={setIdRegion}
      idEjecutivo={idEjecutivo}
      ejecutivos={ejecutivos}
      onEjecutivoChange={setIdEjecutivo}
      idEspecialista={idEspecialista}
      especialistas={especialistas}
      onEspecialistaChange={setIdEspecialista}
      estado={estado}
      estados={ESTADOS}
      onEstadoChange={setEstado}
    />
  );

  return (
    <div className="space-y-5 pb-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">Calendario</h1>
          <p className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.035em] text-slate-900 dark:text-slate-100">
            {seleccionContexto
              ? `${seleccionContexto.tipoGerencia ?? 'Gerencia'} · ${MESES[Number(periodoMes.slice(5, 7)) - 1]} ${periodoMes.slice(0, 4)}`
              : 'Planeación de visitas y talleres'}
          </p>
          {seleccionContexto ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{seleccionContexto.hospitales.length} hospitales</span>
              <span>·</span>
              <span>{seleccionContexto.regiones.length} regiones</span>
              <span>·</span>
              <span>{rutasGeneradas ? 'Rutas generadas' : 'Sin rutas'}</span>
              <span>·</span>
              <span>{seleccionContexto.estado}</span>
              <Link
                to={`/educacion-medica/seleccion?idSeleccion=${seleccionContexto.idSeleccionMensual}`}
                className="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-300"
              >
                Ver selección
              </Link>
            </div>
          ) : (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              No hay selección mensual para {MESES[Number(periodoMes.slice(5, 7)) - 1]}{' '}
              {periodoMes.slice(0, 4)}. Puedes revisar el calendario o crear una selección.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-card px-1 dark:border-slate-800">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => cambiarMes(sumarMeses(`${periodoMes}-01`, -1).slice(0, 7))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
            <Input
              type="month"
              value={periodoMes}
              onChange={(event) => cambiarMes(event.target.value)}
              className="h-7 w-[176px] border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0"
              aria-label="Mes del calendario"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => cambiarMes(sumarMeses(`${periodoMes}-01`, 1).slice(0, 7))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {idSeleccionActiva && seleccionContexto?.estado === 'Cerrada' && puedeGestionarRutas && (
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={() => setModalGenerar(true)}
            >
              <Route className="h-3.5 w-3.5" />
              {rutasGeneradas ? 'Regenerar propuesta' : 'Generar propuesta'}
            </Button>
          )}
          {puedeCotizar && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl border-emerald-200 bg-emerald-50/60 px-3 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              onClick={() => setRutaCotizarAbierta(true)}
              disabled={cotizacionBloqueada}
              title={
                cotizacionBloqueada
                  ? `No se puede cotizar una versión ${estadoVersionSeleccionada}. Selecciona una versión vigente.`
                  : undefined
              }
            >
              <Plane className="h-3.5 w-3.5" />
              Cotizar viáticos
            </Button>
          )}
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

      {idSeleccionActiva && versionesDisponibles.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Planeación de rutas
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Consulta la versión publicada, su estado y las acciones disponibles.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={versionRuta != null ? String(versionRuta) : undefined}
                onValueChange={(valor) => setVersionRuta(Number(valor))}
              >
                <SelectTrigger className="h-8 w-[190px] rounded-lg border-slate-200 bg-card text-[11px] dark:border-slate-800">
                  <SelectValue placeholder="Versión de rutas" />
                </SelectTrigger>
                <SelectContent>
                  {versionesDisponibles.map(([version, estado]) => (
                    <SelectItem key={version} value={String(version)}>
                      v{version} · {estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {versionInfoActual && (
            <DocumentoHeaderCard
              titulo={`Rutas v${versionInfoActual.version}`}
              pasoNombre={versionInfoActual.pasoNombre}
              estadoNombre={versionInfoActual.estadoNombre}
              estadoColor={versionInfoActual.estadoColor}
              estadoFallback={versionInfoActual.estado}
              detalle={`${seleccionContexto?.tipoGerencia ?? 'Sin gerencia'} · ${MESES[Number(periodoMes.slice(5, 7)) - 1]} ${periodoMes.slice(0, 4)}`}
              showFirmar={accionesModalRutas.length > 0}
              textoFirmar={accionEnviarRutas ? 'Enviar a autorización' : 'Firmar'}
              tipoAccion={accionEnviarRutas ? 'enviar' : 'firmar'}
              onFirmar={() => setModalFirma(true)}
              firmando={guardandoWorkflow}
              firmarDeshabilitado={hasFirma === false}
              showHistorial
              onHistorial={() => setModalHistorial(true)}
            />
          )}
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-card p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 xl:inline-flex"
            onClick={() => setPanelLateralAbierto((abierto) => !abierto)}
            aria-label={panelLateralAbierto ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
            title={panelLateralAbierto ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          >
            {panelLateralAbierto ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
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

          {matrizPeriodo && (
            <Badge
              variant="outline"
              className={
                capturaBloqueada
                  ? 'rounded-full border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300'
                  : 'rounded-full border-emerald-300 text-[10px] text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
              }
              title="Estado de captura de los talleres de la matriz"
            >
              {capturaBloqueada ? 'Captura cerrada' : 'Captura abierta'}
            </Badge>
          )}

          {modo === 'calendario' && (
            <div className="hidden flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1 dark:bg-slate-900/60 xl:flex">
              {VISTAS.map((opcion) => {
                const Icono = opcion.icono;
                const activo = vista === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    title={AYUDA_VISTA[opcion.valor]}
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
          {modo === 'calendario' && (
            <AyudaContextual titulo="Vistas del calendario">
              <ul className="list-disc space-y-1 pl-4">
                <li>Semana: lunes a viernes con horarios y capacidad.</li>
                <li>Mes: doble clic en un día para abrir su agenda.</li>
                <li>Especialista: carga y visitas de cada especialista.</li>
                <li>Ejecutivo: carga de cada dueño de hospital.</li>
                <li>Arrastra una tarjeta para reprogramarla.</li>
              </ul>
            </AyudaContextual>
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
          {idSeleccionActiva && sugerencias.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-orange-200 bg-orange-50/60 px-2.5 text-[11px] text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300 dark:hover:bg-orange-950/40"
              onClick={() => setSugerenciasAbiertas(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Sugerencias
              <Badge className="h-4 min-w-4 rounded-full bg-orange-200/70 px-1 text-[9px] text-orange-800 hover:bg-orange-200/70 dark:bg-orange-900 dark:text-orange-200">
                {sugerencias.length}
              </Badge>
            </Button>
          )}
          <Popover open={filtrosDesktopAbiertos} onOpenChange={setFiltrosDesktopAbiertos}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden h-8 gap-1.5 rounded-lg border-slate-200 bg-card px-2.5 text-[11px] md:inline-flex"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {filtrosActivos > 0 && (
                  <Badge className="h-4 min-w-4 rounded-full bg-orange-100 px-1 text-[9px] text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300">
                    {filtrosActivos}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[440px] p-3">
              {contenidoFiltros}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[11px] text-slate-500"
                  onClick={limpiarFiltros}
                  disabled={!hayFiltros}
                >
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-[#eb6c36] text-[11px] text-white hover:bg-[#d95a2b]"
                  onClick={() => setFiltrosDesktopAbiertos(false)}
                >
                  Ver resultados
                </Button>
              </div>
            </PopoverContent>
          </Popover>

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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-[11px] text-slate-500"
            onClick={limpiarFiltros}
            disabled={!hayFiltros}
          >
            <FilterX className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        </div>
      </section>

      {chipsFiltros.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5">
          {chipsFiltros.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-card px-2 py-1 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              onClick={chip.clear}
              aria-label={`Quitar filtro ${chip.label}`}
            >
              {chip.label}
              <FilterX className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}

      <ResumenCalendario
        total={metricas.total}
        talleres={metricas.talleres}
        conflictos={metricas.conflictos}
        sinResponsable={metricas.sinResponsable}
        onVerConflictos={() => cambiarFiltroRapido('conflictos')}
      />

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
            modo === 'matriz'
              ? 'xl:grid-cols-[minmax(0,1fr)]'
              : modo === 'calendario' && panelLateralAbierto
                ? 'xl:grid-cols-[228px_minmax(0,1fr)_324px]'
                : 'xl:grid-cols-[minmax(0,1fr)_324px]',
          ].join(' ')}
        >
        {modo === 'calendario' && panelLateralAbierto && (
          <aside className="hidden space-y-4 xl:block">
            {seleccionContexto ? (
              <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Selección del mes
                  </p>
                  <Badge variant="secondary" className="rounded-full text-[9px]">
                    {seleccionContexto.estado}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                  {seleccionContexto.tipoGerencia ?? 'Gerencia'} ·{' '}
                  {MESES[Number(periodoMes.slice(5, 7)) - 1]}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60">
                    <p className="text-slate-400">Hospitales</p>
                    <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {seleccionContexto.hospitales.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60">
                    <p className="text-slate-400">Regiones</p>
                    <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {seleccionContexto.regiones.length}
                    </p>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <Route className="h-3 w-3" />
                  {rutasGeneradas ? 'Rutas generadas' : 'Sin rutas generadas'}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 w-full justify-between rounded-lg text-[10px]"
                >
                  <Link
                    to={`/educacion-medica/seleccion?idSeleccion=${seleccionContexto.idSeleccionMensual}`}
                  >
                    Ver selección
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-card p-4 text-center dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Selección del mes
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Sin selección para {MESES[Number(periodoMes.slice(5, 7)) - 1]}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 rounded-lg text-[10px]"
                >
                  <Link to="/educacion-medica/seleccion">Crear o revisar selección</Link>
                </Button>
              </div>
            )}
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

            {puedeVerTodas && (
              <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Responsables
                  </p>
                  <Sparkles className="h-3 w-3 text-orange-400" />
                </div>
                <Tabs
                  value={tabPersonas}
                  onValueChange={(value) => setTabPersonas(value as 'ejecutivos' | 'especialistas')}
                  className="mt-2"
                >
                  <TabsList className="grid h-8 w-full grid-cols-2 rounded-lg bg-slate-50 p-0.5 dark:bg-slate-900/60">
                    <TabsTrigger
                      value="ejecutivos"
                      className="gap-1 rounded-md text-[10px] data-[state=active]:bg-card data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                    >
                      Ejecutivos
                      <span className="text-[9px] text-slate-400">{ejecutivos.length}</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="especialistas"
                      className="gap-1 rounded-md text-[10px] data-[state=active]:bg-card data-[state=active]:text-slate-800 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                    >
                      Especialistas
                      <span className="text-[9px] text-slate-400">{especialistas.length}</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="mt-2 max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
                  <RailPersona
                    nombre="Todos"
                    detalle={
                      tabPersonas === 'ejecutivos'
                        ? 'Sin filtro de ejecutivo'
                        : 'Sin filtro de especialista'
                    }
                    total={totalPersonasRail}
                    activo={
                      tabPersonas === 'ejecutivos'
                        ? idEjecutivo === TODOS
                        : idEspecialista === TODOS
                    }
                    onClick={() => {
                      if (tabPersonas === 'ejecutivos') setIdEjecutivo(TODOS);
                      else setIdEspecialista(TODOS);
                    }}
                  />
                  {personasRail.length === 0 ? (
                    <p className="px-2 py-3 text-[10px] text-slate-400">
                      Sin colaboradores activos.
                    </p>
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
            )}

            {!puedeVerTodas && (
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]">Mis visitas</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Solo se muestran las visitas en las que eres ejecutivo o especialista.
                </p>
              </div>
            )}

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
                    onClick={() => seleccionarItem(proximo)}
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
                    key={claveEvento(item)}
                    type="button"
                    onClick={() => seleccionarItem(item)}
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
            {modo === 'calendario' && vista !== 'mes' ? (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-card p-0.5 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => moverPeriodo(-1)}
                  aria-label="Periodo anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[154px] px-1 text-center text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {etiquetaPeriodo(fecha, vista)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => moverPeriodo(1)}
                  aria-label="Periodo siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-[10px]"
                  onClick={irHoy}
                >
                  Hoy
                </Button>
              </div>
            ) : (
              <p className="hidden text-[10px] text-slate-400 sm:block">{ayudaVista}</p>
            )}
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
            idSeleccionActiva && seleccionContexto?.estado === 'Cerrada' && hayRutas === false ? (
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
              onSelect={seleccionarItem}
            />
          ) : modo === 'resumen' ? (
            <CalendarioMatriz
              items={itemsFiltrados}
              seleccionadoId={seleccionadoId}
              onSelect={seleccionarItem}
              onAbrirMatriz={() => cambiarModo('matriz')}
            />
          ) : modo === 'matriz' ? (
            <MatrizPanel
              idGerencia={gerenciaMatrizId}
              periodo={periodoMes}
              matriz={matrizPeriodo}
              concentracion={matrizConcentracion}
              revision={matrizRevision}
              loading={matrizLoading}
              error={matrizError}
              onReload={recargarMatrizYCalendario}
              onCrearTallerParaVisita={crearTallerDesdeVisitaSinTaller}
              onVerVisita={verVisitaSinTaller}
              onVerCalendario={() => cambiarModo('calendario')}
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
                  onSelect={seleccionarItem}
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
                  onSelect={seleccionarItem}
                  onMover={(item, nuevaFecha) => void moverItem(item, nuevaFecha)}
                  onDiaDobleClick={abrirDia}
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
            'min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1',
            seleccionado ? '' : 'hidden xl:block',
            modo === 'matriz' ? 'hidden' : '',
          ].join(' ')}
        >
          <CalendarioInspector
            item={seleccionado}
            ejecutivos={ejecutivos}
            suplentes={suplentes}
            especialistas={especialistas}
            pendientes={itemsFiltrados.filter((item) => item.solicitudCambioPendiente)}
            sugerencia={sugerenciaSeleccionada}
            aplicandoSugerencia={asignandoSugerencia === seleccionadoId}
            onAplicarSugerencia={(sugerencia) => void asignarSugerencia(sugerencia)}
            onSelectItem={seleccionarItem}
            onClose={() => {
              setSeleccionadoId(null);
              setSeleccionadoTallerId(null);
            }}
            onRefresh={refrescarCalendario}
            onCrearTaller={setCrearTallerItem}
            capturaBloqueada={capturaBloqueada}
            onAbrirMatriz={() => cambiarModo('matriz')}
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

          {contenidoFiltros}

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

      <SugerenciasSheet
        open={sugerenciasAbiertas}
        onOpenChange={setSugerenciasAbiertas}
        sugerencias={sugerencias}
        asignandoId={asignandoSugerencia}
        asignandoLote={asignandoSugerencias}
        onAsignar={(sugerencia) => void asignarSugerencia(sugerencia)}
        onAsignarSeleccionadas={(seleccionadas) =>
          void asignarSugerenciasSeleccionadas(seleccionadas)
        }
      />

      {rutaCotizarAbierta && (
        <CotizarRutaModal
          rutas={rutasParaCotizar}
          onAbrirCotizacion={abrirCotizacion}
          onConfirm={confirmarCotizacionRuta}
          onClose={() => setRutaCotizarAbierta(false)}
        />
      )}

      <GenerarRutasModal
        open={modalGenerar}
        onOpenChange={setModalGenerar}
        seleccion={seleccionContexto}
        regenerar={rutasGeneradas}
        onGenerated={() => {
          setHayRutas(true);
          setRefrescoRutas((valor) => valor + 1);
          void cargar();
        }}
      />

      {versionInfoActual && (
        <DocumentoFirmaModal
          open={modalFirma}
          onClose={() => setModalFirma(false)}
          documento={`Rutas v${versionInfoActual.version}`}
          estadoTexto={versionInfoActual.estadoNombre ?? versionInfoActual.estado}
          pasoNombre={versionInfoActual.pasoNombre}
          tipo="rutas"
          idEntidad={versionInfoActual.idRutaVersion}
          idPasoActual={versionInfoActual.idPasoActual}
          acciones={accionesModalRutas}
          hasFirma={hasFirma ?? undefined}
          guardando={guardandoWorkflow}
          onConfirmar={(accion, comentario, datosAdicionales) =>
            firmarVersionRutas(accion, comentario, datosAdicionales)
          }
        />
      )}

      {versionInfoActual && (
        <DocumentoHistorialModal
          open={modalHistorial}
          onClose={() => setModalHistorial(false)}
          documento={`Rutas v${versionInfoActual.version}`}
          estadoTexto={versionInfoActual.estadoNombre ?? versionInfoActual.estado ?? 'Sin estado'}
          tipo="rutas"
          idEntidad={versionInfoActual.idRutaVersion}
          idWorkflow={versionInfoActual.idWorkflow}
          idPasoActual={versionInfoActual.idPasoActual}
        />
      )}

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
          setSeleccionadoTallerId(taller.idTaller);
          void cargar();
          void recargarMatriz();
        }}
      />
    </div>
  );
}
