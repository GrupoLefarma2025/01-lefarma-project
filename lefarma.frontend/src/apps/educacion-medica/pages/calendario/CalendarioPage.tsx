import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
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
  LockKeyhole,
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
import { usePageTitle } from '@/hooks/usePageTitle';
import { CalendarioFiltros } from './components/CalendarioFiltros';
import { CalendarioLeyenda } from './components/CalendarioLeyenda';
import { ResumenCalendario } from './components/ResumenCalendario';
import { ResponsableFiltro, type ResponsableGrupo, type TipoResponsable } from './components/ResponsableFiltro';
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
import { nombreSeleccion } from '../../components/seleccionUtils';
import type {
  CalendarioItem,
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  Region,
  Ruta,
  SeleccionDetalle,
  SeleccionMensual,
  SugerenciaEspecialista,
  SugerenciaEspecialistaCalendario,
  TipoGerencia,
  VisitaSinTaller,
} from '../../types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import {
  DIAS_SEMANA_LARGOS,
  MESES,
  etiquetaPeriodo,
  claveEvento,
  estiloGerencia,
  fechaCorta,
  fechaInicialCalendario,
  fechaLarga,
  fechaMedia,
  fmtHora,
  hoyIso,
  rangoVista,
  sumarDias,
  sumarMeses,
  tonoGerencia,
  type VistaCalendario,
} from './calendarioUtils';
import { CalendarioGrid } from './components/CalendarioGrid';
import { CalendarioTabla } from './components/CalendarioTabla';
import { CalendarioInspector } from './components/CalendarioInspector';
import { CrearTallerVisitaModal } from './components/CrearTallerVisitaModal';
import { GenerarRutasModal } from './components/GenerarRutasModal';
import { MatrizPanel } from './components/MatrizPanel';
import { useMatrizPeriodo } from './hooks/useMatrizPeriodo';

const TODOS = 'all';

const ETIQUETAS_ESTADO_SELECCION: Record<string, string> = {
  Creada: 'Creada',
  EnRevision: 'En revisión',
  Cerrada: 'Cerrada',
  Rechazada: 'Rechazada',
  Cancelada: 'Cancelada',
};

const ESTADOS_SELECCION_SIN_MATRIZ = new Set(['Cancelada', 'Rechazada']);

const puedeAbrirMatrizSeleccion = (seleccion: SeleccionMensual) =>
  !ESTADOS_SELECCION_SIN_MATRIZ.has(seleccion.estado);

const VISTAS_PERIODO: Array<{
  valor: VistaCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'dia', etiqueta: 'Día', icono: LayoutList },
  { valor: 'semana', etiqueta: 'Semana', icono: Columns3 },
  { valor: 'mes', etiqueta: 'Mes', icono: Grid2X2 },
];

const VISTAS_AGRUPACION: Array<{
  valor: VistaCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'especialista', etiqueta: 'Especialista', icono: UserRound },
  { valor: 'ejecutivo', etiqueta: 'Ejecutivo', icono: UsersRound },
];

const VISTAS = [...VISTAS_PERIODO, ...VISTAS_AGRUPACION];

const ESTADOS = [
  { valor: 'SinTaller', etiqueta: 'Sin taller' },
  { valor: 'Programado', etiqueta: 'Programado' },
  { valor: 'EnCurso', etiqueta: 'En curso' },
  { valor: 'Realizado', etiqueta: 'Realizado' },
  { valor: 'Cancelado', etiqueta: 'Cancelado' },
];

type ModoCalendario = 'calendario' | 'tabla' | 'matriz';

const AYUDA_VISTA: Record<VistaCalendario, string> = {
  dia: 'Agenda del día; arrastra un taller para reprogramarlo.',
  semana: 'Semana laboral con horarios, capacidad y visitas.',
  mes: 'Vista mensual; doble clic en un día para abrir su agenda.',
  especialista: 'Carga de visitas por especialista.',
  ejecutivo: 'Carga de visitas por ejecutivo.',
};

const MODOS: Array<{
  valor: ModoCalendario;
  etiqueta: string;
  icono: typeof CalendarDays;
}> = [
  { valor: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
  { valor: 'tabla', etiqueta: 'Tabla', icono: Table2 },
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
  const gerenciasInicializadas = useRef(false);
  const [idSeleccionActiva, setIdSeleccionActiva] = useState<number | null>(idSeleccionParam);

  const [fecha, setFecha] = useState(() => fechaDeepLinkInicial ?? fechaInicialCalendario());
  const [periodoMes, setPeriodoMes] = useState(() =>
    (fechaDeepLinkInicial ?? fechaInicialCalendario()).slice(0, 7)
  );
  const [vista, setVista] = useState<VistaCalendario>(() =>
    esVistaValida(vistaParam) ? vistaParam : 'semana'
  );
  const [modo, setModo] = useState<ModoCalendario>(() =>
    vistaParam === 'tabla' || vistaParam === 'matriz' ? vistaParam : 'calendario'
  );
  const navigate = useNavigate();
  const usuarioActual = useAuthStore((state) => state.user);
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
  const [idGerencias, setIdGerencias] = useState<string[]>([]);
  const multiGerencia = idGerencias.length !== 1;
  const [idRegion, setIdRegion] = useState(TODOS);
  const [idEspecialista, setIdEspecialista] = useState(TODOS);
  const [idEjecutivo, setIdEjecutivo] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);

  const [seleccionesMes, setSeleccionesMes] = useState<SeleccionMensual[]>([]);
  const [items, setItems] = useState<CalendarioItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [seleccionadoTallerId, setSeleccionadoTallerId] = useState<number | null>(null);
  const [crearTallerItem, setCrearTallerItem] = useState<CalendarioItem | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtrosDesktopAbiertos, setFiltrosDesktopAbiertos] = useState(false);
  const [panelLateralAbierto, setPanelLateralAbierto] = useState(false);
  const [tabResponsables, setTabResponsables] = useState<TipoResponsable>('especialistas');
  const [moviendo, setMoviendo] = useState(false);
  const [seleccionContexto, setSeleccionContexto] = useState<SeleccionDetalle | null>(null);
  const [seleccionGenerar, setSeleccionGenerar] = useState<SeleccionDetalle | null>(null);
  const [cargandoGenerar, setCargandoGenerar] = useState(false);
  const [gerenciaMatrizManual, setGerenciaMatrizManual] = useState<number | null>(null);
  const idMatrizParam = Number(searchParams.get('idMatriz')) || null;
  const gerenciaMatrizId =
    gerenciaMatrizManual ??
    (idGerencias.length === 1 ? Number(idGerencias[0]) : null);
  const {
    matriz: matrizPeriodo,
    concentracion: matrizConcentracion,
    revision: matrizRevision,
    loading: matrizLoading,
    error: matrizError,
    reload: recargarMatriz,
  } = useMatrizPeriodo(gerenciaMatrizId, periodoMes, idMatrizParam);
  const capturaBloqueada = matrizPeriodo ? !matrizPeriodo.esEditable : false;
  const talleresCapturados = matrizPeriodo?.totalTalleres ?? 0;
  const [hayRutas, setHayRutas] = useState<boolean | null>(null);
  const [rutasVersion, setRutasVersion] = useState<Ruta[]>([]);
  const [versionRuta, setVersionRuta] = useState<number | null>(null);
  const [refrescoRutas, setRefrescoRutas] = useState(0);
  const [modalGenerar, setModalGenerar] = useState(false);
  const [matrizPickerAbierto, setMatrizPickerAbierto] = useState(false);
  const [generarPickerAbierto, setGenerarPickerAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaEspecialistaCalendario[]>([]);
  const [sugerenciaContextual, setSugerenciaContextual] = useState<SugerenciaEspecialista | null>(
    null
  );
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [responsableFiltroAbierto, setResponsableFiltroAbierto] = useState(false);
  const [rutaCotizarAbierta, setRutaCotizarAbierta] = useState(false);
  const [asignandoSugerencia, setAsignandoSugerencia] = useState<number | null>(null);
  const [asignandoSugerencias, setAsignandoSugerencias] = useState(false);

  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoRegion[]>([]);
  const [suplentes, setSuplentes] = useState<EjecutivoSuplente[]>([]);
  const [especialistas, setEspecialistas] = useState<EspecialistaPersona[]>([]);
  const sinGerenciasActivas = gerencias.length > 0 && idGerencias.length === 0;
  const todasGerenciasActivas =
    gerencias.length > 0 &&
    gerencias.every((gerencia) => idGerencias.includes(String(gerencia.idTipoGerencia)));

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
    if (
      gerenciasInicializadas.current ||
      gerencias.length === 0 ||
      idGerencias.length > 0
    ) {
      return;
    }

    gerenciasInicializadas.current = true;
    setIdGerencias(gerencias.map((gerencia) => String(gerencia.idTipoGerencia)));
  }, [gerencias, idGerencias.length]);

  useEffect(() => {
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
        setSeleccionesMes(lista);
      })
      .catch(() => {
        if (!cancelado) setSeleccionesMes([]);
      });

    return () => {
      cancelado = true;
    };
  }, [periodoMes]);

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
  }, [idSeleccionActiva, puedeVerRutas, refrescoRutas]);

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

  const estadoVersionSeleccionada =
    versionRuta == null
      ? null
      : (versionesDisponibles.find(([version]) => version === versionRuta)?.[1] ?? null);

  const versionSoloLectura =
    !multiGerencia &&
    estadoVersionSeleccionada != null &&
    ['Archivada', 'Cancelada', 'Rechazada'].includes(estadoVersionSeleccionada);
  const puedeEditarCalendario = puedeGestionarRutas && !versionSoloLectura;

  const cotizacionBloqueada =
    estadoVersionSeleccionada != null && !esEstadoRutaCotizable(estadoVersionSeleccionada);

  const rango = useMemo(() => rangoVista(fecha, vista), [fecha, vista]);

  const seleccionesDelPeriodo = useMemo(
    () =>
      sinGerenciasActivas
        ? []
        : idGerencias.length === 0
          ? seleccionesMes
          : seleccionesMes.filter((seleccion) =>
              idGerencias.includes(String(seleccion.idTipoGerencia))
            ),
    [seleccionesMes, idGerencias, sinGerenciasActivas]
  );

  useEffect(() => {
    let cancelado = false;
    const seleccionesSugerencia = seleccionesDelPeriodo;

    if (!puedeVerRutas || seleccionesSugerencia.length === 0) {
      void Promise.resolve().then(() => {
        if (!cancelado) setSugerencias([]);
      });
      return () => {
        cancelado = true;
      };
    }

    void Promise.allSettled(
      seleccionesSugerencia.map(async (seleccion) => {
        const response = await educacionMedicaApi.calendario.sugerencias(
          seleccion.idSeleccionMensual,
          rango.desde,
          rango.hasta
        );
        if (!response.data.success) return [];

        return (response.data.data ?? []).map((sugerencia) => ({
          ...sugerencia,
          idSeleccionMensual: seleccion.idSeleccionMensual,
          idTipoGerencia: seleccion.idTipoGerencia,
          gerencia: seleccion.tipoGerencia ?? 'Gerencia',
        }));
      })
    ).then((resultados) => {
      if (cancelado) return;
      setSugerencias(
        resultados.flatMap((resultado) =>
          resultado.status === 'fulfilled' ? resultado.value : []
        )
      );
    });

    return () => {
      cancelado = true;
    };
  }, [
    puedeVerRutas,
    seleccionesDelPeriodo,
    rango.desde,
    rango.hasta,
    refrescoRutas,
  ]);

  const cargar = useCallback(async (versionOverride?: number | null) => {
    if (sinGerenciasActivas) {
      setItems([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);
    const version = versionOverride !== undefined ? versionOverride : versionRuta;
    try {
      const response = await educacionMedicaApi.calendario.getAll({
        idSeleccion: multiGerencia ? null : idSeleccionActiva,
        version: multiGerencia ? null : version,
        desde: rango.desde,
        hasta: rango.hasta,
        idGerencia: idGerencias.length === 1 ? Number(idGerencias[0]) : null,
        idGerencias: idGerencias.length > 0 ? idGerencias.map(Number) : undefined,
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
    idGerencias,
    idRegion,
    idEspecialista,
    idEjecutivo,
    estado,
    idSeleccionActiva,
    versionRuta,
    multiGerencia,
    sinGerenciasActivas,
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

  const recargarMatrizYCalendario = useCallback(
    async (versionOverride?: number | null) => {
      await Promise.all([recargarMatriz(), cargar(versionOverride)]);
    },
    [recargarMatriz, cargar]
  );

  const resumenSelecciones = useMemo(() => {
    const estados = new Map<string, number>();
    let totalHospitales = 0;
    let totalRegiones = 0;
    let conRutas = 0;

    for (const seleccion of seleccionesDelPeriodo) {
      totalHospitales += seleccion.totalHospitales;
      totalRegiones += seleccion.totalRegiones;
      if (seleccion.tieneRutas) conRutas += 1;
      estados.set(seleccion.estado, (estados.get(seleccion.estado) ?? 0) + 1);
    }

    return {
      totalHospitales,
      totalRegiones,
      conRutas,
      total: seleccionesDelPeriodo.length,
      estados: [...estados.entries()],
    };
  }, [seleccionesDelPeriodo]);

  const seleccionesCerradas = useMemo(
    () => seleccionesDelPeriodo.filter((seleccion) => seleccion.estado === 'Cerrada'),
    [seleccionesDelPeriodo]
  );

  const seleccionesConGerencia = useMemo(
    () => seleccionesDelPeriodo.filter((seleccion) => seleccion.idTipoGerencia != null),
    [seleccionesDelPeriodo]
  );

  const seleccionesMatrizDisponibles = useMemo(
    () => seleccionesConGerencia.filter(puedeAbrirMatrizSeleccion),
    [seleccionesConGerencia]
  );

  const regionesDisponibles = useMemo(
    () =>
      sinGerenciasActivas
        ? []
        : idGerencias.length === 0
          ? regiones
          : regiones.filter((region) =>
              idGerencias.includes(String(region.idTipoGerencia))
            ),
    [regiones, idGerencias, sinGerenciasActivas]
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

  const gerenciasPresentes = useMemo(() => {
    const mapa = new Map<string, { idTipoGerencia: number | null; nombre: string }>();
    for (const item of itemsFiltrados) {
      if (!item.gerencia) continue;
      const clave = item.idTipoGerencia == null ? item.gerencia : String(item.idTipoGerencia);
      if (!mapa.has(clave)) {
        mapa.set(clave, { idTipoGerencia: item.idTipoGerencia, nombre: item.gerencia });
      }
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [itemsFiltrados]);

  const opcionesGerencias = useMemo(() => {
    const base =
      gerencias.length > 0
        ? gerencias
            .map((gerencia) => ({
              idTipoGerencia: gerencia.idTipoGerencia,
              nombre: gerencia.descripcion,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        : gerenciasPresentes;

    if (puedeVerTodas) return base;

    const visibles = new Set(gerenciasPresentes.map((gerencia) => gerencia.idTipoGerencia));
    return base.filter((gerencia) => visibles.has(gerencia.idTipoGerencia));
  }, [gerencias, gerenciasPresentes, puedeVerTodas]);

  const seleccionado = useMemo(
    () =>
      items.find(
        (item) =>
          item.idRutaVisita === seleccionadoId &&
          (seleccionadoTallerId == null || item.idTaller === seleccionadoTallerId)
      ) ?? null,
    [items, seleccionadoId, seleccionadoTallerId]
  );

  const sugerenciaSeleccionada = useMemo(
    () => sugerencias.find((sugerencia) => sugerencia.idRutaVisita === seleccionadoId) ?? null,
    [sugerencias, seleccionadoId]
  );

  useEffect(() => {
    const idVisita = seleccionado?.idRutaVisita ?? null;
    const idSeleccionVisita = seleccionado?.idSeleccionMensual ?? null;
    let cancelado = false;
    if (
      !idSeleccionVisita ||
      !idVisita ||
      !seleccionado?.idEspecialista ||
      !puedeVerRutas
    ) {
      void Promise.resolve().then(() => {
        if (!cancelado) setSugerenciaContextual(null);
      });
      return () => {
        cancelado = true;
      };
    }
    void educacionMedicaApi.calendario
      .sugerencias(idSeleccionVisita, rango.desde, rango.hasta, idVisita)
      .then((response) => {
        if (cancelado) return;
        setSugerenciaContextual(response.data.success ? (response.data.data?.[0] ?? null) : null);
      })
      .catch(() => {
        if (!cancelado) setSugerenciaContextual(null);
      });

    return () => {
      cancelado = true;
    };
  }, [
    seleccionado?.idSeleccionMensual,
    seleccionado?.idRutaVisita,
    seleccionado?.idEspecialista,
    rango.desde,
    rango.hasta,
    puedeVerRutas,
    refrescoRutas,
  ]);

  const seleccionarItem = (item: CalendarioItem) => {
    setSeleccionadoId(item.idRutaVisita);
    setSeleccionadoTallerId(item.idTaller);
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
    setRutasVersion([]);
    setVersionRuta(null);
    const params = new URLSearchParams(searchParams);
    params.set('vista', 'mes');
    params.delete('idSeleccion');
    params.delete('idMatriz');
    setSearchParams(params, { replace: true });
  };

  const aplicarGerencias = (values: string[]) => {
    setIdGerencias(values);
    setIdRegion(TODOS);
    setIdSeleccionActiva(null);
    setSeleccionContexto(null);
    setGerenciaMatrizManual(null);
    setSeleccionGenerar(null);
    setHayRutas(null);
    setRutasVersion([]);
    setVersionRuta(null);
    const params = new URLSearchParams(searchParams);
    params.delete('idSeleccion');
    params.delete('idMatriz');
    setSearchParams(params, { replace: true });
  };

  const cambiarGerencias = (values: string[]) => {
    aplicarGerencias(
      values.length > 0
        ? values
        : gerencias.map((gerencia) => String(gerencia.idTipoGerencia))
    );
  };

  const alternarGerencia = (idTipoGerencia: number) => {
    const valor = String(idTipoGerencia);
    aplicarGerencias(
      idGerencias.includes(valor)
        ? idGerencias.filter((gerencia) => gerencia !== valor)
        : [...idGerencias, valor]
    );
  };

  const abrirGenerar = async (seleccion: SeleccionMensual) => {
    setGenerarPickerAbierto(false);
    setCargandoGenerar(true);
    try {
      const response = await educacionMedicaApi.seleccionesMensuales.getById(
        seleccion.idSeleccionMensual
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message ?? 'No se pudo cargar la selección.');
      }
      setSeleccionGenerar(response.data.data);
      setModalGenerar(true);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar la selección.');
    } finally {
      setCargandoGenerar(false);
    }
  };

  const abrirMatriz = (seleccion: SeleccionMensual) => {
    if (seleccion.idTipoGerencia == null || !puedeAbrirMatrizSeleccion(seleccion)) return;
    setMatrizPickerAbierto(false);
    setGerenciaMatrizManual(seleccion.idTipoGerencia);
    setModo('matriz');
    const params = new URLSearchParams(searchParams);
    params.delete('idMatriz');
    params.set('vista', 'matriz');
    setSearchParams(params, { replace: true });
  };

  const irHoy = () => {
    const hoy = hoyIso();
    setFecha(hoy);
    setPeriodoMes(hoy.slice(0, 7));
    setIdSeleccionActiva(null);
    setSeleccionContexto(null);
    setGerenciaMatrizManual(null);
    setSeleccionGenerar(null);
    setHayRutas(null);
    setRutasVersion([]);
    setVersionRuta(null);
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
      setGerenciaMatrizManual(null);
      setSeleccionGenerar(null);
      setHayRutas(null);
      setRutasVersion([]);
      setVersionRuta(null);
      const params = new URLSearchParams(searchParams);
      params.delete('idSeleccion');
      params.delete('idMatriz');
      setSearchParams(params, { replace: true });
    }
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
    setResponsableFiltroAbierto(false);
    setIdGerencias(gerencias.map((gerencia) => String(gerencia.idTipoGerencia)));
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
      idTipoGerencia: matrizPeriodo?.idTipoGerencia ?? null,
      idTaller: null,
      tieneTalleres: false,
      talleresCount: 0,
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
      tipoVisita: 'Sin tipo',
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
    if (!puedeEditarCalendario) {
      toast.error(
        versionSoloLectura
          ? 'La versión archivada es de solo lectura.'
          : 'No tienes permiso para mover visitas.'
      );
      return;
    }
    if (item.estadoRuta !== 'Creada') {
      toast.error(
        'La ruta no está editable. Los ajustes de rutas cerradas se gestionan en otra fase.'
      );
      return;
    }
    if (item.tieneTalleres) {
      toast.error('La visita tiene talleres. Ajusta o elimina los talleres antes de reprogramarla.');
      return;
    }
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

  const gruposResponsables = useMemo(() => {
    const incluirGerencia = (idTipoGerencia: number | null) => {
      if (sinGerenciasActivas) return false;
      if (idGerencias.length === 0) return true;
      return idTipoGerencia != null && idGerencias.includes(String(idTipoGerencia));
    };

    const ordenarGrupos = (grupos: ResponsableGrupo[]) =>
      grupos.sort((a, b) => {
        if (a.idTipoGerencia == null) return 1;
        if (b.idTipoGerencia == null) return -1;
        return a.nombreGerencia.localeCompare(b.nombreGerencia);
      });

    const ejecutivosPorGerencia = new Map<string, ResponsableGrupo>();
    for (const ejecutivo of ejecutivos) {
      if (!incluirGerencia(ejecutivo.idTipoGerencia)) continue;
      const clave = String(ejecutivo.idTipoGerencia);
      const grupo =
        ejecutivosPorGerencia.get(clave) ?? {
          idTipoGerencia: ejecutivo.idTipoGerencia,
          nombreGerencia: ejecutivo.nombreGerencia,
          personas: [],
        };
      if (!grupo.personas.some((persona) => persona.id === ejecutivo.idUsuario)) {
        grupo.personas.push({
          id: ejecutivo.idUsuario,
          nombre: ejecutivo.nombreUsuario,
          detalle: ejecutivo.nombreRegion,
          total: conteoEjecutivos.get(ejecutivo.idUsuario) ?? 0,
        });
      }
      ejecutivosPorGerencia.set(clave, grupo);
    }

    const especialistasPorGerencia = new Map<string, ResponsableGrupo>();
    for (const especialista of especialistas) {
      const gerencias = especialista.gerencias
        .filter((gerencia) => gerencia.activo)
        .map((gerencia) => ({
          idTipoGerencia: gerencia.idTipoGerencia as number | null,
          nombreGerencia: gerencia.nombreGerencia,
        }));
      if (gerencias.length === 0) {
        gerencias.push({ idTipoGerencia: null, nombreGerencia: 'Sin gerencia' });
      }

      for (const gerencia of gerencias) {
        if (!incluirGerencia(gerencia.idTipoGerencia)) continue;
        const clave = gerencia.idTipoGerencia == null ? 'sin-gerencia' : String(gerencia.idTipoGerencia);
        const grupo =
          especialistasPorGerencia.get(clave) ?? {
            idTipoGerencia: gerencia.idTipoGerencia,
            nombreGerencia: gerencia.nombreGerencia,
            personas: [],
          };
        if (!grupo.personas.some((persona) => persona.id === especialista.idUsuario)) {
          grupo.personas.push({
            id: especialista.idUsuario,
            nombre: especialista.nombreUsuario,
            detalle: especialista.regionPreferida?.nombreRegion ?? 'Sin región preferida',
            total: conteoEspecialistas.get(especialista.idUsuario) ?? 0,
          });
        }
        especialistasPorGerencia.set(clave, grupo);
      }
    }

    return {
      ejecutivos: ordenarGrupos([...ejecutivosPorGerencia.values()]).map((grupo) => ({
        ...grupo,
        personas: grupo.personas.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      })),
      especialistas: ordenarGrupos([...especialistasPorGerencia.values()]).map((grupo) => ({
        ...grupo,
        personas: grupo.personas.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      })),
    };
  }, [
    conteoEjecutivos,
    conteoEspecialistas,
    ejecutivos,
    especialistas,
    idGerencias,
    sinGerenciasActivas,
  ]);

  const idResponsableSeleccionado =
    tabResponsables === 'ejecutivos'
      ? idEjecutivo !== TODOS
        ? Number(idEjecutivo)
        : null
      : idEspecialista !== TODOS
        ? Number(idEspecialista)
        : null;

  const responsableActivoNombre = useMemo(() => {
    if (idEspecialista !== TODOS) {
      return (
        especialistas.find((especialista) => String(especialista.idUsuario) === idEspecialista)
          ?.nombreUsuario ?? 'Especialista'
      );
    }
    if (idEjecutivo !== TODOS) {
      return (
        ejecutivos.find((ejecutivo) => String(ejecutivo.idUsuario) === idEjecutivo)?.nombreUsuario ??
        'Ejecutivo'
      );
    }
    return null;
  }, [ejecutivos, especialistas, idEjecutivo, idEspecialista]);

  const abrirResponsableFiltro = () => {
    if (idEjecutivo !== TODOS) setTabResponsables('ejecutivos');
    else if (idEspecialista !== TODOS) setTabResponsables('especialistas');
    else setTabResponsables(vista === 'ejecutivo' ? 'ejecutivos' : 'especialistas');
    setResponsableFiltroAbierto(true);
  };

  const seleccionarResponsable = (id: number | null, tipo: TipoResponsable) => {
    if (tipo === 'ejecutivos') {
      setIdEjecutivo(id == null ? TODOS : String(id));
      setIdEspecialista(TODOS);
    } else {
      setIdEspecialista(id == null ? TODOS : String(id));
      setIdEjecutivo(TODOS);
    }
    setResponsableFiltroAbierto(false);
  };

  const filtrosActivos =
    (idGerencias.length > 0 && !todasGerenciasActivas ? 1 : 0) +
    [idRegion, idEjecutivo, idEspecialista, estado].filter((valor) => valor !== TODOS).length;

  const actualizarVistaQuery = (nuevoModo: ModoCalendario, nuevaVista: VistaCalendario) => {
    const params = new URLSearchParams(searchParams);
    params.set('vista', nuevoModo === 'calendario' ? nuevaVista : nuevoModo);
    setSearchParams(params, { replace: true });
  };

  const cambiarModo = (nuevo: ModoCalendario) => {
    if (nuevo === modo) return;
    if (nuevo !== 'matriz') setGerenciaMatrizManual(null);
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
    (idGerencias.length > 0 && !todasGerenciasActivas) ||
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
    ...(idGerencias.length > 0 && !todasGerenciasActivas
      ? [
          {
            key: 'gerencia',
            label:
              idGerencias
                .map(
                  (id) =>
                    gerencias.find((gerencia) => String(gerencia.idTipoGerencia) === id)
                      ?.descripcion
                )
                .filter(Boolean)
                .join(' · ') || 'Gerencia',
            clear: () =>
              setIdGerencias(gerencias.map((gerencia) => String(gerencia.idTipoGerencia))),
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
            label: `Ejecutivo: ${
              ejecutivos.find((ejecutivo) => String(ejecutivo.idUsuario) === idEjecutivo)
                ?.nombreUsuario ?? 'Ejecutivo'
            }`,
            clear: () => {
              setIdEjecutivo(TODOS);
              setIdEspecialista(TODOS);
            },
          },
        ]
      : []),
    ...(idEspecialista !== TODOS
      ? [
          {
            key: 'especialista',
            label: `Especialista: ${
              especialistas.find(
                (especialista) => String(especialista.idUsuario) === idEspecialista
              )?.nombreUsuario ?? 'Especialista'
            }`,
            clear: () => {
              setIdEspecialista(TODOS);
              setIdEjecutivo(TODOS);
            },
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
      ? [
          {
            key: 'busqueda',
            label: `Buscar: ${busqueda.trim()}`,
            clear: () => setBusqueda(''),
          },
        ]
      : []),
  ];

  const contenidoFiltros = (
    <CalendarioFiltros
      todos={TODOS}
      periodoLabel={
        multiGerencia
          ? etiquetaPeriodo(fecha, vista)
          : seleccionContexto
            ? nombreSeleccion(seleccionContexto.fechaSeleccion, seleccionContexto.tipoGerencia)
            : idSeleccionParam
              ? 'Selección mensual'
              : etiquetaPeriodo(fecha, vista)
      }
      idGerencias={idGerencias}
      gerencias={gerencias}
      onGerenciasChange={cambiarGerencias}
      idRegion={idRegion}
      regiones={regionesDisponibles}
      onRegionChange={setIdRegion}
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
          <p className="mt-2 text-[24px] font-semibold uppercase leading-tight tracking-[-0.035em] text-slate-900 dark:text-slate-100">
            {MESES[Number(periodoMes.slice(5, 7)) - 1]} {periodoMes.slice(0, 4)}
          </p>
          {resumenSelecciones.total > 0 || gerenciasPresentes.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              {resumenSelecciones.total > 0 ? (
                <>
                  <span>{resumenSelecciones.totalHospitales} hospitales</span>
                  <span>·</span>
                  <span>{resumenSelecciones.totalRegiones} regiones</span>
                  <span>·</span>
                  <span>
                    {resumenSelecciones.conRutas}/{resumenSelecciones.total} con rutas
                  </span>
                  <span>·</span>
                  {resumenSelecciones.estados.map(([estadoSeleccion, cantidad]) => (
                    <span key={estadoSeleccion} className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {cantidad} {ETIQUETAS_ESTADO_SELECCION[estadoSeleccion] ?? estadoSeleccion}
                    </span>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-300"
                      >
                        Ver selecciones
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[380px] p-2">
                      <div className="space-y-1">
                        {seleccionesDelPeriodo.map((seleccion) => (
                          <Link
                            key={seleccion.idSeleccionMensual}
                            to={`/educacion-medica/seleccion?idSeleccion=${seleccion.idSeleccionMensual}`}
                            className={[
                              'flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900',
                              seleccion.idSeleccionMensual === idSeleccionParam
                                ? 'bg-orange-50/70 dark:bg-orange-950/20'
                                : '',
                            ].join(' ')}
                          >
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: seleccion.estadoColor ?? '#94a3b8' }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {seleccion.tipoGerencia ?? 'Gerencia'}
                              </span>
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                {seleccion.totalHospitales} hospitales · {seleccion.totalRegiones} regiones ·{' '}
                                {seleccion.tieneRutas ? 'Con rutas' : 'Sin rutas'}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {ETIQUETAS_ESTADO_SELECCION[seleccion.estado] ?? seleccion.estado}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <span>
                  {gerenciasPresentes.length} gerencia(s) · {itemsFiltrados.length} actividad(es) en el periodo.
                </span>
              )}
            </div>
          ) : null}
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
          {modo === 'matriz' ? (
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-xl bg-[#eb6c36] px-3 text-[11px] text-white hover:bg-[#d95a2b]"
              onClick={() => cambiarModo('calendario')}
            >
              <Presentation className="h-3.5 w-3.5" />
              Volver al calendario
            </Button>
          ) : (
            <Popover open={matrizPickerAbierto} onOpenChange={setMatrizPickerAbierto}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl bg-[#eb6c36] px-3 text-[11px] text-white hover:bg-[#d95a2b]"
                  disabled={seleccionesConGerencia.length === 0}
                  title={
                    seleccionesConGerencia.length === 0
                      ? 'No hay selecciones para abrir la matriz'
                      : undefined
                  }
                >
                  <Presentation className="h-3.5 w-3.5" />
                  Abrir matriz
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] p-2">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Matriz por gerencia
                </p>
                <div className="space-y-1">
                  {seleccionesConGerencia.map((seleccion) => {
                    const habilitada = puedeAbrirMatrizSeleccion(seleccion);
                    return (
                      <button
                        key={seleccion.idSeleccionMensual}
                        type="button"
                        disabled={!habilitada}
                        title={
                          habilitada
                            ? undefined
                            : 'La selección está cancelada o rechazada; no se puede abrir la matriz'
                        }
                        className={[
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                          habilitada
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-900'
                            : 'cursor-not-allowed opacity-50',
                        ].join(' ')}
                        onClick={() => habilitada && abrirMatriz(seleccion)}
                      >
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                          {seleccion.tipoGerencia ?? 'Gerencia'}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          {!habilitada && <LockKeyhole className="h-3 w-3" />}
                          {ETIQUETAS_ESTADO_SELECCION[seleccion.estado] ?? seleccion.estado}
                        </span>
                      </button>
                    );
                  })}
                  {seleccionesMatrizDisponibles.length === 0 && (
                    <p className="px-2 py-2 text-[10px] text-slate-400">
                      No hay matrices disponibles para este periodo. Las selecciones canceladas
                      o rechazadas se muestran solo como referencia.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {puedeGestionarRutas && (
            <Popover open={generarPickerAbierto} onOpenChange={setGenerarPickerAbierto}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  disabled={seleccionesCerradas.length === 0 || cargandoGenerar}
                  title={
                    seleccionesCerradas.length === 0
                      ? 'No hay selecciones cerradas para generar rutas'
                      : undefined
                  }
                >
                  {cargandoGenerar ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Route className="h-3.5 w-3.5" />
                  )}
                  Generar propuesta
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-2">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Selección para rutas
                </p>
                <div className="space-y-1">
                  {seleccionesCerradas.map((seleccion) => (
                    <button
                      key={seleccion.idSeleccionMensual}
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => void abrirGenerar(seleccion)}
                      disabled={cargandoGenerar}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                          {seleccion.tipoGerencia ?? 'Gerencia'}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {seleccion.tieneRutas ? 'Regenerar propuesta' : 'Generar propuesta'}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {seleccion.totalHospitales} hospitales
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {puedeCotizar && !multiGerencia && (
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

      {!multiGerencia && idSeleccionActiva && versionesDisponibles.length > 0 && (
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
        </section>
      )}

      {versionSoloLectura && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Estás viendo la versión v{versionRuta} {estadoVersionSeleccionada?.toLowerCase()}. Es
            de solo lectura: cambia a la versión activa para editar visitas o talleres.
          </span>
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-card p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="px-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Formato
            </span>
            <div
              className="flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/40"
              role="group"
              aria-label="Formato de visualización"
            >
              {MODOS.map((opcion) => {
                const Icono = opcion.icono;
                const activo = modo === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    onClick={() => cambiarModo(opcion.valor)}
                    aria-pressed={activo}
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="px-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Periodo
            </span>
            <div
              className={[
                'flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/40',
                modo !== 'calendario' ? 'opacity-50' : '',
              ].join(' ')}
              role="group"
              aria-label="Periodo del calendario"
            >
              {VISTAS_PERIODO.map((opcion) => {
                const Icono = opcion.icono;
                const activo = modo === 'calendario' && vista === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    title={
                      modo === 'calendario'
                        ? AYUDA_VISTA[opcion.valor]
                        : 'Disponible en la vista Calendario'
                    }
                    disabled={modo !== 'calendario'}
                    aria-pressed={activo}
                    onClick={() => cambiarVista(opcion.valor)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed',
                      activo
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                        : 'text-slate-500 hover:text-slate-800 disabled:text-slate-400 dark:text-slate-400 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icono className="h-3.5 w-3.5" />
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="px-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Agrupación
            </span>
            <div
              className={[
                'flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/40',
                modo !== 'calendario' ? 'opacity-50' : '',
              ].join(' ')}
              role="group"
              aria-label="Agrupación del calendario"
            >
              {VISTAS_AGRUPACION.map((opcion) => {
                const Icono = opcion.icono;
                const activo = modo === 'calendario' && vista === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    title={
                      modo === 'calendario'
                        ? AYUDA_VISTA[opcion.valor]
                        : 'Disponible en la vista Calendario'
                    }
                    disabled={modo !== 'calendario'}
                    aria-pressed={activo}
                    onClick={() => cambiarVista(opcion.valor)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed',
                      activo
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                        : 'text-slate-500 hover:text-slate-800 disabled:text-slate-400 dark:text-slate-400 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icono className="h-3.5 w-3.5" />
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar hospital, región…"
              className="h-8 rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sugerencias.length > 0 && (
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
          {puedeVerTodas && (
            <ResponsableFiltro
              abierto={responsableFiltroAbierto}
              onAbiertoChange={(abierto) => {
                if (!abierto) {
                  setResponsableFiltroAbierto(false);
                  return;
                }
                abrirResponsableFiltro();
              }}
              tipo={tabResponsables}
              onTipoChange={setTabResponsables}
              grupos={gruposResponsables[tabResponsables]}
              idSeleccionado={idResponsableSeleccionado}
              onSeleccionar={seleccionarResponsable}
              ejecutivosCount={ejecutivos.length}
              especialistasCount={especialistas.length}
              activoNombre={responsableActivoNombre}
            />
          )}
          <Popover open={filtrosDesktopAbiertos} onOpenChange={setFiltrosDesktopAbiertos}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative hidden h-8 w-8 rounded-lg border-slate-200 bg-card md:inline-flex"
                aria-label="Filtros"
                title="Filtros"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {filtrosActivos > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-orange-100 px-1 text-[9px] text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300">
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
            size="icon"
            className="relative h-8 w-8 rounded-lg border-slate-200 bg-card md:hidden"
            onClick={() => setFiltrosAbiertos(true)}
            aria-label="Filtros"
            title="Filtros"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {filtrosActivos > 0 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-orange-100 px-1 text-[9px] text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300">
                {filtrosActivos}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-500"
            onClick={limpiarFiltros}
            disabled={!hayFiltros}
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
          >
            <FilterX className="h-3.5 w-3.5" />
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

      {opcionesGerencias.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-card px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-x-auto pb-0.5">
            <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Gerencias
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {opcionesGerencias.map((gerencia) => {
              const id = gerencia.idTipoGerencia;
              const activa =
                gerencias.length === 0
                  ? true
                  : id != null && idGerencias.includes(String(id));
              const estilo = estiloGerencia[
                tonoGerencia({
                  idTipoGerencia: id,
                  gerencia: gerencia.nombre,
                })
              ];
              return (
                <button
                  key={`${id ?? 'sin-id'}-${gerencia.nombre}`}
                  type="button"
                  disabled={id == null}
                  onClick={() => id != null && alternarGerencia(id)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all',
                    activa
                      ? 'border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500',
                  ].join(' ')}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${activa ? estilo.punto : 'bg-slate-300'}`} />
                  {gerencia.nombre}
                </button>
              );
            })}
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400">
              Activa o desactiva su visibilidad
            </span>
          </div>
        </div>
      )}

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
            {seleccionesDelPeriodo.length > 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Selecciones del mes
                  </p>
                  <Badge variant="secondary" className="rounded-full text-[9px]">
                    {resumenSelecciones.total}
                  </Badge>
                </div>

                {resumenSelecciones.total === 1 ? (
                  <>
                    <p className="mt-2 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                      {seleccionesDelPeriodo[0].tipoGerencia ?? 'Gerencia'} — {MESES[Number(periodoMes.slice(5, 7)) - 1]}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60">
                        <p className="text-slate-400">Hospitales</p>
                        <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {seleccionesDelPeriodo[0].totalHospitales}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60">
                        <p className="text-slate-400">Regiones</p>
                        <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {seleccionesDelPeriodo[0].totalRegiones}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <Route className="h-3 w-3" />
                      {seleccionesDelPeriodo[0].tieneRutas ? 'Rutas generadas' : 'Sin rutas generadas'}
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 w-full justify-between rounded-lg text-[10px]"
                    >
                      <Link
                        to={`/educacion-medica/seleccion?idSeleccion=${seleccionesDelPeriodo[0].idSeleccionMensual}`}
                      >
                        Ver selección
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                      {resumenSelecciones.total} selecciones en {MESES[Number(periodoMes.slice(5, 7)) - 1]}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {resumenSelecciones.estados.map(([estadoSeleccion, cantidad]) => (
                        <span
                          key={estadoSeleccion}
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400"
                        >
                          {cantidad} {ETIQUETAS_ESTADO_SELECCION[estadoSeleccion] ?? estadoSeleccion}
                        </span>
                      ))}
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 h-8 w-full justify-between rounded-lg text-[10px]"
                        >
                          Ver selecciones
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[360px] p-2">
                        <div className="space-y-1">
                          {seleccionesDelPeriodo.map((seleccion) => (
                            <Link
                              key={seleccion.idSeleccionMensual}
                              to={`/educacion-medica/seleccion?idSeleccion=${seleccion.idSeleccionMensual}`}
                              className={[
                                'flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900',
                                seleccion.idSeleccionMensual === idSeleccionParam
                                  ? 'bg-orange-50/70 dark:bg-orange-950/20'
                                  : '',
                              ].join(' ')}
                            >
                              <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: seleccion.estadoColor ?? '#94a3b8' }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                                  {seleccion.tipoGerencia ?? 'Gerencia'}
                                </span>
                                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                  {seleccion.totalHospitales} hospitales · {seleccion.totalRegiones} regiones ·{' '}
                                  {seleccion.tieneRutas ? 'Con rutas' : 'Sin rutas'}
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                {ETIQUETAS_ESTADO_SELECCION[seleccion.estado] ?? seleccion.estado}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-card p-4 text-center dark:border-slate-800">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Selecciones del mes
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {sinGerenciasActivas
                    ? 'Activa al menos una gerencia'
                    : `Sin selecciones para ${MESES[Number(periodoMes.slice(5, 7)) - 1]}`}
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
              {modo === 'calendario' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-7 gap-1.5 rounded-lg border-slate-200 bg-card px-2.5 text-[10px] xl:inline-flex"
                  onClick={() => setPanelLateralAbierto((abierto) => !abierto)}
                  aria-label={panelLateralAbierto ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
                  title={panelLateralAbierto ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
                >
                  {panelLateralAbierto ? (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  )}
                  {panelLateralAbierto ? 'Ocultar panel' : 'Mostrar panel'}
                </Button>
              )}
              <h2 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                {modo === 'tabla'
                  ? 'Tabla de actividades'
                  : modo === 'matriz'
                    ? 'Matriz operativa'
                    : vista === 'dia'
                      ? DIAS_SEMANA_LARGOS[(new Date(`${fecha}T00:00:00`).getDay() + 6) % 7]
                      : vista === 'mes'
                        ? MESES[Number(fecha.slice(5, 7)) - 1].toUpperCase()
                        : vista === 'especialista'
                          ? 'Carga por especialista'
                          : vista === 'ejecutivo'
                            ? 'Carga por ejecutivo'
                            : 'Semana de trabajo'}
              </h2>
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

          {modo === 'calendario' && (
            <CalendarioLeyenda puedeEditar={puedeEditarCalendario} />
          )}

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
                      onClick={() => {
                        const objetivo =
                          seleccionesDelPeriodo.find(
                            (seleccion) =>
                              seleccion.idSeleccionMensual === seleccionContexto.idSeleccionMensual
                          ) ?? seleccionesCerradas[0];
                        if (objetivo) void abrirGenerar(objetivo);
                      }}
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
            <CalendarioGrid
              vista={vista}
              fecha={fecha}
              items={itemsFiltrados}
              seleccionadoId={seleccionadoId}
              especialistas={especialistas}
              ejecutivos={ejecutivos}
              suplentes={suplentes}
              onSelect={seleccionarItem}
              puedeMover={puedeEditarCalendario}
              onMover={(item, nuevaFecha) => void moverItem(item, nuevaFecha)}
              onDiaDobleClick={abrirDia}
            />
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
            sugerencia={sugerenciaSeleccionada ?? sugerenciaContextual}
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
            soloLectura={multiGerencia && !puedeGestionarRutas}
            rutaSoloLectura={versionSoloLectura}
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
              Acota la agenda por gerencia, región o estado.
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
        onOpenChange={(abierto) => {
          setModalGenerar(abierto);
          if (!abierto) setSeleccionGenerar(null);
        }}
        seleccion={seleccionGenerar}
        regenerar={seleccionGenerar?.tieneRutas === true}
        talleresCapturados={
          seleccionGenerar?.idTipoGerencia === gerenciaMatrizId ? talleresCapturados : 0
        }
        onGenerated={() => {
          const idSeleccionGenerada = seleccionGenerar?.idSeleccionMensual;
          setSeleccionesMes((actuales) =>
            actuales.map((seleccion) =>
              seleccion.idSeleccionMensual === idSeleccionGenerada
                ? { ...seleccion, tieneRutas: true }
                : seleccion
            )
          );
          setSeleccionGenerar(null);
          setRefrescoRutas((valor) => valor + 1);
          void cargar();
          if (gerenciaMatrizId) void recargarMatriz();
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
          setSeleccionadoTallerId(taller.idTaller);
          void cargar();
          void recargarMatriz();
        }}
      />
    </div>
  );
}
